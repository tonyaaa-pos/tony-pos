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
} from '../data/seedData';
import { syncService, SyncMessage } from '../services/syncService';
import { soundService } from '../utils/audio';

interface POSContextType {
  // Auth
  currentUser: User | null;
  users: User[];
  loginWithPin: (pin: string) => { success: boolean; message?: string };
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
  addCategory: (name: string, icon?: string, color?: string) => void;
  updateCategory: (id: string, name: string, icon?: string, color?: string) => void;
  deleteCategory: (id: string) => void;

  // Order & Bills
  bills: Bill[];
  activeBill: Bill | null;
  setActiveBillId: (billId: string | null) => void;
  createBillForOrder: (orderType: OrderType, tableId?: string, guestCount?: number, deliveryInfo?: DeliveryInfo) => Bill;
  addItemsToBill: (billId: string, items: OrderItem[]) => void;
  updateBillItemQuantity: (billId: string, itemId: string, newQty: number) => void;
  removeUnsentItemFromBill: (billId: string, itemId: string) => void;
  confirmOrder: (billId: string) => void;
  sendOrderToKitchen: (billId: string) => void; // alias to confirmOrder
  voidOrderItem: (billId: string, itemId: string, reason: string) => void;
  applyBillDiscount: (billId: string, type: 'percentage' | 'fixed', value: number) => void;
  applyMembershipDiscount: (billId: string, memberPhone: string, pointsToRedeem: number) => boolean;
  completeBillPayment: (billId: string, payments: PaymentRecord[]) => { success: boolean; bill: Bill };
  voidBill: (billId: string, reason: string) => void;
  lastCompletedBill: Bill | null;
  setLastCompletedBill: (bill: Bill | null) => void;

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

  // Users (filter out obsolete 'kitchen' role)
  const [users, setUsers] = useState<User[]>(() => {
    const loaded = loadState<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return loaded.filter((u: any) => u.role !== 'kitchen');
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const loaded = loadState<User | null>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
    if (!loaded || (loaded as any).role === 'kitchen') {
      return INITIAL_USERS[0];
    }
    return loaded;
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

  // Categories
  const [categories, setCategories] = useState<MenuCategory[]>(() =>
    loadState(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES)
  );

  // Menu Items (clean up obsolete recipeIngredients)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const loaded = loadState<MenuItem[]>(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS);
    return loaded.map((item: any) => {
      const { recipeIngredients, ...rest } = item;
      return rest;
    });
  });

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

  // Persistent storage writers with safe cleanup
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

  // Multi-Tab Sync Listener
  useEffect(() => {
    const unsubscribe = syncService.subscribe((msg: SyncMessage) => {
      if (msg.type === 'DATA_RELOAD' || msg.type === 'TABLE_UPDATED') {
        setTables(autoPositionTables(loadState(STORAGE_KEYS.TABLES, INITIAL_TABLES)));
        setBills(loadState(STORAGE_KEYS.BILLS, INITIAL_BILLS));
        setMenuItems(loadState(STORAGE_KEYS.MENU, INITIAL_MENU_ITEMS));
        setCategories(loadState(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES));
        setNotifications(loadState(STORAGE_KEYS.NOTIFICATIONS, []));
      }
    });

    return () => {
      unsubscribe();
    };
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

    return {
      ...bill,
      subtotal,
      discountAmount,
      serviceChargeAmount,
      vatAmount,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, []);

  // Auth Handlers
  const loginWithPin = useCallback((pin: string) => {
    const matched = users.find((u) => u.pin === pin);
    if (matched) {
      setCurrentUser(matched);
      setActiveCategory(null);
      setActiveNav('tables'); // Always open Tables on login!
      return { success: true };
    }
    return { success: false, message: 'รหัส PIN ไม่ถูกต้อง' };
  }, [users]);

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

  const addStaff = useCallback((userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: 'usr_' + Date.now(),
    };
    setUsers((prev) => [...prev, newUser]);
  }, []);

  const updateStaff = useCallback((id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  }, []);

  const deleteStaff = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
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
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

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

      if (tableId) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === tableId
              ? { ...t, status: 'occupied', currentBillId: newBill.id, seatedAt: now.toISOString(), guestCount }
              : t
          )
        );
        syncService.broadcast('TABLE_UPDATED');
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
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
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
        return { ...b, items: updatedItems };
      })
    );

    soundService.playSuccessTap();
    syncService.broadcast('DATA_RELOAD');
  }, []);

  const sendOrderToKitchen = confirmOrder; // alias for backwards compatibility

  const voidOrderItem = useCallback(
    (billId: string, itemId: string, reason: string) => {
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
          return {
            ...recalculated,
            items: updatedItems,
          };
        })
      );
      syncService.broadcast('DATA_RELOAD');
    },
    [currentUser?.name, recalculateBill, settings]
  );

  const applyBillDiscount = useCallback(
    (billId: string, type: 'percentage' | 'fixed', value: number) => {
      setBills((prev) =>
        prev.map((bill) => {
          if (bill.id !== billId) return bill;
          return recalculateBill(
            {
              ...bill,
              discountType: type,
              discountValue: Math.max(0, value),
            },
            settings
          );
        })
      );
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

  const completeBillPayment = useCallback(
    (billId: string, payments: PaymentRecord[]): { success: boolean; bill: Bill } => {
      const targetBill = bills.find((b) => b.id === billId);
      if (!targetBill) {
        throw new Error('ไม่พบบิล');
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

      // Free the table
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
      setLastCompletedBill(updatedBill);
      if (activeBillId === billId) {
        setActiveBillId(null);
      }

      soundService.playSuccessTap();
      syncService.broadcast('TABLE_UPDATED');
      syncService.broadcast('DATA_RELOAD');

      return { success: true, bill: updatedBill };
    },
    [activeBillId, bills, settings.pointsEarnRate]
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
    },
    [activeBillId, bills, currentUser?.name]
  );

  // Table Floor Plan & Layout Operations
  const moveTable = useCallback((fromTableId: string, toTableId: string): boolean => {
    const fromTable = tables.find((t) => t.id === fromTableId);
    const toTable = tables.find((t) => t.id === toTableId);
    if (!fromTable || !toTable || toTable.status !== 'available' || !fromTable.currentBillId) {
      return false;
    }

    const billId = fromTable.currentBillId;
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, tableId: toTableId, tableName: toTable.number } : b))
    );

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === fromTableId) {
          return {
            ...t,
            status: 'available',
            currentBillId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
          };
        }
        if (t.id === toTableId) {
          return {
            ...t,
            status: 'occupied',
            currentBillId: billId,
            seatedAt: fromTable.seatedAt,
            guestCount: fromTable.guestCount,
          };
        }
        return t;
      })
    );

    syncService.broadcast('TABLE_UPDATED');
    return true;
  }, [tables]);

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
  }, []);

  const updateTable = useCallback((id: string, updates: Partial<Table>) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    syncService.broadcast('TABLE_UPDATED');
  }, []);

  const deleteTable = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
    syncService.broadcast('TABLE_UPDATED');
  }, []);

  const updateTablePosition = useCallback((id: string, x: number, y: number, rotation?: number) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          x: Math.round(x),
          y: Math.round(y),
          ...(typeof rotation === 'number' ? { rotation } : {}),
        };
      })
    );
    syncService.broadcast('TABLE_UPDATED');
  }, []);

  // Menu & Categories
  const addMenuItem = useCallback((itemData: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...itemData,
      id: 'dish_' + Date.now(),
    };
    setMenuItems((prev) => [...prev, newItem]);
    syncService.broadcast('DATA_RELOAD');
  }, []);

  const updateMenuItem = useCallback((id: string, updates: Partial<MenuItem>) => {
    setMenuItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    syncService.broadcast('DATA_RELOAD');
  }, []);

  const deleteMenuItem = useCallback((id: string) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    syncService.broadcast('DATA_RELOAD');
  }, []);

  const toggleSoldOut = useCallback((id: string) => {
    setMenuItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isSoldOut: !m.isSoldOut } : m))
    );
    syncService.broadcast('DATA_RELOAD');
  }, []);

  const addCategory = useCallback((name: string, icon?: string, color?: string) => {
    const newCat: MenuCategory = {
      id: 'cat_' + Date.now(),
      name: name.trim(),
      icon: icon || '🍽️',
      color: color || '#f59e0b',
      sortOrder: categories.length + 1,
    };
    setCategories((prev) => [...prev, newCat]);
    syncService.broadcast('DATA_RELOAD');
  }, [categories.length]);

  const updateCategory = useCallback((id: string, name: string, icon?: string, color?: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: name.trim(), ...(icon ? { icon } : {}), ...(color ? { color } : {}) } : c))
    );
    syncService.broadcast('DATA_RELOAD');
  }, []);

  // When a category with items is deleted, move items to "Uncategorized" category
  const deleteCategory = useCallback((id: string) => {
    const targetUncategorizedId = 'cat_uncategorized';
    const itemsInCat = menuItems.filter((m) => m.categoryId === id);

    if (itemsInCat.length > 0) {
      setCategories((prev) => {
        const exists = prev.some((c) => c.id === targetUncategorizedId);
        if (!exists) {
          return [
            ...prev.filter((c) => c.id !== id),
            { id: targetUncategorizedId, name: 'ไม่ระบุหมวดหมู่', icon: '📦', color: '#94a3b8', sortOrder: 999 },
          ];
        }
        return prev.filter((c) => c.id !== id);
      });

      setMenuItems((prev) =>
        prev.map((m) => (m.categoryId === id ? { ...m, categoryId: targetUncategorizedId } : m))
      );
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }

    if (activeCategory === id) {
      setActiveCategory(null);
    }
    syncService.broadcast('DATA_RELOAD');
  }, [activeCategory, menuItems]);

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
    return newMember;
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

    syncService.broadcast('DATA_RELOAD');
  }, []);

  const exportDataJson = useCallback(() => {
    const backup = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      users,
      settings,
      tables,
      categories,
      menuItems,
      bills,
      members,
      qrImages,
      currentShift,
    };
    return JSON.stringify(backup, null, 2);
  }, [users, settings, tables, categories, menuItems, bills, members, qrImages, currentShift]);

  const importDataJson = useCallback((jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.users && Array.isArray(data.users)) setUsers(data.users.filter((u: any) => u.role !== 'kitchen'));
      if (data.settings) setSettings(data.settings);
      if (data.tables && Array.isArray(data.tables)) setTables(autoPositionTables(data.tables));
      if (data.categories && Array.isArray(data.categories)) setCategories(data.categories);
      if (data.menuItems && Array.isArray(data.menuItems)) setMenuItems(data.menuItems);
      if (data.bills && Array.isArray(data.bills)) setBills(data.bills);
      if (data.members && Array.isArray(data.members)) setMembers(data.members);
      if (data.qrImages && Array.isArray(data.qrImages)) setQrImages(data.qrImages);
      if (data.currentShift) setCurrentShift(data.currentShift);

      syncService.broadcast('DATA_RELOAD');
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

    bills,
    activeBill,
    setActiveBillId,
    createBillForOrder,
    addItemsToBill,
    updateBillItemQuantity,
    removeUnsentItemFromBill,
    confirmOrder,
    sendOrderToKitchen,
    voidOrderItem,
    applyBillDiscount,
    applyMembershipDiscount,
    completeBillPayment,
    voidBill,
    lastCompletedBill,
    setLastCompletedBill,

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
