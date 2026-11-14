import React, { useState } from 'react';
import { SaleOrder, ExpenseRecord, WasteRecord } from '../types';

interface ProfitLossViewProps {
  salesOrders: SaleOrder[];
  expenses: ExpenseRecord[];
  wasteLog: WasteRecord[];
}

export const ProfitLossView: React.FC<ProfitLossViewProps> = ({
  salesOrders,
  expenses,
  wasteLog,
}) => {
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');

  // Filter by a real calendar period; never hard-code a historical date.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  const filteredSales = salesOrders.filter((s) => {
    if (period === 'DAILY') return s.date === today;
    if (period === 'WEEKLY') return s.date >= weekStart && s.date <= today;
    return s.date >= monthStart && s.date <= today;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (period === 'DAILY') return e.date === today;
    if (period === 'WEEKLY') return e.date >= weekStart && e.date <= today;
    return e.date >= monthStart && e.date <= today;
  });

  const filteredWaste = wasteLog.filter((w) => {
    if (period === 'DAILY') return w.date === today;
    if (period === 'WEEKLY') return w.date >= weekStart && w.date <= today;
    return w.date >= monthStart && w.date <= today;
  });

  // Calculate P&L figures
  const grossSales = filteredSales.reduce((sum, s) => sum + s.grossSales, 0);
  const deliveryGP = filteredSales.reduce((sum, s) => sum + s.commissionFee, 0);
  const packagingCost = filteredSales.reduce((sum, s) => sum + s.packagingCost, 0);

  const menuFoodCost = filteredSales.reduce((sum, s) => sum + s.totalFoodCost, 0);
  const wasteCost = filteredWaste.reduce((sum, w) => sum + (w.totalCost ?? w.cost ?? 0), 0);
  const totalCOGS = menuFoodCost + wasteCost;

  const grossProfit = grossSales - totalCOGS - deliveryGP - packagingCost;
  const grossMarginPercent = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;
  const foodCostPercent = grossSales > 0 ? (totalCOGS / grossSales) * 100 : 0;

  const totalOpex = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalOpex;
  const netMarginPercent = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  // Breakdown of opex by category
  const opexCategories = new Map<string, number>();
  filteredExpenses.forEach((e) => {
    opexCategories.set(e.category, (opexCategories.get(e.category) || 0) + e.amount);
  });

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            งบกำไรขาดทุนร้านอาหาร (Profit & Loss Statement)
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            สรุปรายได้, ต้นทุนวัตถุดิบ (COGS), หักค่าคอมมิชชั่น GP, ค่าใช้จ่ายดำเนินงาน, และกำไรสุทธิ
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriod('DAILY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === 'DAILY' ? 'bg-[#F27D26] text-black shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            รายวัน (Today)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('WEEKLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === 'WEEKLY' ? 'bg-[#F27D26] text-black shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            7 วันล่าสุด
          </button>
          <button
            type="button"
            onClick={() => setPeriod('MONTHLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === 'MONTHLY' ? 'bg-[#F27D26] text-black shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            เดือนปัจจุบัน
          </button>
        </div>
      </div>

      {/* Top Net Profit Highlight Banner */}
      <div
        className={`p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          netProfit >= 0
            ? 'bg-[#FCFDF9] text-slate-900 border-emerald-200/80'
            : 'bg-[#FFFDF7] text-slate-900 border-rose-200/80'
        }`}
      >
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 font-sans">
            กำไรสุทธิคงเหลือ (Net Profit) — {period}
          </span>
          <div className={`text-3xl sm:text-4xl font-bold font-mono mt-1 tracking-tight ${
            netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-600 mt-1 font-medium font-sans">
            อัตรากำไรสุทธิ (Net Margin):{' '}
            <span className={`font-bold font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {netMarginPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="bg-white border border-stone-200/80 p-3 rounded-2xl shadow-xs">
            <span className="block text-[10px] text-slate-500 font-sans font-semibold">ยอดขายรวม:</span>
            <span className="font-bold text-sm text-slate-900 font-mono">฿{grossSales.toLocaleString()}</span>
          </div>
          <div className="bg-white border border-stone-200/80 p-3 rounded-2xl shadow-xs">
            <span className="block text-[10px] text-slate-500 font-sans font-semibold">Food Cost %:</span>
            <span className="font-bold text-sm text-[#b45309] font-mono">{foodCostPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* P&L STATEMENT SHEET */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <span className="font-bold text-white text-sm">
            ตารางบัญชีรายได้และค่าใช้จ่ายแบบละเอียด
          </span>
          <span className="text-xs font-mono text-white/40">
            หน่วย: บาท (THB)
          </span>
        </div>

        <div className="p-6 space-y-6 text-xs font-mono">
          {/* SECTION 1: REVENUE */}
          <div className="space-y-2">
            <div className="flex justify-between font-sans font-bold text-white text-sm border-b border-white/10 pb-1">
              <span>1. รายได้จากการขาย (REVENUE)</span>
              <span className="text-green-400">฿{grossSales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-white/70 pl-4 text-xs">
              <span className="font-sans">ยอดขายรวม (Gross Sales จาก {filteredSales.length} บิล)</span>
              <span>฿{grossSales.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* SECTION 2: COGS */}
          <div className="space-y-2">
            <div className="flex justify-between font-sans font-bold text-white text-sm border-b border-white/10 pb-1">
              <span>2. ต้นทุนขาย (COST OF GOODS SOLD - COGS)</span>
              <span className="text-[#FFC107]">
                -฿{totalCOGS.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-white/70 pl-4">
              <span className="font-sans">ต้นทุนวัตถุดิบอาหารที่ขาย (Food Cost of Sales)</span>
              <span>-฿{menuFoodCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-white/70 pl-4">
              <span className="font-sans">ต้นทุนสูญเสียจากของเสีย (Waste Cost)</span>
              <span>-฿{wasteCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* SECTION 3: DELIVERY DEDUCTIONS */}
          <div className="space-y-2">
            <div className="flex justify-between font-sans font-bold text-white text-sm border-b border-white/10 pb-1">
              <span>3. ค่าบริการแพลตฟอร์มและบรรจุภัณฑ์ (PLATFORM & PACKAGING)</span>
              <span className="text-red-400">
                -฿{(deliveryGP + packagingCost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-white/70 pl-4">
              <span className="font-sans">ค่าคอมมิชชั่น GP เดลิเวอรี (Grab / LINE MAN)</span>
              <span>-฿{deliveryGP.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-white/70 pl-4">
              <span className="font-sans">ค่ากล่องและบรรจุภัณฑ์ส่งมอบ (Packaging)</span>
              <span>-฿{packagingCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* GROSS PROFIT STRIP */}
          <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex justify-between font-bold text-slate-900 text-sm">
            <span className="font-sans">กำไรขั้นต้น (GROSS PROFIT) ({grossMarginPercent.toFixed(1)}%)</span>
            <span className="font-mono text-base font-bold text-emerald-700">
              ฿{grossProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* SECTION 4: OPEX */}
          <div className="space-y-2">
            <div className="flex justify-between font-sans font-bold text-white text-sm border-b border-white/10 pb-1">
              <span>4. ค่าใช้จ่ายดำเนินงานคงที่และแปรผัน (OPERATING EXPENSES)</span>
              <span className="text-white/80">
                -฿{totalOpex.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Array.from(opexCategories.entries()).map(([cat, val]) => (
              <div key={cat} className="flex justify-between text-white/70 pl-4">
                <span className="font-sans">{cat}</span>
                <span>-฿{val.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          {/* NET PROFIT FINAL ROW */}
          <div
            className={`p-4 rounded-2xl border flex justify-between font-bold text-base ${
              netProfit >= 0
                ? 'bg-[#FCFDF9] text-slate-900 border-emerald-200/80 shadow-xs'
                : 'bg-[#FFFDF7] text-slate-900 border-rose-200/80 shadow-xs'
            }`}
          >
            <span className="font-sans font-bold text-slate-900">กำไรสุทธิสิ้นงวด (NET PROFIT):</span>
            <span className={`font-mono text-xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
