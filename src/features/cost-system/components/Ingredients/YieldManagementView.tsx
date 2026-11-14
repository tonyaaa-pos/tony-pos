import React, { useState } from 'react';
import { Percent, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Scale } from 'lucide-react';
import { Ingredient } from '../../types/domain';
import { calculateYieldPercent, calculateEffectiveCost, calculateUsableQuantity } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface YieldManagementViewProps {
  ingredients: Ingredient[];
  onUpdateIngredientYield: (ingredientId: string, yieldPercent: number, effectiveCost: number) => void;
  activeLanguage: 'th' | 'en';
}

export const YieldManagementView: React.FC<YieldManagementViewProps> = ({
  ingredients,
  onUpdateIngredientYield,
  activeLanguage,
}) => {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(
    ingredients[0]?.id || ''
  );
  const [rawWeight, setRawWeight] = useState<number>(1000);
  const [usableWeight, setUsableWeight] = useState<number>(920);
  const [rawPrice, setRawPrice] = useState<number>(96);

  const selectedIng = ingredients.find((i) => i.id === selectedIngredientId) || ingredients[0];

  // Calculated Yield
  const testYieldPercent = calculateYieldPercent(rawWeight, usableWeight);
  const isAbsorption = testYieldPercent > 100;
  const testEffectiveCost = calculateEffectiveCost(rawPrice, usableWeight);
  const testCostPerGram = testEffectiveCost; // cost per 1g usable if raw is in grams

  const handleApplyYield = () => {
    if (!selectedIng) return;
    const finalYield = Number(testYieldPercent.toFixed(1));
    const finalEffective = Number((selectedIng.purchasePrice / (selectedIng.purchaseQuantity * (finalYield / 100))).toFixed(2));
    onUpdateIngredientYield(selectedIng.id, finalYield, finalEffective);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
              Prep Loss & Expansion Analytics
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#10B981]" />
            <span>{activeLanguage === 'th' ? 'การทดสอบ Yield & การสูญเสียในการเตรียม' : 'Yield Testing & Prep Loss Lab'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'ห้องทดลองคำนวณ Yield จากการชั่งน้ำหนักจริงก่อนและหลังเตรียม (รองรับทั้งการสูญเสียตัดแต่ง <=100% และการดูดซึมน้ำ >100%)'
              : 'Interactive yield calculator for trimming waste vs boiling/absorption expansion.'}
          </p>
        </div>
      </div>

      {/* Interactive Yield Calculator Lab Card */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Scale className="h-5 w-5 text-[#FF6321]" />
            <span>{activeLanguage === 'th' ? 'ชั่งน้ำหนักทดสอบจริง (Yield Experiment Test)' : 'Yield Measurement Test'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/40">เลือกวัตถุดิบ:</span>
            <select
              value={selectedIngredientId}
              onChange={(e) => {
                setSelectedIngredientId(e.target.value);
                const target = ingredients.find((i) => i.id === e.target.value);
                if (target) {
                  setRawPrice(target.purchasePrice);
                  setRawWeight(target.purchaseQuantity * (target.purchaseUnit === 'kg' ? 1000 : 1));
                  setUsableWeight(target.usableQuantity * (target.purchaseUnit === 'kg' ? 1000 : 1));
                }
              }}
              className="rounded-lg border border-white/10 py-1.5 px-3 text-xs bg-[#0F0F11] font-medium text-white focus:border-[#FF6321] focus:outline-none"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.code} - {ing.thaiName} (Yield ปัจจุบัน: {ing.yieldPercent}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3 Step Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <label className="block text-xs font-semibold text-white/70 mb-1">
              1. น้ำหนักวัตถุดิบก่อนเตรียม (Raw Weight)
            </label>
            <div className="flex items-center gap-2 mt-2">
              <NumericInput
                type="number"
                step="any"
                min="1"
                value={rawWeight}
                onChange={(e) => setRawWeight(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
              <span className="text-xs font-medium text-white/40">กรัม (g)</span>
            </div>
            <p className="text-[11px] text-white/30 mt-1">เช่น อกไก่ดิบ 1,000 กรัม</p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <label className="block text-xs font-semibold text-white/70 mb-1">
              2. น้ำหนักหลังตัดแต่ง/ปรุงเสร็จ (Usable Weight)
            </label>
            <div className="flex items-center gap-2 mt-2">
              <NumericInput
                type="number"
                step="any"
                min="1"
                value={usableWeight}
                onChange={(e) => setUsableWeight(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
              <span className="text-xs font-medium text-white/40">กรัม (g)</span>
            </div>
            <p className="text-[11px] text-white/30 mt-1">หลังตัดเอ็นทิ้ง หรือหลังต้มเส้นสุก</p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <label className="block text-xs font-semibold text-white/70 mb-1">
              3. ราคาซื้อล็อตนี้ (Raw Cost ฿)
            </label>
            <div className="flex items-center gap-2 mt-2">
              <NumericInput
                type="number"
                step="any"
                min="0"
                value={rawPrice}
                onChange={(e) => setRawPrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
              <span className="text-xs font-medium text-white/40">บาท (฿)</span>
            </div>
            <p className="text-[11px] text-white/30 mt-1">ราคาที่จ่ายจริงตามบิล</p>
          </div>
        </div>

        {/* Results Banner */}
        <div className="mt-5 p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-1.5 justify-center sm:justify-start">
              <Percent className="h-4 w-4 text-[#FF6321]" />
              <span>ผลลัพธ์การคำนวณ Yield ที่แท้จริง</span>
            </div>
            <div className="text-3xl font-light text-[#10B981] font-mono">
              {testYieldPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-white/60">
              {isAbsorption
                ? '⚡ การดูดซึมน้ำ/การขยายตัว (>100%): น้ำหนักเพิ่มขึ้นจากการต้มหรือแช่น้ำ'
                : `🔪 สูญเสียจากการตัดแต่ง ${(100 - testYieldPercent).toFixed(1)}% (Usable Yield ${testYieldPercent.toFixed(1)}%)`}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-white/40">ต้นทุนจริงหลังหัก Yield</div>
              <div className="text-lg font-light text-white font-mono">
                ฿{(usableWeight > 0 ? (rawPrice / usableWeight) * 1000 : 0).toFixed(2)} /kg
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyYield}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-4 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>อัปเดตลงในทะเบียนวัตถุดิบ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Yield Reference Guide Table */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-5 text-white">
        <h2 className="text-sm font-semibold text-white mb-3">
          {activeLanguage === 'th' ? 'ตารางสรุป Yield ของวัตถุดิบทั้งหมดในร้าน' : 'All Ingredients Yield Comparison'}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/60 font-medium">
                <th className="py-2.5 px-3">วัตถุดิบ</th>
                <th className="py-2.5 px-3">วิธีเตรียม</th>
                <th className="py-2.5 px-3 text-right">Yield %</th>
                <th className="py-2.5 px-3 text-right">ประเภท Yield</th>
                <th className="py-2.5 px-3 text-right">ราคาซื้อ</th>
                <th className="py-2.5 px-3 text-right">ต้นทุนที่ใช้ได้จริง (Effective)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/70">
              {ingredients.map((ing) => (
                <tr key={ing.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white">{ing.thaiName}</td>
                  <td className="py-2.5 px-3 text-white/40">{ing.preparationMethod || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      ing.yieldPercent > 100 ? 'bg-[#00B1FF]/10 text-[#00B1FF] border border-[#00B1FF]/20' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                    }`}>
                      {ing.yieldPercent}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-white/40">
                    {ing.yieldType === 'absorption' ? 'การดูดซึมน้ำ (>100%)' : 'การสูญเสียตัดแต่ง (<=100%)'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-white/60">
                    ฿{ing.purchasePrice.toFixed(2)} /{ing.purchaseUnit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    ฿{ing.effectiveCost.toFixed(2)} /{ing.purchaseUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
