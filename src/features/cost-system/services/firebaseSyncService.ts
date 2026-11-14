import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocsFromServer,
  getDoc,
  query,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  isQuotaExceededError,
  isFirestoreWritePaused,
  markFirestoreWriteQuotaExceeded,
} from './firebase';
import { StorageService } from './storageService';
import {
  Ingredient,
  Sauce,
  MenuItem,
  RestaurantSettings,
  Supplier,
  ExpenseRecord,
  SaleOrder,
  InventoryItem,
  InventoryTransaction,
  WasteRecord,
  PurchaseRecord,
  PriceHistoryRecord,
  Employee,
} from '../types';
import { DailySalesRecord } from '../types/domain';

export const COLLECTIONS = {
  SETTINGS: 'settings',
  INGREDIENTS: 'ingredients',
  SAUCES: 'sauces',
  MENUS: 'menus',
  DAILY_SALES: 'daily_sales',
  EXPENSES: 'expenses',
  EMPLOYEES: 'employees',
  INVENTORY: 'inventory',
  PURCHASES: 'purchases',
  WASTE_LOG: 'waste_log',
  SUPPLIERS: 'suppliers',
  PRICE_HISTORY: 'price_history',
  SALES_ORDERS: 'sales_orders',
} as const;

export interface CloudSyncState {
  isSyncing: boolean;
  isConnected: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

function isFirestoreSpecialValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof Date || value instanceof Timestamp || value instanceof FieldValue) {
    return true;
  }
  const anyVal = value as Record<string, unknown>;
  return typeof anyVal._methodName === 'string' || typeof anyVal.toDate === 'function';
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (isFirestoreSpecialValue(value)) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
  }

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      const sanitized = sanitizeValue(v);
      if (sanitized !== undefined) {
        clean[k] = sanitized;
      }
    }
  }
  return clean;
}

function normalizeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (value instanceof Timestamp || typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return value;
    }
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestoreValue(item));
  }
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    normalized[k] = normalizeFirestoreValue(v);
  }
  return normalized;
}

function sortByDisplayOrder<T>(items: T[]): T[] {
  const hasOrder = items.some((item) => typeof (item as any)?.displayOrder === 'number');
  if (!hasOrder) return items;
  return [...items].sort((a, b) => {
    const orderA = typeof (a as any)?.displayOrder === 'number' ? (a as any).displayOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof (b as any)?.displayOrder === 'number' ? (b as any).displayOrder : Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

async function runSafeCostWrite(op: () => Promise<void>, operationType: OperationType, path: string): Promise<void> {
  if (isFirestoreWritePaused()) return;
  try {
    await op();
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExceeded();
      console.warn(`[CostSystem Quota] Write paused due to daily quota limit at ${path}`);
      return;
    }
    handleFirestoreError(err, operationType, path);
  }
}

export const FirebaseSyncService = {
  /**
   * Deeply clean data before saving to Firestore (recursively removes undefined values from objects & arrays)
   */
  sanitizeData<T extends Record<string, any>>(data: T): Record<string, any> {
    return (sanitizeValue(data) as Record<string, any>) || {};
  },

  /**
   * Save a single user-scoped document to Firestore
   * Paths: users/{uid}/{collectionName}/{docId}
   */
  async saveUserDoc<T extends Record<string, any>>(
    userId: string,
    collectionName: string,
    docId: string,
    data: T
  ): Promise<void> {
    if (!db || !userId || !docId || isFirestoreWritePaused()) return;
    const firestoreDb = db;
    const path = `users/${userId}/${collectionName}/${docId}`;
    await runSafeCostWrite(
      async () => {
        const docRef = doc(firestoreDb, 'users', userId, collectionName, docId);
        const clean = this.sanitizeData(data);
        const payload: Record<string, any> = {
          ...clean,
          id: docId,
          updatedAt: serverTimestamp(),
        };
        if (!clean.createdAt) {
          payload.createdAt = serverTimestamp();
        }
        await setDoc(docRef, payload, { merge: true });
      },
      OperationType.WRITE,
      path
    );
  },

  /**
   * Delete a single user-scoped document from Firestore
   */
  async deleteUserDoc(userId: string, collectionName: string, docId: string): Promise<void> {
    if (!db || !userId || !docId || isFirestoreWritePaused()) return;
    const firestoreDb = db;
    const path = `users/${userId}/${collectionName}/${docId}`;
    await runSafeCostWrite(
      async () => {
        const docRef = doc(firestoreDb, 'users', userId, collectionName, docId);
        await deleteDoc(docRef);
      },
      OperationType.DELETE,
      path
    );
  },

  /**
   * Batch save multiple user-scoped entities
   */
  async batchSaveUser<T extends { id?: string }>(
    userId: string,
    collectionName: string,
    items: T[]
  ): Promise<void> {
    if (!db || !userId || !items || items.length === 0 || isFirestoreWritePaused()) return;
    const firestoreDb = db;
    const path = `users/${userId}/${collectionName}`;
    await runSafeCostWrite(
      async () => {
        const chunkSize = 400;
        for (let i = 0; i < items.length; i += chunkSize) {
          if (isFirestoreWritePaused()) return;
          const chunk = items.slice(i, i + chunkSize);
          const batch = writeBatch(firestoreDb);
          chunk.forEach((item, index) => {
            const docId = item.id || (item as any).ingredientId || `item_${Date.now()}_${index}`;
            const docRef = doc(firestoreDb, 'users', userId, collectionName, docId);
            const clean = this.sanitizeData(item);
            const payload: Record<string, any> = {
              ...clean,
              id: docId,
              updatedAt: serverTimestamp(),
            };
            if (!clean.createdAt) {
              payload.createdAt = serverTimestamp();
            }
            batch.set(docRef, payload, { merge: true });
          });
          await batch.commit();
        }
      },
      OperationType.WRITE,
      path
    );
  },

  /**
   * Realtime onSnapshot listener for user collection
   */
  subscribeUserCollection<T extends { id?: string }>(
    userId: string,
    collectionName: string,
    onUpdate: (items: T[]) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!db || !userId) return () => {};
    const path = `users/${userId}/${collectionName}`;
    const colRef = collection(db, 'users', userId, collectionName);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = normalizeFirestoreValue(docSnap.data()) as Record<string, any>;
          return {
            ...data,
            id: docSnap.id,
          } as unknown as T;
        });
        onUpdate(sortByDisplayOrder(items));
      },
      (error) => {
        console.warn(`[CostSystem subscribeUserCollection ${collectionName}]:`, error);
        onError?.(error);
      }
    );
  },

  /**
   * Realtime onSnapshot listener for a single user document (e.g. settings)
   */
  subscribeUserDoc<T extends Record<string, any>>(
    userId: string,
    collectionName: string,
    docId: string,
    onUpdate: (data: T | null) => void,
    onError?: (error: any) => void
  ): () => void {
    if (!db || !userId) return () => {};
    const path = `users/${userId}/${collectionName}/${docId}`;
    const docRef = doc(db, 'users', userId, collectionName, docId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = normalizeFirestoreValue(snapshot.data()) as Record<string, any>;
          onUpdate({ ...data, id: snapshot.id } as unknown as T);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.warn(`[CostSystem subscribeUserDoc ${path}]:`, error);
        onError?.(error);
      }
    );
  },

  /**
   * Check if user already has data stored in Cloud Firestore
   */
  async hasUserData(userId: string): Promise<boolean> {
    if (!db || !userId) return false;
    const firestoreDb = db;
    try {
      const [settingsSnap, menusSnap, ingSnap, sauceSnap, expSnap, salesSnap] = await Promise.all([
        getDoc(doc(firestoreDb, 'users', userId, COLLECTIONS.SETTINGS, 'default')),
        getDocs(query(collection(firestoreDb, 'users', userId, COLLECTIONS.MENUS), limit(1))),
        getDocs(query(collection(firestoreDb, 'users', userId, COLLECTIONS.INGREDIENTS), limit(1))),
        getDocs(query(collection(firestoreDb, 'users', userId, COLLECTIONS.SAUCES), limit(1))),
        getDocs(query(collection(firestoreDb, 'users', userId, COLLECTIONS.EXPENSES), limit(1))),
        getDocs(query(collection(firestoreDb, 'users', userId, COLLECTIONS.DAILY_SALES), limit(1))),
      ]);
      return (
        settingsSnap.exists() ||
        !menusSnap.empty ||
        !ingSnap.empty ||
        !sauceSnap.empty ||
        !expSnap.empty ||
        !salesSnap.empty
      );
    } catch (err) {
      console.warn('Error checking user cloud data:', err);
      return false;
    }
  },

  /**
   * Fetch live counts of documents stored on Cloud Firestore for verification
   */
  async getUserCloudCounts(userId: string): Promise<{
    menus: number;
    ingredients: number;
    sauces: number;
    expenses: number;
    dailySales: number;
    total: number;
    settingsSaved: boolean;
  } | null> {
    if (!db || !userId) return null;
    const firestoreDb = db;
    try {
      const [mSnap, iSnap, sSnap, eSnap, dSnap, setSnap] = await Promise.all([
        getDocs(collection(firestoreDb, 'users', userId, COLLECTIONS.MENUS)),
        getDocs(collection(firestoreDb, 'users', userId, COLLECTIONS.INGREDIENTS)),
        getDocs(collection(firestoreDb, 'users', userId, COLLECTIONS.SAUCES)),
        getDocs(collection(firestoreDb, 'users', userId, COLLECTIONS.EXPENSES)),
        getDocs(collection(firestoreDb, 'users', userId, COLLECTIONS.DAILY_SALES)),
        getDoc(doc(firestoreDb, 'users', userId, COLLECTIONS.SETTINGS, 'default')),
      ]);
      const menus = mSnap.size;
      const ingredients = iSnap.size;
      const sauces = sSnap.size;
      const expenses = eSnap.size;
      const dailySales = dSnap.size;
      return {
        menus,
        ingredients,
        sauces,
        expenses,
        dailySales,
        total: menus + ingredients + sauces + expenses + dailySales + (setSnap.exists() ? 1 : 0),
        settingsSaved: setSnap.exists(),
      };
    } catch (err) {
      console.warn('Error fetching cloud counts:', err);
      return null;
    }
  },

  /**
   * Migrate all local state / localStorage data into users/{userId}/...
   */
  async migrateLocalDataToUser(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    if (!db || !userId) return { success: false, count: 0, error: 'User ID or Firestore not ready' };
    if (isFirestoreWritePaused()) return { success: false, count: 0, error: 'Write paused due to Firestore quota limit' };
    try {
      let count = 0;
      const settings = StorageService.getSettings();
      const ingredients = StorageService.getIngredients();
      const sauces = StorageService.getSauces();
      const menus = StorageService.getMenus();
      const dailySales = StorageService.getDailySales();
      const expenses = StorageService.getExpenses();
      const employees = StorageService.getEmployees();
      const inventory = StorageService.getInventory();
      const purchases = StorageService.getPurchases();
      const wasteLog = StorageService.getWasteLog();
      const suppliers = StorageService.getSuppliers();
      const priceHistory = StorageService.getPriceHistory();
      const salesOrders = StorageService.getSalesOrders();

      // 1. Settings
      await this.saveUserDoc(userId, COLLECTIONS.SETTINGS, 'default', settings);
      count++;

      // 2. Arrays
      await Promise.all([
        this.batchSaveUser(userId, COLLECTIONS.INGREDIENTS, ingredients),
        this.batchSaveUser(userId, COLLECTIONS.SAUCES, sauces),
        this.batchSaveUser(userId, COLLECTIONS.MENUS, menus),
        this.batchSaveUser(userId, COLLECTIONS.DAILY_SALES, dailySales),
        this.batchSaveUser(userId, COLLECTIONS.EXPENSES, expenses),
        this.batchSaveUser(userId, COLLECTIONS.EMPLOYEES, employees),
        this.batchSaveUser(userId, COLLECTIONS.INVENTORY, inventory),
        this.batchSaveUser(userId, COLLECTIONS.PURCHASES, purchases),
        this.batchSaveUser(userId, COLLECTIONS.WASTE_LOG, wasteLog),
        this.batchSaveUser(userId, COLLECTIONS.SUPPLIERS, suppliers),
        this.batchSaveUser(userId, COLLECTIONS.PRICE_HISTORY, priceHistory),
        this.batchSaveUser(userId, COLLECTIONS.SALES_ORDERS, salesOrders),
      ]);

      count +=
        ingredients.length +
        sauces.length +
        menus.length +
        dailySales.length +
        expenses.length +
        employees.length +
        inventory.length +
        purchases.length +
        wasteLog.length +
        suppliers.length +
        priceHistory.length +
        salesOrders.length;

      return { success: true, count };
    } catch (err: any) {
      console.error('Failed to migrate data to user:', err);
      return { success: false, count: 0, error: err.message };
    }
  },

  /**
   * Export full cloud data package for the authenticated user as JSON
   */
  async exportUserDataJSON(userId: string): Promise<string> {
    if (!db || !userId) throw new Error('User ID and Firestore are required to export data');
    const firestoreDb = db;
    const loadCol = async <T>(name: string): Promise<T[]> => {
      const snap = await getDocs(collection(firestoreDb, 'users', userId, name));
      return snap.docs.map((d) => ({ ...d.data(), id: d.id } as T));
    };

    const settingsDoc = await getDoc(doc(firestoreDb, 'users', userId, COLLECTIONS.SETTINGS, 'default'));
    const settings = settingsDoc.exists() ? (settingsDoc.data() as RestaurantSettings) : StorageService.getSettings();

    const [
      ingredients,
      sauces,
      menus,
      dailySales,
      expenses,
      employees,
      inventory,
      purchases,
      wasteLog,
      suppliers,
      priceHistory,
      salesOrders,
    ] = await Promise.all([
      loadCol<Ingredient>(COLLECTIONS.INGREDIENTS),
      loadCol<Sauce>(COLLECTIONS.SAUCES),
      loadCol<MenuItem>(COLLECTIONS.MENUS),
      loadCol<DailySalesRecord>(COLLECTIONS.DAILY_SALES),
      loadCol<ExpenseRecord>(COLLECTIONS.EXPENSES),
      loadCol<Employee>(COLLECTIONS.EMPLOYEES),
      loadCol<InventoryItem>(COLLECTIONS.INVENTORY),
      loadCol<PurchaseRecord>(COLLECTIONS.PURCHASES),
      loadCol<WasteRecord>(COLLECTIONS.WASTE_LOG),
      loadCol<Supplier>(COLLECTIONS.SUPPLIERS),
      loadCol<PriceHistoryRecord>(COLLECTIONS.PRICE_HISTORY),
      loadCol<SaleOrder>(COLLECTIONS.SALES_ORDERS),
    ]);

    const exportPackage = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      userId,
      payload: {
        settings,
        ingredients,
        sauces,
        menus,
        dailySales,
        expenses,
        employees,
        inventory,
        purchases,
        wasteLog,
        suppliers,
        priceHistory,
        salesOrders,
      },
    };

    return JSON.stringify(exportPackage, null, 2);
  },

  /**
   * Import data package into Firestore for authenticated user
   */
  async importUserDataJSON(userId: string, jsonString: string): Promise<{ success: boolean; count: number; error?: string }> {
    if (!db || !userId) return { success: false, count: 0, error: 'User ID and Firestore are required' };
    try {
      const parsed = JSON.parse(jsonString);
      const payload = parsed.payload || parsed;
      let count = 0;

      if (payload.settings) {
        await this.saveUserDoc(userId, COLLECTIONS.SETTINGS, 'default', payload.settings);
        count++;
      }
      if (Array.isArray(payload.ingredients)) {
        await this.batchSaveUser(userId, COLLECTIONS.INGREDIENTS, payload.ingredients);
        count += payload.ingredients.length;
      }
      if (Array.isArray(payload.sauces)) {
        await this.batchSaveUser(userId, COLLECTIONS.SAUCES, payload.sauces);
        count += payload.sauces.length;
      }
      if (Array.isArray(payload.menus)) {
        await this.batchSaveUser(userId, COLLECTIONS.MENUS, payload.menus);
        count += payload.menus.length;
      }
      if (Array.isArray(payload.dailySales)) {
        await this.batchSaveUser(userId, COLLECTIONS.DAILY_SALES, payload.dailySales);
        count += payload.dailySales.length;
      }
      if (Array.isArray(payload.expenses)) {
        await this.batchSaveUser(userId, COLLECTIONS.EXPENSES, payload.expenses);
        count += payload.expenses.length;
      }
      if (Array.isArray(payload.employees)) {
        await this.batchSaveUser(userId, COLLECTIONS.EMPLOYEES, payload.employees);
        count += payload.employees.length;
      }
      if (Array.isArray(payload.inventory)) {
        await this.batchSaveUser(userId, COLLECTIONS.INVENTORY, payload.inventory);
        count += payload.inventory.length;
      }
      if (Array.isArray(payload.purchases)) {
        await this.batchSaveUser(userId, COLLECTIONS.PURCHASES, payload.purchases);
        count += payload.purchases.length;
      }
      if (Array.isArray(payload.wasteLog)) {
        await this.batchSaveUser(userId, COLLECTIONS.WASTE_LOG, payload.wasteLog);
        count += payload.wasteLog.length;
      }
      if (Array.isArray(payload.suppliers)) {
        await this.batchSaveUser(userId, COLLECTIONS.SUPPLIERS, payload.suppliers);
        count += payload.suppliers.length;
      }
      if (Array.isArray(payload.priceHistory)) {
        await this.batchSaveUser(userId, COLLECTIONS.PRICE_HISTORY, payload.priceHistory);
        count += payload.priceHistory.length;
      }
      if (Array.isArray(payload.salesOrders)) {
        await this.batchSaveUser(userId, COLLECTIONS.SALES_ORDERS, payload.salesOrders);
        count += payload.salesOrders.length;
      }

      return { success: true, count };
    } catch (err: any) {
      console.error('Failed to import user data JSON:', err);
      return { success: false, count: 0, error: err.message || 'รูปแบบไฟล์ไม่ถูกต้อง' };
    }
  },

  /**
   * Replace an entire user-scoped collection cleanly (upserts current items and removes stale docs)
   */
  async replaceUserCollection<T extends { id?: string }>(
    userId: string,
    collectionName: string,
    items: T[]
  ): Promise<void> {
    if (!db || !userId || isFirestoreWritePaused()) return;
    const firestoreDb = db;
    const path = `users/${userId}/${collectionName}`;
    await runSafeCostWrite(
      async () => {
        const existingSnap = await getDocs(collection(firestoreDb, 'users', userId, collectionName));
        const nextIds = new Set(
          items.map((item, idx) => item.id || (item as any).ingredientId || `item_${Date.now()}_${idx}`)
        );
        const staleDocs = existingSnap.docs.filter((d) => !nextIds.has(d.id));
        for (let i = 0; i < staleDocs.length; i += 400) {
          if (isFirestoreWritePaused()) return;
          const batch = writeBatch(firestoreDb);
          staleDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        if (items.length > 0 && !isFirestoreWritePaused()) {
          await this.batchSaveUser(userId, collectionName, items);
        }
      },
      OperationType.WRITE,
      path
    );
  },

  // Pull latest daily sales directly from Cloud Firestore (or fallback to LocalStorage when signed out)
  async pullDailySales(): Promise<{ success: boolean; data: DailySalesRecord[]; error?: string }> {
    const user = auth?.currentUser;
    if (!user || !db) {
      return { success: true, data: StorageService.getDailySales() };
    }
    try {
      const colRef = collection(db, 'users', user.uid, COLLECTIONS.DAILY_SALES);
      let snap;
      try {
        snap = await getDocsFromServer(colRef);
      } catch {
        snap = await getDocs(colRef);
      }
      const items = snap.docs.map((docSnap) => {
        const data = normalizeFirestoreValue(docSnap.data()) as Record<string, any>;
        return {
          ...data,
          id: docSnap.id,
        } as DailySalesRecord;
      });
      StorageService.saveDailySales(items);
      return { success: true, data: items };
    } catch (err: any) {
      console.error('Failed to pull daily sales from Firestore:', err);
      return {
        success: false,
        data: StorageService.getDailySales(),
        error: err?.message || 'ไม่สามารถดึงข้อมูลยอดขายจาก Cloud ได้',
      };
    }
  },
};
