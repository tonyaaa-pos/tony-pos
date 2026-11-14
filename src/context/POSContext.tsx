import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  User,
  Table,
  TableShape,
  ChairStyle,
  MenuItem,
  MenuCategory,
  Bill,
  Shift,
  Member,
  PaymentQrImage,
  ShopSettings,
  AppNotification,
  OrderItem,
  OrderType,
  PaymentRecord,
  ReservationInfo,
  DeliveryInfo,
  OptionGroup,
  TableZoneConfig,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_TABLES,
  INITIAL_MEMBERS,
  INITIAL_BILLS,
  INITIAL_SETTINGS,
  INITIAL_QR_IMAGES,
  INITIAL_SHIFT,
  DEFAULT_OPTION_GROUP_PRESETS,
  INITIAL_ZONES,
} from '../data/seedData';
import { syncService, SyncMessage } from '../services/syncService';
import { soundService } from '../utils/audio';
import { canPay, CanPayResult } from '../utils/orderRules';
import {
  subscribeAuthState,
  loginToCloud,
  loginWithGoogle,
  logoutFromCloud,
  getCloudUser,
  db,
  isFirebaseConfigured,
} from '../services/firebase';
import {
  saveShopBundle,
  fetchRemoteShopBundle,
  subscribeShop,
  waitForPendingWrites,
  saveMenuItemRemote,
  deleteMenuItemRemote,
  saveCategoryRemote,
  deleteCategoryRemote,
  saveTableRemote,
  deleteTableRemote,
  saveZoneRemote,
  deleteZoneRemote,
  saveOptionPresetRemote,
  deleteOptionPresetRemote,
  saveMemberRemote,
  saveBillRemote,
  atomicPayBillAndReleaseTable,
  atomicVoidBillAndReleaseTable,
  fetchArchivedBills,
  saveShiftRemote,
  saveNotificationRemote,
  markNotificationReadRemote,
  clearNotificationsRemote,
  saveUserRemote,
  deleteUserRemote,
  subscribeCollection,
  subscribeRecentBills,
  subscribeActiveShift,
  uploadFullLocalDataToCloud,
  type ShopBundle,
  type RemoteShopData,
} from '../services/cloudStore';
import {
  subscribeCostManagementData,
  findMatchingCostMenu,
  findMatchingCostVariant,
  getVariantRecipeCost,
  getVariantSellingPrice,
  calculateFixedMonthlyOpEx,
  extractCostTimestampMs,
  getCachedCostBundle,
  OPEX_STORAGE_KEY,
  notifyOpExUpdated,
  type TonysKitchenPayload,
} from '../services/costSyncService';
import { generateSalt, hashPinWithSalt, verifyPin } from '../utils/crypto';
import type { User as FirebaseUser } from 'firebase/auth';

interface POSContextType {
  // Auth
  currentUser: User | null;
  users: User[];
  loginWithPin: (pin: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  switchUser: (userId: string) => void;
  logout: () => void;
  addStaff: (user: Omit<User, 'id'>) => void;
  updateStaff: (id: string, user: Partial<User>) => void;
  deleteStaff: (id: string) => void;

  // Theme & Navigation
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeNav: string;
  setActiveNav: (nav: string) => void;

  // Active Category (for bottom bar and POS filtering, null when none active e.g. on Bill/Tables)
  activeCategory: string | null;
  setActiveCategory: (catId: string | null) => void;

  // Selected Table Zone (for shared ZoneBar filtering across Tables and POS)
  selectedZone: string;
  setSelectedZone: (zone: string) => void;
  zones: TableZoneConfig[];
  addZone: (name: string, nameEn?: string, color?: string) => TableZoneConfig;
  updateZone: (id: string, name: string, nameEn?: string, color?: string) => void;
  deleteZone: (id: string, reassignToZoneId?: string) => { success: boolean; message?: string };
  reorderZones: (startIndex: number, endIndex: number) => void;

  // Tables & Layout
  tables: Table[];
  openTable: (tableId: string, guestCount: number) => string; // returns billId
  moveTable: (fromTableId: string, toTableId: string) => boolean;
  mergeTables: (sourceTableIds: string[], targetTableId: string) => boolean;
  requestTableBill: (tableId: string) => void;
  reserveTable: (tableId: string, reservation: ReservationInfo) => void;
  cancelReservation: (tableId: string) => void;
  addTable: (table: Omit<Table, 'id' | 'status'>) => void;
  updateTable: (id: string, updates: Partial<Table>) => void;
  deleteTable: (id: string) => void;
  updateTablePosition: (id: string, x: number, y: number, rotation?: number) => void;

  // Menu & Categories
  categories: MenuCategory[];
  menuItems: MenuItem[];
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  toggleSoldOut: (id: string) => void;
  addCategory: (name: string, icon?: string, color?: string, nameEn?: string) => void;
  updateCategory: (id: string, name: string, icon?: string, color?: string, nameEn?: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (startIndex: number, endIndex: number) => void;
  restoreDefaultMenu: () => void;

  // Option Presets (หมวด set เมนูย่อย)
  optionPresets: OptionGroup[];
  addOptionPreset: (preset: Omit<OptionGroup, 'id'>) => void;
  updateOptionPreset: (id: string, updates: Partial<OptionGroup>) => void;
  deleteOptionPreset: (id: string) => void;
  reorderOptionPresets: (startIndexOrList: number | OptionGroup[], endIndex?: number) => void;

  // Order & Bills
  bills: Bill[];
  activeBill: Bill | null;
  setActiveBillId: (billId: string | null) => void;
  createBillForOrder: (orderType: OrderType, tableId?: string, guestCount?: number, deliveryInfo?: DeliveryInfo) => Bill;
  updateBillDeliveryInfo: (billId: string, deliveryInfo: DeliveryInfo) => void;
  assignTableToBill: (billId: string, tableId: string) => void;
  addItemsToBill: (billId: string, items: OrderItem[]) => void;
  updateBillItemQuantity: (billId: string, itemId: string, newQty: number) => void;
  removeUnsentItemFromBill: (billId: string, itemId: string) => void;
  confirmOrder: (billId: string) => void;
  sendOrderToKitchen: (billId: string) => void; // alias to confirmOrder
  voidOrderItem: (billId: string, itemId: string, reason: string) => void;
  applyBillDiscount: (billId: string, type: 'percentage' | 'fixed', value: number) => void;
  applyMembershipDiscount: (billId: string, memberPhone: string, pointsToRedeem: number) => boolean;
  canPay: (target: Bill | Table | null | undefined) => CanPayResult;
  splitBill: (originalBillId: string, itemSplits: { itemId: string; quantity: number }[]) => { originalBill: Bill; newBill: Bill } | null;
  mergeBills: (sourceBillIds: string[], targetBillId: string) => boolean;
  updateBillNote: (billId: string, note: string) => void;
  completeBillPayment: (billId: string, payments: PaymentRecord[]) => { success: boolean; bill: Bill };
  voidBill: (billId: string, reason: string) => void;
  lastCompletedBill: Bill | null;
  setLastCompletedBill: (bill: Bill | null) => void;
  loadArchivedBills: () => Promise<number>;

  // Shifts
  currentShift: Shift | null;
  openShift: (startingCash: number, note?: string) => void;
  closeShift: (countedCash: number, note?: string) => void;

  // Members
  members: Member[];
  findMemberByPhone: (phone: string) => Member | undefined;
  registerMember: (name: string, phone: string) => Member;

  // Settings & QR
  settings: ShopSettings;
  updateSettings: (updates: Partial<ShopSettings>) => void;
  qrImages: PaymentQrImage[];
  addQrImage: (label: string, imageData: string, isDefault?: boolean) => void;
  updateQrImage: (id: string, updates: Partial<PaymentQrImage>) => void;
  deleteQrImage: (id: string) => void;

  // Cloud Sync (Phase 1: Shop Settings & Media)
  cloudUser: FirebaseUser | null;
  cloudSyncStatus: 'idle' | 'saving' | 'saved' | 'pending' | 'error';
  cloudConnected: boolean;
  cloudErrorMessage: string | null;
  saveShopData: (overrideBundle?: { settings?: ShopSettings; qrImages?: PaymentQrImage[]; logo?: string }) => Promise<'saved' | 'pending' | 'error'>;
  loginCloud: (email: string, pass: string) => Promise<void>;
  loginCloudWithGoogle: () => Promise<void>;
  logoutCloud: () => Promise<void>;
  initialSyncPrompt: {
    type: 'cloud_empty' | 'conflict';
    cloudData: RemoteShopData | null;
  } | null;
  resolveInitialSync: (choice: 'use_cloud' | 'use_local') => Promise<void>;
  cancelInitialSync: () => void;
  hasExternalCloudUpdate: boolean;
  applyExternalCloudUpdate: () => void;
  dismissExternalCloudUpdate: () => void;
  isFormEditingShop: boolean;
  setIsFormEditingShop: (editing: boolean) => void;

  // Notifications
  notifications: AppNotification[];
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  callWaiterAlert: (tableNumber: string) => void;
  requestBillAlert: (tableNumber: string) => void;

  // Backup & Reset
  resetDemoData: () => void;
  exportDataJson: () => string;
  importDataJson: (jsonStr: string) => boolean;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USERS: 'kind_pos_users_v2',
  CURRENT_USER: 'kind_pos_curr_user_v2',
  THEME: 'kind_pos_theme_v2',
  TABLES: 'kind_pos_tables_v2',
  CATEGORIES: 'kind_pos_categories_v2',
  MENU: 'kind_pos_menu_v2',
  BILLS: 'kind_pos_bills_v2',
  MEMBERS: 'kind_pos_members_v2',
  SETTINGS: 'kind_pos_settings_v2',
  QR_IMAGES: 'kind_pos_qr_images_v2',
  SHIFT: 'kind_pos_shift_v2',
  NOTIFICATIONS: 'kind_pos_notifications_v2',
  OPTION_PRESETS: 'kind_pos_option_presets_v2',
  ZONES: 'kind_pos_zones_v2',
};

// Safe storage loader with automatic migration for tables and users
function loadState<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

// Normalize a table so available/reserved tables never carry stale customer or bill info
function normalizeTableState(t: Table): Table {
  if (t.status === 'available') {
    if (
      t.currentBillId !== undefined ||
      t.seatedAt !== undefined ||
      t.guestCount !== undefined ||
      t.reservation !== undefined
    ) {
      return {
        ...t,
        currentBillId: undefined,
        seatedAt: undefined,
        guestCount: undefined,
        reservation: undefined,
      };
    }
    return t;
  }
  if (t.status === 'reserved') {
    if (
      t.currentBillId !== undefined ||
      t.seatedAt !== undefined ||
      t.guestCount !== undefined
    ) {
      return {
        ...t,
        currentBillId: undefined,
        seatedAt: undefined,
        guestCount: undefined,
      };
    }
    return t;
  }
  return t;
}

// Reconcile tables with bills so paid/voided bills always release tables to available
function reconcileTablesWithBills(
  rawTables: Table[],
  billsList: Bill[]
): { tables: Table[]; changed: boolean } {
  let changed = false;
  const billsById = new Map<string, Bill>(billsList.map((b) => [b.id, b]));

  const reconciled = rawTables.map((rawT) => {
    const t = normalizeTableState(rawT);
    if (t !== rawT) changed = true;

    if (t.status === 'occupied' || t.status === 'payment_pending') {
      const openBillsOnTable = billsList.filter(
        (b) => b.tableId === t.id && b.status === 'open'
      );
      const activeOpenBills = openBillsOnTable.filter((b) =>
        b.items.some((i) => i.status !== 'voided')
      );

      if (t.currentBillId) {
        const linked = billsById.get(t.currentBillId);
        if (linked && (linked.status === 'paid' || linked.status === 'voided')) {
          changed = true;
          const nextBill = activeOpenBills[0];
          if (nextBill) {
            return {
              ...t,
              status: 'occupied' as const,
              currentBillId: nextBill.id,
              updatedAtMs: Math.max(t.updatedAtMs || 0, linked.updatedAtMs || 0, Date.now()),
            };
          }
          return {
            ...t,
            status: 'available' as const,
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            reservation: undefined,
            updatedAtMs: Math.max(t.updatedAtMs || 0, linked.updatedAtMs || 0, Date.now()),
          };
        }
      } else if (openBillsOnTable.length === 0) {
        changed = true;
        return {
          ...t,
          status: 'available' as const,
          currentBillId: undefined,
          seatedAt: undefined,
          guestCount: undefined,
          reservation: undefined,
          updatedAtMs: Math.max(t.updatedAtMs || 0, Date.now()),
        };
      }
    }

    return t;
  });

  return { tables: reconciled, changed };
}

// Merge remote entities keeping the most recently modified version
function mergeEntitiesByLatest<T extends { id: string; updatedAtMs?: number }>(
  currentList: T[],
  incomingItems: T[],
  removedIds: string[] = [],
  shouldPreferIncoming?: (incoming: T, existing: T) => boolean
): T[] {
  const map = new Map<string, T>(currentList.map((item) => [item.id, item]));
  incomingItems.forEach((incoming) => {
    const existing = map.get(incoming.id);
    if (!existing) {
      map.set(incoming.id, incoming);
      return;
    }
    if (shouldPreferIncoming) {
      if (shouldPreferIncoming(incoming, existing)) {
        map.set(incoming.id, incoming);
      }
      return;
    }
    const inTs = incoming.updatedAtMs || 0;
    const exTs = existing.updatedAtMs || 0;
    if (inTs === 0 || exTs === 0 || inTs >= exTs) {
      map.set(incoming.id, incoming);
    }
  });
  removedIds.forEach((id) => map.delete(id));
  return Array.from(map.values());
}

// Auto-place tables without positions on a neat grid per zone
function autoPositionTables(rawTables: Table[]): Table[] {
  const list = Array.isArray(rawTables) ? rawTables : INITIAL_TABLES;
  const zoneCounts: Record<string, number> = {};
  return list.map((t) => {
    const zone = t.zone || 'indoor';
    const index = zoneCounts[zone] || 0;
    zoneCounts[zone] = index + 1;

    const hasPos = typeof t.x === 'number' && typeof t.y === 'number';
    const col = index % 3;
    const row = Math.floor(index / 3);

    return normalizeTableState({
      ...t,
      shape: t.shape || (t.isStandaloneChair ? 'standalone_chair' : 'square'),
      chairStyle: t.chairStyle || 'standard',
      x: hasPos ? t.x : 60 + col * 220,
      y: hasPos ? t.y : 60 + row * 160,
      rotation: typeof t.rotation === 'number' ? t.rotation : 0,
    });
  });
}

// Clean up, normalize categoryId, and guarantee all categories have active food items
export function normalizeAndSeedMenuItems(loaded: any[] | null | undefined): MenuItem[] {
  const source = Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_MENU_ITEMS;
  const validCatIds = new Set(INITIAL_CATEGORIES.map((c) => c.id));

  const nameToCatId: Record<string, string> = {
    'อาหารจานเดียว': 'cat_1',
    'ต้มและแกง': 'cat_2',
    'ส้มตำและยำ': 'cat_3',
    'ของทานเล่น': 'cat_4',
    'เครื่องดื่มและขนมหวาน': 'cat_5',
  };

  const normalized = source.map((item: any) => {
    const { recipeIngredients, ...rest } = item;
    const initialMatch = INITIAL_MENU_ITEMS.find((m) => m.id === rest.id || m.name === rest.name);

    let validCatId = rest.categoryId;
    if (!validCatIds.has(validCatId)) {
      if (initialMatch && validCatIds.has(initialMatch.categoryId)) {
        validCatId = initialMatch.categoryId;
      } else if (rest.category && nameToCatId[rest.category]) {
        validCatId = nameToCatId[rest.category];
      } else if (rest.categoryName && nameToCatId[rest.categoryName]) {
        validCatId = nameToCatId[rest.categoryName];
      } else {
        validCatId = 'cat_1';
      }
    }

    const variants =
      Array.isArray(rest.variants) && rest.variants.length > 0
        ? rest.variants
        : initialMatch?.variants || [
            {
              id: `v_std_${rest.id || 'item'}`,
              name: 'ปกติ',
              nameEn: 'Standard',
              price: rest.price || 0,
              cost: rest.cost || 0,
              isAvailable: true,
              isSoldOut: rest.isSoldOut || false,
            },
          ];

    return {
      ...rest,
      id: rest.id || initialMatch?.id || `dish_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      categoryId: validCatId,
      isAvailable: true, // Always guarantee availability
      isSoldOut: rest.isSoldOut || false,
      name: rest.name || initialMatch?.name || 'เมนูอาหาร',
      nameEn: rest.nameEn || initialMatch?.nameEn || '',
      description: rest.description || initialMatch?.description || '',
      descriptionEn: rest.descriptionEn || initialMatch?.descriptionEn || '',
      image: rest.image || initialMatch?.image || '',
      price: rest.price || initialMatch?.price || 50,
      cost: rest.cost || initialMatch?.cost || 20,
      variants,
    };
  });

  // Guarantee all 5 standard categories have dishes populated from INITIAL_MENU_ITEMS
  INITIAL_MENU_ITEMS.forEach((initDish) => {
    const existingIndex = normalized.findIndex((d) => d.id === initDish.id || d.name === initDish.name);
    if (existingIndex === -1) {
      normalized.push({ ...initDish, isAvailable: true });
    } else {
      // Ensure the standard dish keeps its canonical categoryId and is available
      if (!normalized[existingIndex].categoryId || !validCatIds.has(normalized[existingIndex].categoryId)) {
        normalized[existingIndex].categoryId = initDish.categoryId;
      }
      normalized[existingIndex].isAvailable = true;
    }
  });

  return normalized;
}

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Active navigation: DEFAULT START PAGE IS 'tables'
  const [activeNav, setActiveNav] = useState<string>('tables');

  // Active Category filter for POS & Bottom Bar (null = none active)
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Table Zones configuration with persistence
  const [zones, setZones] = useState<TableZoneConfig[]>(() => {
    const loaded = loadState<TableZoneConfig[]>(STORAGE_KEYS.ZONES, INITIAL_ZONES);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_ZONES;
  });
  const zonesRef = useRef<TableZoneConfig[]>(zones);

  // Selected Zone for Table Layout & POS Table Dropdown (defaults to first zone)
  const [selectedZone, setSelectedZone] = useState<string>(() => {
    const loaded = loadState<TableZoneConfig[]>(STORAGE_KEYS.ZONES, INITIAL_ZONES);
    const validZones = Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_ZONES;
    return validZones[0]?.id || 'indoor';
  });

  useEffect(() => {
    zonesRef.current = zones;
    localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(zones));
  }, [zones]);

  const commitZones = useCallback((next: TableZoneConfig[], broadcast = true) => {
    zonesRef.current = next;
    try {
      localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(next));
    } catch {}
    setZones(next);
    if (broadcast) {
      syncService.broadcast('DATA_RELOAD');
    }
  }, []);

  const addZone = useCallback(
    (name: string, nameEn?: string, color?: string): TableZoneConfig => {
      const cleanName = name.trim();
      const newZone: TableZoneConfig = {
        id: 'zone_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        nameEn: nameEn?.trim() || '',
        color: color || '#f59e0b',
      };
      const nextZones = [...zonesRef.current, newZone];
      commitZones(nextZones);
      soundService.playTap();
      saveZoneRemote(newZone).catch((err) => console.warn('[Cloud saveZoneRemote error]:', err));
      return newZone;
    },
    [commitZones]
  );

  const updateZone = useCallback(
    (id: string, name: string, nameEn?: string, color?: string) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      let updatedZone: TableZoneConfig | null = null;
      const nextZones = zonesRef.current.map((z) => {
        if (z.id !== id) return z;
        const updated = {
          ...z,
          name: cleanName,
          nameEn: typeof nameEn === 'string' ? nameEn.trim() : z.nameEn,
          color: color || z.color,
        };
        updatedZone = updated;
        return updated;
      });
      commitZones(nextZones);
      soundService.playTap();
      if (updatedZone) {
        saveZoneRemote(updatedZone).catch((err) => console.warn('[Cloud saveZoneRemote error]:', err));
      }
    },
    [commitZones]
  );

  const deleteZone = useCallback(
    (id: string, reassignToZoneId?: string): { success: boolean; message?: string } => {
      const currentZones = zonesRef.current;
      if (currentZones.length <= 1) {
        return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากต้องมีโซนโต๊ะอย่างน้อย 1 โซน' };
      }

      const remainingZones = currentZones.filter((z) => z.id !== id);
      const targetZoneId =
        reassignToZoneId && remainingZones.some((z) => z.id === reassignToZoneId)
          ? reassignToZoneId
          : remainingZones[0]?.id || 'indoor';

      // Reassign tables in the deleted zone and sync to localStorage & Cloud
      const updatedTables: Table[] = [];
      const nextTables = tablesRef.current.map((t) => {
        if (t.zone !== id) return t;
        const up = { ...t, zone: targetZoneId };
        updatedTables.push(up);
        return up;
      });
      tablesRef.current = nextTables;
      try {
        localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(nextTables));
      } catch {}
      setTables(nextTables);

      setSelectedZone((prev) => (prev === id ? targetZoneId : prev));
      commitZones(remainingZones);
      syncService.broadcast('TABLE_UPDATED');
      soundService.playTap();

      updatedTables.forEach((t) => {
        saveTableRemote(t).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      });
      deleteZoneRemote(id).catch((err) => console.warn('[Cloud deleteZoneRemote error]:', err));
      return { success: true };
    },
    [commitZones]
  );

  const reorderZones = useCallback(
    (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return;
      const next = [...zonesRef.current];
      const [moved] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, moved);
      commitZones(next);
      soundService.playTap();
    },
    [commitZones]
  );

  // Users (filter out obsolete 'kitchen' role)
  const [users, setUsers] = useState<User[]>(() => {
    const loaded = loadState<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const validUsers = Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_USERS;
    return validUsers
      .filter((u: any) => u && typeof u === 'object' && u.role !== 'kitchen')
      .map((u: any) => {
        const initialMatch = INITIAL_USERS.find((init) => init.id === u.id);
        return {
          ...u,
          nameEn: u.nameEn || initialMatch?.nameEn || '',
        };
      });
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const loaded = loadState<User | null>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
    if (!loaded || (loaded as any).role === 'kitchen') {
      return INITIAL_USERS[0];
    }
    const initialMatch = INITIAL_USERS.find((init) => init.id === (loaded as any).id);
    return {
      ...loaded,
      nameEn: (loaded as any).nameEn || initialMatch?.nameEn || '',
    };
  });

  // Settings
  const [settings, setSettings] = useState<ShopSettings>(() =>
    loadState(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS)
  );

  // Tables with auto-positioning migration
  const [tables, setTables] = useState<Table[]>(() => {
    const loaded = loadState<Table[]>(STORAGE_KEYS.TABLES, INITIAL_TABLES);
    return autoPositionTables(loaded);
  });

  // Categories: Ensure standard categories always exist with canonical IDs
  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    const loaded = loadState<MenuCategory[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    const loadedArray = Array.isArray(loaded) ? loaded : [];

    // Ensure all 5 standard categories exist with their canonical IDs
    const standardMerged: MenuCategory[] = INITIAL_CATEGORIES.map((initCat) => {
      const match = loadedArray.find(
        (c: any) => c.id === initCat.id || c.name === initCat.name
      );
      return {
        ...initCat,
        name: match?.name || initCat.name,
        nameEn: match?.nameEn || initCat.nameEn || '',
        icon: match?.icon || initCat.icon,
        color: match?.color || initCat.color,
        sortOrder: match?.sortOrder || initCat.sortOrder,
      };
    });

    // Keep any custom user-added categories
    const customCats: MenuCategory[] = loadedArray.filter(
      (c: any) =>
        c &&
        c.id &&
        !INITIAL_CATEGORIES.some((init) => init.id === c.id || init.name === c.name)
    );

    return [...standardMerged, ...customCats];
  });

  // Menu Items: Clean up, normalize categoryId, and guarantee all categories have food items
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const loaded = loadState<MenuItem[]>(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS);
    return normalizeAndSeedMenuItems(loaded);
  });

  // Self-healing check on mount to ensure dishes are never missing
  useEffect(() => {
    setMenuItems((prev) => {
      const checked = normalizeAndSeedMenuItems(prev);
      const changed =
        checked.length !== prev.length ||
        checked.some(
          (item, i) =>
            item.categoryId !== prev[i]?.categoryId || item.isAvailable !== prev[i]?.isAvailable
        );
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(checked));
        return checked;
      }
      return prev;
    });
  }, []);

  // Bills
  const [bills, setBills] = useState<Bill[]>(() =>
    loadState(STORAGE_KEYS.BILLS, INITIAL_BILLS)
  );
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [lastCompletedBill, setLastCompletedBill] = useState<Bill | null>(null);

  // Shift
  const [currentShift, setCurrentShift] = useState<Shift | null>(() =>
    loadState(STORAGE_KEYS.SHIFT, INITIAL_SHIFT)
  );

  // Members
  const [members, setMembers] = useState<Member[]>(() =>
    loadState(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS)
  );

  // QR Images
  const [qrImages, setQrImages] = useState<PaymentQrImage[]>(() =>
    loadState(STORAGE_KEYS.QR_IMAGES, INITIAL_QR_IMAGES)
  );

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadState(STORAGE_KEYS.NOTIFICATIONS, [])
  );

  // Option Presets (หมวด set เมนูย่อย)
  const [optionPresets, setOptionPresets] = useState<OptionGroup[]>(() =>
    loadState(STORAGE_KEYS.OPTION_PRESETS, DEFAULT_OPTION_GROUP_PRESETS)
  );

  // Persistent refs & synchronous commit helpers (prevents React 18 batching & stale BroadcastChannel reads)
  const usersRef = useRef<User[]>(users);
  const currentUserRef = useRef<User | null>(currentUser);
  const settingsRef = useRef<ShopSettings>(settings);
  const tablesRef = useRef<Table[]>(tables);
  const categoriesRef = useRef<MenuCategory[]>(categories);
  const menuItemsRef = useRef<MenuItem[]>(menuItems);
  const billsRef = useRef<Bill[]>(bills);
  const shiftRef = useRef<Shift | null>(currentShift);
  const membersRef = useRef<Member[]>(members);
  const qrImagesRef = useRef<PaymentQrImage[]>(qrImages);
  const notificationsRef = useRef<AppNotification[]>(notifications);
  const optionPresetsRef = useRef<OptionGroup[]>(optionPresets);

  useEffect(() => {
    optionPresetsRef.current = optionPresets;
    localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(optionPresets));
  }, [optionPresets]);

  useEffect(() => {
    usersRef.current = users;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    tablesRef.current = tables;
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    categoriesRef.current = categories;
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    menuItemsRef.current = menuItems;
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    billsRef.current = bills;
    localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
  }, [bills]);

  useEffect(() => {
    shiftRef.current = currentShift;
    if (currentShift) {
      localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(currentShift));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SHIFT);
    }
  }, [currentShift]);

  useEffect(() => {
    membersRef.current = members;
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    qrImagesRef.current = qrImages;
    localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(qrImages));
  }, [qrImages]);

  useEffect(() => {
    notificationsRef.current = notifications;
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  const commitOptionPresets = useCallback((next: OptionGroup[], broadcast = true) => {
    optionPresetsRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(next)); } catch {}
    setOptionPresets(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitUsers = useCallback((next: User[], broadcast = true) => {
    usersRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next)); } catch {}
    setUsers(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitCurrentUser = useCallback((next: User | null, broadcast = true) => {
    currentUserRef.current = next;
    try {
      if (next) localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {}
    setCurrentUser(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitSettings = useCallback((next: ShopSettings, broadcast = true) => {
    settingsRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next)); } catch {}
    setSettings(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitTables = useCallback((next: Table[], broadcast = true) => {
    tablesRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(next)); } catch {}
    setTables(next);
    if (broadcast) syncService.broadcast('TABLE_UPDATED');
  }, []);

  const commitCategories = useCallback((next: MenuCategory[], broadcast = true) => {
    categoriesRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(next)); } catch {}
    setCategories(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitMenuItems = useCallback((next: MenuItem[], broadcast = true) => {
    menuItemsRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(next)); } catch {}
    setMenuItems(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitBills = useCallback((next: Bill[], broadcast = true) => {
    billsRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(next)); } catch {}
    setBills(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitShift = useCallback((next: Shift | null, broadcast = true) => {
    shiftRef.current = next;
    try {
      if (next) localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEYS.SHIFT);
    } catch {}
    setCurrentShift(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitMembers = useCallback((next: Member[], broadcast = true) => {
    membersRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(next)); } catch {}
    setMembers(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitQrImages = useCallback((next: PaymentQrImage[], broadcast = true) => {
    qrImagesRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(next)); } catch {}
    setQrImages(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  const commitNotifications = useCallback((next: AppNotification[], broadcast = true) => {
    notificationsRef.current = next;
    try { localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(next)); } catch {}
    setNotifications(next);
    if (broadcast) syncService.broadcast('DATA_RELOAD');
  }, []);

  // Clean old obsolete localStorage items
  useEffect(() => {
    try {
      localStorage.removeItem('kind_pos_ingredients_v1');
      localStorage.removeItem('kind_pos_stock_logs_v1');
      localStorage.removeItem('kind_pos_kitchen_v1');
    } catch {}
  }, []);

  // Self-healing reconciliation on mount: ensure paid/voided bills never leave tables stuck occupied
  useEffect(() => {
    const { tables: reconciled, changed } = reconcileTablesWithBills(
      tablesRef.current,
      billsRef.current
    );
    if (changed) {
      commitTables(reconciled, false);
    }
  }, [commitTables]);

  // Multi-Tab Sync Listener (Reload all STORAGE_KEYS & sync refs)
  useEffect(() => {
    const unsubscribe = syncService.subscribe((msg: SyncMessage) => {
      if (msg.type === 'DATA_RELOAD' || msg.type === 'TABLE_UPDATED') {
        const rawNextTables = autoPositionTables(loadState(STORAGE_KEYS.TABLES, INITIAL_TABLES));
        const nextBills = loadState(STORAGE_KEYS.BILLS, INITIAL_BILLS);
        const { tables: nextTables } = reconcileTablesWithBills(rawNextTables, nextBills);
        const nextMenu = normalizeAndSeedMenuItems(loadState(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS));
        const nextCats = loadState(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
        const nextNotifs = loadState(STORAGE_KEYS.NOTIFICATIONS, []);
        const nextSettings = loadState(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
        const nextQrs = loadState(STORAGE_KEYS.QR_IMAGES, INITIAL_QR_IMAGES);
        const nextUsers = loadState(STORAGE_KEYS.USERS, INITIAL_USERS);
        const nextCurrUser = loadState(STORAGE_KEYS.CURRENT_USER, null);
        const nextMembers = loadState(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS);
        const nextShift = loadState(STORAGE_KEYS.SHIFT, null);
        const nextPresets = loadState(STORAGE_KEYS.OPTION_PRESETS, DEFAULT_OPTION_GROUP_PRESETS);
        const nextZones = loadState(STORAGE_KEYS.ZONES, INITIAL_ZONES);

        tablesRef.current = nextTables;
        billsRef.current = nextBills;
        menuItemsRef.current = nextMenu;
        categoriesRef.current = nextCats;
        notificationsRef.current = nextNotifs;
        settingsRef.current = nextSettings;
        qrImagesRef.current = nextQrs;
        usersRef.current = nextUsers;
        currentUserRef.current = nextCurrUser;
        membersRef.current = nextMembers;
        shiftRef.current = nextShift;
        optionPresetsRef.current = nextPresets;
        zonesRef.current = nextZones;

        setTables(nextTables);
        setBills(nextBills);
        setMenuItems(nextMenu);
        setCategories(nextCats);
        setNotifications(nextNotifs);
        setSettings(nextSettings);
        setQrImages(nextQrs);
        setUsers(nextUsers);
        setCurrentUser(nextCurrUser);
        setMembers(nextMembers);
        setCurrentShift(nextShift);
        setOptionPresets(nextPresets);
        setZones(nextZones);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cloud Firestore & Auth State (Phase 1)
  const [cloudUser, setCloudUser] = useState<FirebaseUser | null>(() => getCloudUser());
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'pending' | 'error'>('idle');
  const [cloudErrorMessage, setCloudErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [hasExternalCloudUpdate, setHasExternalCloudUpdate] = useState<boolean>(false);
  const [cachedRemoteShopData, setCachedRemoteShopData] = useState<RemoteShopData | null>(null);
  const [isFormEditingShop, setIsFormEditingShop] = useState<boolean>(false);
  const [initialSyncPrompt, setInitialSyncPrompt] = useState<{
    type: 'cloud_empty' | 'conflict';
    cloudData: RemoteShopData | null;
  } | null>(null);

  // Online / Offline tracking & Auto-Resync when back online
  const PENDING_OFFLINE_SYNC_KEY = 'kind_pos_pending_offline_sync_v1';

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      if (cloudUser) {
        setCloudSyncStatus('pending');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [cloudUser]);

  // Mark pending offline sync whenever data changes while offline
  useEffect(() => {
    if (!isOnline && cloudUser) {
      try {
        localStorage.setItem(PENDING_OFFLINE_SYNC_KEY, 'true');
        setCloudSyncStatus('pending');
      } catch {}
    }
  }, [
    isOnline,
    cloudUser,
    bills,
    tables,
    menuItems,
    categories,
    zones,
    optionPresets,
    members,
    currentShift,
    settings,
    qrImages,
    users,
  ]);

  // Auto-sync queued offline changes to Cloud Firestore when internet is restored
  useEffect(() => {
    if (!isOnline || !cloudUser || !isFirebaseConfigured() || !db) return;

    const hasPending = localStorage.getItem(PENDING_OFFLINE_SYNC_KEY) === 'true';
    if (!hasPending) return;

    let cancelled = false;
    setCloudSyncStatus('saving');
    setCloudErrorMessage(null);

    uploadFullLocalDataToCloud({
      menuItems,
      categories,
      tables,
      zones,
      optionPresets,
      members,
      bills,
      users,
      shift: currentShift,
      notifications,
      settings,
      qrImages,
    })
      .then(() => {
        if (cancelled) return;
        localStorage.removeItem(PENDING_OFFLINE_SYNC_KEY);
        setCloudSyncStatus('saved');
        setTimeout(() => {
          if (!cancelled) setCloudSyncStatus('idle');
        }, 3000);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Auto-Resync Offline Data Error]:', err);
        setCloudSyncStatus('pending');
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOnline,
    cloudUser,
    menuItems,
    categories,
    tables,
    zones,
    optionPresets,
    members,
    bills,
    users,
    currentShift,
    notifications,
    settings,
    qrImages,
  ]);

  // Firebase Auth state listener
  useEffect(() => {
    const unsub = subscribeAuthState((user) => {
      setCloudUser(user);
    });
    return () => unsub();
  }, []);

  // Cloud real-time subscription (subscribeShop)
  useEffect(() => {
    if (!cloudUser || !isFirebaseConfigured()) return;

    const unsub = subscribeShop((remote: RemoteShopData) => {
      setCachedRemoteShopData(remote);
      // Conflict protection: if user is currently editing the shop settings form, don't overwrite inputs
      if (isFormEditingShop) {
        setHasExternalCloudUpdate(true);
      } else {
        // Direct safe update to state and localStorage (never loop back to Firestore)
        commitSettings(remote.settings, false);
        commitQrImages(remote.qrImages, true);
      }
    });

    return () => {
      unsub();
    };
  }, [cloudUser, isFormEditingShop, commitSettings, commitQrImages]);

  // Phase 2: Cloud real-time subscriptions for remaining data
  const lastCostPayloadSigRef = useRef<string>('');
  const latestCostPayloadRef = useRef<TonysKitchenPayload | null>(null);
  const prevCostPayloadRef = useRef<TonysKitchenPayload | null>(getCachedCostBundle());
  useEffect(() => {
    if (!cloudUser || !isFirebaseConfigured()) return;

    const unsubs: (() => void)[] = [];

    const reconcileMenuItemsWithCostPayload = (
      sourceItems: MenuItem[],
      remotePayload: TonysKitchenPayload,
      prevPayload: TonysKitchenPayload | null
    ): { nextItems: MenuItem[]; changedItems: MenuItem[] } => {
      const costMenus = remotePayload.payload?.menus || [];
      if (costMenus.length === 0) return { nextItems: sourceItems, changedItems: [] };

      const prevMenus = prevPayload?.payload?.menus || [];
      const remoteTime = extractCostTimestampMs(remotePayload);
      const isFromExternalCostApp = remotePayload.syncedFrom !== 'POS_CostProfitIntegration';
      const changedItems: MenuItem[] = [];

      const nextItems = sourceItems.map((posItem) => {
        const matchedCostMenu = findMatchingCostMenu(
          posItem.name,
          costMenus,
          posItem.costMenuId,
          posItem.id
        );
        if (!matchedCostMenu) return posItem;

        const prevCostMenu = prevMenus.find((pm) => pm.id === matchedCostMenu.id);
        let itemChanged =
          posItem.costMenuId !== matchedCostMenu.id ||
          posItem.costMenuName !== matchedCostMenu.name;
        let newBaseCost = posItem.cost;

        if (posItem.variants && posItem.variants.length > 0 && matchedCostMenu.variants) {
          const updatedVariants = posItem.variants.map((posVar) => {
            const matchedCv = findMatchingCostVariant(
              posVar.name,
              matchedCostMenu.variants || [],
              posVar.costVariantId,
              posVar.id,
              posItem.name
            );
            if (!matchedCv) return posVar;

            const recipeCost = getVariantRecipeCost(matchedCv);
            const hasExplicitCost =
              matchedCv.recipeCost !== undefined ||
              matchedCv.foodCostPerUnit !== undefined ||
              matchedCv.calculatedCost !== undefined ||
              matchedCv.cost !== undefined;
            const varCost = hasExplicitCost ? recipeCost : posVar.cost;

            const remoteSellPrice = getVariantSellingPrice(matchedCv);
            const prevMatchedCv = prevCostMenu
              ? findMatchingCostVariant(
                  posVar.name,
                  prevCostMenu.variants || [],
                  matchedCv.id,
                  posVar.id,
                  posItem.name
                )
              : undefined;
            const prevRemotePrice = prevMatchedCv ? getVariantSellingPrice(prevMatchedCv) : undefined;
            const remotePriceChangedInCostApp =
              isFromExternalCostApp &&
              prevRemotePrice !== undefined &&
              remoteSellPrice !== prevRemotePrice;

            const localTime = posVar.priceUpdatedAt ? new Date(posVar.priceUpdatedAt).getTime() : 0;
            const resolvedPrice =
              remoteSellPrice > 0 &&
              (posVar.price <= 0 || remotePriceChangedInCostApp || remoteTime >= localTime)
                ? remoteSellPrice
                : posVar.price;

            const costCvName = matchedCv.name || matchedCv.variantName || posVar.name;
            if (
              varCost !== posVar.cost ||
              resolvedPrice !== posVar.price ||
              posVar.costVariantId !== matchedCv.id ||
              posVar.costMenuId !== matchedCostMenu.id ||
              posVar.costVariantName !== costCvName
            ) {
              itemChanged = true;
            }
            return {
              ...posVar,
              price: resolvedPrice,
              cost: varCost,
              costMenuId: matchedCostMenu.id,
              costVariantId: matchedCv.id,
              costVariantName: costCvName,
              priceUpdatedAt:
                resolvedPrice !== posVar.price
                  ? new Date(remoteTime || Date.now()).toISOString()
                  : posVar.priceUpdatedAt,
            };
          });

          if (itemChanged) {
            const validCosts = updatedVariants.map((v) => v.cost).filter((c) => c > 0);
            if (validCosts.length > 0) {
              newBaseCost = Math.round((validCosts.reduce((a, b) => a + b, 0) / validCosts.length) * 100) / 100;
            }
            const firstPrice = updatedVariants[0]?.price;
            const updatedItem: MenuItem = {
              ...posItem,
              price: typeof firstPrice === 'number' && firstPrice > 0 ? firstPrice : posItem.price,
              cost: newBaseCost,
              costMenuId: matchedCostMenu.id,
              costMenuName: matchedCostMenu.name,
              variants: updatedVariants,
            };
            changedItems.push(updatedItem);
            return updatedItem;
          }
        } else {
          const singleVar = matchedCostMenu.variants?.[0];
          const singleCost =
            matchedCostMenu.recipeCost ??
            (singleVar ? getVariantRecipeCost(singleVar) : undefined) ??
            posItem.cost;
          const singleRemotePrice =
            matchedCostMenu.sellingPrice ??
            (singleVar ? getVariantSellingPrice(singleVar) : 0);
          const resolvedSinglePrice =
            singleRemotePrice > 0 && (posItem.price <= 0 || isFromExternalCostApp)
              ? singleRemotePrice
              : posItem.price;
          if (
            singleCost !== posItem.cost ||
            resolvedSinglePrice !== posItem.price ||
            posItem.costMenuId !== matchedCostMenu.id ||
            posItem.costMenuName !== matchedCostMenu.name
          ) {
            const updatedItem: MenuItem = {
              ...posItem,
              price: resolvedSinglePrice,
              cost: singleCost,
              costMenuId: matchedCostMenu.id,
              costMenuName: matchedCostMenu.name,
            };
            changedItems.push(updatedItem);
            return updatedItem;
          }
        }
        return posItem;
      });

      return { nextItems, changedItems };
    };

    // 1. Menu items
    unsubs.push(
      subscribeCollection<MenuItem>('menuItems', (remoteItems, removedIds) => {
        if ((!remoteItems || remoteItems.length === 0) && removedIds.length === 0) return;
        const merged = mergeEntitiesByLatest(menuItemsRef.current, remoteItems, removedIds);
        if (latestCostPayloadRef.current) {
          const { nextItems, changedItems } = reconcileMenuItemsWithCostPayload(
            merged,
            latestCostPayloadRef.current,
            prevCostPayloadRef.current
          );
          commitMenuItems(nextItems);
          if (changedItems.length > 0) {
            changedItems.forEach((item) => {
              saveMenuItemRemote(item).catch((err) =>
                console.warn('[MenuItems Cost Reconcile saveMenuItemRemote error]:', err)
              );
            });
          }
          return;
        }
        commitMenuItems(merged);
      })
    );

    // 2. Categories
    unsubs.push(
      subscribeCollection<MenuCategory>('categories', (remoteCats, removedIds) => {
        if ((!remoteCats || remoteCats.length === 0) && removedIds.length === 0) return;
        commitCategories(mergeEntitiesByLatest(categoriesRef.current, remoteCats, removedIds));
      })
    );

    // 3. Tables
    unsubs.push(
      subscribeCollection<Table>('tables', (remoteTables, removedIds) => {
        if ((!remoteTables || remoteTables.length === 0) && removedIds.length === 0) return;
        const merged = mergeEntitiesByLatest<Table>(
          tablesRef.current,
          remoteTables,
          removedIds,
          (incoming, existing) => {
            // Do not overwrite an already locally released table with an outdated occupied snapshot for the same paid bill
            if (
              existing.status === 'available' &&
              (incoming.status === 'occupied' || incoming.status === 'payment_pending') &&
              incoming.currentBillId
            ) {
              const linked = billsRef.current.find((b) => b.id === incoming.currentBillId);
              if (linked && (linked.status === 'paid' || linked.status === 'voided')) {
                return false;
              }
            }
            const inTs = incoming.updatedAtMs || 0;
            const exTs = existing.updatedAtMs || 0;
            return inTs === 0 || exTs === 0 || inTs >= exTs;
          }
        );
        const positioned = autoPositionTables(merged);
        const { tables: reconciled } = reconcileTablesWithBills(positioned, billsRef.current);
        commitTables(reconciled);
      })
    );

    // 4. Zones
    unsubs.push(
      subscribeCollection<TableZoneConfig>('zones', (remoteZones, removedIds) => {
        if ((!remoteZones || remoteZones.length === 0) && removedIds.length === 0) return;
        commitZones(mergeEntitiesByLatest(zonesRef.current, remoteZones, removedIds));
      })
    );

    // 5. Option Presets
    unsubs.push(
      subscribeCollection<OptionGroup>('optionPresets', (remotePresets, removedIds) => {
        if ((!remotePresets || remotePresets.length === 0) && removedIds.length === 0) return;
        commitOptionPresets(mergeEntitiesByLatest(optionPresetsRef.current, remotePresets, removedIds));
      })
    );

    // 6. Members
    unsubs.push(
      subscribeCollection<Member>('members', (remoteMembers, removedIds) => {
        if ((!remoteMembers || remoteMembers.length === 0) && removedIds.length === 0) return;
        commitMembers(mergeEntitiesByLatest(membersRef.current, remoteMembers, removedIds));
      })
    );

    // 7. Recent Bills (open bills & bills within last 30 days)
    unsubs.push(
      subscribeRecentBills((remoteRecentBills, removedIds = []) => {
        if ((!remoteRecentBills || remoteRecentBills.length === 0) && removedIds.length === 0) return;
        const nextBills = mergeEntitiesByLatest<Bill>(
          billsRef.current,
          remoteRecentBills,
          removedIds,
          (incoming, existing) => {
            if (incoming.status !== 'open' && existing.status === 'open') return true;
            if (existing.status !== 'open' && incoming.status === 'open') return false;
            const inTs = incoming.updatedAtMs || 0;
            const exTs = existing.updatedAtMs || 0;
            return inTs === 0 || exTs === 0 || inTs >= exTs;
          }
        );
        commitBills(nextBills);
        const { tables: reconciledTables, changed } = reconcileTablesWithBills(
          tablesRef.current,
          nextBills
        );
        if (changed) {
          commitTables(reconciledTables);
        }
      })
    );

    // 8. Active Shift
    unsubs.push(
      subscribeActiveShift((remoteShift) => {
        commitShift(remoteShift);
      })
    );

    // 9. Users
    unsubs.push(
      subscribeCollection<User>('users', (remoteUsers, removedIds) => {
        if ((!remoteUsers || remoteUsers.length === 0) && removedIds.length === 0) return;
        const map = new Map<string, User>(usersRef.current.map((u) => [u.id, u]));
        remoteUsers.forEach((ru) => {
          const localUser = map.get(ru.id);
          map.set(ru.id, {
            ...ru,
            pin: localUser?.pin || ru.pin || '',
          });
        });
        removedIds.forEach((id) => map.delete(id));
        commitUsers(Array.from(map.values()));
      })
    );

    // 10. Notifications
    unsubs.push(
      subscribeCollection<AppNotification>('notifications', (remoteNotifs, removedIds) => {
        if ((!remoteNotifs || remoteNotifs.length === 0) && removedIds.length === 0) return;
        const map = new Map<string, AppNotification>(notificationsRef.current.map((n) => [n.id, n]));
        remoteNotifs.forEach((rn) => map.set(rn.id, rn));
        removedIds.forEach((id) => map.delete(id));
        const merged = Array.from(map.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 50);
        commitNotifications(merged);
      })
    );

    // 11. Always-on real-time Cost & Profit integration listener (auto-syncs linked recipe costs, selling prices & OpEx)
    const costUnsub = subscribeCostManagementData((remotePayload: TonysKitchenPayload) => {
      try {
        const sig = JSON.stringify({
          menus: remotePayload?.payload?.menus || [],
          settings: remotePayload?.payload?.settings || {},
          expenses: remotePayload?.payload?.expenses || [],
          employees: remotePayload?.payload?.employees || [],
        });
        latestCostPayloadRef.current = remotePayload;
        if (sig === lastCostPayloadSigRef.current) return;
        lastCostPayloadSigRef.current = sig;

        const prevPayload = prevCostPayloadRef.current;
        const costSettings = remotePayload.payload?.settings || {};
        const fixedOpEx = calculateFixedMonthlyOpEx(remotePayload);

        // Sync OpEx immediately without waiting for modal
        try {
          const existingRaw = localStorage.getItem(OPEX_STORAGE_KEY);
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          const updatedOpEx = {
            ...existing,
            defaultGrabGpRate: costSettings.grabFoodCommissionPercent ?? existing.defaultGrabGpRate ?? 37,
            defaultLinemanGpRate: costSettings.lineManCommissionPercent ?? existing.defaultLinemanGpRate ?? 37,
            defaultPackagingCost: costSettings.deliveryPackagingCost ?? existing.defaultPackagingCost ?? 8,
            monthlyRent: fixedOpEx.rent > 0 ? fixedOpEx.rent : existing.monthlyRent ?? 15000,
            monthlyFixedSalaries: fixedOpEx.salaries > 0 ? fixedOpEx.salaries : existing.monthlyFixedSalaries ?? 57000,
            monthlyUtilitiesFixed: fixedOpEx.utilities > 0 ? fixedOpEx.utilities : existing.monthlyUtilitiesFixed ?? 8760,
            customFixedExpense: fixedOpEx.extraFixed,
          };
          localStorage.setItem(OPEX_STORAGE_KEY, JSON.stringify(updatedOpEx));
          notifyOpExUpdated();
        } catch (err) {
          console.warn('[Auto Cost OpEx Sync]:', err);
        }

        // Sync linked POS MenuItems' locked costs and newer selling prices immediately
        const { nextItems, changedItems } = reconcileMenuItemsWithCostPayload(
          menuItemsRef.current,
          remotePayload,
          prevPayload
        );
        prevCostPayloadRef.current = remotePayload;

        if (changedItems.length > 0) {
          commitMenuItems(nextItems);
          changedItems.forEach((item) => {
            saveMenuItemRemote(item).catch((err) =>
              console.warn('[Auto Cost Sync saveMenuItemRemote error]:', err)
            );
          });
        }
      } catch (err) {
        console.warn('[Auto Cost Sync Error]:', err);
      }
    });
    if (costUnsub) unsubs.push(costUnsub);

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [
    cloudUser,
    commitMenuItems,
    commitCategories,
    commitTables,
    commitZones,
    commitOptionPresets,
    commitMembers,
    commitBills,
    commitShift,
    commitUsers,
    commitNotifications,
  ]);

  // Automatic PIN migration for existing legacy plain-text users
  useEffect(() => {
    let hasUnmigrated = false;
    for (const u of users) {
      if (!u.pinHash || !u.salt) {
        hasUnmigrated = true;
        break;
      }
    }
    if (hasUnmigrated) {
      (async () => {
        const updatedUsers = await Promise.all(
          users.map(async (u) => {
            if (u.pinHash && u.salt) return u;
            const salt = generateSalt();
            const pinHash = await hashPinWithSalt(u.pin || '1234', salt);
            return {
              ...u,
              salt,
              pinHash,
            };
          })
        );
        setUsers(updatedUsers);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      })();
    }
  }, [users]);

  const applyExternalCloudUpdate = useCallback(() => {
    if (cachedRemoteShopData) {
      commitSettings(cachedRemoteShopData.settings, false);
      commitQrImages(cachedRemoteShopData.qrImages, true);
    }
    setHasExternalCloudUpdate(false);
  }, [cachedRemoteShopData, commitSettings, commitQrImages]);

  const dismissExternalCloudUpdate = useCallback(() => {
    setHasExternalCloudUpdate(false);
  }, []);

  // Save Shop Data (Requirement C.1)
  const saveShopData = useCallback(
    async (overrideBundle?: { settings?: ShopSettings; qrImages?: PaymentQrImage[]; logo?: string }): Promise<'saved' | 'pending' | 'error'> => {
      const targetSettings = overrideBundle?.settings || settingsRef.current;
      const targetQrImages = overrideBundle?.qrImages || qrImagesRef.current;
      const targetLogo = overrideBundle?.logo !== undefined ? overrideBundle.logo : (targetSettings.logoUrl || '');

      // (ก) เขียน settings, qrImages, โลโก้ ลง localStorage และ state ทันที
      commitSettings(targetSettings, false);
      commitQrImages(targetQrImages, true);

      // Local-first check: if Firebase is not configured or not logged in
      if (!isFirebaseConfigured() || !cloudUser || !db) {
        setCloudSyncStatus('saved');
        setTimeout(() => setCloudSyncStatus('idle'), 3000);
        return 'saved';
      }

      // (ค) เรียก saveShopBundle แล้วรอผลสูงสุด 8 วินาที
      setCloudSyncStatus('saving');
      setCloudErrorMessage(null);

      try {
        const bundle: ShopBundle = {
          settings: targetSettings,
          qrImages: targetQrImages,
          logo: targetLogo,
        };

        const timeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), 8000)
        );

        const savePromise = saveShopBundle(bundle, (warnMsg) => {
          setCloudErrorMessage(warnMsg);
        }).then(() => 'done' as const);

        const raceResult = await Promise.race([savePromise, timeoutPromise]);

        if (raceResult === 'done') {
          setCloudSyncStatus('saved');
          setTimeout(() => setCloudSyncStatus('idle'), 3000);
          return 'saved';
        } else {
          // Exceeded 8s or offline -> pending in persistent local cache
          setCloudSyncStatus('pending');

          // Follow up with waitForPendingWrites
          waitForPendingWrites(db)
            .then(() => {
              setCloudSyncStatus('saved');
              setTimeout(() => setCloudSyncStatus('idle'), 3000);
            })
            .catch((pwErr) => {
              console.warn('[waitForPendingWrites error]:', pwErr);
            });

          return 'pending';
        }
      } catch (err: any) {
        console.error('[saveShopData error]:', err);
        const errMsg = err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลขึ้น Cloud';
        setCloudErrorMessage(errMsg);
        setCloudSyncStatus('error');
        return 'error';
      }
    },
    [cloudUser, commitSettings, commitQrImages]
  );

  // Login Cloud with initial sync comparison
  const loginCloud = useCallback(
    async (email: string, pass: string) => {
      const user = await loginToCloud(email, pass);
      setCloudUser(user);

      try {
        const remote = await fetchRemoteShopBundle();
        if (!remote) {
          // Cloud is empty, ask user if they want to upload local data
          setInitialSyncPrompt({
            type: 'cloud_empty',
            cloudData: null,
          });
        } else {
          // Check if remote data differs from local
          const curSettings = settingsRef.current;
          const curQrImages = qrImagesRef.current;
          const isDifferent =
            remote.settings.shopName !== curSettings.shopName ||
            remote.settings.taxId !== curSettings.taxId ||
            remote.settings.phone !== curSettings.phone ||
            remote.qrImages.length !== curQrImages.length;
          if (isDifferent) {
            setInitialSyncPrompt({
              type: 'conflict',
              cloudData: remote,
            });
          } else {
            // Already in sync
            commitSettings(remote.settings, false);
            commitQrImages(remote.qrImages, true);
          }
        }
      } catch (syncErr) {
        console.warn('[Initial Sync Check Error]:', syncErr);
      }
    },
    [commitSettings, commitQrImages]
  );

  const loginCloudWithGoogle = useCallback(async () => {
    const user = await loginWithGoogle();
    setCloudUser(user);

    try {
      const remote = await fetchRemoteShopBundle();
      if (!remote) {
        setInitialSyncPrompt({
          type: 'cloud_empty',
          cloudData: null,
        });
      } else {
        const curSettings = settingsRef.current;
        const curQrImages = qrImagesRef.current;
        const isDifferent =
          remote.settings.shopName !== curSettings.shopName ||
          remote.settings.taxId !== curSettings.taxId ||
          remote.settings.phone !== curSettings.phone ||
          remote.qrImages.length !== curQrImages.length;
        if (isDifferent) {
          setInitialSyncPrompt({
            type: 'conflict',
            cloudData: remote,
          });
        } else {
          commitSettings(remote.settings, false);
          commitQrImages(remote.qrImages, true);
        }
      }
    } catch (syncErr) {
      console.warn('[Initial Sync Check Error]:', syncErr);
    }
  }, [commitSettings, commitQrImages]);

  const logoutCloud = useCallback(async () => {
    await logoutFromCloud();
    setCloudUser(null);
    setInitialSyncPrompt(null);
    setHasExternalCloudUpdate(false);
    setCloudSyncStatus('idle');
  }, []);

  const resolveInitialSync = useCallback(
    async (choice: 'use_cloud' | 'use_local') => {
      if (choice === 'use_cloud' && initialSyncPrompt?.cloudData) {
        const remote = initialSyncPrompt.cloudData;
        commitSettings(remote.settings, false);
        commitQrImages(remote.qrImages, true);
      } else if (choice === 'use_local') {
        if (db) {
          await uploadFullLocalDataToCloud({
            menuItems: menuItemsRef.current,
            categories: categoriesRef.current,
            tables: tablesRef.current,
            zones: zonesRef.current,
            optionPresets: optionPresetsRef.current,
            members: membersRef.current,
            bills: billsRef.current,
            users: usersRef.current,
            shift: shiftRef.current,
            notifications: notificationsRef.current,
            settings: settingsRef.current,
            qrImages: qrImagesRef.current,
          });
        }
      }
      setInitialSyncPrompt(null);
    },
    [initialSyncPrompt, commitSettings, commitQrImages]
  );

  const cancelInitialSync = useCallback(() => {
    setInitialSyncPrompt(null);
  }, []);


  // Helper to recalculate totals
  const recalculateBill = useCallback((bill: Bill, currentSettings: ShopSettings): Bill => {
    const subtotal = bill.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    let discountAmount = 0;
    if (bill.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * (bill.discountValue / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, bill.discountValue);
    }

    if (bill.membershipDiscountPoints && bill.membershipDiscountPoints > 0) {
      discountAmount += bill.membershipDiscountPoints * currentSettings.pointsRedeemRate;
    }
    discountAmount = Math.min(subtotal, discountAmount);

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    let serviceChargeAmount = 0;
    if (bill.serviceChargeRate > 0) {
      serviceChargeAmount = Math.round(discountedSubtotal * (bill.serviceChargeRate / 100) * 100) / 100;
    }

    const totalBeforeVat = discountedSubtotal + serviceChargeAmount;

    let vatAmount = 0;
    let grandTotal = totalBeforeVat;

    if (bill.vatRate > 0) {
      if (bill.vatIncluded) {
        vatAmount = Math.round(((totalBeforeVat * bill.vatRate) / (100 + bill.vatRate)) * 100) / 100;
        grandTotal = totalBeforeVat;
      } else {
        vatAmount = Math.round((totalBeforeVat * (bill.vatRate / 100)) * 100) / 100;
        grandTotal = totalBeforeVat + vatAmount;
      }
    }

    const deliveryGpAmount =
      bill.deliveryGpRate && bill.deliveryGpRate > 0
        ? Math.round((subtotal * (bill.deliveryGpRate / 100)) * 100) / 100
        : (bill.deliveryGpAmount || 0);

    return {
      ...bill,
      subtotal,
      discountAmount,
      serviceChargeAmount,
      vatAmount,
      deliveryGpAmount,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, []);

  // Auth Handlers (Never send plain-text PIN to Cloud, verify with salt & SHA-256)
  const loginWithPin = useCallback(
    async (pin: string): Promise<{ success: boolean; message?: string }> => {
      for (const u of usersRef.current) {
        const isMatch = await verifyPin(pin, u);
        if (isMatch) {
          let userToSet = u;
          if (!u.pinHash || !u.salt) {
            const salt = generateSalt();
            const pinHash = await hashPinWithSalt(pin, salt);
            userToSet = { ...u, salt, pinHash };
            commitUsers(usersRef.current.map((item) => (item.id === u.id ? userToSet : item)));
            saveUserRemote(userToSet).catch((err) => console.warn('[Cloud saveUserRemote error]:', err));
          }
          commitCurrentUser(userToSet);
          setActiveCategory(null);
          setActiveNav('tables'); // Always open Tables on login!
          return { success: true };
        }
      }
      return { success: false, message: 'รหัส PIN ไม่ถูกต้อง' };
    },
    [commitUsers, commitCurrentUser]
  );

  const switchUser = useCallback(
    (userId: string) => {
      const target = usersRef.current.find((u) => u.id === userId);
      if (target) {
        commitCurrentUser(target);
        setActiveCategory(null);
        setActiveNav('tables');
      }
    },
    [commitCurrentUser]
  );

  const logout = useCallback(() => {
    commitCurrentUser(null);
  }, [commitCurrentUser]);

  const addStaff = useCallback(
    async (userData: Omit<User, 'id'>) => {
      const salt = userData.salt || generateSalt();
      const pinHash = userData.pinHash || (await hashPinWithSalt(userData.pin || '1234', salt));

      const newUser: User = {
        ...userData,
        id: 'usr_' + Date.now(),
        salt,
        pinHash,
      };
      commitUsers([...usersRef.current, newUser]);
      saveUserRemote(newUser).catch((err) => console.warn('[Cloud sync addStaff]', err));
    },
    [commitUsers]
  );

  const updateStaff = useCallback(
    async (id: string, updates: Partial<User>) => {
      let finalSalt = updates.salt;
      let finalPinHash = updates.pinHash;

      if (updates.pin && (!finalPinHash || !finalSalt)) {
        finalSalt = generateSalt();
        finalPinHash = await hashPinWithSalt(updates.pin, finalSalt);
      }

      let updatedUserObj: User | null = null;
      const nextUsers = usersRef.current.map((u) => {
        if (u.id !== id) return u;
        const updated: User = {
          ...u,
          ...updates,
          ...(finalSalt ? { salt: finalSalt } : {}),
          ...(finalPinHash ? { pinHash: finalPinHash } : {}),
        };
        updatedUserObj = updated;
        return updated;
      });
      commitUsers(nextUsers);

      if (updatedUserObj) {
        saveUserRemote(updatedUserObj).catch((err) => console.warn('[Cloud sync updateStaff]', err));
      }
    },
    [commitUsers]
  );

  const deleteStaff = useCallback(
    (id: string) => {
      commitUsers(usersRef.current.filter((u) => u.id !== id));
      deleteUserRemote(id).catch((err) => console.warn('[Cloud sync deleteStaff]', err));
    },
    [commitUsers]
  );

  // Active Bill
  const activeBill = useMemo(() => {
    if (!activeBillId) return null;
    return bills.find((b) => b.id === activeBillId) || null;
  }, [activeBillId, bills]);

  // Notifications
  const addNotification = useCallback(
    (type: AppNotification['type'], title: string, message: string, tableNumber?: string) => {
      const newNotif: AppNotification = {
        id: 'notif_' + Date.now(),
        type,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
        tableNumber,
      };
      commitNotifications([newNotif, ...notificationsRef.current.slice(0, 49)]);
      saveNotificationRemote(newNotif).catch((err) => console.warn('[Cloud saveNotificationRemote error]:', err));
    },
    [commitNotifications]
  );

  const markNotificationAsRead = useCallback(
    (id: string) => {
      commitNotifications(
        notificationsRef.current.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      markNotificationReadRemote(id).catch((err) => console.warn('[Cloud markNotificationReadRemote error]:', err));
    },
    [commitNotifications]
  );

  const clearAllNotifications = useCallback(() => {
    const ids = notificationsRef.current.map((n) => n.id);
    commitNotifications([]);
    clearNotificationsRemote(ids).catch((err) => console.warn('[Cloud clearNotificationsRemote error]:', err));
  }, [commitNotifications]);

  const callWaiterAlert = useCallback(
    (tableNumber: string) => {
      addNotification('call_waiter', 'ลูกค้าเรียกพนักงาน!', `โต๊ะ ${tableNumber} กดเรียกบริการ`, tableNumber);
      soundService.playReadyChime();
    },
    [addNotification]
  );

  const requestBillAlert = useCallback(
    (tableNumber: string) => {
      addNotification('request_bill', 'ลูกค้าขอเช็คบิล!', `โต๊ะ ${tableNumber} ขอยอดชำระเงิน`, tableNumber);
      soundService.playReadyChime();
      const nowTs = Date.now();
      const updatedTables: Table[] = [];
      const nextTables = tablesRef.current.map((t) => {
        if (t.number !== tableNumber) return t;
        const up: Table = { ...t, status: 'payment_pending', updatedAtMs: nowTs };
        updatedTables.push(up);
        return up;
      });
      commitTables(nextTables);
      updatedTables.forEach((t) => {
        saveTableRemote(t).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      });
    },
    [addNotification, commitTables]
  );

  // Order & Bill Creation
  const createBillForOrder = useCallback(
    (orderType: OrderType, tableId?: string, guestCount?: number, deliveryInfo?: DeliveryInfo): Bill => {
      const now = new Date();
      const nowTs = now.getTime();
      const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
      const count = billsRef.current.length + 1;
      const billNumber = `B-${dateStr}-${String(count).padStart(3, '0')}`;

      const assignedTable = tableId ? tablesRef.current.find((t) => t.id === tableId) : undefined;
      const activeSettings = settingsRef.current;
      const actor = currentUserRef.current;

      const newBill: Bill = {
        id: 'bill_' + nowTs,
        billNumber,
        orderType,
        tableId,
        tableName: assignedTable?.number,
        guestCount: guestCount || (assignedTable?.capacity || 2),
        deliveryInfo,
        deliveryPlatform: deliveryInfo?.platform,
        deliveryGpRate: deliveryInfo?.gpRate,
        deliveryGpAmount: deliveryInfo?.gpAmount,
        packagingCost: deliveryInfo?.packagingCost,
        items: [],
        status: 'open',
        createdAt: now.toISOString(),
        createdByUserId: actor?.id || 'unknown',
        createdByName: actor?.name || 'พนักงาน',
        subtotal: 0,
        discountType: 'percentage',
        discountValue: 0,
        discountAmount: 0,
        serviceChargeRate: activeSettings.serviceChargeEnabled ? activeSettings.serviceChargeRate : 0,
        serviceChargeAmount: 0,
        vatRate: activeSettings.vatEnabled ? activeSettings.vatRate : 0,
        vatAmount: 0,
        vatIncluded: activeSettings.vatInclusive,
        grandTotal: 0,
        payments: [],
        updatedAtMs: nowTs,
      };

      const nextBills = [...billsRef.current, newBill];
      commitBills(nextBills);
      setActiveBillId(newBill.id);
      if (deliveryInfo) {
        saveBillRemote(newBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }

      // Table stays 'available' when bill has 0 ordered items; becomes 'occupied' once an item is added.
      return newBill;
    },
    [commitBills]
  );

  const syncTableOccupancyForBill = useCallback(
    (bill: Bill | null, nextBills: Bill[], nowTs: number) => {
      const targetTableId = bill?.tableId;
      if (!targetTableId) return;

      const activeOpenOnTable = nextBills.filter(
        (b) =>
          b.tableId === targetTableId &&
          b.status === 'open' &&
          (b.items || []).some((i) => i.status !== 'voided')
      );

      let updatedTable: Table | null = null;
      const nextTables = tablesRef.current.map((t) => {
        if (t.id !== targetTableId) return t;
        if (activeOpenOnTable.length > 0) {
          const desiredBillId =
            bill && activeOpenOnTable.some((b) => b.id === bill.id)
              ? bill.id
              : activeOpenOnTable[0].id;
          const desiredStatus: Table['status'] =
            t.status === 'payment_pending' ? 'payment_pending' : 'occupied';
          if (
            t.status === desiredStatus &&
            t.currentBillId === desiredBillId &&
            t.seatedAt &&
            t.guestCount
          ) {
            return t;
          }
          const up: Table = {
            ...t,
            status: desiredStatus,
            currentBillId: desiredBillId,
            seatedAt: t.seatedAt || new Date(nowTs).toISOString(),
            guestCount: t.guestCount || bill?.guestCount || t.capacity || 2,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          updatedTable = up;
          return up;
        }

        // No ordered food items remain on this table -> always mark available
        if (t.status === 'available' && !t.currentBillId && !t.seatedAt && !t.guestCount) {
          return t;
        }
        const up: Table = {
          ...t,
          status: t.status === 'reserved' ? 'reserved' : 'available',
          currentBillId: undefined,
          seatedAt: undefined,
          guestCount: undefined,
          updatedAtMs: nowTs,
        };
        updatedTable = up;
        return up;
      });

      if (updatedTable) {
        commitTables(nextTables, false);
        syncService.broadcast('TABLE_UPDATED');
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitTables]
  );

  const navigateTo = useCallback(
    (nav: string) => {
      if (nav !== 'pos') {
        const currentBills = billsRef.current;
        const emptyDraftIds = new Set(
          currentBills
            .filter(
              (b) =>
                b.status === 'open' &&
                (b.items || []).length === 0 &&
                !b.note &&
                !b.deliveryInfo &&
                (b.payments || []).length === 0
            )
            .map((b) => b.id)
        );

        if (emptyDraftIds.size > 0) {
          const cleanedBills = currentBills.filter((b) => !emptyDraftIds.has(b.id));
          commitBills(cleanedBills, false);
          if (activeBillId && emptyDraftIds.has(activeBillId)) {
            setActiveBillId(null);
          }
        }

        const remainingBills =
          emptyDraftIds.size > 0
            ? billsRef.current
            : currentBills;
        const tablesToReset: Table[] = [];
        const nowTs = Date.now();
        const checkedTables = tablesRef.current.map((t) => {
          if (t.status === 'reserved' || t.status === 'available') return t;
          const hasOrdered = remainingBills.some(
            (b) =>
              b.status === 'open' &&
              (b.tableId === t.id || (t.currentBillId && b.id === t.currentBillId)) &&
              (b.items || []).some((i) => i.status !== 'voided')
          );
          if (hasOrdered) return t;
          const resetTable: Table = {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            updatedAtMs: nowTs,
          };
          tablesToReset.push(resetTable);
          return resetTable;
        });

        if (tablesToReset.length > 0) {
          commitTables(checkedTables, false);
          syncService.broadcast('TABLE_UPDATED');
          tablesToReset.forEach((tbl) => {
            saveTableRemote(tbl).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
          });
        }
      }
      setActiveNav(nav);
    },
    [activeBillId, commitBills, commitTables]
  );

  const openTable = useCallback(
    (tableId: string, guestCount: number): string => {
      // Prune unused 0-item empty drafts from other tables so empty clicks never accumulate
      const emptyOtherDraftIds = new Set(
        billsRef.current
          .filter(
            (b) =>
              b.status === 'open' &&
              b.tableId !== tableId &&
              (b.items || []).length === 0 &&
              !b.note &&
              !b.deliveryInfo &&
              (b.payments || []).length === 0
          )
          .map((b) => b.id)
      );
      if (emptyOtherDraftIds.size > 0) {
        commitBills(
          billsRef.current.filter((b) => !emptyOtherDraftIds.has(b.id)),
          false
        );
      }

      const existingTable = tablesRef.current.find((t) => t.id === tableId);
      const existingOpenBill =
        (existingTable?.currentBillId
          ? billsRef.current.find(
              (b) => b.id === existingTable.currentBillId && b.status === 'open'
            )
          : undefined) ||
        billsRef.current.find((b) => b.tableId === tableId && b.status === 'open');

      if (existingOpenBill) {
        setActiveBillId(existingOpenBill.id);
        return existingOpenBill.id;
      }

      const newBill = createBillForOrder('dine_in', tableId, guestCount);
      return newBill.id;
    },
    [createBillForOrder, commitBills]
  );

  const assignTableToBill = useCallback(
    (billId: string, tableId: string) => {
      const now = new Date();
      const nowTs = now.getTime();
      const assignedTable = tablesRef.current.find((t) => t.id === tableId);
      let updatedBill: Bill | null = null;
      const voidedEmptyBills: Bill[] = [];

      const nextBills = billsRef.current.map((b) => {
        if (b.id === billId) {
          const up: Bill = {
            ...b,
            tableId,
            tableName: assignedTable?.number,
            guestCount: b.guestCount || assignedTable?.capacity || 2,
            updatedAtMs: nowTs,
          };
          updatedBill = up;
          return up;
        }
        // Clean up any orphan empty open bill left on this table so it never blocks table release on checkout
        if (
          b.tableId === tableId &&
          b.status === 'open' &&
          !b.items.some((i) => i.status !== 'voided')
        ) {
          const voided: Bill = {
            ...b,
            status: 'voided',
            voidReason: 'เปลี่ยนบิลประจำโต๊ะ',
            voidedAt: now.toISOString(),
            updatedAtMs: nowTs,
          };
          voidedEmptyBills.push(voided);
          return voided;
        }
        return b;
      });
      commitBills(nextBills, false);

      const resolvedBill = nextBills.find((b) => b.id === billId);
      const billHasOrderedItems = Boolean(
        resolvedBill?.items?.some((i) => i.status !== 'voided')
      );

      let updatedTable: Table | null = null;
      if (billHasOrderedItems) {
        const nextTables = tablesRef.current.map((t) => {
          if (t.id !== tableId) return t;
          const up: Table = {
            ...t,
            status: 'occupied',
            currentBillId: billId,
            seatedAt: t.seatedAt || now.toISOString(),
            guestCount: t.guestCount || assignedTable?.capacity || 2,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          updatedTable = up;
          return up;
        });
        commitTables(nextTables);
      }
      syncService.broadcast('DATA_RELOAD');

      if (updatedBill && billHasOrderedItems) {
        saveBillRemote(updatedBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
      voidedEmptyBills.forEach((vb) => {
        saveBillRemote(vb).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      });
      if (updatedTable) {
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitBills, commitTables]
  );

  const updateBillDeliveryInfo = useCallback(
    (billId: string, deliveryInfo: DeliveryInfo) => {
      let updatedBill: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;
      const nextBills = billsRef.current.map((b) => {
        if (b.id !== billId) return b;
        const updated: Bill = recalculateBill(
          {
            ...b,
            orderType: 'delivery',
            deliveryInfo,
            deliveryPlatform: deliveryInfo.platform,
            deliveryGpRate: deliveryInfo.gpRate,
            deliveryGpAmount: deliveryInfo.gpAmount,
            packagingCost: deliveryInfo.packagingCost,
            updatedAtMs: nowTs,
          },
          activeSettings
        );
        updatedBill = updated;
        return updated;
      });
      commitBills(nextBills);
      if (updatedBill) {
        saveBillRemote(updatedBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
    },
    [recalculateBill, commitBills]
  );

  const addItemsToBill = useCallback(
    (billId: string, newItems: OrderItem[]) => {
      let updatedBill: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;
      const nextBills = billsRef.current.map((bill) => {
        if (bill.id !== billId) return bill;
        const updatedItems = [...bill.items, ...newItems];
        const up = recalculateBill({ ...bill, items: updatedItems, updatedAtMs: nowTs }, activeSettings);
        updatedBill = up;
        return up;
      });
      commitBills(nextBills);
      if (updatedBill) {
        saveBillRemote(updatedBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
        syncTableOccupancyForBill(updatedBill, nextBills, nowTs);
      }
    },
    [recalculateBill, commitBills, syncTableOccupancyForBill]
  );

  const updateBillItemQuantity = useCallback(
    (billId: string, itemId: string, newQty: number) => {
      let updatedBill: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;
      const nextBills = billsRef.current.map((bill) => {
        if (bill.id !== billId) return bill;
        const updatedItems = bill.items
          .map((item) => (item.id !== itemId ? item : { ...item, quantity: newQty }))
          .filter((item) => item.quantity > 0);
        const up = recalculateBill({ ...bill, items: updatedItems, updatedAtMs: nowTs }, activeSettings);
        updatedBill = up;
        return up;
      });
      commitBills(nextBills);
      if (updatedBill) {
        saveBillRemote(updatedBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
        syncTableOccupancyForBill(updatedBill, nextBills, nowTs);
      }
    },
    [recalculateBill, commitBills, syncTableOccupancyForBill]
  );

  const removeUnsentItemFromBill = useCallback(
    (billId: string, itemId: string) => {
      let updatedBill: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;
      const nextBills = billsRef.current.map((bill) => {
        if (bill.id !== billId) return bill;
        const updatedItems = bill.items.filter((item) => item.id !== itemId);
        const up = recalculateBill({ ...bill, items: updatedItems, updatedAtMs: nowTs }, activeSettings);
        updatedBill = up;
        return up;
      });
      commitBills(nextBills);
      if (updatedBill) {
        saveBillRemote(updatedBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
        syncTableOccupancyForBill(updatedBill, nextBills, nowTs);
      }
    },
    [recalculateBill, commitBills, syncTableOccupancyForBill]
  );

  // "Confirm order" saves new unsent items to bill without kitchen status flow
  const confirmOrder = useCallback(
    (billId: string) => {
      let affectedTableId: string | undefined;
      let updatedBillObj: Bill | null = null;
      const nowTs = Date.now();

      const nextBills = billsRef.current.map((b) => {
        if (b.id !== billId) return b;
        affectedTableId = b.tableId;
        const updatedItems = b.items.map((item) => {
          if (item.isNewUnsent) {
            return {
              ...item,
              isNewUnsent: false,
              status: 'confirmed' as const,
            };
          }
          return item;
        });
        const up = { ...b, items: updatedItems, updatedAtMs: nowTs };
        updatedBillObj = up;
        return up;
      });
      commitBills(nextBills, false);

      let updatedTableObj: Table | null = null;
      if (affectedTableId) {
        const nextTables = tablesRef.current.map((t) => {
          if (t.id !== affectedTableId) return t;
          const up: Table = {
            ...t,
            status: t.status === 'payment_pending' ? 'payment_pending' : 'occupied',
            currentBillId: billId,
            seatedAt: t.seatedAt || new Date(nowTs).toISOString(),
            guestCount: t.guestCount || updatedBillObj?.guestCount || t.capacity || 2,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          updatedTableObj = up;
          return up;
        });
        commitTables(nextTables, false);
        syncService.broadcast('TABLE_UPDATED');
      }

      soundService.playSuccessTap();
      syncService.broadcast('DATA_RELOAD');

      if (updatedBillObj) {
        saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
      if (updatedTableObj) {
        saveTableRemote(updatedTableObj).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitBills, commitTables]
  );

  const sendOrderToKitchen = confirmOrder; // alias for backwards compatibility

  const voidOrderItem = useCallback(
    (billId: string, itemId: string, reason: string) => {
      let updatedBillObj: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;
      const actorName = currentUserRef.current?.name || 'พนักงาน';

      const nextBills = billsRef.current.map((b) => {
        if (b.id !== billId) return b;
        const updatedItems = b.items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            status: 'voided' as const,
            voidReason: reason,
            voidedBy: actorName,
            voidedAt: new Date(nowTs).toISOString(),
          };
        });

        const activeItems = updatedItems.filter((i) => i.status !== 'voided');
        const recalculated = recalculateBill({ ...b, items: activeItems, updatedAtMs: nowTs }, activeSettings);
        const finalBill: Bill = {
          ...recalculated,
          items: updatedItems,
          updatedAtMs: nowTs,
        };
        updatedBillObj = finalBill;
        return finalBill;
      });

      commitBills(nextBills);
      if (updatedBillObj) {
        saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
        syncTableOccupancyForBill(updatedBillObj, nextBills, nowTs);
      }
    },
    [recalculateBill, commitBills, syncTableOccupancyForBill]
  );

  const applyBillDiscount = useCallback(
    (billId: string, type: 'percentage' | 'fixed', value: number) => {
      let updatedBillObj: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;

      const nextBills = billsRef.current.map((bill) => {
        if (bill.id !== billId) return bill;
        const recalculated = recalculateBill(
          {
            ...bill,
            discountType: type,
            discountValue: Math.max(0, value),
            updatedAtMs: nowTs,
          },
          activeSettings
        );
        updatedBillObj = recalculated;
        return recalculated;
      });

      commitBills(nextBills);
      if (updatedBillObj) {
        saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
    },
    [recalculateBill, commitBills]
  );

  const applyMembershipDiscount = useCallback(
    (billId: string, memberPhone: string, pointsToRedeem: number): boolean => {
      const member = membersRef.current.find((m) => m.phone === memberPhone);
      if (!member || member.points < pointsToRedeem) return false;

      let updatedBillObj: Bill | null = null;
      const nowTs = Date.now();
      const activeSettings = settingsRef.current;
      const nextBills = billsRef.current.map((b) => {
        if (b.id !== billId) return b;
        const up = recalculateBill(
          {
            ...b,
            membershipPhone: memberPhone,
            membershipDiscountPoints: pointsToRedeem,
            updatedAtMs: nowTs,
          },
          activeSettings
        );
        updatedBillObj = up;
        return up;
      });
      commitBills(nextBills);
      if (updatedBillObj) {
        saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
      return true;
    },
    [recalculateBill, commitBills]
  );

  const checkCanPay = useCallback(
    (target: Bill | Table | null | undefined): CanPayResult => {
      return canPay(target, billsRef.current);
    },
    []
  );

  const completeBillPayment = useCallback(
    (billId: string, payments: PaymentRecord[]): { success: boolean; bill: Bill } => {
      const currentBills = billsRef.current;
      const activeSettings = settingsRef.current;
      const targetBill = currentBills.find((b) => b.id === billId);
      if (!targetBill) {
        throw new Error('ไม่พบบิล');
      }
      if (targetBill.status === 'paid') {
        return { success: true, bill: targetBill };
      }

      // Re-check rule inside the final "confirm payment" action
      const payCheck = canPay(targetBill, currentBills);
      if (!payCheck.allowed) {
        return { success: false, bill: targetBill };
      }

      const nowTs = Date.now();
      const closedAt = new Date(nowTs).toISOString();
      const updatedBill: Bill = {
        ...targetBill,
        payments,
        status: 'paid',
        closedAt,
        updatedAtMs: nowTs,
      };

      // Add points to membership if applicable
      let memberUpdate: { id: string; points: number; totalSpent: number } | undefined;
      if (targetBill.membershipPhone) {
        const pointsEarned = Math.floor(targetBill.grandTotal / activeSettings.pointsEarnRate);
        const pointsSpent = targetBill.membershipDiscountPoints || 0;
        const nextMembers = membersRef.current.map((m) => {
          if (m.phone !== targetBill.membershipPhone) return m;
          const nextPoints = Math.max(0, m.points - pointsSpent + pointsEarned);
          const nextTotalSpent = m.totalSpent + targetBill.grandTotal;
          memberUpdate = { id: m.id, points: nextPoints, totalSpent: nextTotalSpent };
          return { ...m, points: nextPoints, totalSpent: nextTotalSpent, updatedAtMs: nowTs };
        });
        commitMembers(nextMembers, false);
      }

      // Resolve associated table (by targetBill.tableId OR any table pointing to this bill)
      const resolvedTableId =
        targetBill.tableId ||
        tablesRef.current.find((t) => t.currentBillId === billId)?.id;

      // Only active open bills (with non-voided items) keep the table occupied; empty orphan open bills are auto-voided
      const otherActiveOpenBills = resolvedTableId
        ? currentBills.filter(
            (b) =>
              b.tableId === resolvedTableId &&
              b.id !== billId &&
              b.status === 'open' &&
              b.items.some((i) => i.status !== 'voided')
          )
        : [];
      const emptyOrphanBills = resolvedTableId
        ? currentBills.filter(
            (b) =>
              b.tableId === resolvedTableId &&
              b.id !== billId &&
              b.status === 'open' &&
              !b.items.some((i) => i.status !== 'voided')
          )
        : [];

      const isTableReleased = otherActiveOpenBills.length === 0;
      const nextTableBillId = otherActiveOpenBills[0]?.id;
      const voidedEmptyBills: Bill[] = isTableReleased
        ? emptyOrphanBills.map((eb) => ({
            ...eb,
            status: 'voided' as const,
            voidReason: 'ปิดโต๊ะหลังชำระเงิน',
            voidedAt: closedAt,
            updatedAtMs: nowTs,
          }))
        : [];
      const voidedEmptyMap = new Map(voidedEmptyBills.map((eb) => [eb.id, eb]));

      const releasedOrUpdatedTables: Table[] = [];
      if (resolvedTableId || tablesRef.current.some((t) => t.currentBillId === billId)) {
        const nextTables = tablesRef.current.map((t) => {
          const matchesTable =
            (resolvedTableId && t.id === resolvedTableId) || t.currentBillId === billId;
          if (!matchesTable) return t;
          if (!isTableReleased && t.id === resolvedTableId) {
            const up: Table = {
              ...t,
              status: 'occupied',
              currentBillId: nextTableBillId,
              updatedAtMs: nowTs,
            };
            releasedOrUpdatedTables.push(up);
            return up;
          }
          const released: Table = {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          releasedOrUpdatedTables.push(released);
          return released;
        });
        commitTables(nextTables, false);
        syncService.broadcast('TABLE_UPDATED');
      }

      commitBills(
        currentBills.map((b) => {
          if (b.id === billId) return updatedBill;
          return voidedEmptyMap.get(b.id) || b;
        }),
        true
      );
      setLastCompletedBill(updatedBill);
      if (activeBillId === billId) {
        setActiveBillId(null);
      }

      soundService.playSuccessTap();

      // Cloud Atomic writeBatch sync
      if (db && cloudUser) {
        atomicPayBillAndReleaseTable({
          bill: updatedBill,
          tableId: resolvedTableId,
          isTableReleased,
          nextTableBillId,
          voidEmptyBills: voidedEmptyBills,
          memberUpdate,
        }).catch((err) => console.warn('[Cloud sync atomicPayBill error]:', err));

        // Also sync any extra tables whose currentBillId happened to reference this billId
        releasedOrUpdatedTables
          .filter((t) => t.id !== resolvedTableId)
          .forEach((extraTbl) => {
            saveTableRemote(extraTbl).catch((err) =>
              console.warn('[Cloud sync extra table release error]:', err)
            );
          });
      }

      return { success: true, bill: updatedBill };
    },
    [activeBillId, cloudUser, commitBills, commitTables, commitMembers]
  );

  const voidBill = useCallback(
    (billId: string, reason: string) => {
      const currentBills = billsRef.current;
      const targetBill = currentBills.find((b) => b.id === billId);
      if (!targetBill) return;

      const nowTs = Date.now();
      const voidedAt = new Date(nowTs).toISOString();
      const updatedBill: Bill = {
        ...targetBill,
        status: 'voided',
        voidReason: reason,
        voidedBy: currentUserRef.current?.name || 'พนักงาน',
        voidedAt,
        updatedAtMs: nowTs,
      };

      const resolvedTableId =
        targetBill.tableId ||
        tablesRef.current.find((t) => t.currentBillId === billId)?.id;

      const otherActiveOpenBills = resolvedTableId
        ? currentBills.filter(
            (b) =>
              b.tableId === resolvedTableId &&
              b.id !== billId &&
              b.status === 'open' &&
              b.items.some((i) => i.status !== 'voided')
          )
        : [];
      const emptyOrphanBills = resolvedTableId
        ? currentBills.filter(
            (b) =>
              b.tableId === resolvedTableId &&
              b.id !== billId &&
              b.status === 'open' &&
              !b.items.some((i) => i.status !== 'voided')
          )
        : [];

      const isTableReleased = otherActiveOpenBills.length === 0;
      const nextTableBillId = otherActiveOpenBills[0]?.id;
      const voidedEmptyBills: Bill[] = isTableReleased
        ? emptyOrphanBills.map((eb) => ({
            ...eb,
            status: 'voided' as const,
            voidReason: 'ปิดโต๊ะหลังยกเลิกบิล',
            voidedAt,
            updatedAtMs: nowTs,
          }))
        : [];
      const voidedEmptyMap = new Map(voidedEmptyBills.map((eb) => [eb.id, eb]));

      if (resolvedTableId || tablesRef.current.some((t) => t.currentBillId === billId)) {
        const nextTables = tablesRef.current.map((t) => {
          const matchesTable =
            (resolvedTableId && t.id === resolvedTableId) || t.currentBillId === billId;
          if (!matchesTable) return t;
          if (!isTableReleased && t.id === resolvedTableId) {
            return {
              ...t,
              status: 'occupied' as const,
              currentBillId: nextTableBillId,
              updatedAtMs: nowTs,
            };
          }
          return {
            ...t,
            status: 'available' as const,
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
        });
        commitTables(nextTables, false);
        syncService.broadcast('TABLE_UPDATED');
      }

      commitBills(
        currentBills.map((b) => {
          if (b.id === billId) return updatedBill;
          return voidedEmptyMap.get(b.id) || b;
        })
      );
      if (activeBillId === billId) {
        setActiveBillId(null);
      }

      // Cloud Atomic writeBatch sync
      if (db && cloudUser) {
        atomicVoidBillAndReleaseTable({
          bill: updatedBill,
          tableId: resolvedTableId,
          isTableReleased,
          nextTableBillId,
          voidEmptyBills: voidedEmptyBills,
        }).catch((err) => console.warn('[Cloud sync atomicVoidBill error]:', err));
      }
    },
    [activeBillId, cloudUser, commitBills, commitTables]
  );

  const splitBill = useCallback(
    (
      originalBillId: string,
      itemSplits: { itemId: string; quantity: number }[]
    ): { originalBill: Bill; newBill: Bill } | null => {
      const currentBills = billsRef.current;
      const activeSettings = settingsRef.current;
      const actor = currentUserRef.current;
      const originalBill = currentBills.find((b) => b.id === originalBillId);
      if (!originalBill) return null;

      const now = new Date();
      const nowTs = now.getTime();
      // Calculate suffix, e.g. -B, -C, etc.
      const existingSplitsCount = currentBills.filter(
        (b) => b.tableId && b.tableId === originalBill.tableId
      ).length;
      const splitSuffix = String.fromCharCode(65 + existingSplitsCount);
      const baseBillNum = originalBill.billNumber.replace(/-[A-Z]$/, '');
      const newBillNumber = `${baseBillNum}-${splitSuffix}`;

      const remainingItems: OrderItem[] = [];
      const movedItems: OrderItem[] = [];

      originalBill.items.forEach((item) => {
        if (item.status === 'voided') {
          remainingItems.push(item);
          return;
        }
        const splitSpec = itemSplits.find((s) => s.itemId === item.id);
        const splitQty = splitSpec ? Math.min(item.quantity, Math.max(0, splitSpec.quantity)) : 0;
        const remainQty = item.quantity - splitQty;

        if (splitQty > 0) {
          movedItems.push({
            ...item,
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            quantity: splitQty,
            isNewUnsent: item.isNewUnsent,
          });
        }

        if (remainQty > 0) {
          remainingItems.push({
            ...item,
            quantity: remainQty,
          });
        }
      });

      if (movedItems.length === 0) return null;

      const updatedOriginal = recalculateBill(
        { ...originalBill, items: remainingItems, updatedAtMs: nowTs },
        activeSettings
      );

      const createdNewBill: Bill = recalculateBill(
        {
          id: 'bill_' + nowTs + '_split',
          billNumber: newBillNumber,
          orderType: originalBill.orderType,
          tableId: originalBill.tableId,
          tableName: originalBill.tableName,
          guestCount: 1,
          items: movedItems,
          status: 'open',
          createdAt: now.toISOString(),
          createdByUserId: actor?.id || 'unknown',
          createdByName: actor?.name || 'พนักงาน',
          subtotal: 0,
          discountType: 'percentage',
          discountValue: 0,
          discountAmount: 0,
          serviceChargeRate: originalBill.serviceChargeRate,
          serviceChargeAmount: 0,
          vatRate: originalBill.vatRate,
          vatAmount: 0,
          vatIncluded: originalBill.vatIncluded,
          grandTotal: 0,
          payments: [],
          updatedAtMs: nowTs,
        },
        activeSettings
      );

      commitBills([
        ...currentBills.map((b) => (b.id === originalBillId ? updatedOriginal : b)),
        createdNewBill,
      ]);
      syncService.broadcast('TABLE_UPDATED');

      saveBillRemote(updatedOriginal).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      saveBillRemote(createdNewBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));

      return { originalBill: updatedOriginal, newBill: createdNewBill };
    },
    [recalculateBill, commitBills]
  );

  const updateBillNote = useCallback(
    (billId: string, note: string) => {
      const nowTs = Date.now();
      const normalizedNote = note.trim() ? note.trim() : undefined;
      let updatedBill: Bill | null = null;
      const nextBills = billsRef.current.map((b) => {
        if (b.id !== billId) return b;
        const up: Bill = {
          ...b,
          note: normalizedNote,
          updatedAtMs: nowTs,
        };
        updatedBill = up;
        return up;
      });
      commitBills(nextBills);
      if (updatedBill) {
        saveBillRemote(updatedBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
    },
    [commitBills]
  );

  const mergeBills = useCallback(
    (sourceBillIds: string[], targetBillId: string): boolean => {
      const currentBills = billsRef.current;
      const currentTables = tablesRef.current;
      const targetBill = currentBills.find((b) => b.id === targetBillId && b.status === 'open');
      if (!targetBill) return false;

      const uniqueSourceIds = Array.from(new Set(sourceBillIds)).filter((id) => id !== targetBillId);
      const sourceBills = currentBills.filter(
        (b) => uniqueSourceIds.includes(b.id) && b.status === 'open'
      );
      if (sourceBills.length === 0) return false;

      const now = new Date();
      const nowTs = now.getTime();
      const nowIso = now.toISOString();
      const actorName = currentUserRef.current?.name || 'พนักงาน';

      const combinedItems = [
        ...targetBill.items,
        ...sourceBills.flatMap((sb) => sb.items),
      ];
      const combinedNote =
        Array.from(
          new Set(
            [targetBill.note, ...sourceBills.map((sb) => sb.note)].filter(
              (n): n is string => Boolean(n && n.trim())
            )
          )
        ).join(' | ') || undefined;

      const recalculatedTargetBill = recalculateBill(
        {
          ...targetBill,
          items: combinedItems,
          note: combinedNote,
          updatedAtMs: nowTs,
        },
        settingsRef.current
      );

      const sourceIdSet = new Set(sourceBills.map((sb) => sb.id));
      const voidedBills: Bill[] = [];
      const mergeReason = targetBill.tableName
        ? `รวมเข้ากับโต๊ะ ${targetBill.tableName} (${targetBill.billNumber})`
        : `รวมเข้ากับบิล ${targetBill.billNumber}`;

      const preBills = currentBills.map((b) => {
        if (b.id === recalculatedTargetBill.id) return recalculatedTargetBill;
        if (sourceIdSet.has(b.id)) {
          const voided: Bill = {
            ...b,
            status: 'voided',
            voidReason: mergeReason,
            voidedBy: actorName,
            voidedAt: nowIso,
            updatedAtMs: nowTs,
          };
          voidedBills.push(voided);
          return voided;
        }
        return b;
      });

      const affectedTableIds = new Set<string>();
      sourceBills.forEach((sb) => {
        if (sb.tableId) affectedTableIds.add(sb.tableId);
      });
      currentTables.forEach((t) => {
        if (t.currentBillId && sourceIdSet.has(t.currentBillId)) {
          affectedTableIds.add(t.id);
        }
      });

      const orphanEmptyIdsToVoid = new Set<string>();
      const updatedTables: Table[] = [];
      const nextTables = currentTables.map((t) => {
        if (targetBill.tableId && t.id === targetBill.tableId) {
          const up: Table = {
            ...t,
            status: t.status === 'payment_pending' ? 'payment_pending' : 'occupied',
            currentBillId: recalculatedTargetBill.id,
            updatedAtMs: nowTs,
          };
          updatedTables.push(up);
          return up;
        }

        if (!affectedTableIds.has(t.id)) {
          return t;
        }

        const remainingActiveOpen = preBills.filter(
          (b) =>
            b.tableId === t.id &&
            b.status === 'open' &&
            b.items.some((i) => i.status !== 'voided')
        );

        if (remainingActiveOpen.length > 0) {
          const up: Table = {
            ...t,
            status: 'occupied',
            currentBillId: remainingActiveOpen[0].id,
            updatedAtMs: nowTs,
          };
          updatedTables.push(up);
          return up;
        }

        preBills
          .filter((b) => b.tableId === t.id && b.status === 'open')
          .forEach((ob) => orphanEmptyIdsToVoid.add(ob.id));

        const up: Table = {
          ...t,
          status: 'available',
          currentBillId: undefined,
          seatedAt: undefined,
          guestCount: undefined,
          reservation: undefined,
          updatedAtMs: nowTs,
        };
        updatedTables.push(up);
        return up;
      });

      const nextBills = preBills.map((b) => {
        if (!orphanEmptyIdsToVoid.has(b.id)) return b;
        const voidedOrphan: Bill = {
          ...b,
          status: 'voided',
          voidReason: mergeReason,
          voidedBy: actorName,
          voidedAt: nowIso,
          updatedAtMs: nowTs,
        };
        voidedBills.push(voidedOrphan);
        return voidedOrphan;
      });

      commitBills(nextBills, false);
      commitTables(nextTables);
      if (activeBillId && sourceIdSet.has(activeBillId)) {
        setActiveBillId(recalculatedTargetBill.id);
      }
      syncService.broadcast('DATA_RELOAD');

      saveBillRemote(recalculatedTargetBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      voidedBills.forEach((vb) => {
        saveBillRemote(vb).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      });
      updatedTables.forEach((t) => {
        saveTableRemote(t).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      });
      return true;
    },
    [activeBillId, recalculateBill, commitBills, commitTables]
  );

  // Table Floor Plan & Layout Operations
  const moveTable = useCallback(
    (fromTableId: string, toTableId: string): boolean => {
      const currentTables = tablesRef.current;
      const currentBills = billsRef.current;
      const fromTable = currentTables.find((t) => t.id === fromTableId);
      const toTable = currentTables.find((t) => t.id === toTableId);
      if (!fromTable || !toTable || toTable.status !== 'available') {
        return false;
      }

      const nowTs = Date.now();
      let billId = fromTable.currentBillId;
      if (!billId) {
        const existingBill = currentBills.find(
          (b) => b.tableId === fromTableId && b.status === 'open'
        );
        if (existingBill) {
          billId = existingBill.id;
        }
      }

      let movedBillObj: Bill | undefined;
      if (billId) {
        const nextBills = currentBills.map((b) => {
          if (b.id !== billId) return b;
          const up = { ...b, tableId: toTableId, tableName: toTable.number, updatedAtMs: nowTs };
          return up;
        });
        movedBillObj = nextBills.find((b) => b.id === billId);
        commitBills(nextBills, false);
      }

      const movedHasItems = Boolean(
        movedBillObj?.items?.some((i) => i.status !== 'voided')
      );

      const updatedTables: Table[] = [];
      const nextTables = currentTables.map((t) => {
        if (t.id === fromTableId) {
          const up: Table = {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          updatedTables.push(up);
          return up;
        }
        if (t.id === toTableId) {
          if (!movedHasItems) {
            return t;
          }
          const up: Table = {
            ...t,
            status: fromTable.status === 'payment_pending' ? 'payment_pending' : 'occupied',
            currentBillId: billId,
            seatedAt: fromTable.seatedAt || new Date(nowTs).toISOString(),
            guestCount: fromTable.guestCount || toTable.capacity,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          updatedTables.push(up);
          return up;
        }
        return t;
      });
      commitTables(nextTables);
      syncService.broadcast('DATA_RELOAD');

      if (movedBillObj && movedHasItems) {
        saveBillRemote(movedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
      updatedTables.forEach((t) => {
        saveTableRemote(t).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      });
      return true;
    },
    [commitBills, commitTables]
  );

  const mergeTables = useCallback(
    (sourceTableIds: string[], targetTableId: string): boolean => {
      const currentTables = tablesRef.current;
      const targetTable = currentTables.find((t) => t.id === targetTableId);
      if (!targetTable) return false;

      let targetBill = billsRef.current.find((b) => b.id === targetTable.currentBillId);
      if (!targetBill) {
        targetBill = createBillForOrder('dine_in', targetTableId, targetTable.capacity);
      }

      const nowTs = Date.now();
      const currentBills = billsRef.current;
      const sourceBills = currentBills.filter(
        (b) => sourceTableIds.includes(b.tableId || '') && b.id !== targetBill?.id && b.status === 'open'
      );

      let combinedItems = [...targetBill.items];
      sourceBills.forEach((sb) => {
        combinedItems = [...combinedItems, ...sb.items];
      });

      const recalculatedTargetBill = recalculateBill(
        { ...targetBill, items: combinedItems, updatedAtMs: nowTs },
        settingsRef.current
      );
      const voidedBills: Bill[] = [];
      const actorName = currentUserRef.current?.name || 'พนักงาน';

      const nextBills = currentBills.map((b) => {
        if (b.id === recalculatedTargetBill.id) return recalculatedTargetBill;
        if (sourceBills.some((sb) => sb.id === b.id)) {
          const voided: Bill = {
            ...b,
            status: 'voided',
            voidReason: `รวมเข้ากับโต๊ะ ${targetTable.number}`,
            voidedBy: actorName,
            updatedAtMs: nowTs,
          };
          voidedBills.push(voided);
          return voided;
        }
        return b;
      });
      commitBills(nextBills, false);

      const updatedTables: Table[] = [];
      const nextTables = tablesRef.current.map((t) => {
        if (sourceTableIds.includes(t.id)) {
          const up: Table = {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            reservation: undefined,
            updatedAtMs: nowTs,
          };
          updatedTables.push(up);
          return up;
        }
        if (t.id === targetTableId) {
          const up: Table = {
            ...t,
            status: 'occupied',
            currentBillId: recalculatedTargetBill.id,
            updatedAtMs: nowTs,
          };
          updatedTables.push(up);
          return up;
        }
        return t;
      });
      commitTables(nextTables);
      syncService.broadcast('DATA_RELOAD');

      saveBillRemote(recalculatedTargetBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      voidedBills.forEach((vb) => {
        saveBillRemote(vb).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      });
      updatedTables.forEach((t) => {
        saveTableRemote(t).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      });
      return true;
    },
    [createBillForOrder, recalculateBill, commitBills, commitTables]
  );

  const requestTableBill = useCallback(
    (tableId: string) => {
      let updatedTable: Table | null = null;
      const nowTs = Date.now();
      const nextTables = tablesRef.current.map((t) => {
        if (t.id !== tableId) return t;
        const up: Table = { ...t, status: 'payment_pending', updatedAtMs: nowTs };
        updatedTable = up;
        return up;
      });
      commitTables(nextTables);
      if (updatedTable) {
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitTables]
  );

  const reserveTable = useCallback(
    (tableId: string, reservation: ReservationInfo) => {
      let updatedTable: Table | null = null;
      const nowTs = Date.now();
      const nextTables = tablesRef.current.map((t) => {
        if (t.id !== tableId) return t;
        const up: Table = {
          ...t,
          status: 'reserved',
          currentBillId: undefined,
          seatedAt: undefined,
          guestCount: undefined,
          reservation,
          updatedAtMs: nowTs,
        };
        updatedTable = up;
        return up;
      });
      commitTables(nextTables);
      if (updatedTable) {
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitTables]
  );

  const cancelReservation = useCallback(
    (tableId: string) => {
      let updatedTable: Table | null = null;
      const nowTs = Date.now();
      const nextTables = tablesRef.current.map((t) => {
        if (t.id !== tableId) return t;
        const up: Table = {
          ...t,
          status: 'available',
          currentBillId: undefined,
          seatedAt: undefined,
          guestCount: undefined,
          reservation: undefined,
          updatedAtMs: nowTs,
        };
        updatedTable = up;
        return up;
      });
      commitTables(nextTables);
      if (updatedTable) {
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitTables]
  );

  const addTable = useCallback(
    (tableData: Omit<Table, 'id' | 'status'>) => {
      const nowTs = Date.now();
      const newTable: Table = {
        ...tableData,
        id: 'tbl_' + nowTs,
        status: 'available',
        shape: tableData.shape || 'square',
        chairStyle: tableData.chairStyle || 'standard',
        x: typeof tableData.x === 'number' ? tableData.x : 60,
        y: typeof tableData.y === 'number' ? tableData.y : 60,
        rotation: tableData.rotation || 0,
        updatedAtMs: nowTs,
      };
      commitTables([...tablesRef.current, newTable]);
      saveTableRemote(newTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
    },
    [commitTables]
  );

  const updateTable = useCallback(
    (id: string, updates: Partial<Table>) => {
      let updatedTable: Table | null = null;
      const nowTs = Date.now();
      const nextTables = tablesRef.current.map((t) => {
        if (t.id !== id) return t;
        const up = normalizeTableState({ ...t, ...updates, updatedAtMs: nowTs });
        updatedTable = up;
        return up;
      });
      commitTables(nextTables);
      if (updatedTable) {
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitTables]
  );

  const deleteTable = useCallback(
    (id: string) => {
      commitTables(tablesRef.current.filter((t) => t.id !== id));
      deleteTableRemote(id).catch((err) => console.warn('[Cloud deleteTableRemote error]:', err));
    },
    [commitTables]
  );

  const updateTablePosition = useCallback(
    (id: string, x: number, y: number, rotation?: number) => {
      let updatedTable: Table | null = null;
      const nowTs = Date.now();
      const nextTables = tablesRef.current.map((t) => {
        if (t.id !== id) return t;
        const up = {
          ...t,
          x: Math.round(x),
          y: Math.round(y),
          ...(typeof rotation === 'number' ? { rotation } : {}),
          updatedAtMs: nowTs,
        };
        updatedTable = up;
        return up;
      });
      commitTables(nextTables);
      if (updatedTable) {
        saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
      }
    },
    [commitTables]
  );

  // Menu & Categories
  const addMenuItem = useCallback(
    (itemData: Omit<MenuItem, 'id'>) => {
      const nowTs = Date.now();
      const newItem: MenuItem = {
        ...itemData,
        id: 'dish_' + nowTs,
        updatedAtMs: nowTs,
      };
      commitMenuItems([...menuItemsRef.current, newItem]);
      saveMenuItemRemote(newItem).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
    },
    [commitMenuItems]
  );

  const updateMenuItem = useCallback(
    (id: string, updates: Partial<MenuItem>) => {
      let updatedItem: MenuItem | null = null;
      const nowTs = Date.now();
      const nextItems = menuItemsRef.current.map((m) => {
        if (m.id !== id) return m;
        const up = { ...m, ...updates, updatedAtMs: nowTs };
        updatedItem = up;
        return up;
      });
      commitMenuItems(nextItems);
      if (updatedItem) {
        saveMenuItemRemote(updatedItem).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
      }
    },
    [commitMenuItems]
  );

  const deleteMenuItem = useCallback(
    (id: string) => {
      commitMenuItems(menuItemsRef.current.filter((m) => m.id !== id));
      deleteMenuItemRemote(id).catch((err) => console.warn('[Cloud deleteMenuItemRemote error]:', err));
    },
    [commitMenuItems]
  );

  const toggleSoldOut = useCallback(
    (id: string) => {
      let updatedItem: MenuItem | null = null;
      const nowTs = Date.now();
      const nextItems = menuItemsRef.current.map((m) => {
        if (m.id !== id) return m;
        const up = { ...m, isSoldOut: !m.isSoldOut, updatedAtMs: nowTs };
        updatedItem = up;
        return up;
      });
      commitMenuItems(nextItems);
      if (updatedItem) {
        saveMenuItemRemote(updatedItem).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
      }
    },
    [commitMenuItems]
  );

  const addCategory = useCallback(
    (name: string, icon?: string, color?: string, nameEn?: string) => {
      const nowTs = Date.now();
      const newCat: MenuCategory = {
        id: 'cat_' + nowTs,
        name: name.trim(),
        nameEn: nameEn?.trim() || '',
        icon: icon || '🍽️',
        color: color || '#f59e0b',
        sortOrder: categoriesRef.current.length + 1,
        updatedAtMs: nowTs,
      };
      commitCategories([...categoriesRef.current, newCat]);
      saveCategoryRemote(newCat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
    },
    [commitCategories]
  );

  const updateCategory = useCallback(
    (id: string, name: string, icon?: string, color?: string, nameEn?: string) => {
      let updatedCat: MenuCategory | null = null;
      const nowTs = Date.now();
      const nextCats = categoriesRef.current.map((c) => {
        if (c.id !== id) return c;
        const up = {
          ...c,
          name: name.trim(),
          ...(nameEn !== undefined ? { nameEn: nameEn.trim() } : {}),
          ...(icon ? { icon } : {}),
          ...(color ? { color } : {}),
          updatedAtMs: nowTs,
        };
        updatedCat = up;
        return up;
      });
      commitCategories(nextCats);
      if (updatedCat) {
        saveCategoryRemote(updatedCat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
      }
    },
    [commitCategories]
  );

  // When a category with items is deleted, move items to "Uncategorized" category
  const deleteCategory = useCallback(
    (id: string) => {
      const targetUncategorizedId = 'cat_uncategorized';
      const currentItems = menuItemsRef.current;
      const itemsInCat = currentItems.filter((m) => m.categoryId === id);

      if (itemsInCat.length > 0) {
        const currentCats = categoriesRef.current;
        const exists = currentCats.some((c) => c.id === targetUncategorizedId);
        let nextCats = currentCats.filter((c) => c.id !== id);
        if (!exists) {
          const uncategorizedCat: MenuCategory = {
            id: targetUncategorizedId,
            name: 'ไม่ระบุหมวดหมู่',
            icon: '📦',
            color: '#94a3b8',
            sortOrder: 999,
            updatedAtMs: Date.now(),
          };
          nextCats = [...nextCats, uncategorizedCat];
          saveCategoryRemote(uncategorizedCat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
        }
        commitCategories(nextCats, false);

        const nowTs = Date.now();
        const reassignedItems: MenuItem[] = [];
        const nextItems = currentItems.map((m) => {
          if (m.categoryId !== id) return m;
          const up = { ...m, categoryId: targetUncategorizedId, updatedAtMs: nowTs };
          reassignedItems.push(up);
          return up;
        });
        commitMenuItems(nextItems);
        reassignedItems.forEach((up) => {
          saveMenuItemRemote(up).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
        });
      } else {
        commitCategories(categoriesRef.current.filter((c) => c.id !== id));
      }

      if (activeCategory === id) {
        setActiveCategory(null);
      }
      deleteCategoryRemote(id).catch((err) => console.warn('[Cloud deleteCategoryRemote error]:', err));
    },
    [activeCategory, commitCategories, commitMenuItems]
  );

  const reorderCategories = useCallback(
    (startIndex: number, endIndex: number) => {
      if (startIndex === endIndex) return;
      const nowTs = Date.now();
      const next = [...categoriesRef.current];
      const [moved] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, moved);
      const updated = next.map((cat, idx) => ({ ...cat, sortOrder: idx + 1, updatedAtMs: nowTs }));
      commitCategories(updated);
      updated.forEach((cat) => {
        saveCategoryRemote(cat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
      });
    },
    [commitCategories]
  );

  const restoreDefaultMenu = useCallback(() => {
    commitMenuItems(INITIAL_MENU_ITEMS);
  }, [commitMenuItems]);

  // Option Presets Management (หมวด set เมนูย่อย)
  const addOptionPreset = useCallback(
    (presetData: Omit<OptionGroup, 'id'>) => {
      const nowTs = Date.now();
      const newPreset: OptionGroup = {
        ...presetData,
        id: 'preset_' + nowTs,
        updatedAtMs: nowTs,
      };
      commitOptionPresets([...optionPresetsRef.current, newPreset]);
      saveOptionPresetRemote(newPreset).catch((err) => console.warn('[Cloud saveOptionPresetRemote error]:', err));
    },
    [commitOptionPresets]
  );

  const updateOptionPreset = useCallback(
    (id: string, updates: Partial<OptionGroup>) => {
      let updatedPreset: OptionGroup | null = null;
      const nowTs = Date.now();
      const nextPresets = optionPresetsRef.current.map((p) => {
        if (p.id !== id) return p;
        const up = { ...p, ...updates, updatedAtMs: nowTs };
        updatedPreset = up;
        return up;
      });
      commitOptionPresets(nextPresets);
      if (updatedPreset) {
        saveOptionPresetRemote(updatedPreset).catch((err) => console.warn('[Cloud saveOptionPresetRemote error]:', err));
      }
    },
    [commitOptionPresets]
  );

  const deleteOptionPreset = useCallback(
    (id: string) => {
      commitOptionPresets(optionPresetsRef.current.filter((p) => p.id !== id));
      deleteOptionPresetRemote(id).catch((err) => console.warn('[Cloud deleteOptionPresetRemote error]:', err));
    },
    [commitOptionPresets]
  );

  const reorderOptionPresets = useCallback(
    (startIndexOrList: number | OptionGroup[], endIndex?: number) => {
      const prev = optionPresetsRef.current;
      let next: OptionGroup[];
      if (Array.isArray(startIndexOrList)) {
        next = [...startIndexOrList];
      } else if (typeof endIndex === 'number') {
        if (startIndexOrList === endIndex) return;
        next = [...prev];
        const [moved] = next.splice(startIndexOrList, 1);
        next.splice(endIndex, 0, moved);
      } else {
        return;
      }
      commitOptionPresets(next);
    },
    [commitOptionPresets]
  );

  // Shifts
  const openShift = useCallback(
    (startingCash: number, note?: string) => {
      const newShift: Shift = {
        id: 'shift_' + Date.now(),
        openedAt: new Date().toISOString(),
        openedBy: currentUserRef.current?.name || 'พนักงาน',
        startingCash,
        status: 'open',
        note,
      };
      commitShift(newShift);
      saveShiftRemote(newShift).catch((err) => console.warn('[Cloud saveShiftRemote error]:', err));
    },
    [commitShift]
  );

  const closeShift = useCallback(
    (countedCash: number, note?: string) => {
      const activeShift = shiftRef.current;
      if (!activeShift) return;

      const cashPayments = billsRef.current
        .filter((b) => b.status === 'paid' && new Date(b.createdAt) >= new Date(activeShift.openedAt))
        .flatMap((b) => b.payments)
        .filter((p) => p.method === 'cash')
        .reduce((sum, p) => sum + p.amount, 0);

      const expectedCash = activeShift.startingCash + cashPayments;
      const difference = countedCash - expectedCash;

      const closed: Shift = {
        ...activeShift,
        closedAt: new Date().toISOString(),
        closedBy: currentUserRef.current?.name || 'พนักงาน',
        endingCashCounted: countedCash,
        expectedCash,
        difference,
        status: 'closed',
        note: note ? `${activeShift.note || ''} | ${note}` : activeShift.note,
      };

      commitShift(null);
      saveShiftRemote(closed).catch((err) => console.warn('[Cloud saveShiftRemote error]:', err));
    },
    [commitShift]
  );

  // Members
  const findMemberByPhone = useCallback((phone: string) => {
    return members.find((m) => m.phone === phone);
  }, [members]);

  const registerMember = useCallback(
    (name: string, phone: string) => {
      const newMember: Member = {
        id: 'mem_' + Date.now(),
        name,
        phone,
        points: 0,
        totalSpent: 0,
        registeredAt: new Date().toISOString(),
      };
      commitMembers([...membersRef.current, newMember]);
      saveMemberRemote(newMember).catch((err) => console.warn('[Cloud saveMemberRemote error]:', err));
      return newMember;
    },
    [commitMembers]
  );

  // On-demand loader for historical bills older than 30 days
  const loadArchivedBills = useCallback(async (): Promise<number> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const archived = await fetchArchivedBills(thirtyDaysAgoISO);
    if (archived && archived.length > 0) {
      const map = new Map<string, Bill>(billsRef.current.map((b) => [b.id, b]));
      archived.forEach((b) => {
        if (!map.has(b.id)) {
          map.set(b.id, b);
        }
      });
      commitBills(Array.from(map.values()));
      return archived.length;
    }
    return 0;
  }, [commitBills]);

  // Settings & QR
  const updateSettings = useCallback(
    (updates: Partial<ShopSettings>) => {
      const nextSettings = { ...settingsRef.current, ...updates };
      commitSettings(nextSettings);
      if (cloudUser && isFirebaseConfigured() && db) {
        saveShopBundle({
          settings: nextSettings,
          qrImages: qrImagesRef.current,
          logo: nextSettings.logoUrl || '',
        }).catch((err) => console.warn('[Cloud updateSettings error]:', err));
      }
    },
    [commitSettings, cloudUser]
  );

  const addQrImage = useCallback(
    (label: string, imageData: string, isDefault = false) => {
      const newQr: PaymentQrImage = {
        id: 'qr_' + Date.now(),
        label,
        imageData,
        isDefault,
      };
      const prev = qrImagesRef.current;
      const next = isDefault
        ? [...prev.map((q) => ({ ...q, isDefault: false })), newQr]
        : [...prev, newQr];
      commitQrImages(next);
      if (cloudUser && isFirebaseConfigured() && db) {
        saveShopBundle({
          settings: settingsRef.current,
          qrImages: next,
          logo: settingsRef.current.logoUrl || '',
        }).catch((err) => console.warn('[Cloud addQrImage error]:', err));
      }
    },
    [commitQrImages, cloudUser]
  );

  const updateQrImage = useCallback(
    (id: string, updates: Partial<PaymentQrImage>) => {
      const next = qrImagesRef.current.map((q) => {
        if (q.id !== id) {
          if (updates.isDefault) return { ...q, isDefault: false };
          return q;
        }
        return { ...q, ...updates };
      });
      commitQrImages(next);
      if (cloudUser && isFirebaseConfigured() && db) {
        saveShopBundle({
          settings: settingsRef.current,
          qrImages: next,
          logo: settingsRef.current.logoUrl || '',
        }).catch((err) => console.warn('[Cloud updateQrImage error]:', err));
      }
    },
    [commitQrImages, cloudUser]
  );

  const deleteQrImage = useCallback(
    (id: string) => {
      const next = qrImagesRef.current.filter((q) => q.id !== id);
      commitQrImages(next);
      if (cloudUser && isFirebaseConfigured() && db) {
        saveShopBundle({
          settings: settingsRef.current,
          qrImages: next,
          logo: settingsRef.current.logoUrl || '',
        }).catch((err) => console.warn('[Cloud deleteQrImage error]:', err));
      }
    },
    [commitQrImages, cloudUser]
  );

  // Backup & Reset
  const resetDemoData = useCallback(() => {
    const defaultTables = autoPositionTables(INITIAL_TABLES);
    usersRef.current = INITIAL_USERS;
    currentUserRef.current = INITIAL_USERS[0];
    settingsRef.current = INITIAL_SETTINGS;
    tablesRef.current = defaultTables;
    categoriesRef.current = INITIAL_CATEGORIES;
    menuItemsRef.current = INITIAL_MENU_ITEMS;
    billsRef.current = INITIAL_BILLS;
    membersRef.current = INITIAL_MEMBERS;
    qrImagesRef.current = INITIAL_QR_IMAGES;
    shiftRef.current = INITIAL_SHIFT;
    notificationsRef.current = [];
    zonesRef.current = INITIAL_ZONES;

    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setSettings(INITIAL_SETTINGS);
    setTables(defaultTables);
    setCategories(INITIAL_CATEGORIES);
    setMenuItems(INITIAL_MENU_ITEMS);
    setBills(INITIAL_BILLS);
    setMembers(INITIAL_MEMBERS);
    setQrImages(INITIAL_QR_IMAGES);
    setCurrentShift(INITIAL_SHIFT);
    setNotifications([]);
    setActiveCategory(null);
    setSelectedZone(INITIAL_ZONES[0]?.id || 'indoor');
    setZones(INITIAL_ZONES);
    setActiveNav('tables');

    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.TABLES);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.MENU);
    localStorage.removeItem(STORAGE_KEYS.BILLS);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.QR_IMAGES);
    localStorage.removeItem(STORAGE_KEYS.SHIFT);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.ZONES);

    syncService.broadcast('DATA_RELOAD');
  }, []);

  const exportDataJson = useCallback(() => {
    const backup = {
      system: 'KinD Restaurant POS',
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      summary: {
        menuItemsCount: menuItems.length,
        categoriesCount: categories.length,
        optionPresetsCount: optionPresets.length,
        tablesCount: tables.length,
        zonesCount: zones.length,
        billsCount: bills.length,
        membersCount: members.length,
        qrImagesCount: qrImages.length,
        usersCount: users.length,
      },
      settings,
      zones,
      categories,
      menuItems, // complete with food images (base64/URL), prices, costs, variants, and optionGroups
      optionPresets, // complete sub-menu sets (หมวด set เมนูย่อย)
      tables, // complete floor plan, positions, chair sizes & styles
      bills, // complete order history & payments
      members, // customer loyalty points
      qrImages, // QR payment images
      users: users.filter((u: any) => u.role !== 'kitchen'),
      currentShift,
    };
    return JSON.stringify(backup, null, 2);
  }, [
    users,
    settings,
    zones,
    tables,
    categories,
    menuItems,
    optionPresets,
    bills,
    members,
    qrImages,
    currentShift,
  ]);

  const importDataJson = useCallback((jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') return false;

      // Validate that it looks like a valid KinD POS backup file
      const hasValidSection =
        Boolean(data.menuItems && Array.isArray(data.menuItems)) ||
        Boolean(data.tables && Array.isArray(data.tables)) ||
        Boolean(data.categories && Array.isArray(data.categories)) ||
        Boolean(data.settings && typeof data.settings === 'object');

      if (!hasValidSection) return false;

      if (data.users && Array.isArray(data.users)) {
        const filteredUsers = data.users.filter((u: any) => u.role !== 'kitchen');
        usersRef.current = filteredUsers;
        setUsers(filteredUsers);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filteredUsers));
      }

      if (data.settings && typeof data.settings === 'object') {
        settingsRef.current = data.settings;
        setSettings(data.settings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }

      if (data.zones && Array.isArray(data.zones)) {
        zonesRef.current = data.zones;
        setZones(data.zones);
        localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(data.zones));
      }

      if (data.categories && Array.isArray(data.categories)) {
        categoriesRef.current = data.categories;
        setCategories(data.categories);
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
      }

      if (data.menuItems && Array.isArray(data.menuItems)) {
        menuItemsRef.current = data.menuItems;
        setMenuItems(data.menuItems);
        localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(data.menuItems));
      }

      if (data.optionPresets && Array.isArray(data.optionPresets)) {
        optionPresetsRef.current = data.optionPresets;
        setOptionPresets(data.optionPresets);
        localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(data.optionPresets));
      }

      if (data.tables && Array.isArray(data.tables)) {
        const positionedTables = autoPositionTables(data.tables);
        const importedBills: Bill[] = Array.isArray(data.bills) ? data.bills : billsRef.current;
        const { tables: reconciledTables } = reconcileTablesWithBills(positionedTables, importedBills);
        tablesRef.current = reconciledTables;
        setTables(reconciledTables);
        localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(reconciledTables));
      }

      if (data.bills && Array.isArray(data.bills)) {
        billsRef.current = data.bills;
        setBills(data.bills);
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(data.bills));
      }

      if (data.members && Array.isArray(data.members)) {
        membersRef.current = data.members;
        setMembers(data.members);
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(data.members));
      }

      if (data.qrImages && Array.isArray(data.qrImages)) {
        qrImagesRef.current = data.qrImages;
        setQrImages(data.qrImages);
        localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(data.qrImages));
      }

      if (data.currentShift) {
        shiftRef.current = data.currentShift;
        setCurrentShift(data.currentShift);
        localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(data.currentShift));
      }

      syncService.broadcast('DATA_RELOAD');
      syncService.broadcast('TABLE_UPDATED');
      return true;
    } catch {
      return false;
    }
  }, []);

  const value: POSContextType = {
    currentUser,
    users,
    loginWithPin,
    switchUser,
    logout,
    addStaff,
    updateStaff,
    deleteStaff,

    theme,
    toggleTheme,
    activeNav,
    setActiveNav: navigateTo,

    activeCategory,
    setActiveCategory,
    selectedZone,
    setSelectedZone,
    zones,
    addZone,
    updateZone,
    deleteZone,
    reorderZones,

    tables,
    openTable,
    moveTable,
    mergeTables,
    requestTableBill,
    reserveTable,
    cancelReservation,
    addTable,
    updateTable,
    deleteTable,
    updateTablePosition,

    categories,
    menuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleSoldOut,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    restoreDefaultMenu,

    optionPresets,
    addOptionPreset,
    updateOptionPreset,
    deleteOptionPreset,
    reorderOptionPresets,

    bills,
    activeBill,
    setActiveBillId,
    createBillForOrder,
    updateBillDeliveryInfo,
    assignTableToBill,
    addItemsToBill,
    updateBillItemQuantity,
    removeUnsentItemFromBill,
    confirmOrder,
    sendOrderToKitchen,
    voidOrderItem,
    applyBillDiscount,
    applyMembershipDiscount,
    canPay: checkCanPay,
    splitBill,
    mergeBills,
    updateBillNote,
    completeBillPayment,
    voidBill,
    lastCompletedBill,
    setLastCompletedBill,
    loadArchivedBills,

    currentShift,
    openShift,
    closeShift,

    members,
    findMemberByPhone,
    registerMember,

    settings,
    updateSettings,
    qrImages,
    addQrImage,
    updateQrImage,
    deleteQrImage,

    // Cloud Sync (Phase 1)
    cloudUser,
    cloudSyncStatus,
    cloudConnected: Boolean(cloudUser && isOnline && isFirebaseConfigured()),
    cloudErrorMessage,
    saveShopData,
    loginCloud,
    loginCloudWithGoogle,
    logoutCloud,
    initialSyncPrompt,
    resolveInitialSync,
    cancelInitialSync,
    hasExternalCloudUpdate,
    applyExternalCloudUpdate,
    dismissExternalCloudUpdate,
    isFormEditingShop,
    setIsFormEditingShop,

    notifications,
    markNotificationAsRead,
    clearAllNotifications,
    callWaiterAlert,
    requestBillAlert,

    resetDemoData,
    exportDataJson,
    importDataJson,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};

export const usePOS = (): POSContextType => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
