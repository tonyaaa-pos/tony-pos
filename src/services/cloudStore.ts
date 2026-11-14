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
import {
  db,
  isFirebaseConfigured,
  getCloudUser,
  isQuotaExceededError,
  isFirestoreWritePaused,
  markFirestoreWriteQuotaExceeded,
} from './firebase';

async function safeWrite(op: () => Promise<void>): Promise<void> {
  if (isFirestoreWritePaused()) return;
  try {
    await op();
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      console.warn('[Firestore Quota] Write paused temporarily due to daily free quota limit.');
      return;
    }
    throw err;
  }
}
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
 * Recursively strips `undefined` values from plain objects and arrays before writing to Firestore,
 * while preserving `null`, `Date`, and Firestore `FieldValue` / `Timestamp` sentinels.
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) {
    return val;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(val as Record<string, unknown>)) {
    if (entry !== undefined) {
      result[key] = sanitizeForFirestore(entry);
    }
  }
  return result as T;
}

/**
 * Extracts a comparable millisecond timestamp from a local or Firestore document.
 */
export function extractTimestampMs(raw: any): number {
  if (!raw || typeof raw !== 'object') return 0;
  if (typeof raw.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs)) {
    return raw.updatedAtMs;
  }
  if (typeof raw.clientUpdatedAt === 'number' && Number.isFinite(raw.clientUpdatedAt)) {
    return raw.clientUpdatedAt;
  }
  const ts = raw.updatedAt;
  if (ts) {
    if (typeof ts.toMillis === 'function') {
      try {
        return ts.toMillis();
      } catch {
        // ignore
      }
    }
    if (typeof ts.seconds === 'number') {
      return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
    }
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      return ts;
    }
    if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

/**
 * Normalizes a Table document from Firestore or localStorage so `null` fields become `undefined`
 * and available/reserved tables never carry stale guest/bill data.
 */
export function normalizeTableData(raw: any): Table {
  const status = (raw?.status || 'available') as Table['status'];
  const isAvailable = status === 'available';
  const isReserved = status === 'reserved';
  const tsMs = extractTimestampMs(raw);

  return {
    ...raw,
    status,
    currentBillId: isAvailable || isReserved ? undefined : (raw?.currentBillId ?? undefined),
    seatedAt: isAvailable || isReserved ? undefined : (raw?.seatedAt ?? undefined),
    guestCount:
      isAvailable || isReserved
        ? undefined
        : typeof raw?.guestCount === 'number' && raw.guestCount > 0
        ? raw.guestCount
        : undefined,
    reservation: isAvailable ? undefined : (raw?.reservation ?? undefined),
    ...(tsMs > 0 ? { updatedAtMs: tsMs } : {}),
  } as Table;
}

/**
 * Normalizes a Bill document from Firestore so `null` optional fields become `undefined`
 * and preserves the document's latest timestamp.
 */
export function normalizeBillData(raw: any): Bill {
  const tsMs = extractTimestampMs(raw);
  return {
    ...raw,
    tableId: raw?.tableId ?? undefined,
    tableName: raw?.tableName ?? undefined,
    guestCount: raw?.guestCount ?? undefined,
    deliveryInfo: raw?.deliveryInfo ?? undefined,
    note: raw?.note ?? undefined,
    closedAt: raw?.closedAt ?? undefined,
    ...(tsMs > 0 ? { updatedAtMs: tsMs } : {}),
  } as Bill;
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
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const firestoreDb = db;

  const deviceId = getDeviceId();
  const batch = writeBatch(firestoreDb);

  // Settings
  const settingsRef = doc(firestoreDb, 'users', (getCloudUser()?.uid || '_'), 'settings', 'shop');
  const nowMs = bundle.settings.updatedAtMs || Date.now();
  batch.set(
    settingsRef,
    sanitizeForFirestore({
      ...bundle.settings,
      logoUrl: bundle.logo !== undefined ? bundle.logo : (bundle.settings.logoUrl || ''),
      updatedAtMs: nowMs,
      clientUpdatedAt: nowMs,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    }),
    { merge: true }
  );

  // Logo Media
  if (bundle.logo !== undefined) {
    let logoData = bundle.logo;
    if (logoData && logoData.startsWith('data:')) {
      const checkedLogo = await ensureImageUnderLimit(logoData, 'โลโก้ร้าน', onWarning);
      logoData = checkedLogo ?? '';
    }
    const logoRef = doc(firestoreDb, 'users', (getCloudUser()?.uid || '_'), 'media', 'logo');
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
  const qrColRef = collection(firestoreDb, 'users', (getCloudUser()?.uid || '_'), 'qrImages');
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
    const qrDocRef = doc(firestoreDb, 'users', (getCloudUser()?.uid || '_'), 'qrImages', qr.id);
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

  await safeWrite(() => batch.commit());
}

export async function fetchRemoteShopBundle(): Promise<RemoteShopData | null> {
  if (!db || !getCloudUser()) return null;

  try {
    const uid = getCloudUser()?.uid || '_';
    const settingsRef = doc(db, 'users', uid, 'settings', 'shop');
    const qrColRef = collection(db, 'users', uid, 'qrImages');
    const logoRef = doc(db, 'users', uid, 'media', 'logo');

    const [settingsSnap, qrSnap, logoSnap] = await Promise.all([
      getDoc(settingsRef),
      getDocs(qrColRef),
      getDoc(logoRef),
    ]);

    if (!settingsSnap.exists()) {
      return null;
    }

    const settingsData = settingsSnap.data() as ShopSettings & {
      updatedAt?: unknown;
      updatedBy?: string;
    };

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
  const settingsRef = doc(db, 'users', (getCloudUser()?.uid || '_'), 'settings', 'shop');

  return onSnapshot(
    settingsRef,
    { includeMetadataChanges: true },
    async (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.updatedBy === deviceId) return;
      if (snapshot.metadata.hasPendingWrites) return;

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
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  let image = item.image || '';
  if (image && image.startsWith('data:')) {
    const checked = await ensureImageUnderLimit(image, item.name);
    image = checked || '';
  }

  const nowMs = item.updatedAtMs || Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'menuItems', item.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...item,
        image,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

export async function saveMenuItemsBatchRemote(items: MenuItem[]): Promise<void> {
  if (!db || !getCloudUser() || items.length === 0 || isFirestoreWritePaused()) return;
  const firestoreDb = db;
  const uid = getCloudUser()?.uid || '_';
  const deviceId = getDeviceId();

  const prepared: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
  for (const item of items) {
    if (isFirestoreWritePaused()) return;
    let image = item.image || '';
    if (image && image.startsWith('data:')) {
      const checked = await ensureImageUnderLimit(image, item.name);
      image = checked || '';
    }
    const nowMs = item.updatedAtMs || Date.now();
    prepared.push({
      ref: doc(firestoreDb, 'users', uid, 'menuItems', item.id),
      data: sanitizeForFirestore({
        ...item,
        image,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  for (let i = 0; i < prepared.length; i += 400) {
    if (isFirestoreWritePaused()) return;
    const chunk = prepared.slice(i, i + 400);
    const batch = writeBatch(firestoreDb);
    chunk.forEach((op) => batch.set(op.ref, op.data, { merge: true }));
    await safeWrite(() => batch.commit());
  }
}

export async function deleteMenuItemRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'menuItems', id);
  await safeWrite(() => deleteDoc(ref));
}

export async function saveCategoryRemote(category: MenuCategory): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const nowMs = category.updatedAtMs || Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'categories', category.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...category,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

export async function deleteCategoryRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'categories', id);
  await safeWrite(() => deleteDoc(ref));
}

// ==========================================
// 3. TABLES & ZONES
// ==========================================

export async function saveTableRemote(table: Table): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'tables', table.id);
  const nowMs = table.updatedAtMs || Date.now();
  const isAvailable = table.status === 'available';
  const isReserved = table.status === 'reserved';

  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...table,
        currentBillId: isAvailable || isReserved ? null : (table.currentBillId ?? null),
        seatedAt: isAvailable || isReserved ? null : (table.seatedAt ?? null),
        guestCount: isAvailable || isReserved ? null : (table.guestCount ?? null),
        reservation: isAvailable ? null : (table.reservation ?? null),
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

export async function deleteTableRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'tables', id);
  await safeWrite(() => deleteDoc(ref));
}

export async function saveZoneRemote(zone: TableZoneConfig): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const nowMs = zone.updatedAtMs || Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'zones', zone.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...zone,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

export async function deleteZoneRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'zones', id);
  await safeWrite(() => deleteDoc(ref));
}

// ==========================================
// 4. OPTION PRESETS & MEMBERS
// ==========================================

export async function saveOptionPresetRemote(preset: OptionGroup): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const nowMs = preset.updatedAtMs || Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'optionPresets', preset.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...preset,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

export async function deleteOptionPresetRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'optionPresets', id);
  await safeWrite(() => deleteDoc(ref));
}

export async function saveMemberRemote(member: Member): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const nowMs = member.updatedAtMs || Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'members', member.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...member,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

// ==========================================
// 5. BILLS & MULTI-DOC ATOMIC TRANSACTIONS
// ==========================================

export async function saveBillRemote(bill: Bill): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const nowMs = bill.updatedAtMs || Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'bills', bill.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...bill,
        note: bill.note ?? null,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
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
  voidEmptyBills?: Bill[];
  memberUpdate?: { id: string; points: number; totalSpent: number };
}): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const firestoreDb = db;

  const uid = getCloudUser()?.uid || '_';
  const batch = writeBatch(firestoreDb);
  const deviceId = getDeviceId();
  const nowMs = params.bill.updatedAtMs || Date.now();

  // 1. Update Bill to paid
  const billRef = doc(firestoreDb, 'users', uid, 'bills', params.bill.id);
  batch.set(
    billRef,
    sanitizeForFirestore({
      ...params.bill,
      status: 'paid',
      updatedAtMs: nowMs,
      clientUpdatedAt: nowMs,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    }),
    { merge: true }
  );

  // 1b. Void any orphan empty open bills left on the released table
  if (params.voidEmptyBills && params.voidEmptyBills.length > 0) {
    for (const emptyBill of params.voidEmptyBills) {
      const emptyBillRef = doc(firestoreDb, 'users', uid, 'bills', emptyBill.id);
      batch.set(
        emptyBillRef,
        sanitizeForFirestore({
          ...emptyBill,
          status: 'voided',
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        }),
        { merge: true }
      );
    }
  }

  // 2. Update Table status using merge set (never batch.update so newly created/demo docs never fail NOT_FOUND)
  if (params.tableId) {
    const tableRef = doc(firestoreDb, 'users', uid, 'tables', params.tableId);
    if (params.isTableReleased) {
      batch.set(
        tableRef,
        {
          id: params.tableId,
          status: 'available',
          currentBillId: null,
          seatedAt: null,
          guestCount: null,
          reservation: null,
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        },
        { merge: true }
      );
    } else if (params.nextTableBillId) {
      batch.set(
        tableRef,
        {
          id: params.tableId,
          status: 'occupied',
          currentBillId: params.nextTableBillId,
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        },
        { merge: true }
      );
    }
  }

  // 3. Update Member points & total spent if applicable
  if (params.memberUpdate) {
    const memberRef = doc(firestoreDb, 'users', uid, 'members', params.memberUpdate.id);
    batch.set(
      memberRef,
      {
        id: params.memberUpdate.id,
        points: params.memberUpdate.points,
        totalSpent: params.memberUpdate.totalSpent,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      },
      { merge: true }
    );
  }

  await safeWrite(() => batch.commit());
}

/**
 * Atomic void bill and release table
 */
export async function atomicVoidBillAndReleaseTable(params: {
  bill: Bill;
  tableId?: string;
  isTableReleased: boolean;
  nextTableBillId?: string;
  voidEmptyBills?: Bill[];
}): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const firestoreDb = db;

  const uid = getCloudUser()?.uid || '_';
  const batch = writeBatch(firestoreDb);
  const deviceId = getDeviceId();
  const nowMs = params.bill.updatedAtMs || Date.now();

  const billRef = doc(firestoreDb, 'users', uid, 'bills', params.bill.id);
  batch.set(
    billRef,
    sanitizeForFirestore({
      ...params.bill,
      status: 'voided',
      updatedAtMs: nowMs,
      clientUpdatedAt: nowMs,
      updatedAt: serverTimestamp(),
      updatedBy: deviceId,
    }),
    { merge: true }
  );

  if (params.voidEmptyBills && params.voidEmptyBills.length > 0) {
    for (const emptyBill of params.voidEmptyBills) {
      const emptyBillRef = doc(firestoreDb, 'users', uid, 'bills', emptyBill.id);
      batch.set(
        emptyBillRef,
        sanitizeForFirestore({
          ...emptyBill,
          status: 'voided',
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        }),
        { merge: true }
      );
    }
  }

  if (params.tableId) {
    const tableRef = doc(firestoreDb, 'users', uid, 'tables', params.tableId);
    if (params.isTableReleased) {
      batch.set(
        tableRef,
        {
          id: params.tableId,
          status: 'available',
          currentBillId: null,
          seatedAt: null,
          guestCount: null,
          reservation: null,
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        },
        { merge: true }
      );
    } else if (params.nextTableBillId) {
      batch.set(
        tableRef,
        {
          id: params.tableId,
          status: 'occupied',
          currentBillId: params.nextTableBillId,
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        },
        { merge: true }
      );
    }
  }

  await safeWrite(() => batch.commit());
}

/**
 * On-demand loader for bills older than 30 days (avoids reading entire history in real-time)
 */
export async function fetchArchivedBills(beforeIsoDate: string): Promise<Bill[]> {
  if (!db || !getCloudUser()) return [];

  try {
    const billsCol = collection(db, 'users', (getCloudUser()?.uid || '_'), 'bills');
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
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const activeShiftRef = doc(db, 'users', (getCloudUser()?.uid || '_'), 'shifts', 'active');
  const deviceId = getDeviceId();
  const nowMs = shift?.updatedAtMs || Date.now();
  const firestoreDb = db;

  if (shift) {
    await safeWrite(() =>
      setDoc(
        activeShiftRef,
        sanitizeForFirestore({
          shift,
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        })
      )
    );

    if (isFirestoreWritePaused()) return;
    // Also record into shift history collection
    const shiftHistoryRef = doc(firestoreDb, 'users', (getCloudUser()?.uid || '_'), 'shiftRecords', shift.id);
    await safeWrite(() =>
      setDoc(
        shiftHistoryRef,
        sanitizeForFirestore({
          ...shift,
          updatedAtMs: nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        }),
        { merge: true }
      )
    );
  } else {
    await safeWrite(() =>
      setDoc(activeShiftRef, {
        shift: null,
        updatedAtMs: nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      })
    );
  }
}

export async function saveNotificationRemote(notif: AppNotification): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const nowMs = Date.now();
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'notifications', notif.id);
  await safeWrite(() =>
    setDoc(
      ref,
      sanitizeForFirestore({
        ...notif,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      }),
      { merge: true }
    )
  );
}

export async function markNotificationReadRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'notifications', id);
  await safeWrite(() =>
    setDoc(
      ref,
      {
        read: true,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      },
      { merge: true }
    )
  );
}

export async function clearNotificationsRemote(ids: string[]): Promise<void> {
  const firestore = db;
  if (!firestore || !getCloudUser() || ids.length === 0 || isFirestoreWritePaused()) return;
  const batch = writeBatch(firestore);
  ids.slice(0, 400).forEach((id) => {
    const ref = doc(firestore, 'users', (getCloudUser()?.uid || '_'), 'notifications', id);
    batch.delete(ref);
  });
  await safeWrite(() => batch.commit());
}

// ==========================================
// 7. USERS (NEVER SEND PLAIN-TEXT PIN TO CLOUD)
// ==========================================

export async function saveUserRemote(user: User): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;

  let salt = user.salt;
  let pinHash = user.pinHash;

  // Ensure PIN is hashed with salt if not already
  if (!pinHash || !salt) {
    salt = generateSalt();
    pinHash = await hashPinWithSalt(user.pin || '1234', salt);
  }

  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'users', user.id);
  // Plain text `pin` is explicitly OMITTED from Cloud payload!
  await safeWrite(() =>
    setDoc(
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
    )
  );
}

export async function deleteUserRemote(id: string): Promise<void> {
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const ref = doc(db, 'users', (getCloudUser()?.uid || '_'), 'users', id);
  await safeWrite(() => deleteDoc(ref));
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
  const baseCol = collection(db, 'users', (getCloudUser()?.uid || '_'), collectionName);
  const q = customQueryBuilder ? customQueryBuilder(baseCol) : baseCol;

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot: any) => {
      const items: T[] = [];
      snapshot.forEach((docSnap: any) => {
        if (docSnap.metadata?.hasPendingWrites) return;
        const data = docSnap.data();
        // Skip document if it was updated by this device (echo prevention)
        if (data.updatedBy === deviceId) {
          return;
        }
        if (collectionName === 'tables') {
          items.push(normalizeTableData(data) as unknown as T);
        } else {
          const tsMs = extractTimestampMs(data);
          items.push((tsMs > 0 ? { ...data, updatedAtMs: tsMs } : data) as T);
        }
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
export function subscribeRecentBills(
  onUpdate: (recentBills: Bill[], removedIds?: string[]) => void
): Unsubscribe {
  if (!db || !isFirebaseConfigured() || !getCloudUser()) {
    return () => {};
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

  const deviceId = getDeviceId();
  const billsCol = collection(db, 'users', (getCloudUser()?.uid || '_'), 'bills');
  const q = query(billsCol, where('createdAt', '>=', thirtyDaysAgoISO));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const bills: Bill[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.metadata.hasPendingWrites) return;
        const data = docSnap.data() as Bill & { updatedBy?: string };
        if (data.updatedBy === deviceId) return;
        bills.push(normalizeBillData(data));
      });

      const removedIds: string[] = snapshot
        .docChanges()
        .filter((c) => c.type === 'removed')
        .map((c) => c.doc.id);

      if (bills.length > 0 || removedIds.length > 0) {
        onUpdate(bills, removedIds);
      }
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
  const shiftRef = doc(db, 'users', (getCloudUser()?.uid || '_'), 'shifts', 'active');

  return onSnapshot(
    shiftRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (data.updatedBy === deviceId || snapshot.metadata.hasPendingWrites) return;
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
  if (!db || !getCloudUser() || isFirestoreWritePaused()) return;
  const firestoreDb = db;
  const uid = getCloudUser()?.uid || '_';
  const deviceId = getDeviceId();

  // 1. Settings & Media
  await saveShopBundle({
    settings: params.settings,
    qrImages: params.qrImages,
    logo: params.settings.logoUrl,
  });
  if (isFirestoreWritePaused()) return;

  // Collect all entity writes into 400-doc writeBatches instead of 100+ sequential setDoc calls
  const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
  const nowMs = Date.now();

  for (const cat of params.categories) {
    ops.push({
      ref: doc(firestoreDb, 'users', uid, 'categories', cat.id),
      data: sanitizeForFirestore({
        ...cat,
        updatedAtMs: cat.updatedAtMs || nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  for (const item of params.menuItems) {
    let image = item.image || '';
    if (image && image.startsWith('data:')) {
      const checked = await ensureImageUnderLimit(image, item.name);
      image = checked || '';
    }
    ops.push({
      ref: doc(firestoreDb, 'users', uid, 'menuItems', item.id),
      data: sanitizeForFirestore({
        ...item,
        image,
        updatedAtMs: item.updatedAtMs || nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  for (const table of params.tables) {
    const isAvailable = table.status === 'available';
    const isReserved = table.status === 'reserved';
    ops.push({
      ref: doc(firestoreDb, 'users', uid, 'tables', table.id),
      data: sanitizeForFirestore({
        ...table,
        currentBillId: isAvailable || isReserved ? null : (table.currentBillId ?? null),
        seatedAt: isAvailable || isReserved ? null : (table.seatedAt ?? null),
        guestCount: isAvailable || isReserved ? null : (table.guestCount ?? null),
        reservation: isAvailable ? null : (table.reservation ?? null),
        updatedAtMs: table.updatedAtMs || nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  for (const zone of params.zones) {
    ops.push({
      ref: doc(firestoreDb, 'users', uid, 'zones', zone.id),
      data: sanitizeForFirestore({
        ...zone,
        updatedAtMs: zone.updatedAtMs || nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  for (const preset of params.optionPresets) {
    ops.push({
      ref: doc(firestoreDb, 'users', uid, 'optionPresets', preset.id),
      data: sanitizeForFirestore({
        ...preset,
        updatedAtMs: preset.updatedAtMs || nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  for (const member of params.members) {
    ops.push({
      ref: doc(firestoreDb, 'users', uid, 'members', member.id),
      data: sanitizeForFirestore({
        ...member,
        updatedAtMs: member.updatedAtMs || nowMs,
        clientUpdatedAt: nowMs,
        updatedAt: serverTimestamp(),
        updatedBy: deviceId,
      }) as unknown as Record<string, unknown>,
    });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
  for (const bill of params.bills) {
    if (bill.status === 'open' || bill.createdAt >= thirtyDaysAgoISO) {
      ops.push({
        ref: doc(firestoreDb, 'users', uid, 'bills', bill.id),
        data: sanitizeForFirestore({
          ...bill,
          note: bill.note ?? null,
          updatedAtMs: bill.updatedAtMs || nowMs,
          clientUpdatedAt: nowMs,
          updatedAt: serverTimestamp(),
          updatedBy: deviceId,
        }) as unknown as Record<string, unknown>,
      });
    }
  }

  for (let i = 0; i < ops.length; i += 400) {
    if (isFirestoreWritePaused()) return;
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(firestoreDb);
    chunk.forEach((op) => batch.set(op.ref, op.data, { merge: true }));
    await safeWrite(() => batch.commit());
  }

  if (isFirestoreWritePaused()) return;

  for (const user of params.users) {
    if (isFirestoreWritePaused()) return;
    await saveUserRemote(user);
  }

  if (!isFirestoreWritePaused()) {
    await saveShiftRemote(params.shift);
  }
}

export { waitForPendingWrites };
