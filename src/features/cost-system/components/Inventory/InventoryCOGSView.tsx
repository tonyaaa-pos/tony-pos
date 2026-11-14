import React, { useState } from 'react';
import { Boxes, Scale, AlertTriangle, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { Ingredient, DailySalesRecord } from '../../types/domain';
import { calculateInventoryCOGS, calculateVariance } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface InventoryCOGSViewProps {
  ingredients: Ingredient[];
  sales: DailySalesRecord[];
  activeLanguage: 'th' | 'en';
}

export const InventoryCOGSView: React.FC<InventoryCOGSViewProps> = ({
  ingredients,
  sales,
  activeLanguage,
}) => {
  const [beginningInventory, setBeginningInventory] = useState<number>(45000);
  const [purchases, setPurchases] = useState<number>(110000);
  const [endingInventory, setEndingInventory] = useState<number>(42000);
  const [theoreticalCOGS, setTheoreticalCOGS] = useState<number>(106500);

  const cogsResult = calculateInventoryCOGS(beginningInventory, purchases, endingInventory);
  const actualCOGS = cogsResult.cogs;
  const varianceResult = calculateVariance(actualCOGS, theoreticalCOGS);

  const monthlyNetSales = sales.reduce((sum, s) => sum + s.netSales, 0);
  const actualCostPercent = monthlyNetSales > 0 ? (actualCOGS / monthlyNetSales) * 100 : 0;
  const theoreticalCostPercent = monthlyNetSales > 0 ? (theoreticalCOGS / monthlyNetSales) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
              Inventory Valuation & Shrinkage Control
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <Boxes className="h-5 w-5 text-[#10B981]" />
            <span>{activeLanguage === 'th' ? 'การคำนวณต้นทุนขายตามสต็อกจริง (Inventory COGS & Variance)' : 'Inventory COGS & Variance Analysis'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'คำนวณต้นทุนจริงตามรอบนับสต็อก (Mode B) และเปรียบเทียบกับต้นทุนตามสูตรมาตรฐาน (Mode A) เพื่อหาของหาย การตักเกิน หรือของเสีย'
              : 'Periodic inventory equation (Beginning + Purchases - Ending) vs theoretical recipe COGS to uncover shrinkage and waste.'}
          </p>
        </div>
      </div>

      {/* Warning banner when stock calculation is negative */}
      {cogsResult.isNegative && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="font-semibold">ตัวเลขสต็อกผิดปกติ ตรวจสอบการนับสต็อก (ต้นทุนคำนวณติดลบ ฿{actualCOGS.toLocaleString()})</span>
        </div>
      )}

      {/* Equation Visual Banner */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-6 text-white">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
          สมการต้นทุนสินค้าคงเหลือตามงวด (Periodic Inventory Formula)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-white/60 font-semibold mb-1">1. สต็อกต้นงวด (Beginning)</div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold text-white/30">฿</span>
              <NumericInput
                type="number"
                value={beginningInventory}
                onChange={(e) => setBeginningInventory(parseFloat(e.target.value) || 0)}
                className="w-28 text-center text-lg font-bold font-mono text-white rounded-lg border border-white/10 bg-[#0F0F11] py-1 focus:border-[#FF6321] focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-white/60 font-semibold mb-1">+ ยอดซื้อเพิ่มในงวด (Purchases)</div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold text-white/30">฿</span>
              <NumericInput
                type="number"
                value={purchases}
                onChange={(e) => setPurchases(parseFloat(e.target.value) || 0)}
                className="w-28 text-center text-lg font-bold font-mono text-white rounded-lg border border-white/10 bg-[#0F0F11] py-1 focus:border-[#FF6321] focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <div className="text-xs text-white/60 font-semibold mb-1">- สต็อกปลายงวด (Ending)</div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm font-bold text-white/30">฿</span>
              <NumericInput
                type="number"
                value={endingInventory}
                onChange={(e) => setEndingInventory(parseFloat(e.target.value) || 0)}
                className="w-28 text-center text-lg font-bold font-mono text-white rounded-lg border border-white/10 bg-[#0F0F11] py-1 focus:border-[#FF6321] focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
            <div className="text-xs text-white/60 font-semibold mb-1">= ต้นทุนขายจริง (Actual COGS)</div>
            <div className="text-2xl font-light text-[#10B981] font-mono">
              ฿{actualCOGS.toLocaleString()}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">{actualCostPercent.toFixed(1)}% of Net Sales</div>
          </div>
        </div>
      </div>

      {/* Variance Analysis Panel */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-6 space-y-4 text-white">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Scale className="h-5 w-5 text-[#00B1FF]" />
            <span>การเปรียบเทียบผลต่างต้นทุน (Actual vs Theoretical Variance)</span>
          </div>
          <span className="text-xs font-mono text-white/60">
            {varianceResult.varianceStatus === 'OVER_BUDGET' ? '⚠️ ต้นทุนจริงสูงกว่าสูตร' : '✅ ควบคุมต้นทุนได้ดี'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <label className="block text-xs font-semibold text-white/70 mb-1">
              ต้นทุนตามสูตรมาตรฐาน (Theoretical COGS ฿)
            </label>
            <NumericInput
              type="number"
              value={theoreticalCOGS}
              onChange={(e) => setTheoreticalCOGS(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
            />
            <p className="text-[11px] text-white/30 mt-1">
              คำนวณจาก (จำนวนจานที่ขาย x ต้นทุนสูตรมาตรฐาน)
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
            <div className="text-xs text-white/60 font-semibold">ผลต่างจำนวนเงิน (Variance Amount)</div>
            <div className={`text-2xl font-light font-mono mt-1 ${
              varianceResult.varianceAmount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
            }`}>
              {varianceResult.varianceAmount > 0 ? `+฿${varianceResult.varianceAmount.toLocaleString()}` : `-฿${Math.abs(varianceResult.varianceAmount).toLocaleString()}`}
            </div>
            <p className="text-[11px] text-white/30 mt-0.5">ส่วนต่างระหว่างของที่ใช้จริงกับสูตร</p>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-center ${
            varianceResult.variancePercent > 5 ? 'bg-[#EF4444]/10 border-[#EF4444]/20' : 'bg-[#10B981]/10 border-[#10B981]/20'
          }`}>
            <div className="text-xs font-bold uppercase tracking-wider text-white/70">
              % ส่วนต่างผลกระทบ (% Variance)
            </div>
            <div className={`text-2xl font-light font-mono mt-1 ${
              varianceResult.variancePercent > 5 ? 'text-[#EF4444]' : 'text-[#10B981]'
            }`}>
              {varianceResult.variancePercent > 0 ? `+${varianceResult.variancePercent.toFixed(1)}%` : `${varianceResult.variancePercent.toFixed(1)}%`}
            </div>
            <p className="text-[11px] text-white/60 mt-0.5">
              {varianceResult.varianceAmount > 0
                ? 'สาเหตุ: ตักพอร์ชั่นเกิน, วัตถุดิบเน่าเสียไม่ได้บันทึก, หรือของสูญหาย'
                : 'ยอดการใช้วัตถุดิบอยู่ในเกณฑ์ควบคุมมาตรฐาน'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
