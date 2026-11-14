import React, { useState } from 'react';
import { Plus, Trash2, Calendar, AlertTriangle, Scale, DollarSign } from 'lucide-react';
import { WasteRecord, Ingredient, WasteReason } from '../../types/domain';
import { NumericInput } from '../common/NumericInput';
import { CategoryIngredientSelect } from '../common/CategoryIngredientSelect';

interface WasteTrackingViewProps {
  wasteRecords: WasteRecord[];
  ingredients: Ingredient[];
  onAddWasteRecord: (record: WasteRecord) => void;
  onDeleteWasteRecord: (id: string) => void;
  activeLanguage: 'th' | 'en';
}

export const WasteTrackingView: React.FC<WasteTrackingViewProps> = ({
  wasteRecords,
  ingredients,
  onAddWasteRecord,
  onDeleteWasteRecord,
  activeLanguage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<{
    date: string;
    ingredientId: string;
    quantity: number;
    reason: WasteReason;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    ingredientId: ingredients[0]?.id || '',
    quantity: 1,
    reason: 'Expired',
    notes: '',
  });

  const reasons: { key: WasteReason; labelTh: string; labelEn: string }[] = [
    { key: 'Expired', labelTh: 'หมดอายุ (Expired)', labelEn: 'Expired' },
    { key: 'Spoiled / Mold', labelTh: 'เน่าเสีย / ขึ้นรา (Spoiled)', labelEn: 'Spoiled / Mold' },
    { key: 'Cooking / Burn Loss', labelTh: 'ปรุงไหม้ / ผิดพลาด (Cooking Loss)', labelEn: 'Cooking / Burn Loss' },
    { key: 'Overproduction', labelTh: 'เตรียมไว้เกินเหลือทิ้ง (Overproduction)', labelEn: 'Overproduction' },
    { key: 'Dropped / Spilled', labelTh: 'ทำตกหล่น / หกเสียหาย (Dropped)', labelEn: 'Dropped / Spilled' },
    { key: 'Other', labelTh: 'อื่นๆ (Other)', labelEn: 'Other' },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const ing = ingredients.find((i) => i.id === formData.ingredientId);
    if (!ing) return;

    // Calculate exact financial cost of wasted ingredient
    const unitCost = ing.effectiveCost;
    const totalCost = formData.quantity * unitCost;

    const newWaste: WasteRecord = {
      id: `waste-${Date.now()}`,
      date: formData.date,
      ingredientId: ing.id,
      ingredientName: ing.thaiName,
      quantity: formData.quantity,
      unit: ing.purchaseUnit,
      unitCost,
      totalCost,
      reason: formData.reason,
      notes: formData.notes,
      responsiblePerson: 'Chef',
    };

    onAddWasteRecord(newWaste);
    setIsModalOpen(false);
  };

  const totalWasteCost = wasteRecords.reduce((sum, w) => sum + w.totalCost, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#EF4444] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#EF4444]">
              Shrinkage & Loss Auditing
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-[#EF4444]" />
            <span>{activeLanguage === 'th' ? 'บันทึกของเสีย & ขยะอาหาร (Waste Tracking & Loss)' : 'Waste Tracking & Loss'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'บันทึกการทิ้งวัตถุดิบ อาหารไหม้ ของหมดอายุ และคำนวณมูลค่าความเสียหายเป็นตัวเงินจริง (฿)'
              : 'Log kitchen spoilage, dropped items, and over-prepped waste with real financial loss in Baht.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF4444] hover:bg-[#EF4444]/90 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{activeLanguage === 'th' ? 'บันทึกของเสีย' : 'Log Waste'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 p-5 text-white">
          <div className="text-white/70 text-xs font-semibold">มูลค่าความเสียหายรวม (Total Waste Loss)</div>
          <div className="mt-1 text-2xl font-light text-[#EF4444] font-mono">
            ฿{totalWasteCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">{wasteRecords.length} บันทึกการทิ้ง</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#151518] p-5 text-white">
          <div className="text-white/40 text-xs font-medium">สาเหตุที่พบบ่อยที่สุด</div>
          <div className="mt-1 text-base font-semibold text-white">
            วัตถุดิบหมดอายุ (Expired)
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">แนะนำ: ปรับรอบสั่งซื้อและใช้วิธี FIFO</div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#151518] p-5 text-white">
          <div className="text-white/40 text-xs font-medium">เป้าหมายลดขยะอาหาร (Target)</div>
          <div className="mt-1 text-base font-semibold text-[#10B981]">
            ต่ำกว่า 1.5% ของยอดซื้อ
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">ควบคุมคุณภาพการเก็บรักษา</div>
        </div>
      </div>

      {/* Waste Table */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-5 text-white overflow-hidden">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#FF6321]" />
          <span>ประวัติการทิ้งวัตถุดิบ</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/60 font-medium">
                <th className="py-2.5 px-3">วันที่</th>
                <th className="py-2.5 px-3">วัตถุดิบที่ทิ้ง</th>
                <th className="py-2.5 px-3 text-right">ปริมาณ</th>
                <th className="py-2.5 px-3">สาเหตุการทิ้ง</th>
                <th className="py-2.5 px-3 text-right">มูลค่าเสียหาย (฿)</th>
                <th className="py-2.5 px-3">หมายเหตุ</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/70">
              {wasteRecords.map((w) => (
                <tr key={w.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-white/40">{w.date}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{w.ingredientName}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-white/60">
                    {w.quantity} {w.unit}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20">
                      {w.reason}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#EF4444]">
                    ฿{w.totalCost.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-white/40">{w.notes || '-'}</td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteWasteRecord(w.id)}
                      className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-[#151518] p-6 border border-white/10 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-white">บันทึกของเสีย/ขยะอาหาร</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">วันที่</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">สาเหตุการทิ้ง</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value as any })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    {reasons.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.labelTh}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <CategoryIngredientSelect
                ingredients={ingredients.map((i) => ({ ...i, name: i.thaiName }))}
                selectedIngredientId={formData.ingredientId}
                onSelectIngredientId={(id) => setFormData({ ...formData, ingredientId: id })}
                formatIngredientOption={(ing) => `${ing.thaiName} (฿${(ing.effectiveCost || 0).toFixed(2)}/${ing.purchaseUnit})`}
                categoryLabel="1. เลือกหมวดหมู่วัตถุดิบก่อน"
                ingredientLabel="2. เลือกวัตถุดิบย่อย"
                theme="dark"
                layout="row"
                required
              />

              <div>
                <label className="block text-xs text-white/60 mb-1">ปริมาณที่ทิ้ง</label>
                <NumericInput
                  type="number"
                  step="any"
                  required
                  min="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  placeholder="เช่น ลืมแช่ตู้เย็นข้ามคืน"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#EF4444] hover:bg-[#EF4444]/90 px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  บันทึกของเสีย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
