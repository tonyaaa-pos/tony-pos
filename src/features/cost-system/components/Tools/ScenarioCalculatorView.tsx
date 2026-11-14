import React, { useState } from 'react';
import { SlidersHorizontal, TrendingDown, TrendingUp, AlertTriangle, ArrowRight, DollarSign, Sparkles } from 'lucide-react';
import { Ingredient, MenuItem, DailySalesRecord } from '../../types/domain';
import { calculateScenarioImpact } from '../../engine/calculations';

interface ScenarioCalculatorViewProps {
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  sales: DailySalesRecord[];
  activeLanguage: 'th' | 'en';
}

export const ScenarioCalculatorView: React.FC<ScenarioCalculatorViewProps> = ({
  ingredients,
  menuItems,
  sales,
  activeLanguage,
}) => {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(
    ingredients[0]?.id || ''
  );
  const [ingredientPriceIncreasePercent, setIngredientPriceIncreasePercent] = useState<number>(20);
  const [laborIncreasePercent, setLaborIncreasePercent] = useState<number>(0);
  const [monthlyUsageQty, setMonthlyUsageQty] = useState<number>(120); // e.g. 120 kg/month

  const selectedIng = ingredients.find((i) => i.id === selectedIngredientId) || ingredients[0];

  const monthlyNetSales = sales.reduce((sum, s) => sum + s.netSales, 0);
  const baseMonthlyNetProfit = 68900; // base from P&L

  // Calculate Impact
  const impact = calculateScenarioImpact(
    selectedIng?.purchasePrice || 100,
    ingredientPriceIncreasePercent,
    monthlyUsageQty,
    baseMonthlyNetProfit
  );

  // Find all menu portions affected by this ingredient
  const affectedPortions = menuItems.flatMap((m) =>
    m.portions
      .filter((p) => p.items.some((it) => it.ingredientId === selectedIng?.id))
      .map((p) => {
        const itemUsage = p.items.find((it) => it.ingredientId === selectedIng?.id);
        const qty = itemUsage ? itemUsage.quantity : 0;
        const currentCost = p.directFoodCost;
        const costIncreasePerDish = (selectedIng.costPerBaseUnit * (ingredientPriceIncreasePercent / 100)) * (itemUsage?.unit === 'kg' || itemUsage?.unit === 'l' ? qty * 1000 : qty);
        const newCost = currentCost + costIncreasePerDish;
        const newFoodCostPercent = p.sellingPrice > 0 ? (newCost / p.sellingPrice) * 100 : 0;
        const suggestedNewPrice = Math.ceil(newCost / (p.foodCostPercent / 100 || 0.3));

        return {
          menuName: m.thaiName,
          portionName: p.name,
          sellingPrice: p.sellingPrice,
          currentCost,
          newCost,
          costIncreasePerDish,
          currentFoodCostPercent: p.foodCostPercent,
          newFoodCostPercent,
          suggestedNewPrice,
        };
      })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF6321] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6321]">
              Inflation & Pricing Sensitivity Simulator
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[#FF6321]" />
            <span>{activeLanguage === 'th' ? 'แบบจำลองสถานการณ์ต้นทุน (What-If Cost Simulator)' : 'What-If Cost Simulator'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'จำลองผลกระทบเมื่อราคาวัตถุดิบหลักหรือค่าแรงปรับตัวสูงขึ้น ว่าจะกระทบกำไรสุทธิต่อเดือนและกำไรต่อจานเท่าไร'
              : 'Simulate the exact bottom-line impact of ingredient inflation and see auto-adjusted suggested prices.'}
          </p>
        </div>
      </div>

      {/* Simulator Control Panel */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-6 text-white space-y-5">
        <h2 className="text-sm font-semibold text-white border-b border-white/5 pb-3">
          กำหนดตัวแปรจำลอง (Simulation Scenario)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1">เลือกวัตถุดิบที่ราคาขึ้น</label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="w-full rounded-lg border border-white/10 py-2 px-3 text-xs bg-[#0F0F11] font-medium text-white focus:border-[#FF6321] focus:outline-none"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.thaiName} (ปัจจุบัน ฿{ing.purchasePrice}/{ing.purchaseUnit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1">
              เปอร์เซ็นต์ราคาที่คาดว่าจะปรับขึ้น (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="200"
                value={ingredientPriceIncreasePercent}
                onChange={(e) => setIngredientPriceIncreasePercent(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
              <span className="text-sm font-bold text-white/40">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1">
              ปริมาณการใช้โดยเฉลี่ยต่อเดือน ({selectedIng?.purchaseUnit}/เดือน)
            </label>
            <input
              type="number"
              min="1"
              value={monthlyUsageQty}
              onChange={(e) => setMonthlyUsageQty(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
            />
          </div>
        </div>

        {/* Impact Results Banner */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-white/60 font-semibold">ราคาซื้อใหม่ที่คาดการณ์</div>
            <div className="text-2xl font-light text-white font-mono mt-1">
              ฿{impact.newCostPerUnit.toFixed(2)} /{selectedIng?.purchaseUnit}
            </div>
            <div className="text-[11px] text-[#EF4444] mt-0.5">
              เพิ่มขึ้น +฿{impact.costIncreasePerUnit.toFixed(2)} /{selectedIng?.purchaseUnit}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 font-semibold">ต้นทุนร้านเพิ่มขึ้นต่อเดือน</div>
            <div className="text-2xl font-light text-[#EF4444] font-mono mt-1">
              +฿{Math.round(impact.totalMonthlyCostIncrease).toLocaleString()}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">
              จากการใช้ {monthlyUsageQty} {selectedIng?.purchaseUnit}/เดือน
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60 font-semibold">กำไรสุทธิใหม่หลังต้นทุนขึ้น</div>
            <div className="text-2xl font-light text-white font-mono mt-1">
              ฿{Math.round(impact.newMonthlyNetProfit).toLocaleString()}
            </div>
            <div className="text-[11px] text-[#EF4444] font-medium mt-0.5">
              กำไรลดลง -{impact.profitErosionPercent.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Affected Menu Portions Table */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-6 text-white space-y-4">
        <h2 className="text-sm font-semibold text-white border-b border-white/5 pb-3 flex items-center justify-between">
          <span>
            เมนูอาหารที่ได้รับผลกระทบจาก {selectedIng?.thaiName} ({affectedPortions.length} เมนู)
          </span>
          <span className="text-xs font-normal text-white/40">
            ระบบคำนวณราคาขายใหม่ที่ควรปรับเพื่อรักษากำไรเดิม
          </span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/60 font-medium">
                <th className="py-2.5 px-3">ชื่อเมนู</th>
                <th className="py-2.5 px-3">พอร์ชั่น</th>
                <th className="py-2.5 px-3 text-right">ราคาขายเดิม (฿)</th>
                <th className="py-2.5 px-3 text-right">ต้นทุนเดิม (฿)</th>
                <th className="py-2.5 px-3 text-right">ต้นทุนใหม่ (฿)</th>
                <th className="py-2.5 px-3 text-right">% Food Cost เดิม</th>
                <th className="py-2.5 px-3 text-right">% Food Cost ใหม่</th>
                <th className="py-2.5 px-3 text-right">ราคาขายที่ควรปรับ (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/70">
              {affectedPortions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-white/30">
                    ไม่พบเมนูที่ใช้ {selectedIng?.thaiName} เป็นส่วนผสม
                  </td>
                </tr>
              ) : (
                affectedPortions.map((p, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">{p.menuName}</td>
                    <td className="py-3 px-3 text-white/60">{p.portionName}</td>
                    <td className="py-3 px-3 text-right font-mono text-white/80">฿{p.sellingPrice}</td>
                    <td className="py-3 px-3 text-right font-mono text-white/40">฿{p.currentCost.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#EF4444]">
                      ฿{p.newCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white/60">{p.currentFoodCostPercent.toFixed(1)}%</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#EF4444]">
                      {p.newFoodCostPercent.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#10B981] bg-[#10B981]/10">
                      ฿{p.suggestedNewPrice}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
