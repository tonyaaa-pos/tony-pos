import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Calendar, Plus } from 'lucide-react';
import { Ingredient } from '../../types/domain';
import { NumericInput } from '../common/NumericInput';

interface PriceHistoryViewProps {
  ingredients: Ingredient[];
  onAddPriceRecord: (ingredientId: string, price: number, quantity: number, date: string, notes?: string) => void;
  activeLanguage: 'th' | 'en';
}

export const PriceHistoryView: React.FC<PriceHistoryViewProps> = ({
  ingredients,
  onAddPriceRecord,
  activeLanguage,
}) => {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(
    ingredients[0]?.id || ''
  );
  const [newPrice, setNewPrice] = useState<number>(100);
  const [newQty, setNewQty] = useState<number>(1);
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newNotes, setNewNotes] = useState<string>('');

  const selectedIng = ingredients.find((i) => i.id === selectedIngredientId) || ingredients[0];

  const history = selectedIng?.priceHistory || [];
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const prices = sortedHistory.map((h) => h.price);
  const lastPrice = sortedHistory[0]?.price || selectedIng?.purchasePrice || 0;
  const oldestPrice = sortedHistory[sortedHistory.length - 1]?.price || lastPrice;
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : lastPrice;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : lastPrice;
  const minPrice = prices.length > 0 ? Math.min(...prices) : lastPrice;
  const priceChangePercent = oldestPrice > 0 ? ((lastPrice - oldestPrice) / oldestPrice) * 100 : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIng || newPrice <= 0) return;
    onAddPriceRecord(selectedIng.id, newPrice, newQty, newDate, newNotes);
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00B1FF] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00B1FF]">
              Price Trend & Inflation Auditor
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#00B1FF]" />
            <span>{activeLanguage === 'th' ? 'ประวัติราคาซื้อ & การติดตามเงินเฟ้อวัตถุดิบ' : 'Purchase Price History & Trend Tracker'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'บันทึกราคาซื้อย้อนหลังทุกรอบ วิเคราะห์แนวโน้มราคา และแจ้งเตือนเมื่อต้นทุนวัตถุดิบปรับตัวสูงขึ้น'
              : 'Track historical purchases, calculate average vs last price, and trigger inflation warnings.'}
          </p>
        </div>
      </div>

      {/* Select Ingredient Dropdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#151518] p-4 rounded-xl border border-white/5 text-white">
        <label className="text-xs font-semibold text-white/60 whitespace-nowrap">
          {activeLanguage === 'th' ? 'เลือกวัตถุดิบเพื่อดูประวัติ:' : 'Select Ingredient:'}
        </label>
        <select
          value={selectedIngredientId}
          onChange={(e) => setSelectedIngredientId(e.target.value)}
          className="w-full sm:w-80 rounded-lg border border-white/10 py-1.5 px-3 text-xs bg-[#0F0F11] font-medium text-white focus:border-[#FF6321] focus:outline-none"
        >
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.code} - {ing.thaiName} ({ing.purchasePrice} ฿/{ing.purchaseUnit})
            </option>
          ))}
        </select>
      </div>

      {/* Summary KPI Cards for Selected Ingredient */}
      {selectedIng && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-white/5 bg-[#151518] p-4 text-white">
            <div className="text-white/40 text-xs font-medium">ราคาซื้อล่าสุด</div>
            <div className="mt-1 text-xl font-light text-white font-mono">
              ฿{lastPrice.toFixed(2)}
            </div>
            <div className="text-[11px] text-white/30">ต่อ {selectedIng.purchaseUnit}</div>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#151518] p-4 text-white">
            <div className="text-white/40 text-xs font-medium">ราคาเฉลี่ยทุกรอบ (Avg)</div>
            <div className="mt-1 text-xl font-light text-white/80 font-mono">
              ฿{avgPrice.toFixed(2)}
            </div>
            <div className="text-[11px] text-white/30">บันทึก {history.length} ครั้ง</div>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#151518] p-4 text-white">
            <div className="text-white/40 text-xs font-medium">ราคาสูงสุด / ต่ำสุด</div>
            <div className="mt-1 text-base font-light text-white font-mono">
              ฿{maxPrice.toFixed(0)} <span className="text-white/30 font-normal">/</span> ฿{minPrice.toFixed(0)}
            </div>
            <div className="text-[11px] text-white/30">Max / Min Price</div>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#151518] p-4 text-white">
            <div className="text-white/40 text-xs font-medium">การเปลี่ยนแปลงสะสม</div>
            <div className={`mt-1 text-xl font-light font-mono flex items-center gap-1 ${
              priceChangePercent > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
            }`}>
              {priceChangePercent > 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              <span>{priceChangePercent > 0 ? `+${priceChangePercent.toFixed(1)}%` : `${priceChangePercent.toFixed(1)}%`}</span>
            </div>
            <div className="text-[11px] text-white/30">เทียบกับราคาแรกเริ่ม</div>
          </div>
        </div>
      )}

      {/* Add New Price Record Box & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form to log purchase */}
        <div className="rounded-xl border border-white/5 bg-[#151518] p-5 text-white">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-[#FF6321]" />
            <span>บันทึกการซื้อล็อตใหม่</span>
          </h3>

          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">วันที่ซื้อ</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">
                ราคาซื้อต่อหน่วย (฿/{selectedIng?.purchaseUnit})
              </label>
              <NumericInput
                type="number"
                step="any"
                required
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">ปริมาณที่ซื้อ ({selectedIng?.purchaseUnit})</label>
              <NumericInput
                type="number"
                step="any"
                required
                min="0.1"
                value={newQty}
                onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">บันทึกข้อความ / ซัพพลายเออร์</label>
              <input
                type="text"
                placeholder="เช่น ปรับราคาจากฟาร์ม, สั่งล็อตใหญ่"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              บันทึกราคาวัตถุดิบใหม่
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-[#151518] p-5 text-white">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#00B1FF]" />
            <span>ประวัติราคาซื้อในอดีต (Historical Records)</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/60 font-medium">
                  <th className="py-2.5 px-3">วันที่</th>
                  <th className="py-2.5 px-3 text-right">ราคาซื้อ (฿)</th>
                  <th className="py-2.5 px-3 text-right">จำนวน</th>
                  <th className="py-2.5 px-3">ซัพพลายเออร์</th>
                  <th className="py-2.5 px-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/70">
                {sortedHistory.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-white/40">{item.date}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                      ฿{item.price.toFixed(2)} /{item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white/60">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-white/60">{item.supplierName || '-'}</td>
                    <td className="py-2.5 px-3 text-white/40">{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
