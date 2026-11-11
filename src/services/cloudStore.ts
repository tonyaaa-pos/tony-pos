import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  waitForPendingWrites,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, getCloudUser } from './firebase';
import type {
  ShopSettings,
  PaymentQrImage,
  MenuItem,
  MenuCategory,
  Table,
  TableZoneConfig,
  OptionGroup,
  Member,
  Bill,
  Shift,
  AppNotification,
  User,
} from '../types';
import { compressImageFile } from '../utils/imageCompressor';
import { generateSalt, hashPinWithSalt } from '../utils/crypto';

export interface ShopBundle {
  settings: ShopSettings;
  qrImages: PaymentQrImage[];
  logo?: string;
}

export interface RemoteShopData {
  settings: ShopSettings;
  qrImages: PaymentQrImage[];
  logo?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

const DEVICE_ID_KEY = 'kind_pos_device_id';

/**
 * Unique Device ID for conflict detection and echo cancellation
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'device_unknown';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'device_fallback';
  }
}

/**
 * Checks and compresses base64 data to stay under Firestore document limit (~700 KB)
 */
export async function ensureImageUnderLimit(
  base64Data: string,
  imageLabel: string,
  onWarning?: (msg: string) => void
): Promise<string | null> {
  if (!base64Data) return '';

  const approxBytes = new Blob([base64Data]).size;
  if (approxBytes <= 700 * 1024) {
    return base64Data;
  }

  // Attempt re-compression
  try {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });

    let compressed = await compressImageFile(file, 600, 0.75);
    if (new Blob([compressed]).size <= 700 * 1024) {
      return compressed;
    }

    compressed = await compressImageFile(file, 400, 0.6);
    if (new Blob([compressed]).size <= 700 * 1024) {
      return compressed;
    }
  } catch (err) {
    console.warn('[Image Compress Error]:', err);
  }

  const warningMsg = `รูปภาพ "${imageLabel}" มีขนาดเกิน 700 KB และไม่สามารถบีบอัดให้เล็กลงได้ ข้ามการอัปโหลดขึ้น Cloud`;
  if (onWarning) {
    onWarning(warningMsg);
  } else {
    console.warn(warningMsg);
  }
  return null;
}

// ==========================================
// 1. SHOP SETTINGS & QR IMAGES & LOGO
// ==========================================

export async function saveShopBundle(
  bundle: ShopBundle,
  onWarning?: (msg: string) => void
): Promise<void> {
  if (!db || !getCloudUser()) return;

  const deviceId = getDeviceId();
  const batch = writeBatch(db);

  // Settings
  const settingsRef = doc(db, 'shops', 'main', 'settings', 'shop');
  batch.set(
    settingsRef,
    {
      ...bundle.settings,
      logoUrl: bundle.logo !== undefined ? bundle.logo : (bundle.settings.logoUrl || ''),
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    },
    { merge: true }
  );

  // Logo Media
  if (bundle.logo !== undefined) {
    let logoData = bundle.logo;
    if (logoData && logoData.startsWith('data:')) {
      const checkedLogo = await ensureImageUnderLimit(logoData, 'โลโก้ร้าน', onWarning);
      logoData = checkedLogo ?? '';
    }
    const logoRef = doc(db, 'shops', 'main', 'media', 'logo');
    batch.set(
      logoRef,
      {
        logoUrl: logoData,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      },
      { merge: true }
    );
  }

  // QR Images diff
  const qrColRef = collection(db, 'shops', 'main', 'qrImages');
  try {
    const existingQrsSnap = await getDocs(qrColRef);
    const localQrIds = new Set(bundle.qrImages.map((q) => q.id));
    existingQrsSnap.forEach((docSnap) => {
      if (!localQrIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });
  } catch (err) {
    console.warn('[saveShopBundle] Could not diff existing QRs (offline):', err);
  }

  for (const qr of bundle.qrImages) {
    let imgData = qr.imageData;
    if (imgData && imgData.startsWith('data:')) {
      const checkedImg = await ensureImageUnderLimit(imgData, qr.label || 'QR ชำระเงิน', onWarning);
      if (checkedImg === null) continue;
      imgData = checkedImg;
    }
    const qrDocRef = doc(db, 'shops', 'main', 'qrImages', qr.id);
    batch.set(
      qrDocRef,
      {
        id: qr.id,
        label: qr.label || 'QR Code',
        imageData: imgData,
        isDefault: Boolean(qr.isDefault),
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function fetchRemoteShopBundle(): Promise<RemoteShopData | null> {
  if (!db || !getCloudUser()) return null;

  try {
    const settingsRef = doc(db, 'shops', 'main', 'settings', 'shop');
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return null;
    }

    const settingsData = settingsSnap.data() as ShopSettings & {
      updatedAt?: unknown;
      updatedBy?: string;
    };

    const qrColRef = collection(db, 'shops', 'main', 'qrImages');
    const qrSnap = await getDocs(qrColRef);
    const qrImages: PaymentQrImage[] = [];
    qrSnap.forEach((docSnap) => {
      const q = docSnap.data();
      if (q && q.id) {
        qrImages.push({
          id: q.id,
          label: q.label || 'QR Code',
          imageData: q.imageData || '',
          isDefault: Boolean(q.isDefault),
        });
      }
    });

    const logoRef = doc(db, 'shops', 'main', 'media', 'logo');
    const logoSnap = await getDoc(logoRef);
    const logoUrl = logoSnap.exists() ? (logoSnap.data().logoUrl as string) : settingsData.logoUrl || '';

    return {
      settings: {
        shopName: settingsData.shopName || '',
        address: settingsData.address || '',
        phone: settingsData.phone || '',
        taxId: settingsData.taxId || '',
        logoUrl: logoUrl,
        vatEnabled: Boolean(settingsData.vatEnabled),
        vatRate: Number(settingsData.vatRate ?? 7),
        vatInclusive: Boolean(settingsData.vatInclusive),
        serviceChargeEnabled: Boolean(settingsData.serviceChargeEnabled),
        serviceChargeRate: Number(settingsData.serviceChargeRate ?? 0),
        receiptHeader: settingsData.receiptHeader || '',
        receiptFooter: settingsData.receiptFooter || '',
        receiptPaperWidth: settingsData.receiptPaperWidth || '80mm',
        allowedPaymentMethods: settingsData.allowedPaymentMethods || ['cash', 'transfer'],
        pointsEarnRate: Number(settingsData.pointsEarnRate ?? 50),
        pointsRedeemRate: Number(settingsData.pointsRedeemRate ?? 1),
      },
      qrImages,
      logo: logoUrl,
      updatedAt: settingsData.updatedAt,
      updatedBy: settingsData.updatedBy,
    };
  } catch (err) {
    console.warn('[fetchRemoteShopBundle] Failed to fetch:', err);
    return null;
  }
}

export function subscribeShop(
  onChange: (remote: RemoteShopData) => void
): Unsubscribe {
  if (!db || !isFirebaseConfigured() || !getCloudUser()) {
    return () => {};
  }

  const deviceId = getDeviceId();
  const settingsRef = doc(db, 'shops', 'main', 'settings', 'shop');

  return onSnapshot(
    settingsRef,
    { includeMetadataChanges: true },
    async (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return;
      const data = snapshot.data();
      if (data.updatedBy === deviceId) return;

      const fullBundle = await fetchRemoteShopBundle();
      if (fullBundle) {
        onChange(fullBundle);
      }
    },
    (err) => console.warn('[subscribeShop Error]:', err)
  );
}

// ==========================================
// 2. MENU ITEMS & CATEGORIES
// ==========================================

export async function saveMenuItemRemote(item: MenuItem): Promise<void> {
  if (!db || !getCloudUser()) return;
  let image = item.image || '';
  if (image && image.startsWith('data:')) {
    const checked = await ensureImageUnderLimit(image, item.name);
    image = checked || '';
  }

  const ref = doc(db, 'shops', 'main', 'menuItems', item.id);
  await setDoc(
    ref,
    {
      ...item,
      image,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function deleteMenuItemRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'menuItems', id);
  await deleteDoc(ref);
}

export async function saveCategoryRemote(category: MenuCategory): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'categories', category.id);
  await setDoc(
    ref,
    {
      ...category,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function deleteCategoryRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'categories', id);
  await deleteDoc(ref);
}

// ==========================================
// 3. TABLES & ZONES
// ==========================================

export async function saveTableRemote(table: Table): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'tables', table.id);
  await setDoc(
    ref,
    {
      ...table,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function deleteTableRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'tables', id);
  await deleteDoc(ref);
}

export async function saveZoneRemote(zone: TableZoneConfig): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'zones', zone.id);
  await setDoc(
    ref,
    {
      ...zone,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function deleteZoneRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'zones', id);
  await deleteDoc(ref);
}

// ==========================================
// 4. OPTION PRESETS & MEMBERS
// ==========================================

export async function saveOptionPresetRemote(preset: OptionGroup): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'optionPresets', preset.id);
  await setDoc(
    ref,
    {
      ...preset,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function deleteOptionPresetRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'optionPresets', id);
  await deleteDoc(ref);
}

export async function saveMemberRemote(member: Member): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'members', member.id);
  await setDoc(
    ref,
    {
      ...member,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

// ==========================================
// 5. BILLS & MULTI-DOC ATOMIC TRANSACTIONS
// ==========================================

export async function saveBillRemote(bill: Bill): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'bills', bill.id);
  await setDoc(
    ref,
    {
      ...bill,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

/**
 * Atomic transaction/batch for bill completion, table releasing, and membership points
 */
export async function atomicPayBillAndReleaseTable(params: {
  bill: Bill;
  tableId?: string;
  isTableReleased: boolean;
  nextTableBillId?: string;
  memberUpdate?: { id: string; points: number; totalSpent: number };
}): Promise<void> {
  if (!db || !getCloudUser()) return;

  const batch = writeBatch(db);
  const deviceId = getDeviceId();

  // 1. Update Bill to paid
  const billRef = doc(db, 'shops', 'main', 'bills', params.bill.id);
  batch.set(
    billRef,
    {
      ...params.bill,
      status: 'paid',
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    },
    { merge: true }
  );

  // 2. Update Table status
  if (params.tableId) {
    const tableRef = doc(db, 'shops', 'main', 'tables', params.tableId);
    if (params.isTableReleased) {
      batch.update(tableRef, {
        status: 'available',
        currentBillId: null,
        seatedAt: null,
        guestCount: null,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      });
    } else if (params.nextTableBillId) {
      batch.update(tableRef, {
        status: 'occupied',
        currentBillId: params.nextTableBillId,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      });
    }
  }

  // 3. Update Member points & total spent if applicable
  if (params.memberUpdate) {
    const memberRef = doc(db, 'shops', 'main', 'members', params.memberUpdate.id);
    batch.update(memberRef, {
      points: params.memberUpdate.points,
      totalSpent: params.memberUpdate.totalSpent,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    });
  }

  await batch.commit();
}

/**
 * Atomic void bill and release table
 */
export async function atomicVoidBillAndReleaseTable(params: {
  bill: Bill;
  tableId?: string;
  isTableReleased: boolean;
}): Promise<void> {
  if (!db || !getCloudUser()) return;

  const batch = writeBatch(db);
  const deviceId = getDeviceId();

  const billRef = doc(db, 'shops', 'main', 'bills', params.bill.id);
  batch.set(
    billRef,
    {
      ...params.bill,
      status: 'voided',
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    },
    { merge: true }
  );

  if (params.tableId && params.isTableReleased) {
    const tableRef = doc(db, 'shops', 'main', 'tables', params.tableId);
    batch.update(tableRef, {
      status: 'available',
      currentBillId: null,
      seatedAt: null,
      guestCount: null,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    });
  }

  await batch.commit();
}

/**
 * On-demand loader for bills older than 30 days (avoids reading entire history in real-time)
 */
export async function fetchArchivedBills(beforeIsoDate: string): Promise<Bill[]> {
  if (!db || !getCloudUser()) return [];

  try {
    const billsCol = collection(db, 'shops', 'main', 'bills');
    const q = query(
      billsCol,
      where('createdAt', '<', beforeIsoDate),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    const bills: Bill[] = [];
    snap.forEach((d) => {
      const data = d.data() as Bill;
      if (data && data.id) bills.push(data);
    });
    return bills;
  } catch (err) {
    console.warn('[fetchArchivedBills Error]:', err);
    return [];
  }
}

// ==========================================
// 6. SHIFTS & NOTIFICATIONS
// ==========================================

export async function saveShiftRemote(shift: Shift | null): Promise<void> {
  if (!db || !getCloudUser()) return;
  const activeShiftRef = doc(db, 'shops', 'main', 'shifts', 'active');
  const deviceId = getDeviceId();

  if (shift) {
    await setDoc(activeShiftRef, {
      shift,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    });

    // Also record into shift history collection
    const shiftHistoryRef = doc(db, 'shops', 'main', 'shiftRecords', shift.id);
    await setDoc(
      shiftHistoryRef,
      {
        ...shift,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      },
      { merge: true }
    );
  } else {
    await setDoc(activeShiftRef, {
      shift: null,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    });
  }
}

export async function saveNotificationRemote(notif: AppNotification): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'notifications', notif.id);
  await setDoc(
    ref,
    {
      ...notif,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function markNotificationReadRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'notifications', id);
  await setDoc(
    ref,
    {
      read: true,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function clearNotificationsRemote(ids: string[]): Promise<void> {
  const firestore = db;
  if (!firestore || !getCloudUser() || ids.length === 0) return;
  const batch = writeBatch(firestore);
  ids.slice(0, 400).forEach((id) => {
    const ref = doc(firestore, 'shops', 'main', 'notifications', id);
    batch.delete(ref);
  });
  await batch.commit();
}

// ==========================================
// 7. USERS (NEVER SEND PLAIN-TEXT PIN TO CLOUD)
// ==========================================

export async function saveUserRemote(user: User): Promise<void> {
  if (!db || !getCloudUser()) return;

  let salt = user.salt;
  let pinHash = user.pinHash;

  // Ensure PIN is hashed with salt if not already
  if (!pinHash || !salt) {
    salt = generateSalt();
    pinHash = await hashPinWithSalt(user.pin || '1234', salt);
  }

  const ref = doc(db, 'shops', 'main', 'users', user.id);
  // Plain text `pin` is explicitly OMITTED from Cloud payload!
  await setDoc(
    ref,
    {
      id: user.id,
      name: user.name,
      nameEn: user.nameEn || '',
      role: user.role,
      pinHash,
      salt,
      avatar: user.avatar || '',
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    },
    { merge: true }
  );
}

export async function deleteUserRemote(id: string): Promise<void> {
  if (!db || !getCloudUser()) return;
  const ref = doc(db, 'shops', 'main', 'users', id);
  await deleteDoc(ref);
}

// ==========================================
// 8. UNIFIED REALTIME SUBSCRIBERS
// ==========================================

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  onUpdate: (items: T[], removedIds: string[]) => void,
  customQueryBuilder?: (col: any) => any
): Unsubscribe {
  if (!db || !isFirebaseConfigured() || !getCloudUser()) {
    return () => {};
  }

  const deviceId = getDeviceId();
  const baseCol = collection(db, 'shops', 'main', collectionName);
  const q = customQueryBuilder ? customQueryBuilder(baseCol) : baseCol;

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot: any) => {
      if (snapshot.metadata.hasPendingWrites) return;

      const items: T[] = [];
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        // Skip document if it was updated by this device (echo prevention)
        if (data.updatedBy === deviceId) {
          return;
        }
        items.push(data as T);
      });

      const removedIds: string[] = snapshot
        .docChanges()
        .filter((c: any) => c.type === 'removed')
        .map((c: any) => c.doc.id);

      if (items.length > 0 || removedIds.length > 0) {
        onUpdate(items, removedIds);
      }
    },
    (err: any) => {
      console.warn(`[subscribeCollection ${collectionName} Error]:`, err);
    }
  );
}

/**
 * Real-time subscription for active bills and bills created within the last 30 days
 */
export function subscribeRecentBills(onUpdate: (recentBills: Bill[]) => void): Unsubscribe {
  if (!db || !isFirebaseConfigured() || !getCloudUser()) {
    return () => {};
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const deviceId = getDeviceId();
  const billsCol = collection(db, 'shops', 'main', 'bills');
  const q = query(billsCol, where('createdAt', '>=', thirtyDaysAgoISO));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;

      const bills: Bill[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Bill & { updatedBy?: string };
        if (data.updatedBy === deviceId) return;
        bills.push(data);
      });

      onUpdate(bills);
    },
    (err) => console.warn('[subscribeRecentBills Error]:', err)
  );
}

/**
 * Real-time subscription for active shift
 */
export function subscribeActiveShift(onUpdate: (shift: Shift | null) => void): Unsubscribe {
  if (!db || !isFirebaseConfigured() || !getCloudUser()) {
    return () => {};
  }

  const deviceId = getDeviceId();
  const shiftRef = doc(db, 'shops', 'main', 'shifts', 'active');

  return onSnapshot(
    shiftRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return;
      const data = snapshot.data();
      if (data.updatedBy === deviceId) return;
      onUpdate(data.shift || null);
    },
    (err) => console.warn('[subscribeActiveShift Error]:', err)
  );
}

/**
 * Bulk upload local dataset to Cloud (Initial upload or Full sync)
 */
export async function uploadFullLocalDataToCloud(params: {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  tables: Table[];
  zones: TableZoneConfig[];
  optionPresets: OptionGroup[];
  members: Member[];
  bills: Bill[];
  users: User[];
  shift: Shift | null;
  notifications: AppNotification[];
  settings: ShopSettings;
  qrImages: PaymentQrImage[];
}): Promise<void> {
  if (!db || !getCloudUser()) return;

  // 1. Settings & Media
  await saveShopBundle({
    settings: params.settings,
    qrImages: params.qrImages,
    logo: params.settings.logoUrl,
  });

  // 2. Categories
  for (const cat of params.categories) {
    await saveCategoryRemote(cat);
  }

  // 3. Menu items
  for (const item of params.menuItems) {
    await saveMenuItemRemote(item);
  }

  // 4. Tables
  for (const table of params.tables) {
    await saveTableRemote(table);
  }

  // 5. Zones
  for (const zone of params.zones) {
    await saveZoneRemote(zone);
  }

  // 6. Option Presets
  for (const preset of params.optionPresets) {
    await saveOptionPresetRemote(preset);
  }

  // 7. Members
  for (const member of params.members) {
    await saveMemberRemote(member);
  }

  // 8. Recent/Open Bills
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
  for (const bill of params.bills) {
    if (bill.status === 'open' || bill.createdAt >= thirtyDaysAgoISO) {
      await saveBillRemote(bill);
    }
  }

  // 9. Users (Secure PIN hashing with salt, plain PIN never sent)
  for (const user of params.users) {
    await saveUserRemote(user);
  }

  // 10. Active Shift
  await saveShiftRemote(params.shift);
}

export { waitForPendingWrites };
