import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

// Auto-place tables without positions on a neat grid per zone
function autoPositionTables(rawTables: Table[]): Table[] {
  const zoneCounts: Record<string, number> = {};
  return rawTables.map((t) => {
    const zone = t.zone || 'indoor';
    const index = zoneCounts[zone] || 0;
    zoneCounts[zone] = index + 1;

    const hasPos = typeof t.x === 'number' && typeof t.y === 'number';
    const col = index % 3;
    const row = Math.floor(index / 3);

    return {
      ...t,
      shape: t.shape || (t.isStandaloneChair ? 'standalone_chair' : 'square'),
      chairStyle: t.chairStyle || 'standard',
      x: hasPos ? t.x : 60 + col * 220,
      y: hasPos ? t.y : 60 + row * 160,
      rotation: typeof t.rotation === 'number' ? t.rotation : 0,
    };
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

  // Selected Zone for Table Layout & POS Table Dropdown ('all' = all zones)
  const [selectedZone, setSelectedZone] = useState<string>('all');

  // Table Zones configuration with persistence
  const [zones, setZones] = useState<TableZoneConfig[]>(() => {
    const loaded = loadState<TableZoneConfig[]>(STORAGE_KEYS.ZONES, INITIAL_ZONES);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : INITIAL_ZONES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(zones));
  }, [zones]);

  const addZone = useCallback((name: string, nameEn?: string, color?: string): TableZoneConfig => {
    const cleanName = name.trim();
    const newZone: TableZoneConfig = {
      id: 'zone_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      nameEn: nameEn?.trim() || '',
      color: color || '#f59e0b',
    };
    setZones((prev) => [...prev, newZone]);
    soundService.playTap();
    saveZoneRemote(newZone).catch((err) => console.warn('[Cloud saveZoneRemote error]:', err));
    return newZone;
  }, []);

  const updateZone = useCallback((id: string, name: string, nameEn?: string, color?: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    let updatedZone: TableZoneConfig | null = null;
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== id) return z;
        const updated = {
          ...z,
          name: cleanName,
          nameEn: typeof nameEn === 'string' ? nameEn.trim() : z.nameEn,
          color: color || z.color,
        };
        updatedZone = updated;
        return updated;
      })
    );
    soundService.playTap();
    if (updatedZone) {
      saveZoneRemote(updatedZone).catch((err) => console.warn('[Cloud saveZoneRemote error]:', err));
    }
  }, []);

  const deleteZone = useCallback(
    (id: string, reassignToZoneId?: string): { success: boolean; message?: string } => {
      if (zones.length <= 1) {
        return { success: false, message: 'ไม่สามารถลบได้ เนื่องจากต้องมีโซนโต๊ะอย่างน้อย 1 โซน' };
      }

      const remainingZones = zones.filter((z) => z.id !== id);
      const targetZoneId =
        reassignToZoneId && remainingZones.some((z) => z.id === reassignToZoneId)
          ? reassignToZoneId
          : remainingZones[0]?.id || 'indoor';

      // Reassign tables in the deleted zone
      setTables((prev) =>
        prev.map((t) => (t.zone === id ? { ...t, zone: targetZoneId } : t))
      );

      setSelectedZone((prev) => (prev === id ? 'all' : prev));
      setZones(remainingZones);
      soundService.playTap();
      deleteZoneRemote(id).catch((err) => console.warn('[Cloud deleteZoneRemote error]:', err));
      return { success: true };
    },
    [zones]
  );

  const reorderZones = useCallback((startIndex: number, endIndex: number) => {
    if (startIndex === endIndex) return;
    setZones((prev) => {
      const next = [...prev];
      const [moved] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, moved);
      localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(next));
      syncService.broadcast('DATA_RELOAD');
      return next;
    });
    soundService.playTap();
  }, []);

  // Users (filter out obsolete 'kitchen' role)
  const [users, setUsers] = useState<User[]>(() => {
    const loaded = loadState<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return loaded
      .filter((u: any) => u.role !== 'kitchen')
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

  // Persistent storage writers with safe cleanup
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(optionPresets));
  }, [optionPresets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
  }, [bills]);

  useEffect(() => {
    if (currentShift) {
      localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(currentShift));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SHIFT);
    }
  }, [currentShift]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(qrImages));
  }, [qrImages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  // Clean old obsolete localStorage items
  useEffect(() => {
    try {
      localStorage.removeItem('kind_pos_ingredients_v1');
      localStorage.removeItem('kind_pos_stock_logs_v1');
      localStorage.removeItem('kind_pos_kitchen_v1');
    } catch {}
  }, []);

  // Multi-Tab Sync Listener (Reload all STORAGE_KEYS)
  useEffect(() => {
    const unsubscribe = syncService.subscribe((msg: SyncMessage) => {
      if (msg.type === 'DATA_RELOAD' || msg.type === 'TABLE_UPDATED') {
        setTables(autoPositionTables(loadState(STORAGE_KEYS.TABLES, INITIAL_TABLES)));
        setBills(loadState(STORAGE_KEYS.BILLS, INITIAL_BILLS));
        setMenuItems(normalizeAndSeedMenuItems(loadState(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS)));
        setCategories(loadState(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
        setNotifications(loadState(STORAGE_KEYS.NOTIFICATIONS, []));
        setSettings(loadState(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS));
        setQrImages(loadState(STORAGE_KEYS.QR_IMAGES, INITIAL_QR_IMAGES));
        setUsers(loadState(STORAGE_KEYS.USERS, INITIAL_USERS));
        setCurrentUser(loadState(STORAGE_KEYS.CURRENT_USER, null));
        setMembers(loadState(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS));
        setCurrentShift(loadState(STORAGE_KEYS.SHIFT, null));
        setOptionPresets(loadState(STORAGE_KEYS.OPTION_PRESETS, DEFAULT_OPTION_GROUP_PRESETS));
        setZones(loadState(STORAGE_KEYS.ZONES, INITIAL_ZONES));
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
        setSettings(remote.settings);
        setQrImages(remote.qrImages);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remote.settings));
        localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(remote.qrImages));
        syncService.broadcast('DATA_RELOAD');
      }
    });

    return () => {
      unsub();
    };
  }, [cloudUser, isFormEditingShop]);

  // Phase 2: Cloud real-time subscriptions for remaining data
  useEffect(() => {
    if (!cloudUser || !isFirebaseConfigured()) return;

    const unsubs: (() => void)[] = [];

    // 1. Menu items
    unsubs.push(
      subscribeCollection<MenuItem>('menuItems', (remoteItems) => {
        if (!remoteItems || remoteItems.length === 0) return;
        setMenuItems((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          remoteItems.forEach((rm) => map.set(rm.id, rm));
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 2. Categories
    unsubs.push(
      subscribeCollection<MenuCategory>('categories', (remoteCats) => {
        if (!remoteCats || remoteCats.length === 0) return;
        setCategories((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          remoteCats.forEach((rc) => map.set(rc.id, rc));
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 3. Tables
    unsubs.push(
      subscribeCollection<Table>('tables', (remoteTables) => {
        if (!remoteTables || remoteTables.length === 0) return;
        setTables((prev) => {
          const map = new Map(prev.map((t) => [t.id, t]));
          remoteTables.forEach((rt) => map.set(rt.id, rt));
          const merged = autoPositionTables(Array.from(map.values()));
          localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('TABLE_UPDATED');
      })
    );

    // 4. Zones
    unsubs.push(
      subscribeCollection<TableZoneConfig>('zones', (remoteZones) => {
        if (!remoteZones || remoteZones.length === 0) return;
        setZones((prev) => {
          const map = new Map(prev.map((z) => [z.id, z]));
          remoteZones.forEach((rz) => map.set(rz.id, rz));
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 5. Option Presets
    unsubs.push(
      subscribeCollection<OptionGroup>('optionPresets', (remotePresets) => {
        if (!remotePresets || remotePresets.length === 0) return;
        setOptionPresets((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          remotePresets.forEach((rp) => map.set(rp.id, rp));
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 6. Members
    unsubs.push(
      subscribeCollection<Member>('members', (remoteMembers) => {
        if (!remoteMembers || remoteMembers.length === 0) return;
        setMembers((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          remoteMembers.forEach((rm) => map.set(rm.id, rm));
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 7. Recent Bills (open bills & bills within last 30 days)
    unsubs.push(
      subscribeRecentBills((remoteRecentBills) => {
        if (!remoteRecentBills || remoteRecentBills.length === 0) return;
        setBills((prev) => {
          const map = new Map(prev.map((b) => [b.id, b]));
          remoteRecentBills.forEach((rb) => map.set(rb.id, rb));
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 8. Active Shift
    unsubs.push(
      subscribeActiveShift((remoteShift) => {
        setCurrentShift(remoteShift);
        if (remoteShift) {
          localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(remoteShift));
        } else {
          localStorage.removeItem(STORAGE_KEYS.SHIFT);
        }
        syncService.broadcast('DATA_RELOAD');
      })
    );

    // 9. Users
    unsubs.push(
      subscribeCollection<User>('users', (remoteUsers) => {
        if (!remoteUsers || remoteUsers.length === 0) return;
        setUsers((prev) => {
          const map = new Map(prev.map((u) => [u.id, u]));
          remoteUsers.forEach((ru) => {
            const localUser = map.get(ru.id);
            map.set(ru.id, {
              ...ru,
              pin: localUser?.pin || ru.pin || '',
            });
          });
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
          return merged;
        });
        syncService.broadcast('DATA_RELOAD');
      })
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [cloudUser]);

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
      setSettings(cachedRemoteShopData.settings);
      setQrImages(cachedRemoteShopData.qrImages);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cachedRemoteShopData.settings));
      localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(cachedRemoteShopData.qrImages));
      syncService.broadcast('DATA_RELOAD');
    }
    setHasExternalCloudUpdate(false);
  }, [cachedRemoteShopData]);

  const dismissExternalCloudUpdate = useCallback(() => {
    setHasExternalCloudUpdate(false);
  }, []);

  // Save Shop Data (Requirement C.1)
  const saveShopData = useCallback(
    async (overrideBundle?: { settings?: ShopSettings; qrImages?: PaymentQrImage[]; logo?: string }): Promise<'saved' | 'pending' | 'error'> => {
      const targetSettings = overrideBundle?.settings || settings;
      const targetQrImages = overrideBundle?.qrImages || qrImages;
      const targetLogo = overrideBundle?.logo !== undefined ? overrideBundle.logo : (targetSettings.logoUrl || '');

      // (ก) เขียน settings, qrImages, โลโก้ ลง localStorage ทันที
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(targetSettings));
        localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(targetQrImages));
        setSettings(targetSettings);
        setQrImages(targetQrImages);
      } catch (err) {
        console.warn('[saveShopData] Failed to write localStorage:', err);
      }

      // (ข) เรียก syncService.broadcast('DATA_RELOAD') ทันที
      syncService.broadcast('DATA_RELOAD');

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
    [settings, qrImages, cloudUser]
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
          const isDifferent =
            remote.settings.shopName !== settings.shopName ||
            remote.settings.taxId !== settings.taxId ||
            remote.settings.phone !== settings.phone ||
            remote.qrImages.length !== qrImages.length;
          if (isDifferent) {
            setInitialSyncPrompt({
              type: 'conflict',
              cloudData: remote,
            });
          } else {
            // Already in sync
            setSettings(remote.settings);
            setQrImages(remote.qrImages);
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remote.settings));
            localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(remote.qrImages));
          }
        }
      } catch (syncErr) {
        console.warn('[Initial Sync Check Error]:', syncErr);
      }
    },
    [settings, qrImages]
  );

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
        setSettings(remote.settings);
        setQrImages(remote.qrImages);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remote.settings));
        localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(remote.qrImages));
        syncService.broadcast('DATA_RELOAD');
      } else if (choice === 'use_local') {
        if (db) {
          await uploadFullLocalDataToCloud({
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
          });
        }
      }
      setInitialSyncPrompt(null);
    },
    [
      initialSyncPrompt,
      settings,
      qrImages,
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
    ]
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
      for (const u of users) {
        const isMatch = await verifyPin(pin, u);
        if (isMatch) {
          let userToSet = u;
          if (!u.pinHash || !u.salt) {
            const salt = generateSalt();
            const pinHash = await hashPinWithSalt(pin, salt);
            userToSet = { ...u, salt, pinHash };
            setUsers((prev) => prev.map((item) => (item.id === u.id ? userToSet : item)));
            localStorage.setItem(
              STORAGE_KEYS.USERS,
              JSON.stringify(users.map((item) => (item.id === u.id ? userToSet : item)))
            );
            saveUserRemote(userToSet).catch((err) => console.warn('[Cloud saveUserRemote error]:', err));
          }
          setCurrentUser(userToSet);
          setActiveCategory(null);
          setActiveNav('tables'); // Always open Tables on login!
          return { success: true };
        }
      }
      return { success: false, message: 'รหัส PIN ไม่ถูกต้อง' };
    },
    [users]
  );

  const switchUser = useCallback((userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      setActiveCategory(null);
      setActiveNav('tables');
    }
  }, [users]);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const addStaff = useCallback(async (userData: Omit<User, 'id'>) => {
    const salt = userData.salt || generateSalt();
    const pinHash = userData.pinHash || (await hashPinWithSalt(userData.pin || '1234', salt));

    const newUser: User = {
      ...userData,
      id: 'usr_' + Date.now(),
      salt,
      pinHash,
    };
    setUsers((prev) => [...prev, newUser]);
    saveUserRemote(newUser).catch((err) => console.warn('[Cloud sync addStaff]', err));
  }, []);

  const updateStaff = useCallback(async (id: string, updates: Partial<User>) => {
    let updatedUserObj: User | null = null;
    let finalSalt = updates.salt;
    let finalPinHash = updates.pinHash;

    if (updates.pin && (!finalPinHash || !finalSalt)) {
      finalSalt = generateSalt();
      finalPinHash = await hashPinWithSalt(updates.pin, finalSalt);
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const updated: User = {
          ...u,
          ...updates,
          ...(finalSalt ? { salt: finalSalt } : {}),
          ...(finalPinHash ? { pinHash: finalPinHash } : {}),
        };
        updatedUserObj = updated;
        return updated;
      })
    );

    if (updatedUserObj) {
      saveUserRemote(updatedUserObj).catch((err) => console.warn('[Cloud sync updateStaff]', err));
    }
  }, []);

  const deleteStaff = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    deleteUserRemote(id).catch((err) => console.warn('[Cloud sync deleteStaff]', err));
  }, []);

  // Active Bill
  const activeBill = useMemo(() => {
    if (!activeBillId) return null;
    return bills.find((b) => b.id === activeBillId) || null;
  }, [activeBillId, bills]);

  // Notifications
  const addNotification = useCallback((type: AppNotification['type'], title: string, message: string, tableNumber?: string) => {
    const newNotif: AppNotification = {
      id: 'notif_' + Date.now(),
      type,
      title,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      tableNumber,
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
    saveNotificationRemote(newNotif).catch((err) => console.warn('[Cloud saveNotificationRemote error]:', err));
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    markNotificationReadRemote(id).catch((err) => console.warn('[Cloud markNotificationReadRemote error]:', err));
  }, []);

  const clearAllNotifications = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    setNotifications([]);
    clearNotificationsRemote(ids).catch((err) => console.warn('[Cloud clearNotificationsRemote error]:', err));
  }, [notifications]);

  const callWaiterAlert = useCallback((tableNumber: string) => {
    addNotification('call_waiter', 'ลูกค้าเรียกพนักงาน!', `โต๊ะ ${tableNumber} กดเรียกบริการ`, tableNumber);
    soundService.playReadyChime();
    syncService.broadcast('DATA_RELOAD');
  }, [addNotification]);

  const requestBillAlert = useCallback((tableNumber: string) => {
    addNotification('request_bill', 'ลูกค้าขอเช็คบิล!', `โต๊ะ ${tableNumber} ขอยอดชำระเงิน`, tableNumber);
    soundService.playReadyChime();
    setTables((prev) =>
      prev.map((t) => (t.number === tableNumber ? { ...t, status: 'payment_pending' } : t))
    );
    syncService.broadcast('TABLE_UPDATED');
  }, [addNotification]);

  // Order & Bill Creation
  const createBillForOrder = useCallback(
    (orderType: OrderType, tableId?: string, guestCount?: number, deliveryInfo?: DeliveryInfo): Bill => {
      const now = new Date();
      const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
      const count = bills.length + 1;
      const billNumber = `B-${dateStr}-${String(count).padStart(3, '0')}`;

      const assignedTable = tableId ? tables.find((t) => t.id === tableId) : undefined;

      const newBill: Bill = {
        id: 'bill_' + Date.now(),
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
        createdByUserId: currentUser?.id || 'unknown',
        createdByName: currentUser?.name || 'พนักงาน',
        subtotal: 0,
        discountType: 'percentage',
        discountValue: 0,
        discountAmount: 0,
        serviceChargeRate: settings.serviceChargeEnabled ? settings.serviceChargeRate : 0,
        serviceChargeAmount: 0,
        vatRate: settings.vatEnabled ? settings.vatRate : 0,
        vatAmount: 0,
        vatIncluded: settings.vatInclusive,
        grandTotal: 0,
        payments: [],
      };

      setBills((prev) => [...prev, newBill]);
      setActiveBillId(newBill.id);
      saveBillRemote(newBill).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));

      if (tableId) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === tableId
              ? { ...t, status: 'occupied', currentBillId: newBill.id, seatedAt: now.toISOString(), guestCount }
              : t
          )
        );
        syncService.broadcast('TABLE_UPDATED');
        if (assignedTable) {
          saveTableRemote({
            ...assignedTable,
            status: 'occupied',
            currentBillId: newBill.id,
            seatedAt: now.toISOString(),
            guestCount,
          }).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
        }
      }

      return newBill;
    },
    [bills.length, currentUser, settings, tables]
  );

  const openTable = useCallback(
    (tableId: string, guestCount: number): string => {
      const existingTable = tables.find((t) => t.id === tableId);
      if (existingTable?.currentBillId) {
        setActiveBillId(existingTable.currentBillId);
        return existingTable.currentBillId;
      }
      const newBill = createBillForOrder('dine_in', tableId, guestCount);
      return newBill.id;
    },
    [tables, createBillForOrder]
  );

  const assignTableToBill = useCallback(
    (billId: string, tableId: string) => {
      const now = new Date();
      const assignedTable = tables.find((t) => t.id === tableId);
      setBills((prev) =>
        prev.map((b) =>
          b.id === billId
            ? {
                ...b,
                tableId,
                tableName: assignedTable?.number,
                guestCount: b.guestCount || assignedTable?.capacity || 2,
              }
            : b
        )
      );
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status: 'occupied',
                currentBillId: billId,
                seatedAt: t.seatedAt || now.toISOString(),
                guestCount: t.guestCount || assignedTable?.capacity || 2,
              }
            : t
        )
      );
      syncService.broadcast('TABLE_UPDATED');
      syncService.broadcast('DATA_RELOAD');
    },
    [tables]
  );

  const updateBillDeliveryInfo = useCallback(
    (billId: string, deliveryInfo: DeliveryInfo) => {
      setBills((prev) =>
        prev.map((b) => {
          if (b.id !== billId) return b;
          const updated: Bill = {
            ...b,
            orderType: 'delivery',
            deliveryInfo,
            deliveryPlatform: deliveryInfo.platform,
            deliveryGpRate: deliveryInfo.gpRate,
            deliveryGpAmount: deliveryInfo.gpAmount,
            packagingCost: deliveryInfo.packagingCost,
          };
          return recalculateBill(updated, settings);
        })
      );
    },
    [recalculateBill, settings]
  );

  const addItemsToBill = useCallback((billId: string, newItems: OrderItem[]) => {
    setBills((prev) =>
      prev.map((bill) => {
        if (bill.id !== billId) return bill;
        const updatedItems = [...bill.items, ...newItems];
        return recalculateBill({ ...bill, items: updatedItems }, settings);
      })
    );
  }, [recalculateBill, settings]);

  const updateBillItemQuantity = useCallback((billId: string, itemId: string, newQty: number) => {
    setBills((prev) =>
      prev.map((bill) => {
        if (bill.id !== billId) return bill;
        const updatedItems = bill.items
          .map((item) => {
            if (item.id !== itemId) return item;
            return { ...item, quantity: newQty };
          })
          .filter((item) => item.quantity > 0);
        return recalculateBill({ ...bill, items: updatedItems }, settings);
      })
    );
  }, [recalculateBill, settings]);

  const removeUnsentItemFromBill = useCallback((billId: string, itemId: string) => {
    setBills((prev) =>
      prev.map((bill) => {
        if (bill.id !== billId) return bill;
        const updatedItems = bill.items.filter((item) => item.id !== itemId);
        return recalculateBill({ ...bill, items: updatedItems }, settings);
      })
    );
  }, [recalculateBill, settings]);

  // "Confirm order" saves new unsent items to bill without kitchen status flow
  const confirmOrder = useCallback((billId: string) => {
    let affectedTableId: string | undefined;
    let updatedBillObj: Bill | null = null;

    setBills((prev) =>
      prev.map((b) => {
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
        const up = { ...b, items: updatedItems };
        updatedBillObj = up;
        return up;
      })
    );

    if (affectedTableId) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === affectedTableId
            ? {
                ...t,
                status: t.status === 'payment_pending' ? 'payment_pending' : 'occupied',
                currentBillId: billId,
              }
            : t
        )
      );
    }

    soundService.playSuccessTap();
    syncService.broadcast('DATA_RELOAD');

    if (updatedBillObj) {
      saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
    }
  }, []);

  const sendOrderToKitchen = confirmOrder; // alias for backwards compatibility

  const voidOrderItem = useCallback(
    (billId: string, itemId: string, reason: string) => {
      let updatedBillObj: Bill | null = null;
      setBills((prev) =>
        prev.map((b) => {
          if (b.id !== billId) return b;
          const updatedItems = b.items.map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              status: 'voided' as const,
              voidReason: reason,
              voidedBy: currentUser?.name || 'พนักงาน',
              voidedAt: new Date().toISOString(),
            };
          });

          // Recalculate bill excluding voided items
          const activeItems = updatedItems.filter((i) => i.status !== 'voided');
          const recalculated = recalculateBill({ ...b, items: activeItems }, settings);
          const finalBill = {
            ...recalculated,
            items: updatedItems,
          };
          updatedBillObj = finalBill;
          return finalBill;
        })
      );
      syncService.broadcast('DATA_RELOAD');
      if (updatedBillObj) {
        saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
    },
    [currentUser?.name, recalculateBill, settings]
  );

  const applyBillDiscount = useCallback(
    (billId: string, type: 'percentage' | 'fixed', value: number) => {
      let updatedBillObj: Bill | null = null;
      setBills((prev) =>
        prev.map((bill) => {
          if (bill.id !== billId) return bill;
          const recalculated = recalculateBill(
            {
              ...bill,
              discountType: type,
              discountValue: Math.max(0, value),
            },
            settings
          );
          updatedBillObj = recalculated;
          return recalculated;
        })
      );
      if (updatedBillObj) {
        saveBillRemote(updatedBillObj).catch((err) => console.warn('[Cloud saveBillRemote error]:', err));
      }
    },
    [recalculateBill, settings]
  );

  const applyMembershipDiscount = useCallback(
    (billId: string, memberPhone: string, pointsToRedeem: number): boolean => {
      const member = members.find((m) => m.phone === memberPhone);
      if (!member || member.points < pointsToRedeem) return false;

      setBills((prev) =>
        prev.map((b) => {
          if (b.id !== billId) return b;
          return recalculateBill(
            {
              ...b,
              membershipPhone: memberPhone,
              membershipDiscountPoints: pointsToRedeem,
            },
            settings
          );
        })
      );
      return true;
    },
    [members, recalculateBill, settings]
  );

  const checkCanPay = useCallback(
    (target: Bill | Table | null | undefined): CanPayResult => {
      return canPay(target, bills);
    },
    [bills]
  );

  const completeBillPayment = useCallback(
    (billId: string, payments: PaymentRecord[]): { success: boolean; bill: Bill } => {
      const targetBill = bills.find((b) => b.id === billId);
      if (!targetBill) {
        throw new Error('ไม่พบบิล');
      }

      // Re-check rule inside the final "confirm payment" action
      const payCheck = canPay(targetBill, bills);
      if (!payCheck.allowed) {
        return { success: false, bill: targetBill };
      }

      const closedAt = new Date().toISOString();
      const updatedBill: Bill = {
        ...targetBill,
        payments,
        status: 'paid',
        closedAt,
      };

      // Add points to membership if applicable
      if (targetBill.membershipPhone) {
        const pointsEarned = Math.floor(targetBill.grandTotal / settings.pointsEarnRate);
        const pointsSpent = targetBill.membershipDiscountPoints || 0;
        setMembers((prev) =>
          prev.map((m) => {
            if (m.phone === targetBill.membershipPhone) {
              return {
                ...m,
                points: Math.max(0, m.points - pointsSpent + pointsEarned),
                totalSpent: m.totalSpent + targetBill.grandTotal,
              };
            }
            return m;
          })
        );
      }

      // Free the table only if no other open bills remain for this table
      if (targetBill.tableId) {
        const otherOpenBills = bills.filter(
          (b) => b.tableId === targetBill.tableId && b.id !== billId && b.status === 'open'
        );
        if (otherOpenBills.length > 0) {
          setTables((prev) =>
            prev.map((t) =>
              t.id === targetBill.tableId
                ? {
                    ...t,
                    status: 'occupied',
                    currentBillId: otherOpenBills[0].id,
                  }
                : t
            )
          );
        } else {
          setTables((prev) =>
            prev.map((t) =>
              t.id === targetBill.tableId
                ? {
                    ...t,
                    status: 'available',
                    currentBillId: undefined,
                    seatedAt: undefined,
                    guestCount: undefined,
                  }
                : t
            )
          );
        }
      }

      setBills((prev) => prev.map((b) => (b.id === billId ? updatedBill : b)));
      setLastCompletedBill(updatedBill);
      if (activeBillId === billId) {
        setActiveBillId(null);
      }

      soundService.playSuccessTap();
      syncService.broadcast('TABLE_UPDATED');
      syncService.broadcast('DATA_RELOAD');

      // Cloud Atomic writeBatch sync
      if (db && cloudUser) {
        const otherOpenBills = targetBill.tableId
          ? bills.filter((b) => b.tableId === targetBill.tableId && b.id !== billId && b.status === 'open')
          : [];
        const isTableReleased = otherOpenBills.length === 0;
        const nextTableBillId = otherOpenBills[0]?.id;

        const targetMember = targetBill.membershipPhone
          ? members.find((m) => m.phone === targetBill.membershipPhone)
          : undefined;
        const memberUpdate = targetMember
          ? {
              id: targetMember.id,
              points: Math.max(
                0,
                targetMember.points -
                  (targetBill.membershipDiscountPoints || 0) +
                  Math.floor(targetBill.grandTotal / settings.pointsEarnRate)
              ),
              totalSpent: targetMember.totalSpent + targetBill.grandTotal,
            }
          : undefined;

        atomicPayBillAndReleaseTable({
          bill: updatedBill,
          tableId: targetBill.tableId,
          isTableReleased,
          nextTableBillId,
          memberUpdate,
        }).catch((err) => console.warn('[Cloud sync atomicPayBill error]:', err));
      }

      return { success: true, bill: updatedBill };
    },
    [activeBillId, bills, members, settings.pointsEarnRate, cloudUser]
  );

  const voidBill = useCallback(
    (billId: string, reason: string) => {
      const targetBill = bills.find((b) => b.id === billId);
      if (!targetBill) return;

      const voidedAt = new Date().toISOString();
      const updatedBill: Bill = {
        ...targetBill,
        status: 'voided',
        voidReason: reason,
        voidedBy: currentUser?.name || 'พนักงาน',
        voidedAt,
      };

      if (targetBill.tableId) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === targetBill.tableId
              ? {
                  ...t,
                  status: 'available',
                  currentBillId: undefined,
                  seatedAt: undefined,
                  guestCount: undefined,
                }
              : t
          )
        );
      }

      setBills((prev) => prev.map((b) => (b.id === billId ? updatedBill : b)));
      if (activeBillId === billId) {
        setActiveBillId(null);
      }
      syncService.broadcast('TABLE_UPDATED');
      syncService.broadcast('DATA_RELOAD');

      // Cloud Atomic writeBatch sync
      if (db && cloudUser) {
        atomicVoidBillAndReleaseTable({
          bill: updatedBill,
          tableId: targetBill.tableId,
          isTableReleased: true,
        }).catch((err) => console.warn('[Cloud sync atomicVoidBill error]:', err));
      }
    },
    [activeBillId, bills, currentUser?.name, cloudUser]
  );

  const splitBill = useCallback(
    (
      originalBillId: string,
      itemSplits: { itemId: string; quantity: number }[]
    ): { originalBill: Bill; newBill: Bill } | null => {
      const originalBill = bills.find((b) => b.id === originalBillId);
      if (!originalBill) return null;

      const now = new Date();
      // Calculate suffix, e.g. -B, -C, etc.
      const existingSplitsCount = bills.filter(
        (b) => b.tableId && b.tableId === originalBill.tableId
      ).length;
      const splitSuffix = String.fromCharCode(65 + existingSplitsCount);
      const baseBillNum = originalBill.billNumber.replace(/-[A-Z]$/, '');
      const newBillNumber = `${baseBillNum}-${splitSuffix}`;

      const remainingItems: OrderItem[] = [];
      const movedItems: OrderItem[] = [];

      originalBill.items.forEach((item) => {
        const splitSpec = itemSplits.find((s) => s.itemId === item.id);
        const splitQty = splitSpec ? Math.min(item.quantity, Math.max(0, splitSpec.quantity)) : 0;
        const remainQty = item.quantity - splitQty;

        if (splitQty > 0) {
          movedItems.push({
            ...item,
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            quantity: splitQty,
            isNewUnsent: false,
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

      const updatedOriginal = recalculateBill({ ...originalBill, items: remainingItems }, settings);

      const createdNewBill: Bill = recalculateBill(
        {
          id: 'bill_' + Date.now() + '_split',
          billNumber: newBillNumber,
          orderType: originalBill.orderType,
          tableId: originalBill.tableId,
          tableName: originalBill.tableName,
          guestCount: 1,
          items: movedItems,
          status: 'open',
          createdAt: now.toISOString(),
          createdByUserId: currentUser?.id || 'unknown',
          createdByName: currentUser?.name || 'พนักงาน',
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
        },
        settings
      );

      setBills((prev) => [...prev.map((b) => (b.id === originalBillId ? updatedOriginal : b)), createdNewBill]);
      syncService.broadcast('TABLE_UPDATED');
      syncService.broadcast('DATA_RELOAD');

      return { originalBill: updatedOriginal, newBill: createdNewBill };
    },
    [bills, currentUser?.id, currentUser?.name, recalculateBill, settings]
  );

  // Table Floor Plan & Layout Operations
  const moveTable = useCallback((fromTableId: string, toTableId: string): boolean => {
    const fromTable = tables.find((t) => t.id === fromTableId);
    const toTable = tables.find((t) => t.id === toTableId);
    if (!fromTable || !toTable || toTable.status !== 'available') {
      return false;
    }

    let billId = fromTable.currentBillId;
    if (!billId) {
      const existingBill = bills.find(
        (b) => b.tableId === fromTableId && b.status === 'open'
      );
      if (existingBill) {
        billId = existingBill.id;
      }
    }

    if (billId) {
      setBills((prev) =>
        prev.map((b) => (b.id === billId ? { ...b, tableId: toTableId, tableName: toTable.number } : b))
      );
    }

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === fromTableId) {
          return {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
            reservation: undefined,
          };
        }
        if (t.id === toTableId) {
          return {
            ...t,
            status: fromTable.status === 'payment_pending' ? 'payment_pending' : 'occupied',
            currentBillId: billId,
            seatedAt: fromTable.seatedAt || new Date().toISOString(),
            guestCount: fromTable.guestCount || toTable.capacity,
          };
        }
        return t;
      })
    );

    syncService.broadcast('TABLE_UPDATED');
    syncService.broadcast('DATA_RELOAD');
    return true;
  }, [tables, bills]);

  const mergeTables = useCallback((sourceTableIds: string[], targetTableId: string): boolean => {
    const targetTable = tables.find((t) => t.id === targetTableId);
    if (!targetTable) return false;

    let targetBill = bills.find((b) => b.id === targetTable.currentBillId);
    if (!targetBill) {
      targetBill = createBillForOrder('dine_in', targetTableId, targetTable.capacity);
    }

    const sourceBills = bills.filter(
      (b) => sourceTableIds.includes(b.tableId || '') && b.id !== targetBill?.id && b.status === 'open'
    );

    let combinedItems = [...targetBill.items];
    sourceBills.forEach((sb) => {
      combinedItems = [...combinedItems, ...sb.items];
    });

    const recalculatedTargetBill = recalculateBill({ ...targetBill, items: combinedItems }, settings);

    setBills((prev) =>
      prev.map((b) => {
        if (b.id === recalculatedTargetBill.id) return recalculatedTargetBill;
        if (sourceBills.some((sb) => sb.id === b.id)) {
          return {
            ...b,
            status: 'voided',
            voidReason: `รวมเข้ากับโต๊ะ ${targetTable.number}`,
            voidedBy: currentUser?.name || 'พนักงาน',
          };
        }
        return b;
      })
    );

    setTables((prev) =>
      prev.map((t) => {
        if (sourceTableIds.includes(t.id)) {
          return {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
          };
        }
        if (t.id === targetTableId) {
          return {
            ...t,
            status: 'occupied',
            currentBillId: recalculatedTargetBill.id,
          };
        }
        return t;
      })
    );

    syncService.broadcast('TABLE_UPDATED');
    return true;
  }, [bills, createBillForOrder, currentUser?.name, recalculateBill, settings, tables]);

  const requestTableBill = useCallback((tableId: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: 'payment_pending' } : t))
    );
    syncService.broadcast('TABLE_UPDATED');
  }, []);

  const reserveTable = useCallback((tableId: string, reservation: ReservationInfo) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: 'reserved', reservation } : t))
    );
    syncService.broadcast('TABLE_UPDATED');
  }, []);

  const cancelReservation = useCallback((tableId: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, status: 'available', reservation: undefined } : t))
    );
    syncService.broadcast('TABLE_UPDATED');
  }, []);

  const addTable = useCallback((tableData: Omit<Table, 'id' | 'status'>) => {
    const newTable: Table = {
      ...tableData,
      id: 'tbl_' + Date.now(),
      status: 'available',
      shape: tableData.shape || 'square',
      chairStyle: tableData.chairStyle || 'standard',
      x: typeof tableData.x === 'number' ? tableData.x : 60,
      y: typeof tableData.y === 'number' ? tableData.y : 60,
      rotation: tableData.rotation || 0,
    };
    setTables((prev) => [...prev, newTable]);
    syncService.broadcast('TABLE_UPDATED');
    saveTableRemote(newTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
  }, []);

  const updateTable = useCallback((id: string, updates: Partial<Table>) => {
    let updatedTable: Table | null = null;
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const up = { ...t, ...updates };
        updatedTable = up;
        return up;
      })
    );
    syncService.broadcast('TABLE_UPDATED');
    if (updatedTable) {
      saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
    }
  }, []);

  const deleteTable = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
    syncService.broadcast('TABLE_UPDATED');
    deleteTableRemote(id).catch((err) => console.warn('[Cloud deleteTableRemote error]:', err));
  }, []);

  const updateTablePosition = useCallback((id: string, x: number, y: number, rotation?: number) => {
    let updatedTable: Table | null = null;
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const up = {
          ...t,
          x: Math.round(x),
          y: Math.round(y),
          ...(typeof rotation === 'number' ? { rotation } : {}),
        };
        updatedTable = up;
        return up;
      })
    );
    syncService.broadcast('TABLE_UPDATED');
    if (updatedTable) {
      saveTableRemote(updatedTable).catch((err) => console.warn('[Cloud saveTableRemote error]:', err));
    }
  }, []);

  // Menu & Categories
  const addMenuItem = useCallback((itemData: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...itemData,
      id: 'dish_' + Date.now(),
    };
    setMenuItems((prev) => [...prev, newItem]);
    syncService.broadcast('DATA_RELOAD');
    saveMenuItemRemote(newItem).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
  }, []);

  const updateMenuItem = useCallback((id: string, updates: Partial<MenuItem>) => {
    let updatedItem: MenuItem | null = null;
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const up = { ...m, ...updates };
        updatedItem = up;
        return up;
      })
    );
    syncService.broadcast('DATA_RELOAD');
    if (updatedItem) {
      saveMenuItemRemote(updatedItem).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
    }
  }, []);

  const deleteMenuItem = useCallback((id: string) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    syncService.broadcast('DATA_RELOAD');
    deleteMenuItemRemote(id).catch((err) => console.warn('[Cloud deleteMenuItemRemote error]:', err));
  }, []);

  const toggleSoldOut = useCallback((id: string) => {
    let updatedItem: MenuItem | null = null;
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const up = { ...m, isSoldOut: !m.isSoldOut };
        updatedItem = up;
        return up;
      })
    );
    syncService.broadcast('DATA_RELOAD');
    if (updatedItem) {
      saveMenuItemRemote(updatedItem).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
    }
  }, []);

  const addCategory = useCallback((name: string, icon?: string, color?: string, nameEn?: string) => {
    const newCat: MenuCategory = {
      id: 'cat_' + Date.now(),
      name: name.trim(),
      nameEn: nameEn?.trim() || '',
      icon: icon || '🍽️',
      color: color || '#f59e0b',
      sortOrder: categories.length + 1,
    };
    setCategories((prev) => [...prev, newCat]);
    syncService.broadcast('DATA_RELOAD');
    saveCategoryRemote(newCat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
  }, [categories.length]);

  const updateCategory = useCallback((id: string, name: string, icon?: string, color?: string, nameEn?: string) => {
    let updatedCat: MenuCategory | null = null;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const up = {
          ...c,
          name: name.trim(),
          ...(nameEn !== undefined ? { nameEn: nameEn.trim() } : {}),
          ...(icon ? { icon } : {}),
          ...(color ? { color } : {}),
        };
        updatedCat = up;
        return up;
      })
    );
    syncService.broadcast('DATA_RELOAD');
    if (updatedCat) {
      saveCategoryRemote(updatedCat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
    }
  }, []);

  // When a category with items is deleted, move items to "Uncategorized" category
  const deleteCategory = useCallback((id: string) => {
    const targetUncategorizedId = 'cat_uncategorized';
    const itemsInCat = menuItems.filter((m) => m.categoryId === id);

    if (itemsInCat.length > 0) {
      setCategories((prev) => {
        const exists = prev.some((c) => c.id === targetUncategorizedId);
        if (!exists) {
          const uncategorizedCat: MenuCategory = { id: targetUncategorizedId, name: 'ไม่ระบุหมวดหมู่', icon: '📦', color: '#94a3b8', sortOrder: 999 };
          saveCategoryRemote(uncategorizedCat).catch((err) => console.warn('[Cloud saveCategoryRemote error]:', err));
          return [
            ...prev.filter((c) => c.id !== id),
            uncategorizedCat,
          ];
        }
        return prev.filter((c) => c.id !== id);
      });

      setMenuItems((prev) =>
        prev.map((m) => {
          if (m.categoryId !== id) return m;
          const up = { ...m, categoryId: targetUncategorizedId };
          saveMenuItemRemote(up).catch((err) => console.warn('[Cloud saveMenuItemRemote error]:', err));
          return up;
        })
      );
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }

    if (activeCategory === id) {
      setActiveCategory(null);
    }
    syncService.broadcast('DATA_RELOAD');
    deleteCategoryRemote(id).catch((err) => console.warn('[Cloud deleteCategoryRemote error]:', err));
  }, [activeCategory, menuItems]);

  const reorderCategories = useCallback((startIndex: number, endIndex: number) => {
    if (startIndex === endIndex) return;
    setCategories((prev) => {
      const next = [...prev];
      const [moved] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, moved);
      const updated = next.map((cat, idx) => ({ ...cat, sortOrder: idx + 1 }));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(updated));
      syncService.broadcast('DATA_RELOAD');
      return updated;
    });
  }, []);

  const restoreDefaultMenu = useCallback(() => {
    setMenuItems(INITIAL_MENU_ITEMS);
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(INITIAL_MENU_ITEMS));
    syncService.broadcast('DATA_RELOAD');
  }, []);

  // Option Presets Management (หมวด set เมนูย่อย)
  const addOptionPreset = useCallback((presetData: Omit<OptionGroup, 'id'>) => {
    const newPreset: OptionGroup = {
      ...presetData,
      id: 'preset_' + Date.now(),
    };
    setOptionPresets((prev) => [...prev, newPreset]);
    syncService.broadcast('DATA_RELOAD');
    saveOptionPresetRemote(newPreset).catch((err) => console.warn('[Cloud saveOptionPresetRemote error]:', err));
  }, []);

  const updateOptionPreset = useCallback((id: string, updates: Partial<OptionGroup>) => {
    let updatedPreset: OptionGroup | null = null;
    setOptionPresets((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const up = { ...p, ...updates };
        updatedPreset = up;
        return up;
      })
    );
    syncService.broadcast('DATA_RELOAD');
    if (updatedPreset) {
      saveOptionPresetRemote(updatedPreset).catch((err) => console.warn('[Cloud saveOptionPresetRemote error]:', err));
    }
  }, []);

  const deleteOptionPreset = useCallback((id: string) => {
    setOptionPresets((prev) => prev.filter((p) => p.id !== id));
    syncService.broadcast('DATA_RELOAD');
    deleteOptionPresetRemote(id).catch((err) => console.warn('[Cloud deleteOptionPresetRemote error]:', err));
  }, []);

  const reorderOptionPresets = useCallback(
    (startIndexOrList: number | OptionGroup[], endIndex?: number) => {
      setOptionPresets((prev) => {
        let next: OptionGroup[];
        if (Array.isArray(startIndexOrList)) {
          next = [...startIndexOrList];
        } else if (typeof endIndex === 'number') {
          if (startIndexOrList === endIndex) return prev;
          next = [...prev];
          const [moved] = next.splice(startIndexOrList, 1);
          next.splice(endIndex, 0, moved);
        } else {
          return prev;
        }
        localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(next));
        syncService.broadcast('DATA_RELOAD');
        return next;
      });
    },
    []
  );

  // Shifts
  const openShift = useCallback((startingCash: number, note?: string) => {
    const newShift: Shift = {
      id: 'shift_' + Date.now(),
      openedAt: new Date().toISOString(),
      openedBy: currentUser?.name || 'พนักงาน',
      startingCash,
      status: 'open',
      note,
    };
    setCurrentShift(newShift);
    saveShiftRemote(newShift).catch((err) => console.warn('[Cloud saveShiftRemote error]:', err));
  }, [currentUser?.name]);

  const closeShift = useCallback((countedCash: number, note?: string) => {
    if (!currentShift) return;

    const cashPayments = bills
      .filter((b) => b.status === 'paid' && new Date(b.createdAt) >= new Date(currentShift.openedAt))
      .flatMap((b) => b.payments)
      .filter((p) => p.method === 'cash')
      .reduce((sum, p) => sum + p.amount, 0);

    const expectedCash = currentShift.startingCash + cashPayments;
    const difference = countedCash - expectedCash;

    const closed: Shift = {
      ...currentShift,
      closedAt: new Date().toISOString(),
      closedBy: currentUser?.name || 'พนักงาน',
      endingCashCounted: countedCash,
      expectedCash,
      difference,
      status: 'closed',
      note: note ? `${currentShift.note || ''} | ${note}` : currentShift.note,
    };

    setCurrentShift(null);
    saveShiftRemote(closed).catch((err) => console.warn('[Cloud saveShiftRemote error]:', err));
  }, [bills, currentShift, currentUser?.name]);

  // Members
  const findMemberByPhone = useCallback((phone: string) => {
    return members.find((m) => m.phone === phone);
  }, [members]);

  const registerMember = useCallback((name: string, phone: string) => {
    const newMember: Member = {
      id: 'mem_' + Date.now(),
      name,
      phone,
      points: 0,
      totalSpent: 0,
      registeredAt: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, newMember]);
    saveMemberRemote(newMember).catch((err) => console.warn('[Cloud saveMemberRemote error]:', err));
    return newMember;
  }, []);

  // On-demand loader for historical bills older than 30 days
  const loadArchivedBills = useCallback(async (): Promise<number> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const archived = await fetchArchivedBills(thirtyDaysAgoISO);
    if (archived && archived.length > 0) {
      setBills((prev) => {
        const map = new Map(prev.map((b) => [b.id, b]));
        archived.forEach((b) => {
          if (!map.has(b.id)) {
            map.set(b.id, b);
          }
        });
        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(merged));
        return merged;
      });
      syncService.broadcast('DATA_RELOAD');
      return archived.length;
    }
    return 0;
  }, []);

  // Settings & QR
  const updateSettings = useCallback((updates: Partial<ShopSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const addQrImage = useCallback((label: string, imageData: string, isDefault = false) => {
    const newQr: PaymentQrImage = {
      id: 'qr_' + Date.now(),
      label,
      imageData,
      isDefault,
    };
    setQrImages((prev) => {
      if (isDefault) {
        return [...prev.map((q) => ({ ...q, isDefault: false })), newQr];
      }
      return [...prev, newQr];
    });
  }, []);

  const updateQrImage = useCallback((id: string, updates: Partial<PaymentQrImage>) => {
    setQrImages((prev) =>
      prev.map((q) => {
        if (q.id !== id) {
          if (updates.isDefault) return { ...q, isDefault: false };
          return q;
        }
        return { ...q, ...updates };
      })
    );
  }, []);

  const deleteQrImage = useCallback((id: string) => {
    setQrImages((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // Backup & Reset
  const resetDemoData = useCallback(() => {
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setSettings(INITIAL_SETTINGS);
    setTables(autoPositionTables(INITIAL_TABLES));
    setCategories(INITIAL_CATEGORIES);
    setMenuItems(INITIAL_MENU_ITEMS);
    setBills(INITIAL_BILLS);
    setMembers(INITIAL_MEMBERS);
    setQrImages(INITIAL_QR_IMAGES);
    setCurrentShift(INITIAL_SHIFT);
    setNotifications([]);
    setActiveCategory(null);
    setSelectedZone('all');
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
        setUsers(filteredUsers);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filteredUsers));
      }

      if (data.settings && typeof data.settings === 'object') {
        setSettings(data.settings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }

      if (data.zones && Array.isArray(data.zones)) {
        setZones(data.zones);
        localStorage.setItem(STORAGE_KEYS.ZONES, JSON.stringify(data.zones));
      }

      if (data.categories && Array.isArray(data.categories)) {
        setCategories(data.categories);
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
      }

      if (data.menuItems && Array.isArray(data.menuItems)) {
        setMenuItems(data.menuItems);
        localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(data.menuItems));
      }

      if (data.optionPresets && Array.isArray(data.optionPresets)) {
        setOptionPresets(data.optionPresets);
        localStorage.setItem(STORAGE_KEYS.OPTION_PRESETS, JSON.stringify(data.optionPresets));
      }

      if (data.tables && Array.isArray(data.tables)) {
        const positionedTables = autoPositionTables(data.tables);
        setTables(positionedTables);
        localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(positionedTables));
      }

      if (data.bills && Array.isArray(data.bills)) {
        setBills(data.bills);
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(data.bills));
      }

      if (data.members && Array.isArray(data.members)) {
        setMembers(data.members);
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(data.members));
      }

      if (data.qrImages && Array.isArray(data.qrImages)) {
        setQrImages(data.qrImages);
        localStorage.setItem(STORAGE_KEYS.QR_IMAGES, JSON.stringify(data.qrImages));
      }

      if (data.currentShift) {
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
    setActiveNav,

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
