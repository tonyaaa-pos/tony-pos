import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  SaleOrder,
  SaleOrderItem,
  SalesChannel,
  MenuItem,
  MenuVariant,
  Ingredient,
  Sauce,
  RestaurantSettings,
} from '../types';
import { calculateVariantCostBreakdown, calculateOrderFinancials, getDeliveryCommissionPercent } from '../services/calculationEngine';

interface SalesViewProps {
  salesOrders: SaleOrder[];
  menus: MenuItem[];
  ingredients: Ingredient[];
  sauces: Sauce[];
  settings: RestaurantSettings;
  onSaveSaleOrder: (order: SaleOrder) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  salesOrders,
  menus,
  ingredients,
  sauces,
  settings,
  onSaveSaleOrder,
}) => {
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('ALL');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // New order form state
  const [orderChannel, setOrderChannel] = useState<SalesChannel>('DINE_IN');
  const [orderItems, setOrderItems] = useState<
    Array<{
      menuId: string;
      variantId: string;
      quantity: number;
    }>
  >([]);
  const [orderNotes, setOrderNotes] = useState('');

  const ingredientsMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const saucesMap = new Map<string, Sauce>(sauces.map((s) => [s.id, s]));

  // Flatten all menu variants for easy selection
  const flatVariants: Array<{
    menu: MenuItem;
    variant: MenuVariant;
    label: string;
  }> = [];
  menus.forEach((m) => {
    m.variants.forEach((v) => {
      flatVariants.push({
        menu: m,
        variant: v,
        label: `${m.name} - ${v.name} (${v.proteinType})`,
      });
    });
  });

  const handleOpenNewOrder = () => {
    if (flatVariants[0]) {
      setOrderItems([
        {
          menuId: flatVariants[0].menu.id,
          variantId: flatVariants[0].variant.id,
          quantity: 1,
        },
      ]);
    }
    setOrderChannel('DINE_IN');
    setOrderNotes('');
    setIsOrderModalOpen(true);
  };

  const handleAddItemToOrder = () => {
    if (flatVariants[0]) {
      setOrderItems([
        ...orderItems,
        {
          menuId: flatVariants[0].menu.id,
          variantId: flatVariants[0].variant.id,
          quantity: 1,
        },
      ]);
    }
  };

  const handleRemoveItemFromOrder = (index: number) => {
    const updated = [...orderItems];
    updated.splice(index, 1);
    setOrderItems(updated);
  };

  const handleUpdateItemVariant = (index: number, variantId: string) => {
    const found = flatVariants.find((fv) => fv.variant.id === variantId);
    if (!found) return;
    const updated = [...orderItems];
    updated[index].menuId = found.menu.id;
    updated[index].variantId = found.variant.id;
    setOrderItems(updated);
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    const updated = [...orderItems];
    updated[index].quantity = qty;
    setOrderItems(updated);
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    let grossSales = 0;
    let totalFoodCost = 0;
    const finalItems: SaleOrderItem[] = [];

    orderItems.forEach((oi) => {
      const match = flatVariants.find((fv) => fv.variant.id === oi.variantId);
      if (!match) return;

      const bd = calculateVariantCostBreakdown(
        match.variant,
        match.menu.name,
        ingredientsMap,
        saucesMap,
        settings
      );

      let price = match.variant.sellingPrice;
      if (orderChannel === 'TAKEAWAY') price = match.variant.takeawayPrice;
      if (orderChannel === 'GRABFOOD' || orderChannel === 'LINE MAN' || orderChannel === 'DELIVERY') price = match.variant.deliveryPrice;

      const itemTotal = price * oi.quantity;
      const itemFoodCost = bd.totalFoodCost * oi.quantity;

      grossSales += itemTotal;
      totalFoodCost += itemFoodCost;

      finalItems.push({
        menuId: match.menu.id,
        menuName: match.menu.name,
        variantId: match.variant.id,
        variantName: `${match.variant.name} (${match.variant.proteinType})`,
        quantity: oi.quantity,
        unitPrice: price,
        totalPrice: itemTotal,
        foodCostPerUnit: bd.totalFoodCost,
        totalFoodCost: itemFoodCost,
      });
    });

    const packagingUnits = finalItems.reduce((sum, item) => sum + item.quantity, 0);
    const orderFinancials = calculateOrderFinancials(
      grossSales,
      totalFoodCost,
      orderChannel as 'DINE_IN' | 'TAKEAWAY' | 'GRABFOOD' | 'LINE MAN' | 'DELIVERY',
      packagingUnits,
      settings
    );
    const { commissionPercent, commissionFee, packagingCost, grossProfit } = orderFinancials;

    const newOrder: SaleOrder = {
      id: `ord_${Date.now()}`,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      channel: orderChannel,
      items: finalItems,
      grossSales,
      commissionFee,
      commissionPercent,
      packagingCost,
      totalFoodCost,
      grossProfit,
      notes: orderNotes,
      createdAt: new Date().toISOString(),
    };

    onSaveSaleOrder(newOrder);
    setIsOrderModalOpen(false);
  };

  const filteredOrders = salesOrders.filter(
    (o) => selectedChannelFilter === 'ALL' || o.channel === selectedChannelFilter
  );

  const totalGross = filteredOrders.reduce((sum, o) => sum + o.grossSales, 0);
  const totalFoodCostAll = filteredOrders.reduce((sum, o) => sum + o.totalFoodCost, 0);
  const totalProfitAll = filteredOrders.reduce((sum, o) => sum + o.grossProfit, 0);
  const totalCommissions = filteredOrders.reduce((sum, o) => sum + o.commissionFee, 0);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            บันทึกและจัดการยอดขาย (Daily Sales & Orders)
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            บันทึกรายการขายหน้าร้าน, กลับบ้าน, และเดลิเวอรี คำนวณ GP และกำไรขั้นต้นทันที
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewOrder}
          className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#d96817] text-black font-bold rounded-xl text-xs shadow-lg shadow-[#F27D26]/20 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ เปิดบิลขายใหม่</span>
        </button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
          <span className="text-xs font-bold text-white/50 uppercase">ยอดขายรวม</span>
          <div className="text-xl font-bold text-white font-mono mt-1">
            ฿{totalGross.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
          <span className="text-xs font-bold text-white/50 uppercase">ต้นทุนอาหาร (COGS)</span>
          <div className="text-xl font-bold text-[#FFC107] font-mono mt-1">
            ฿{totalFoodCostAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
          <span className="text-xs font-bold text-white/50 uppercase">หัก GP เดลิเวอรี</span>
          <div className="text-xl font-bold text-red-400 font-mono mt-1">
            ฿{totalCommissions.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
          <span className="text-xs font-bold text-white/50 uppercase">กำไรขั้นต้นสุทธิ</span>
          <div className="text-xl font-bold text-green-400 font-mono mt-1">
            ฿{totalProfitAll.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filter by channel */}
      <div className="flex items-center gap-2">
        {['ALL', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'].map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setSelectedChannelFilter(ch)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedChannelFilter === ch
                ? 'bg-[#F27D26] text-black'
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {ch === 'ALL'
              ? 'ทุกช่องทาง'
              : ch === 'DINE_IN'
              ? 'หน้าร้าน (Dine-in)'
              : ch === 'TAKEAWAY'
              ? 'กลับบ้าน (Takeaway)'
              : 'เดลิเวอรี (Delivery)'}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/50 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">เลขที่บิล / เวลา</th>
                <th className="py-3 px-3">ช่องทางขาย</th>
                <th className="py-3 px-3">รายการอาหารที่สั่ง</th>
                <th className="py-3 px-3 text-right">ยอดขาย (บาท)</th>
                <th className="py-3 px-3 text-right">ต้นทุนอาหาร</th>
                <th className="py-3 px-3 text-right">GP + กล่อง</th>
                <th className="py-3 px-4 text-right">กำไรขั้นต้น</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-white/5">
                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-bold text-white">{ord.orderNumber}</div>
                    <div className="text-[11px] text-white/40 font-mono">
                      {ord.date} {ord.time}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ord.channel === 'DELIVERY'
                          ? 'bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30'
                          : ord.channel === 'TAKEAWAY'
                          ? 'bg-[#FFC107]/20 text-[#FFC107]'
                          : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {ord.channel}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-sans text-white/80">
                    {ord.items.map((it, idx) => (
                      <div key={idx} className="text-xs">
                        {it.variantName} <span className="font-bold text-white">× {it.quantity}</span>
                      </div>
                    ))}
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-white">
                    ฿{ord.grossSales.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-[#FFC107] font-bold">
                    ฿{ord.totalFoodCost.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-white/40">
                    ฿{(ord.commissionFee + ord.packagingCost).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-green-400 text-sm">
                    ฿{ord.grossProfit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW ORDER MODAL */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-white/20 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">เปิดบิลขายใหม่</h3>
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1 text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-white/80 mb-1">ช่องทางการขาย</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'DINE_IN', name: 'หน้าร้าน' },
                    { id: 'TAKEAWAY', name: 'กลับบ้าน' },
                    { id: 'GRABFOOD', name: `GrabFood (GP ${getDeliveryCommissionPercent(settings, 'grab')}%)` },
                    { id: 'LINE MAN', name: `LINE MAN (GP ${getDeliveryCommissionPercent(settings, 'lineman')}%)` },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setOrderChannel(ch.id as SalesChannel)}
                      className={`p-2 rounded-xl font-bold border text-center transition-all cursor-pointer ${
                        orderChannel === ch.id
                          ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items in order */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white/80">รายการเมนูที่สั่ง</span>
                  <button
                    type="button"
                    onClick={handleAddItemToOrder}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold border border-white/10 cursor-pointer"
                  >
                    + เพิ่มเมนู
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-black/40 p-2.5 rounded-xl border border-white/15"
                    >
                      <select
                        value={item.variantId}
                        onChange={(e) => handleUpdateItemVariant(idx, e.target.value)}
                        className="flex-1 p-1.5 bg-[#1a1a1a] border border-white/15 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-[#F27D26]"
                      >
                        {flatVariants.map((fv) => (
                          <option key={fv.variant.id} value={fv.variant.id} className="bg-[#1a1a1a] text-white">
                            {fv.label} (฿
                            {(orderChannel === 'GRABFOOD' || orderChannel === 'LINE MAN' || orderChannel === 'DELIVERY')
                              ? fv.variant.deliveryPrice
                              : fv.variant.sellingPrice}
                            )
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 w-24">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItemQty(idx, parseInt(e.target.value) || 1)
                          }
                          className="w-14 p-1.5 bg-[#1a1a1a] border border-white/15 rounded-lg text-xs font-mono font-bold text-center text-white"
                        />
                        <span className="text-white/40 text-[11px]">จาน</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemFromOrder(idx)}
                        className="p-1 text-white/40 hover:text-red-400 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-white/80 mb-1">หมายเหตุบิล</label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full p-2 bg-black/40 border border-white/15 rounded-xl text-white placeholder-white/40"
                  placeholder="เช่น โต๊ะ 4, ไม่เผ็ด..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-[#d96817] text-black rounded-xl font-bold shadow-md shadow-[#F27D26]/20 cursor-pointer"
                >
                  บันทึกบิลขาย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
