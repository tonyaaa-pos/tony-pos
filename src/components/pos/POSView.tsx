import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { MenuItem, OrderItem, OrderType, DeliveryInfo } from '../../types';
import {
  Plus,
  Minus,
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
  Search,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { ItemCustomizerModal } from './ItemCustomizerModal';
import { PaymentModal } from './PaymentModal';
import { VoidItemModal } from './VoidItemModal';
import { soundService } from '../../utils/audio';
import { ZoneBar } from '../common/ZoneBar';
import { canPay, PayBlockReason } from '../../utils/orderRules';
import { UnsavedItemsPaymentDialog } from './UnsavedItemsPaymentDialog';
import { Modal } from '../common/Modal';

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
  } = usePOS();

  const { t, getName } = useLanguage();

  // Modals
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [voidingItem, setVoidingItem] = useState<OrderItem | null>(null);

  // Blocked payment and table selection modals
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [payBlockReason, setPayBlockReason] = useState<PayBlockReason>('unsaved_items');
  const [showTableSelectModal, setShowTableSelectModal] = useState(false);

  // Delivery info edit mode
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [searchDishQuery, setSearchDishQuery] = useState('');

  // Filtered menu items based on active food category and optional search query
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      let matchCat = !activeCategory || activeCategory === 'all';
      if (!matchCat && activeCategory) {
        if (item.categoryId === activeCategory) {
          matchCat = true;
        } else {
          const targetCategory = categories.find((c) => c.id === activeCategory);
          const itemCategory = categories.find((c) => c.id === item.categoryId);
          if (targetCategory && itemCategory && targetCategory.name === itemCategory.name) {
            matchCat = true;
          }
        }
      }

      const matchSearch =
        !searchDishQuery.trim() ||
        item.name.toLowerCase().includes(searchDishQuery.toLowerCase()) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(searchDishQuery.toLowerCase()));

      return matchCat && matchSearch && item.isAvailable !== false;
    });
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

  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const info: DeliveryInfo = {
      customerName: deliveryName.trim(),
      phone: deliveryPhone.trim(),
      address: deliveryAddress.trim(),
    };
    const newBill = createBillForOrder('delivery', undefined, 1, info);
    setActiveBillId(newBill.id);
    setShowDeliveryForm(false);
  };

  // Card click: opens food-type detail modal directly
  const handleItemCardClick = (menuItem: MenuItem) => {
    if (menuItem.isSoldOut) return;

    // Ensure we have an active bill. If not, auto-create one
    if (!activeBill) {
      createBillForOrder('dine_in');
    }

    soundService.playTap();
    setCustomizingItem(menuItem);
  };

  const handleAddToCart = (item: OrderItem) => {
    let targetBill = activeBill;
    if (!targetBill) {
      targetBill = createBillForOrder('dine_in');
    }
    addItemsToBill(targetBill.id, [item]);
  };

  // Unsent items in cart
  const unsentCount = activeBill?.items.filter((i) => i.isNewUnsent).length || 0;

  // Active category item count helper
  const totalAvailableDishes = menuItems.filter((m) => m.isAvailable !== false).length;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT: Menu Browse (Food categories + items grid) */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden border-r border-slate-200 dark:border-slate-800">
        {/* Dedicated Food Category Bar & Search */}
        <div className="shrink-0 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-2xs">
          {/* Scrollable Categories Chips */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            {/* 'All' Category Button */}
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer select-none ${
                !activeCategory || activeCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/50'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>✨</span>
              <span>{t('bottom_all_categories')}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  !activeCategory || activeCategory === 'all'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {totalAvailableDishes}
              </span>
            </button>

            {/* Individual Category Buttons */}
            {categories.map((cat) => {
              const isSelected = activeCategory === cat.id;
              const catCount = menuItems.filter((m) => {
                if (m.isAvailable === false) return false;
                if (m.categoryId === cat.id) return true;
                const itemCat = categories.find((c) => c.id === m.categoryId);
                return itemCat && itemCat.name === cat.name;
              }).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-base leading-none">{cat.icon || '🍽️'}</span>
                  <span>{getName(cat)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isSelected
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {catCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchDishQuery}
              onChange={(e) => setSearchDishQuery(e.target.value)}
              placeholder="ค้นหาชื่ออาหาร..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredMenuItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
              <UtensilsCrossed className="w-12 h-12 opacity-35" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  ไม่มีรายการอาหารในหมวดหมู่นี้
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  กดปุ่มด้านล่างเพื่อดูเมนูทั้งหมด
                </p>
              </div>
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
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemCardClick(item)}
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
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" fill="%23cbd5e1"><rect width="200" height="150"/><text x="100" y="80" font-family="sans-serif" font-size="16" fill="%23475569" text-anchor="middle">Food</text></svg>';
                      }}
                    />

                    {/* Sold out overlay */}
                    {item.isSoldOut && (
                      <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center p-2 text-center">
                        <span className="px-3 py-1 bg-rose-600 text-white font-extrabold text-xs rounded-lg uppercase tracking-wider shadow-md">
                          {t('sold_out_overlay')}
                        </span>
                      </div>
                    )}

                    {/* Small unobtrusive recommended badge on photo corner */}
                    {item.isRecommended && !item.isSoldOut && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{t('recommended_badge')}</span>
                      </div>
                    )}
                  </div>

                  {/* Card ONLY shows food-type name below photo */}
                  <div className="p-3 sm:p-3.5 flex items-center justify-center min-h-[48px] sm:min-h-[54px] text-center">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {getName(item)}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Order Cart & Bill Panel */}
      <div className="w-full lg:w-[400px] xl:w-[440px] bg-white dark:bg-slate-900 flex flex-col justify-between shrink-0 shadow-lg border-t lg:border-t-0 border-slate-200 dark:border-slate-800">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
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
            <div className="text-xs text-slate-400">
              {activeBill?.guestCount
                ? t('cart_guests_count', { count: activeBill.guestCount })
                : activeBill?.deliveryInfo
                ? t('cart_delivery_to', {
                    name: activeBill.deliveryInfo.customerName,
                    phone: activeBill.deliveryInfo.phone,
                  })
                : t('order_type_dine_in')}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                        {item.name}
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
                            • {opt.choiceName}
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

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white tabular-nums">
                      {formatBaht(item.price * item.quantity)}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        @{formatBaht(item.price)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions & Quantity row */}
                {item.status !== 'voided' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          item.isNewUnsent
                            ? item.quantity > 1
                              ? updateBillItemQuantity(activeBill.id, item.id, item.quantity - 1)
                              : removeUnsentItemFromBill(activeBill.id, item.id)
                            : updateBillItemQuantity(activeBill.id, item.id, item.quantity - 1)
                        }
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateBillItemQuantity(activeBill.id, item.id, item.quantity + 1)
                        }
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {item.isNewUnsent ? (
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
                        className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                      >
                        {t('void_item_btn')}
                      </button>
                    )}
                  </div>
                )}
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
    </div>
  );
};
