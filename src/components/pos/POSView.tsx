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
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { ItemCustomizerModal } from './ItemCustomizerModal';
import { PaymentModal } from './PaymentModal';
import { VoidItemModal } from './VoidItemModal';
import { soundService } from '../../utils/audio';
import { ZoneBar } from '../common/ZoneBar';

export const POSView: React.FC = () => {
  const {
    categories,
    menuItems,
    tables,
    bills,
    activeBill,
    setActiveBillId,
    createBillForOrder,
    addItemsToBill,
    updateBillItemQuantity,
    removeUnsentItemFromBill,
    confirmOrder,
    voidOrderItem,
    settings,
    activeCategory,
    selectedZone,
  } = usePOS();

  const { t, getName } = useLanguage();

  // Modals
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [voidingItem, setVoidingItem] = useState<OrderItem | null>(null);

  // Delivery info edit mode
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Zone bar visibility: hidden when a food category is selected from bottom bar
  const isZoneBarVisible = activeCategory === null;

  // Filtered menu items based on active food category selected in bottom bar
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = !activeCategory || activeCategory === 'all' || item.categoryId === activeCategory;
      return matchCat && item.isAvailable;
    });
  }, [menuItems, activeCategory]);

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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT: Menu Browse (Food type cards showing ONLY photo and name) */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden border-r border-slate-200 dark:border-slate-800">
        {/* Table Zone Bar with smooth slide/fade transition */}
        <div
          className={`transition-all duration-200 ease-in-out shrink-0 overflow-hidden ${
            isZoneBarVisible
              ? 'max-h-16 opacity-100 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800'
              : 'max-h-0 opacity-0 p-0 border-b-0 m-0 pointer-events-none'
          }`}
        >
          <ZoneBar />
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredMenuItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <UtensilsCrossed className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">{t('no')}</p>
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
                  soundService.playSuccessTap();
                  confirmOrder(activeBill.id);
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
              onClick={() => setShowPaymentModal(true)}
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
