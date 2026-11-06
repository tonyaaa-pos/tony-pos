import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { MenuItem, OrderItem, OrderType, DeliveryInfo, DeliveryPlatform } from '../../types';
import {
  Trash2,
  CheckCircle,
  CreditCard,
  UtensilsCrossed,
  Ban,
  Clock,
  Sparkles,
  AlertTriangle,
  User,
  ShoppingBag,
  Truck,
  Bike,
  Package,
  Search,
  GripVertical,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Edit,
  SlidersHorizontal,
} from 'lucide-react';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../../data/seedData';
import { formatBaht } from '../../utils/formatters';
import { ItemCustomizerModal } from './ItemCustomizerModal';
import { PaymentModal } from './PaymentModal';
import { VoidItemModal } from './VoidItemModal';
import { soundService } from '../../utils/audio';
import { ZoneBar } from '../common/ZoneBar';
import { canPay, PayBlockReason } from '../../utils/orderRules';
import { UnsavedItemsPaymentDialog } from './UnsavedItemsPaymentDialog';
import { Modal } from '../common/Modal';
import { EditMenuItemModal } from '../menu/EditMenuItemModal';
import { customerDisplayService } from '../../services/customerDisplayService';

// Robust matching function so dishes always appear in their category
export const isDishInCategory = (
  item: MenuItem,
  catId: string | null | undefined,
  allCategories: any[]
): boolean => {
  if (!catId || catId === 'all' || catId === 'null' || catId === 'undefined' || catId === '') return true;
  if (item.categoryId === catId) return true;

  const targetCategory = allCategories.find((c) => c.id === catId);
  if (!targetCategory) return true; // Safe fallback: if catId doesn't exist, don't hide dishes!

  // Match by category name or English name
  const itemCategory = allCategories.find((c) => c.id === item.categoryId);
  if (
    itemCategory &&
    (itemCategory.name === targetCategory.name ||
      (itemCategory.nameEn && itemCategory.nameEn === targetCategory.nameEn))
  ) {
    return true;
  }

  // Match raw fields
  if (
    (item as any).category === targetCategory.name ||
    (item as any).categoryName === targetCategory.name
  ) {
    return true;
  }

  // Standard category name map fallback
  const standardNameMap: Record<string, string> = {
    cat_1: 'อาหารจานเดียว',
    cat_2: 'ต้มและแกง',
    cat_3: 'ส้มตำและยำ',
    cat_4: 'ของทานเล่น',
    cat_5: 'เครื่องดื่มและขนมหวาน',
  };

  if (standardNameMap[item.categoryId] && standardNameMap[item.categoryId] === targetCategory.name) {
    return true;
  }
  if (standardNameMap[targetCategory.id] && itemCategory && itemCategory.name === standardNameMap[targetCategory.id]) {
    return true;
  }

  // Fallback to initial canonical category mappings
  const initialMatch = INITIAL_MENU_ITEMS.find((init) => init.id === item.id || init.name === item.name);
  if (initialMatch) {
    if (initialMatch.categoryId === catId) return true;
    const initialCat = INITIAL_CATEGORIES.find((c) => c.id === initialMatch.categoryId);
    if (initialCat && initialCat.name === targetCategory.name) return true;
  }

  return false;
};

export const POSView: React.FC = () => {
  const {
    categories,
    menuItems,
    tables,
    bills,
    activeBill,
    setActiveBillId,
    setActiveNav,
    createBillForOrder,
    updateBillDeliveryInfo,
    assignTableToBill,
    addItemsToBill,
    updateBillItemQuantity,
    removeUnsentItemFromBill,
    confirmOrder,
    voidOrderItem,
    settings,
    activeCategory,
    setActiveCategory,
    selectedZone,
    reorderCategories,
    restoreDefaultMenu,
  } = usePOS();

  const { t, getName } = useLanguage();

  // Modals
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [voidingItem, setVoidingItem] = useState<OrderItem | null>(null);
  const [quickEditItem, setQuickEditItem] = useState<MenuItem | null>(null);

  // 2-Second Long-Press state for editing dishes directly
  const [holdingDishId, setHoldingDishId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const lastOrderTimestampRef = useRef<number>(0);

  // Blocked payment and table selection modals
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [payBlockReason, setPayBlockReason] = useState<PayBlockReason>('unsaved_items');
  const [showTableSelectModal, setShowTableSelectModal] = useState(false);

  // Delivery platform info edit mode
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryPlatform, setDeliveryPlatform] = useState<DeliveryPlatform>('grab');
  const [deliveryPlatformOrderId, setDeliveryPlatformOrderId] = useState('');
  const [deliveryGpRate, setDeliveryGpRate] = useState<number>(30);
  const [deliveryPackagingCost, setDeliveryPackagingCost] = useState<number>(15);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [searchDishQuery, setSearchDishQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu');

  // Drag and drop state for reordering categories
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);
  const [dragOverCatIndex, setDragOverCatIndex] = useState<number | null>(null);

  // Auto-reset activeCategory and self-heal menu items on POSView mount
  useEffect(() => {
    if (
      !activeCategory ||
      activeCategory === 'null' ||
      activeCategory === 'undefined' ||
      (activeCategory !== 'all' && !categories.some((c) => c.id === activeCategory))
    ) {
      setActiveCategory('all');
    }
    if (!menuItems || menuItems.length === 0) {
      restoreDefaultMenu();
    }
  }, [activeCategory, categories, menuItems, restoreDefaultMenu, setActiveCategory]);

  // Real-time synchronization with secondary customer-facing display
  useEffect(() => {
    customerDisplayService.setOrdering(activeBill);
  }, [activeBill]);

  // Filtered menu items based on active food category and optional search query
  const filteredMenuItems = useMemo(() => {
    // 1. Initial filter by category & search
    let list = menuItems.filter((item) => {
      const matchCat = isDishInCategory(item, activeCategory, categories);

      const matchSearch =
        !searchDishQuery.trim() ||
        item.name.toLowerCase().includes(searchDishQuery.toLowerCase()) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(searchDishQuery.toLowerCase()));

      return matchCat && matchSearch && item.isAvailable !== false;
    });

    // 2. Fail-safe: if the current category yields 0 items and no search is entered,
    // fallback automatically to all available dishes so the POS is NEVER empty when entering from floor plan!
    if (list.length === 0 && !searchDishQuery.trim()) {
      list = menuItems.filter((item) => item.isAvailable !== false);
    }

    // 3. Absolute fail-safe: if menuItems in state is somehow empty, fallback to INITIAL_MENU_ITEMS
    if (list.length === 0) {
      list = INITIAL_MENU_ITEMS;
    }

    return list;
  }, [menuItems, activeCategory, searchDishQuery, categories]);

  // Filtered tables for the switcher dropdown based on active zone
  const filteredTables = useMemo(() => {
    if (selectedZone === 'all') {
      return tables;
    }
    return tables.filter((t) => t.zone === selectedZone);
  }, [tables, selectedZone]);

  // Current order type
  const orderType: OrderType = activeBill ? activeBill.orderType : 'dine_in';

  const handleOpenDeliveryModal = () => {
    if (activeBill?.deliveryInfo) {
      setDeliveryPlatform(activeBill.deliveryInfo.platform || 'grab');
      setDeliveryPlatformOrderId(activeBill.deliveryInfo.platformOrderId || '');
      setDeliveryGpRate(activeBill.deliveryInfo.gpRate ?? (activeBill.deliveryGpRate ?? 30));
      setDeliveryPackagingCost(activeBill.deliveryInfo.packagingCost ?? (activeBill.packagingCost ?? 15));
      setDeliveryName(activeBill.deliveryInfo.customerName || '');
      setDeliveryPhone(activeBill.deliveryInfo.phone || '');
      setDeliveryAddress(activeBill.deliveryInfo.address || '');
    } else {
      setDeliveryPlatform('grab');
      setDeliveryPlatformOrderId('');
      setDeliveryGpRate(30);
      setDeliveryPackagingCost(15);
      setDeliveryName('');
      setDeliveryPhone('');
      setDeliveryAddress('');
    }
    setShowDeliveryForm(true);
  };

  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const info: DeliveryInfo = {
      platform: deliveryPlatform,
      platformOrderId: deliveryPlatformOrderId.trim(),
      gpRate: Number(deliveryGpRate) || 0,
      packagingCost: Number(deliveryPackagingCost) || 0,
      customerName: deliveryName.trim() || `${deliveryPlatform.toUpperCase()} Customer`,
      phone: deliveryPhone.trim(),
      address: deliveryAddress.trim(),
    };

    if (activeBill) {
      updateBillDeliveryInfo(activeBill.id, info);
    } else {
      const newBill = createBillForOrder('delivery', undefined, 1, info);
      setActiveBillId(newBill.id);
    }
    setShowDeliveryForm(false);
    soundService.playSuccessTap();
  };

  // Direct single-click / single-tap order handler: immediately adds dish to bill!
  const orderFoodItem = (menuItem: MenuItem) => {
    if (menuItem.isSoldOut) {
      soundService.playTap();
      return;
    }

    // Ensure we have an active bill. If not, auto-select first open bill or create a new one!
    let targetBill = activeBill;
    if (!targetBill) {
      const openBill = bills.find((b) => b.status === 'open');
      if (openBill) {
        targetBill = openBill;
        setActiveBillId(openBill.id);
      } else {
        targetBill = createBillForOrder('dine_in');
      }
    }

    // Default variant (first available variant) or base dish price
    const defaultVariant =
      menuItem.variants?.find((v) => !v.isSoldOut && v.isAvailable !== false) ||
      menuItem.variants?.[0];
    const price = defaultVariant?.price ?? menuItem.price ?? 0;
    const cost = defaultVariant?.cost ?? menuItem.cost ?? 0;

    // Check if there is already an unsent item for this exact dish and variant without extra options
    const existingUnsent = targetBill.items.find(
      (it) =>
        it.menuItemId === menuItem.id &&
        it.isNewUnsent &&
        (it.variantId || '') === (defaultVariant?.id || '') &&
        (!it.selectedOptions || it.selectedOptions.length === 0)
    );

    if (existingUnsent) {
      updateBillItemQuantity(targetBill.id, existingUnsent.id, existingUnsent.quantity + 1);
    } else {
      const orderItem: OrderItem = {
        id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        menuItemId: menuItem.id,
        variantId: defaultVariant?.id,
        variantName: defaultVariant?.name,
        variantNameEn: defaultVariant?.nameEn,
        name: menuItem.name,
        nameEn: menuItem.nameEn,
        price: price,
        cost: cost,
        quantity: 1,
        selectedOptions: [],
        note: '',
        isNewUnsent: true,
      };
      addItemsToBill(targetBill.id, [orderItem]);
    }
    soundService.playSuccessTap();
  };

  // 2-Second Hold-to-Edit handlers
  const handleHoldStart = (e: React.MouseEvent | React.TouchEvent, item: MenuItem) => {
    // Only primary mouse button or single touch
    if ('button' in e && e.button !== 0) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startPosRef.current = { x: clientX, y: clientY };
    pressStartTimeRef.current = Date.now();
    isLongPressTriggeredRef.current = false;

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    const startTime = Date.now();

    // Show hold progress ring ONLY after 500ms so quick clicks/taps never show any overlay or re-render
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= 500) {
        setHoldingDishId(item.id);
        const pct = Math.min(100, ((elapsed - 500) / 1500) * 100);
        setHoldProgress(pct);
      }
    }, 40);

    holdTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      setHoldingDishId(null);
      setHoldProgress(0);
      soundService.playReadyChime();
      setQuickEditItem(item);
    }, 2000);
  };

  const handleHoldEnd = (e?: React.MouseEvent | React.TouchEvent, item?: MenuItem) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldingDishId(null);
    setHoldProgress(0);

    // If it was a quick touch on mobile/tablet (< 450ms) and not long press, open option customization modal!
    if (e && 'changedTouches' in e && item) {
      const touchDuration = Date.now() - (pressStartTimeRef.current || 0);
      if (!isLongPressTriggeredRef.current && touchDuration < 450) {
        const now = Date.now();
        if (now - lastOrderTimestampRef.current >= 250) {
          lastOrderTimestampRef.current = now;
          if (!item.isSoldOut) {
            soundService.playTap();
            setCustomizingItem(item);
          }
        }
      }
    }
  };

  const handleHoldMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!startPosRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - startPosRef.current.x);
    const dy = Math.abs(clientY - startPosRef.current.y);

    if (dx > 15 || dy > 15) {
      handleHoldEnd();
    }
  };

  // Single tap / click: opens the option customization modal so staff can choose options before confirming!
  const handleItemCardClick = (menuItem: MenuItem) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (menuItem.isSoldOut) {
      soundService.playTap();
      return;
    }

    // Debounce fast duplicate clicks (e.g. touch + synthetic click)
    const now = Date.now();
    if (now - lastOrderTimestampRef.current < 250) {
      return;
    }
    lastOrderTimestampRef.current = now;

    soundService.playTap();
    setCustomizingItem(menuItem);
  };

  const handleAddToCart = (item: OrderItem) => {
    let targetBill = activeBill;
    if (!targetBill) {
      const openBill = bills.find((b) => b.status === 'open');
      if (openBill) {
        targetBill = openBill;
        setActiveBillId(openBill.id);
      } else {
        targetBill = createBillForOrder('dine_in');
      }
    }
    addItemsToBill(targetBill.id, [item]);
    soundService.playSuccessTap();
  };


  // Unsent items in cart
  const unsentCount = activeBill?.items.filter((i) => i.isNewUnsent).length || 0;
  const activeCartCount = activeBill?.items.filter((i) => i.status !== 'voided').length || 0;

  // Active category item count helper with reliable fail-safe
  const totalAvailableDishes = useMemo(() => {
    const count = menuItems.filter((m) => m.isAvailable !== false).length;
    return count > 0 ? count : INITIAL_MENU_ITEMS.length;
  }, [menuItems]);

  return (
    <div className="h-full min-h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)] flex flex-col md:flex-row overflow-hidden">
      {/* Mobile View Toggle Bar (Only visible on small screens < md) */}
      <div className="md:hidden flex items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('menu')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'menu'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>เลือกเมนูอาหาร ({filteredMenuItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileTab === 'cart'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>
            {activeBill?.tableName ? `โต๊ะ ${activeBill.tableName}` : 'ตะกร้า/บิล'}
            {activeCartCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px]">
                {activeCartCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* LEFT: Menu Browse (Food categories + items grid) */}
      <div
        className={`flex-1 min-h-0 flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden border-r border-slate-200 dark:border-slate-800 ${
          mobileTab === 'cart' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Menu Items Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
          {filteredMenuItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
              <UtensilsCrossed className="w-12 h-12 opacity-35" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  ไม่มีรายการอาหารในหมวดหมู่นี้
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  เลือกดูหมวดอื่น หรือกดปุ่มด้านล่างเพื่อแสดงเมนูทั้งหมด
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory('all');
                    setSearchDishQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  ✨ แสดงอาหารทั้งหมด ({totalAvailableDishes} รายการ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    restoreDefaultMenu();
                    soundService.playSuccessTap();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>กู้คืนเมนูอาหารทั้งหมด</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemCardClick(item)}
                  onMouseDown={(e) => handleHoldStart(e, item)}
                  onMouseUp={(e) => handleHoldEnd(e, item)}
                  onMouseLeave={() => handleHoldEnd()}
                  onTouchStart={(e) => handleHoldStart(e, item)}
                  onTouchEnd={(e) => handleHoldEnd(e, item)}
                  onTouchCancel={() => handleHoldEnd()}
                  onTouchMove={handleHoldMove}
                  onMouseMove={handleHoldMove}
                  title="คลิกเพื่อเลือกตัวเลือกย่อยและสั่งอาหาร หรือกดค้างไว้ 2 วินาทีเพื่อแก้ไขเมนูนี้ทันที"
                  className={`relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden flex flex-col justify-between transition group select-none ${
                    item.isSoldOut
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-md hover:border-amber-400 active:scale-98'
                  }`}
                >
                  {/* Food Photo Container */}
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={item.image}
                      alt={getName(item)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" fill="%23cbd5e1"><rect width="200" height="150"/><text x="100" y="80" font-family="sans-serif" font-size="16" fill="%23475569" text-anchor="middle">Food</text></svg>';
                      }}
                    />

                    {/* Quick Edit Pencil Button (Top-Right) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        soundService.playTap();
                        setQuickEditItem(item);
                      }}
                      className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-slate-900/60 hover:bg-amber-500 text-white hover:text-slate-950 flex items-center justify-center shadow-md backdrop-blur-xs transition cursor-pointer"
                      title="แก้ไขเมนูนี้ (หรือกดค้างไว้ 2 วินาที)"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* 2-Second Hold-to-Edit Countdown & Progress Ring (pointer-events-none ensures clicks/taps are NEVER blocked) */}
                    {holdingDishId === item.id && (
                      <div className="absolute inset-0 z-20 pointer-events-none bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center transition-all animate-in fade-in">
                        <div className="relative w-14 h-14 flex items-center justify-center mb-1">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-slate-700"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-amber-400 transition-all duration-75"
                              strokeDasharray={`${holdProgress}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <Edit className="w-5 h-5 text-amber-400 absolute" />
                        </div>
                        <span className="text-[11px] font-bold text-white leading-tight">
                          เข้าสู่โหมดแก้ไข
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 mt-0.5">
                          {Math.min(2.0, holdProgress * 0.02).toFixed(1)}s / 2.0s
                        </span>
                      </div>
                    )}

                    {/* Sold out overlay */}
                    {item.isSoldOut && (
                      <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center p-2 text-center pointer-events-none">
                        <span className="px-3 py-1 bg-rose-600 text-white font-extrabold text-xs rounded-lg uppercase tracking-wider shadow-md">
                          {t('sold_out_overlay')}
                        </span>
                      </div>
                    )}

                    {/* Small unobtrusive recommended badge on photo corner */}
                    {item.isRecommended && !item.isSoldOut && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs flex items-center gap-1 pointer-events-none">
                        <Sparkles className="w-3 h-3" />
                        <span>{t('recommended_badge')}</span>
                      </div>
                    )}

                    {/* Optional Quick Customize Button (for multi-variant dishes if desired) */}
                    {((item.variants && item.variants.length > 1) || (item.optionGroups && item.optionGroups.length > 0)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundService.playTap();
                          setCustomizingItem(item);
                        }}
                        className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-lg bg-slate-900/80 hover:bg-amber-500 text-white hover:text-slate-950 font-semibold text-[10px] flex items-center gap-1 shadow-xs backdrop-blur-xs transition cursor-pointer"
                        title="เลือกขนาดหรือท็อปปิ้งเพิ่มเติม"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>ตัวเลือก</span>
                      </button>
                    )}
                  </div>

                  {/* Card ONLY shows food-type name below photo */}
                  <div className="p-3 sm:p-3.5 flex items-center justify-center min-h-[48px] sm:min-h-[54px] text-center pointer-events-none">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {getName(item)}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Quick Cart Bar (bottom of menu column when items exist) */}
        {activeCartCount > 0 && (
          <div className="md:hidden p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 shadow-md">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              เลือกแล้ว <strong className="text-slate-900 dark:text-white">{activeCartCount}</strong> รายการ ·{' '}
              <strong className="text-amber-600 dark:text-amber-400 font-mono text-sm">
                {formatBaht(activeBill?.grandTotal || 0)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setMobileTab('cart')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>ดูบิล / ชำระเงิน</span>
              <ShoppingBag className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT: Order Cart & Bill Panel */}
      <div
        className={`w-full md:w-[320px] lg:w-[380px] xl:w-[420px] bg-white dark:bg-slate-900 flex-col justify-between shrink-0 min-h-0 shadow-lg border-t md:border-t-0 border-slate-200 dark:border-slate-800 ${
          mobileTab === 'menu' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileTab('menu')}
                className="md:hidden p-1.5 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                title="กลับไปเลือกอาหาร"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>เพิ่มอาหาร</span>
              </button>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {activeBill?.tableName
                  ? t('cart_table_label', { table: activeBill.tableName })
                  : activeBill
                  ? t('cart_bill_no', { no: activeBill.billNumber })
                  : t('bottom_bill')}
              </span>
              {unsentCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  {unsentCount} {t('cart_unconfirmed_badge')}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {activeBill?.guestCount
                ? t('cart_guests_count', { count: activeBill.guestCount })
                : activeBill?.deliveryInfo
                ? t('cart_delivery_to', {
                    name: activeBill.deliveryInfo.customerName,
                    phone: activeBill.deliveryInfo.phone,
                  })
                : t('order_type_dine_in')}
            </div>

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {activeBill?.orderType === 'delivery' ? (
                <button
                  type="button"
                  onClick={handleOpenDeliveryModal}
                  className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer hover:bg-emerald-200 transition"
                  title="คลิกเพื่อแก้ไขข้อมูลเดลิเวอรี / GP"
                >
                  <Bike className="w-3 h-3" />
                  <span>
                    {activeBill.deliveryPlatform ? activeBill.deliveryPlatform.toUpperCase() : 'DELIVERY'}
                    {activeBill.deliveryInfo?.platformOrderId ? ` #${activeBill.deliveryInfo.platformOrderId}` : ''}
                    {' '}(GP {activeBill.deliveryGpRate ?? 30}%)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenDeliveryModal}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-400 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition"
                  title="เปลี่ยนบิลนี้เป็นออเดอร์เดลิเวอรี (Grab / LINE MAN)"
                >
                  <Bike className="w-3 h-3" />
                  <span>🛵 สั่งเดลิเวอรี (Grab/LINE MAN)</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Table Switcher */}
          <select
            value={activeBill?.tableId || ''}
            onChange={(e) => {
              const tbl = tables.find((t) => t.id === e.target.value);
              if (tbl?.currentBillId) {
                setActiveBillId(tbl.currentBillId);
              }
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">{t('switch_table')}</option>
            {filteredTables.map((tItem) => (
              <option key={tItem.id} value={tItem.id}>
                {tItem.number} {tItem.currentBillId ? `(${t('table_has_order')})` : `(${t('table_empty')})`}
              </option>
            ))}
          </select>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {!activeBill || activeBill.items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <ShoppingBag className="w-12 h-12 opacity-30 stroke-[1.5]" />
              <p className="text-sm font-medium">{t('cart_empty_title')}</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                {t('cart_empty_desc')}
              </p>
            </div>
          ) : (
            activeBill.items.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition ${
                  item.status === 'voided'
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-60'
                    : item.isNewUnsent
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                        {getName(item)} <span className="text-amber-600 dark:text-amber-400 font-bold ml-1">x {item.quantity}</span>
                      </span>
                      {item.isNewUnsent && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-slate-950">
                          {t('cart_unconfirmed_badge')}
                        </span>
                      )}
                      {item.status === 'voided' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500 text-white">
                          ยกเลิก
                        </span>
                      )}
                    </div>

                    {/* Selected Options display */}
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 space-x-1">
                        {item.selectedOptions.map((opt) => (
                          <span key={opt.choiceId} className="inline-block">
                            • {getName({ name: opt.choiceName, nameEn: opt.choiceNameEn })}
                            {opt.priceDelta > 0 && ` (+${opt.priceDelta}฿)`}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.note && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                        "{item.note}"
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch gap-1">
                    <div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums">
                        {formatBaht(item.price * item.quantity)}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          @{formatBaht(item.price)}
                        </div>
                      )}
                    </div>

                    {item.status !== 'voided' && (
                      item.isNewUnsent ? (
                        <button
                          type="button"
                          onClick={() => removeUnsentItemFromBill(activeBill.id, item.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVoidingItem(item)}
                          className="text-[10px] font-semibold text-rose-500 hover:underline cursor-pointer"
                        >
                          {t('void_item_btn')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Bottom Summary & Checkout Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          {/* Financial Breakdown */}
          <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex justify-between">
              <span>{t('cart_subtotal')}</span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatBaht(activeBill?.subtotal || 0)}
              </span>
            </div>

            {Boolean(activeBill?.discountAmount) && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{t('cart_discount')}</span>
                <span className="font-mono tabular-nums">
                  -{formatBaht(activeBill?.discountAmount || 0)}
                </span>
              </div>
            )}

            {Boolean(activeBill?.serviceChargeAmount) && (
              <div className="flex justify-between">
                <span>
                  {t('cart_service_charge')} ({activeBill?.serviceChargeRate}%)
                </span>
                <span className="font-mono tabular-nums">
                  +{formatBaht(activeBill?.serviceChargeAmount || 0)}
                </span>
              </div>
            )}

            {Boolean(activeBill?.vatAmount) && (
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>
                  {t('cart_vat')} (7% {activeBill?.vatIncluded ? 'Included' : 'Added'})
                </span>
                <span className="font-mono tabular-nums">
                  {formatBaht(activeBill?.vatAmount || 0)}
                </span>
              </div>
            )}

            {Boolean(activeBill?.deliveryGpAmount) && (
              <div className="flex justify-between text-rose-500 text-[11px]">
                <span>หัก GP เดลิเวอรี ({activeBill?.deliveryGpRate}%)</span>
                <span className="font-mono tabular-nums">
                  -{formatBaht(activeBill?.deliveryGpAmount || 0)}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {t('cart_grand_total')}
              </span>
              <span className="font-mono font-black text-xl text-amber-600 dark:text-amber-400 tabular-nums">
                {formatBaht(activeBill?.grandTotal || 0)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={!activeBill || unsentCount === 0}
              onClick={() => {
                if (activeBill) {
                  if (activeBill.orderType === 'dine_in' && !activeBill.tableId) {
                    setShowTableSelectModal(true);
                    return;
                  }
                  soundService.playSuccessTap();
                  confirmOrder(activeBill.id);
                  if (activeBill.orderType === 'dine_in' && activeBill.tableId) {
                    setActiveNav('tables');
                  }
                }
              }}
              className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                unsentCount > 0
                  ? 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white cursor-pointer shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {unsentCount > 0
                  ? t('cart_confirm_order_count', { count: unsentCount })
                  : t('cart_confirm_order')}
              </span>
            </button>

            <button
              type="button"
              disabled={!activeBill || activeBill.items.length === 0}
              onClick={() => {
                if (!activeBill) return;
                const check = canPay(activeBill);
                if (!check.allowed) {
                  setPayBlockReason(check.reason || 'unsaved_items');
                  setShowBlockedDialog(true);
                  return;
                }
                setShowPaymentModal(true);
              }}
              className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition ${
                activeBill && activeBill.items.length > 0
                  ? 'bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 cursor-pointer'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{t('cart_pay_now')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Item Customizer Modal (Shows options, variants, prices, add button, kitchen note) */}
      {customizingItem && (
        <ItemCustomizerModal
          isOpen={true}
          onClose={() => setCustomizingItem(null)}
          menuItem={customizingItem}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Blocked Payment Dialog */}
      {showBlockedDialog && activeBill && (
        <UnsavedItemsPaymentDialog
          isOpen={true}
          onClose={() => setShowBlockedDialog(false)}
          reason={payBlockReason}
          isDineInWithoutTable={Boolean(activeBill.orderType === 'dine_in' && !activeBill.tableId)}
          onSelectTable={() => {
            setShowBlockedDialog(false);
            setShowTableSelectModal(true);
          }}
          onSaveAndGoToFloorPlan={() => {
            if (activeBill.orderType === 'dine_in' && !activeBill.tableId) {
              setShowBlockedDialog(false);
              setShowTableSelectModal(true);
              return;
            }
            confirmOrder(activeBill.id);
            setShowBlockedDialog(false);
            if (activeBill.orderType === 'dine_in') {
              setActiveNav('tables');
            }
          }}
        />
      )}

      {/* Dine-in Table Selection Modal when no table is assigned */}
      {showTableSelectModal && activeBill && (
        <Modal
          isOpen={true}
          onClose={() => setShowTableSelectModal(false)}
          title={t('select_table')}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('pay_blocked_no_table_msg')}
            </p>
            <div className="grid grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
              {tables.map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => {
                    assignTableToBill(activeBill.id, tItem.id);
                    confirmOrder(activeBill.id);
                    setShowTableSelectModal(false);
                    setActiveNav('tables');
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-600 transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="font-bold text-sm">{tItem.number}</span>
                  <span className="text-[10px] opacity-75">{tItem.capacity} ที่นั่ง</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTableSelectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {showPaymentModal && activeBill && (
        <PaymentModal
          isOpen={true}
          onClose={() => setShowPaymentModal(false)}
          bill={activeBill}
        />
      )}

      {/* Void Item Modal */}
      {voidingItem && activeBill && (
        <VoidItemModal
          isOpen={true}
          onClose={() => setVoidingItem(null)}
          item={voidingItem}
          onConfirmVoid={(reason: string) => {
            voidOrderItem(activeBill.id, voidingItem.id, reason);
            setVoidingItem(null);
          }}
        />
      )}

      {/* Delivery Platform & Order Info Modal */}
      {showDeliveryForm && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeliveryForm(false)}
          title="🛵 บันทึกข้อมูลออเดอร์เดลิเวอรี & GP (Delivery Order)"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmDelivery} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                เลือกแพลตฟอร์มเดลิเวอรี *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'grab', label: 'GrabFood', icon: '🟢', defaultGp: 30 },
                  { id: 'lineman', label: 'LINE MAN', icon: '🟢', defaultGp: 30 },
                  { id: 'shopeefood', label: 'ShopeeFood', icon: '🟠', defaultGp: 30 },
                  { id: 'robinhood', label: 'Robinhood', icon: '🟣', defaultGp: 0 },
                  { id: 'direct', label: 'ร้านส่งเอง', icon: '🛵', defaultGp: 0 },
                  { id: 'other', label: 'อื่นๆ', icon: '📦', defaultGp: 30 },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setDeliveryPlatform(p.id as DeliveryPlatform);
                      setDeliveryGpRate(p.defaultGp);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer font-bold ${
                      deliveryPlatform === p.id
                        ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-xs">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสออเดอร์บนแอป (Order ID)
                </label>
                <input
                  type="text"
                  placeholder="เช่น GF-9821, LM-402"
                  value={deliveryPlatformOrderId}
                  onChange={(e) => setDeliveryPlatformOrderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  อัตราหัก GP แพลตฟอร์ม (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={deliveryGpRate}
                  onChange={(e) => setDeliveryGpRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ต้นทุนกล่องและบรรจุภัณฑ์ (บาท)
              </label>
              <input
                type="number"
                min={0}
                value={deliveryPackagingCost}
                onChange={(e) => setDeliveryPackagingCost(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                placeholder="15"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 text-[11px] block">
                ข้อมูลลูกค้าหรือไรเดอร์ (ไม่บังคับ):
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="ชื่อลูกค้า / ไรเดอร์"
                  value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <input
                  type="tel"
                  placeholder="เบอร์โทรติดต่อ"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <input
                type="text"
                placeholder="ที่อยู่จัดส่ง / อาคาร / ซอย"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeliveryForm(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs cursor-pointer"
              >
                บันทึกออเดอร์เดลิเวอรี
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Edit Menu Item Modal (Opened via 2-Second Hold-to-Edit) */}
      <EditMenuItemModal
        isOpen={!!quickEditItem}
        onClose={() => setQuickEditItem(null)}
        item={quickEditItem}
      />
    </div>
  );
};
