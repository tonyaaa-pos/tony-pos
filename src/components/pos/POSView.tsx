import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
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

  // Item Click
  const handleItemClick = (menuItem: MenuItem) => {
    if (menuItem.isSoldOut) return;

    // Ensure we have an active bill. If not, auto-create one
    let targetBill = activeBill;
    if (!targetBill) {
      targetBill = createBillForOrder('dine_in');
    }

    // If item has option groups, open customizer modal
    if (menuItem.optionGroups && menuItem.optionGroups.length > 0) {
      setCustomizingItem(menuItem);
    } else {
      // Direct quick add
      soundService.playTap();
      const orderItem: OrderItem = {
        id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.promoActive && menuItem.promoPrice ? menuItem.promoPrice : menuItem.price,
        cost: menuItem.cost,
        quantity: 1,
        selectedOptions: [],
        note: '',
        status: 'confirmed',
        isNewUnsent: true,
      };
      addItemsToBill(targetBill.id, [orderItem]);
    }
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
      {/* LEFT: Menu Browse (Flexible width, expands full screen when zone bar is hidden) */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden border-r border-slate-200 dark:border-slate-800">
        {/* Table Zone Bar with smooth slide/fade transition (150-200ms) */}
        <div
          className={`transition-all duration-200 ease-in-out shrink-0 overflow-hidden ${
            isZoneBarVisible
              ? 'max-h-16 opacity-100 p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800'
              : 'max-h-0 opacity-0 p-0 border-b-0 m-0 pointer-events-none'
          }`}
        >
          <ZoneBar />
        </div>

        {/* Menu Items Grid - Fills entire available space up to the top when zone bar is hidden */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredMenuItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <UtensilsCrossed className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">ไม่พบรายการอาหารในหมวดนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden flex flex-col justify-between transition group ${
                    item.isSoldOut
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-md hover:border-amber-400 active:scale-98'
                  }`}
                >
                  {/* Image Container */}
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />

                    {/* Sold out overlay */}
                    {item.isSoldOut && (
                      <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center">
                        <span className="px-3 py-1 bg-rose-600 text-white font-extrabold text-xs rounded-lg uppercase tracking-wider shadow-md">
                          สินค้าหมด
                        </span>
                      </div>
                    )}

                    {/* Promo badge */}
                    {item.promoActive && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs">
                        <Sparkles className="w-3 h-3" />
                        <span>โปรโมชั่น</span>
                      </div>
                    )}

                    {/* Recommended badge */}
                    {item.isRecommended && !item.promoActive && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs">
                        แนะนำ
                      </div>
                    )}
                  </div>

                  {/* Item Details */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight line-clamp-2">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="font-mono tabular-nums font-bold text-sm text-amber-600 dark:text-amber-400">
                        {item.promoActive && item.promoPrice ? (
                          <div className="flex items-baseline gap-1.5">
                            <span>{formatBaht(item.promoPrice)}</span>
                            <span className="text-xs text-slate-400 line-through font-normal">
                              {formatBaht(item.price)}
                            </span>
                          </div>
                        ) : (
                          <span>{formatBaht(item.price)}</span>
                        )}
                      </div>

                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center transition">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Order Cart & Bill Panel (Fixed ~380-440px width) */}
      <div className="w-full lg:w-[400px] xl:w-[440px] bg-white dark:bg-slate-900 flex flex-col justify-between shrink-0 shadow-lg border-t lg:border-t-0 border-slate-200 dark:border-slate-800">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-slate-900 dark:text-white">
                {activeBill?.tableName ? `โต๊ะ ${activeBill.tableName}` : activeBill?.orderType === 'takeaway' ? 'สั่งกลับบ้าน' : activeBill?.orderType === 'delivery' ? 'เดลิเวอรี' : 'ออเดอร์ใหม่'}
              </span>
              {activeBill && (
                <span className="text-xs font-mono text-slate-400">
                  {activeBill.billNumber}
                </span>
              )}
            </div>
            {activeBill?.guestCount && (
              <span className="text-xs text-slate-500">
                จำนวนลูกค้า: {activeBill.guestCount} ท่าน
              </span>
            )}
            {activeBill?.deliveryInfo && (
              <div className="text-[11px] text-blue-600 dark:text-blue-400 truncate">
                ส่งถึง: {activeBill.deliveryInfo.customerName} ({activeBill.deliveryInfo.phone})
              </div>
            )}
          </div>

          {/* Table Switcher Dropdown (Filtered by selected zone) */}
          <div className="flex items-center gap-1.5">
            <select
              value={activeBill?.tableId || ''}
              onChange={(e) => {
                const tbl = tables.find((t) => t.id === e.target.value);
                if (tbl?.currentBillId) {
                  setActiveBillId(tbl.currentBillId);
                } else if (tbl) {
                  const b = createBillForOrder('dine_in', tbl.id, 2);
                  setActiveBillId(b.id);
                }
              }}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 max-w-[170px]"
            >
              <option value="">สลับโต๊ะ...</option>
              {filteredTables.map((t) => (
                <option key={t.id} value={t.id}>
                  โต๊ะ {t.number} {t.status === 'occupied' ? '(มีออเดอร์)' : '(ว่าง)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800">
          {!activeBill || activeBill.items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 p-6">
              <UtensilsCrossed className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">ยังไม่มีรายการอาหารในออเดอร์นี้</p>
              <p className="text-xs mt-1">แตะเมนูอาหารทางด้านซ้ายเพื่อเลือกรายการ</p>
            </div>
          ) : (
            activeBill.items.map((item) => {
              const isVoided = item.status === 'voided';
              return (
                <div
                  key={item.id}
                  className={`py-3 transition ${isVoided ? 'opacity-40 line-through' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.name}
                        </span>
                        {item.isNewUnsent ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                            ยังไม่ยืนยัน
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                            ยืนยันแล้ว
                          </span>
                        )}
                      </div>

                      {/* Selected Options / Note */}
                      {item.selectedOptions.length > 0 && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {item.selectedOptions.map((o) => o.choiceName).join(', ')}
                        </div>
                      )}
                      {item.note && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 italic">
                          *{item.note}
                        </div>
                      )}

                      {/* Void reason info */}
                      {isVoided && item.voidReason && (
                        <div className="text-[11px] text-rose-500 mt-0.5">
                          ยกเลิก: {item.voidReason} ({item.voidedBy})
                        </div>
                      )}
                    </div>

                    {/* Unit Total Price */}
                    <div className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white shrink-0">
                      {formatBaht(item.price * item.quantity)}
                    </div>
                  </div>

                  {/* Quantity controls & Void / Delete buttons */}
                  {!isVoided && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                      <div className="text-xs text-slate-400 font-mono">
                        @{formatBaht(item.price)}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.isNewUnsent ? (
                          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                            <button
                              type="button"
                              onClick={() => {
                                soundService.playTap();
                                if (item.quantity > 1) {
                                  updateBillItemQuantity(activeBill.id, item.id, item.quantity - 1);
                                } else {
                                  removeUnsentItemFromBill(activeBill.id, item.id);
                                }
                              }}
                              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 shadow-2xs cursor-pointer"
                            >
                              {item.quantity === 1 ? (
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              ) : (
                                <Minus className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <span className="w-6 text-center font-bold text-xs font-mono">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                soundService.playTap();
                                updateBillItemQuantity(activeBill.id, item.id, item.quantity + 1);
                              }}
                              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 shadow-2xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                              จำนวน: x{item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setVoidingItem(item)}
                              className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              <span>ยกเลิกรายการ</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer / Totals & Action Buttons */}
        {activeBill && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-3">
            {/* Calculation summary */}
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>ยอดรวมรายการ (Subtotal)</span>
                <span className="font-mono font-semibold">{formatBaht(activeBill.subtotal)}</span>
              </div>

              {activeBill.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>ส่วนลด ({activeBill.discountType === 'percentage' ? `${activeBill.discountValue}%` : 'ยอดคงที่'})</span>
                  <span className="font-mono font-semibold">-{formatBaht(activeBill.discountAmount)}</span>
                </div>
              )}

              {activeBill.serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>ค่าบริการ ({activeBill.serviceChargeRate}%)</span>
                  <span className="font-mono font-semibold">+{formatBaht(activeBill.serviceChargeAmount)}</span>
                </div>
              )}

              {activeBill.vatAmount > 0 && (
                <div className="flex justify-between">
                  <span>ภาษีมูลค่าเพิ่ม ({activeBill.vatRate}%)</span>
                  <span className="font-mono font-semibold">+{formatBaht(activeBill.vatAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>ยอดสุทธิ (Grand Total)</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {formatBaht(activeBill.grandTotal)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Confirm / Send Order Button */}
              <button
                type="button"
                disabled={unsentCount === 0}
                onClick={() => {
                  soundService.playSuccessTap();
                  confirmOrder(activeBill.id);
                }}
                className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                  unsentCount > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>ยืนยันออเดอร์ ({unsentCount})</span>
              </button>

              {/* Checkout / Pay Button */}
              <button
                type="button"
                disabled={activeBill.items.length === 0 || unsentCount > 0}
                onClick={() => {
                  soundService.playTap();
                  setShowPaymentModal(true);
                }}
                className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                  activeBill.items.length > 0 && unsentCount === 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>เช็คบิล / ชำระเงิน</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Item Options Customizer */}
      {customizingItem && (
        <ItemCustomizerModal
          isOpen={true}
          menuItem={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Modal: Payment Modal */}
      {showPaymentModal && activeBill && (
        <PaymentModal
          isOpen={true}
          onClose={() => setShowPaymentModal(false)}
          bill={activeBill}
        />
      )}

      {/* Modal: Void Item */}
      {voidingItem && activeBill && (
        <VoidItemModal
          isOpen={true}
          item={voidingItem}
          onClose={() => setVoidingItem(null)}
          onConfirmVoid={(reason) => {
            voidOrderItem(activeBill.id, voidingItem.id, reason);
            setVoidingItem(null);
          }}
        />
      )}

      {/* Delivery Form Modal */}
      {showDeliveryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
          <form
            onSubmit={handleConfirmDelivery}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ข้อมูลลูกค้าสำหรับส่งเดลิเวอรี
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ชื่อลูกค้า <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={deliveryName}
                onChange={(e) => setDeliveryName(e.target.value)}
                placeholder="ชื่อลูกค้า"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                เบอร์โทรศัพท์ <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                placeholder="เบอร์โทรติดต่อ"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ที่อยู่จัดส่ง <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="บ้านเลขที่, ซอย, ถนน หรือจุดสังเกต..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeliveryForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950"
              >
                เริ่มรับออเดอร์เดลิเวอรี
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
