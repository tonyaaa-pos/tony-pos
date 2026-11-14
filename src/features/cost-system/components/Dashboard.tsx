import React, { useState } from 'react';
import {
  DollarSign,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Play,
  ChevronRight,
  Store,
} from 'lucide-react';
import {
  Ingredient,
  Sauce,
  MenuItem,
  RestaurantSettings,
  SaleOrder,
  ExpenseRecord,
  RecipeCostBreakdown,
} from '../types';
import { StorageService } from '../services/storageService';
import { calculateInventoryCOGS } from '../engine/calculations';
import {
  calculateVariantCostBreakdown,
  runFullSpecificationTests,
  runSection11SpecificationTests,
  TestResultItem,
} from '../services/calculationEngine';

interface DashboardProps {
  ingredients: Ingredient[];
  sauces: Sauce[];
  menus: MenuItem[];
  settings: RestaurantSettings;
  salesOrders: SaleOrder[];
  expenses: ExpenseRecord[];
  onNavigate: (tabId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  ingredients,
  sauces,
  menus,
  settings,
  salesOrders,
  expenses,
  onNavigate,
}) => {
  const [testResults, setTestResults] = useState<TestResultItem[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Dashboard accounting period: current calendar month. Historical months remain available in Expenses/P&L.
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);
  const periodSales = salesOrders.filter((o) => o.date.startsWith(currentMonthPrefix) && o.date <= today);
  const periodExpenses = expenses.filter((e) => e.date.startsWith(currentMonthPrefix) && e.date <= today);

  // Fast maps
  const ingredientsMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const saucesMap = new Map<string, Sauce>(sauces.map((s) => [s.id, s]));

  // Owner-defined GP % from settings
  const grabGpPercent = settings.grabFoodCommissionPercent ?? 30;
  const linemanGpPercent = settings.lineManCommissionPercent ?? 25;

  // Channel breakdowns
  const dineinOrders = periodSales.filter((o) => o.channel === 'ร้าน' || o.channel === 'DINE_IN');
  const takeawayOrders = periodSales.filter(
    (o) => o.channel === 'สั่งกลับบ้าน (Takeaway)' || o.channel === 'Takeaway'
  );
  const grabOrders = periodSales.filter((o) => o.channel === 'GrabFood' || o.channel === 'grab' || o.channel === 'GRABFOOD');
  const linemanOrders = periodSales.filter((o) => o.channel === 'LINE MAN' || o.channel === 'lineman' || o.channel === 'LINEMAN');

  // Revenue
  const totalGrossSales = periodSales.reduce((sum, o) => sum + o.grossSales, 0);
  const dineinSales = dineinOrders.reduce((sum, o) => sum + o.grossSales, 0);
  const takeawaySales = takeawayOrders.reduce((sum, o) => sum + o.grossSales, 0);
  const storefrontSales = dineinSales + takeawaySales;

  const grabSales = grabOrders.reduce((sum, o) => sum + o.grossSales, 0);
  const grabGpAmount = grabOrders.reduce((sum, o) => sum + (Number.isFinite(o.commissionFee) ? o.commissionFee : o.grossSales * (grabGpPercent / 100)), 0);
  const grabNetAfterGp = grabSales - grabGpAmount;

  const linemanSales = linemanOrders.reduce((sum, o) => sum + o.grossSales, 0);
  const linemanGpAmount = linemanOrders.reduce((sum, o) => sum + (Number.isFinite(o.commissionFee) ? o.commissionFee : o.grossSales * (linemanGpPercent / 100)), 0);
  const linemanNetAfterGp = linemanSales - linemanGpAmount;

  const onlineSales = grabSales + linemanSales;
  const totalGpAmount = grabGpAmount + linemanGpAmount;

  // Check for actual purchases & inventory stock (consistent with P&L and Executive Dashboard)
  const purchasesList = React.useMemo(() => StorageService.getPurchases(), []);
  const inventoryList = React.useMemo(() => StorageService.getInventory(), []);
  const wasteList = React.useMemo(() => StorageService.getWasteLog(), []);
  const hasActualStock = purchasesList.length > 0 && inventoryList.length > 0;

  // Costs
  const theoreticalFoodCost = periodSales.reduce((sum, o) => sum + o.totalFoodCost, 0);
  let totalFoodCost = theoreticalFoodCost;

  if (hasActualStock) {
    const totalPurchasesCost = purchasesList.reduce((sum, p) => sum + (p.totalPrice || p.price || 0), 0);
    const totalEndingStockCost = inventoryList.reduce((sum, item) => sum + ((item.currentStock ?? 0) * (item.costPerUnit || 0)), 0);
    const totalWasteCost = wasteList.reduce((sum, w) => sum + (w.totalCost || w.cost || 0), 0);
    const estimatedBeginningStockCost = totalEndingStockCost * 1.05;
    const actualCogsResult = calculateInventoryCOGS(
      estimatedBeginningStockCost,
      totalPurchasesCost,
      totalEndingStockCost,
      totalWasteCost
    );
    totalFoodCost = actualCogsResult.cogs;
  }

  const totalOpex = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPackaging = periodSales.reduce((sum, o) => sum + o.packagingCost, 0);
  const totalOtherCosts = totalPackaging;
  const totalCosts = totalFoodCost + totalOpex + totalGpAmount + totalOtherCosts;

  // Profitability
  const grossProfit = totalGrossSales - totalFoodCost - totalGpAmount - totalPackaging;
  const netProfit = grossProfit - totalOpex;

  const profitPercent = totalGrossSales > 0 ? (netProfit / totalGrossSales) * 100 : 0;
  const foodCostPercent = totalGrossSales > 0 ? (totalFoodCost / totalGrossSales) * 100 : 0;
  const expensePercent = totalGrossSales > 0 ? (totalOpex / totalGrossSales) * 100 : 0;
  const gpPercent = totalGrossSales > 0 ? (totalGpAmount / totalGrossSales) * 100 : 0;

  // Compute cost breakdowns for all active variants for warning alerts
  const allBreakdowns: RecipeCostBreakdown[] = [];
  menus.forEach((m) => {
    m.variants.forEach((v) => {
      if (v.active) {
        const bd = calculateVariantCostBreakdown(v, m.name, ingredientsMap, saucesMap, settings);
        allBreakdowns.push(bd);
      }
    });
  });

  const highCostVariants = allBreakdowns.filter(
    (b) => b.foodCostPercent > (settings.targetFoodCostPercent || 40)
  );

  // Warnings / Loss detection
  const warnings: { title: string; message: string; severity: 'high' | 'medium' | 'info' }[] = [];

  if (foodCostPercent > (settings.targetFoodCostPercent || 40)) {
    warnings.push({
      title: 'Food Cost สูงผิดปกติ',
      message: `Food Cost รวมอยู่ที่ ${foodCostPercent.toFixed(1)}% สูงกว่าเป้าหมาย ${(settings.targetFoodCostPercent || 40)}%`,
      severity: 'high',
    });
  }

  if (totalOpex > totalGrossSales * 0.45) {
    warnings.push({
      title: 'ค่าใช้จ่ายดำเนินงานสูงผิดปกติ',
      message: `ค่าใช้จ่ายดำเนินงานรวม ฿${totalOpex.toLocaleString()} คิดเป็น ${expensePercent.toFixed(1)}% ของยอดขาย`,
      severity: 'medium',
    });
  }

  if (netProfit < 0) {
    warnings.push({
      title: 'กำไรสุทธิติดลบ (ขาดทุน)',
      message: `กำไรสุทธิติดลบ ฿${Math.abs(netProfit).toLocaleString()} บาท กรุณาตรวจสอบต้นทุนอาหารและค่าใช้จ่าย`,
      severity: 'high',
    });
  } else if (profitPercent < 15 && totalGrossSales > 0) {
    warnings.push({
      title: 'อัตรากำไรสุทธิอยู่ในระดับต่ำ',
      message: `กำไรสุทธิอยู่ที่ ${profitPercent.toFixed(1)}% ควรควบคุมต้นทุนหรือปรับราคาขาย`,
      severity: 'medium',
    });
  }

  if (gpPercent > 20 && totalGrossSales > 0) {
    warnings.push({
      title: 'สัดส่วนค่า GP สูง',
      message: `ค่า GP เดลิเวอรีรวมคิดเป็น ${gpPercent.toFixed(1)}% ของยอดขายรวมร้าน`,
      severity: 'info',
    });
  }

  if (highCostVariants.length > 0) {
    warnings.push({
      title: 'เมนูที่ต้นทุนสูงเกินเป้าหมาย',
      message: `พบ ${highCostVariants.length} เมนูที่มี Food Cost % เกินเป้าหมาย (${highCostVariants.map((v) => v.variantName).slice(0, 3).join(', ')}${highCostVariants.length > 3 ? '...' : ''})`,
      severity: 'medium',
    });
  }

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const sec11Results = runSection11SpecificationTests();
      const fullResults = runFullSpecificationTests();
      setTestResults([...sec11Results, ...fullResults]);
      setIsRunningTests(false);
    }, 250);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header Card */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFC107]">
              Real-time Accounting Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1 tracking-tight">
            แดชบอร์ดสรุปธุรกิจและการเงิน Tony's Kitchen
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            สรุปภาพรวมรายได้ ต้นทุน กำไร แยกช่องทาง GrabFood และ LINE MAN ชัดเจนตาม GP ที่เจ้าของร้านกำหนด
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#d96817] text-black font-bold rounded-xl text-xs shadow-lg shadow-[#F27D26]/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="w-4 h-4" />
            <span>+ บันทึกยอดขาย</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('food_cost')}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>ต้นทุนอาหาร</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS (GP Split into GrabFood & LINE MAN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Sales */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/40 text-[10px] uppercase font-bold">ยอดขายรวม (Total Sales)</p>
            <Store className="w-4 h-4 text-[#F27D26]" />
          </div>
          <h3 className="text-2xl font-mono text-white font-bold">
            ฿{totalGrossSales.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
          </h3>
          <p className="text-[11px] text-white/50 mt-1">
            หน้าร้าน ฿{storefrontSales.toLocaleString()} • Online ฿{onlineSales.toLocaleString()}
          </p>
        </div>

        {/* 2. GrabFood GP Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-emerald-500/20 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <p className="text-emerald-400 text-[10px] uppercase font-bold">GrabFood GP</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-900 font-mono font-bold">
              GP {grabGpPercent}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-[10px] text-white/40 block">ยอดขาย</span>
              <span className="text-base font-bold font-mono text-white">
                ฿{grabSales.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400/70 block">GP Amount</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                ฿{grabGpAmount.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-white/60">Net after GP:</span>
            <span className="font-mono font-bold text-white">
              ฿{grabNetAfterGp.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* 3. LINE MAN GP Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-green-500/20 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-green-400 text-[10px] uppercase font-bold">LINE MAN GP</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-green-500/20 text-green-950 font-mono font-bold">
              GP {linemanGpPercent}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-[10px] text-white/40 block">ยอดขาย</span>
              <span className="text-base font-bold font-mono text-white">
                ฿{linemanSales.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-green-400/70 block">GP Amount</span>
              <span className="text-base font-bold font-mono text-green-400">
                ฿{linemanGpAmount.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-white/60">Net after GP:</span>
            <span className="font-mono font-bold text-white">
              ฿{linemanNetAfterGp.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* 4. Net Profit Card */}
        <div className="bg-[#F27D26] rounded-2xl p-4 text-black shadow-lg shadow-[#F27D26]/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-black font-bold uppercase text-[10px] tracking-wider">
              กำไรสุทธิ (Net Profit)
            </p>
            <span className="bg-white text-stone-900 border border-white/70 text-[10px] px-2 py-0.5 rounded font-bold font-mono shadow-xs">
              {profitPercent.toFixed(1)}% Margin
            </span>
          </div>
          <h3 className="text-2xl font-mono text-black font-black mt-1">
            ฿{netProfit.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
          </h3>
          <p className="text-[11px] text-black/80 mt-1">
            หัก Food Cost, GP และ Opex ฿{totalOpex.toLocaleString()} แล้ว
          </p>
        </div>
      </div>

      {/* BUSINESS FINANCIAL SUMMARY (Replaces Recipe Breakdown) */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F27D26]" />
              Business Financial Summary (สรุปการเงินธุรกิจ)
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              โครงสร้างรายได้ ต้นทุน กำไร และระบบเตือนความเสี่ยงทางการเงิน
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 bg-white/5 rounded-xl border border-white/10 text-white/70">
              Food Cost: <span className="font-bold text-[#FFC107]">{foodCostPercent.toFixed(1)}%</span>
            </span>
            <span className="px-3 py-1 bg-white/5 rounded-xl border border-white/10 text-white/70">
              Net Margin: <span className="font-bold text-emerald-400">{profitPercent.toFixed(1)}%</span>
            </span>
          </div>
        </div>

        {/* 3 Columns: Revenue, Cost, Profitability */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Revenue */}
          <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFC107] border-b border-white/10 pb-2">
              1. Revenue (รายรับ)
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/80 font-bold">ยอดขายรวม (Total Revenue)</span>
                <span className="font-mono font-bold text-white">฿{totalGrossSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">ยอดขายหน้าร้าน (Dine-in + Takeaway)</span>
                <span className="font-mono text-white/80">฿{storefrontSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 pl-3 text-[11px] text-white/40">
                <span>• ทานที่ร้าน (Dine-in)</span>
                <span className="font-mono">฿{dineinSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 pl-3 text-[11px] text-white/40">
                <span>• สั่งกลับบ้าน (Takeaway)</span>
                <span className="font-mono">฿{takeawaySales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-white/5">
                <span className="text-white/60">ยอดขาย Online (รวมแอป)</span>
                <span className="font-mono text-white/80">฿{onlineSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 pl-3 text-[11px] text-emerald-400">
                <span>• ยอดขาย GrabFood</span>
                <span className="font-mono">฿{grabSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 pl-3 text-[11px] text-green-400">
                <span>• ยอดขาย LINE MAN</span>
                <span className="font-mono">฿{linemanSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Cost */}
          <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-white/10 pb-2">
              2. Cost (ต้นทุน)
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/80 font-bold">ต้นทุนรวมทั้งหมด (Total Cost)</span>
                <span className="font-mono font-bold text-amber-400">฿{totalCosts.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">ต้นทุนอาหาร (Food Cost)</span>
                <span className="font-mono text-white/80">฿{totalFoodCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">ค่าใช้จ่ายดำเนินงาน (Operating Expense)</span>
                <span className="font-mono text-white/80">฿{totalOpex.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-emerald-400">
                <span>ค่า GP GrabFood ({grabGpPercent}%)</span>
                <span className="font-mono">฿{grabGpAmount.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-green-400">
                <span>ค่า GP LINE MAN ({linemanGpPercent}%)</span>
                <span className="font-mono">฿{linemanGpAmount.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-white/60">
                <span>ค่าใช้จ่ายอื่นๆ (กล่องบรรจุภัณฑ์)</span>
                <span className="font-mono text-white/80">฿{totalOtherCosts.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Profitability */}
          <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-white/10 pb-2">
              3. Profitability (ความสามารถทำกำไร)
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/80 font-bold">กำไรขั้นต้น (Gross Profit)</span>
                <span className="font-mono font-bold text-emerald-400">฿{grossProfit.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-white/80 font-bold">กำไรสุทธิ (Net Profit)</span>
                <span className="font-mono font-bold text-[#F27D26]">฿{netProfit.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">% กำไรสุทธิ (% Net Profit)</span>
                <span className="font-mono font-bold text-emerald-400">{profitPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">% Food Cost</span>
                <span className="font-mono text-amber-400">{foodCostPercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">% Expense (Opex)</span>
                <span className="font-mono text-white/80">{expensePercent.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-white/60">% GP รวม</span>
                <span className="font-mono text-white/80">{gpPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Loss / Warning Alerts Section */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Loss / Warning (ระบบตรวจจับความผิดปกติและการเตือน)
            </h3>
          </div>

          {warnings.length === 0 ? (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-xs text-emerald-900 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>ไม่พบความผิดปกติ: อัตรากำไรและต้นทุนอยู่ในเกณฑ์มาตรฐานที่ปลอดภัย</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border text-xs ${
                    w.severity === 'high'
                      ? 'bg-red-500/10 border-red-500/30 text-red-900'
                      : w.severity === 'medium'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-950'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{w.title}</span>
                  </div>
                  <p className="text-[11px] opacity-90">{w.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TEST SUITE RUNNER (Section 11 Tests 1-7 & Core Tests) */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                ระบบทดสอบความถูกต้องทางบัญชี (Automated Accounting Tests)
              </h2>
            </div>
            <p className="text-xs text-white/60 mt-1">
              ตรวจสอบ Menu Cost, Seafood Rule, GP GrabFood/LINE MAN, Expense, Monthly Filter, Custom Category และ Regression
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunTests}
            disabled={isRunningTests}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Play className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
            <span>{isRunningTests ? 'กำลังรันการทดสอบ...' : 'รันผลทดสอบทั้งหมด (Run Section 11 Tests)'}</span>
          </button>
        </div>

        {testResults && (
          <div className="space-y-2.5">
            {(() => {
              const passedCount = testResults.filter((t) => t.passed).length;
              const failedCount = testResults.length - passedCount;
              const allPassed = failedCount === 0;
              return (
                <>
                  <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                    allPassed
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className={`flex items-center gap-2 text-xs font-bold ${allPassed ? 'text-emerald-800' : 'text-red-800'}`}>
                      {allPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span>ผลการทดสอบ: {passedCount}/{testResults.length} ผ่าน{failedCount > 0 ? ` • ${failedCount} รายการต้องแก้ไข` : ' • ผ่านทั้งหมด'}</span>
                    </div>
                    <span className={`text-[11px] font-semibold font-mono ${allPassed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {allPassed ? 'ALL TESTS PASSED' : 'TEST FAILURE DETECTED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {testResults.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 bg-white/5 rounded-xl border text-xs space-y-1 hover:border-white/20 transition-colors ${
                          t.passed ? 'border-white/10' : 'border-red-500/40 bg-red-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white/90">{t.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.passed
                              ? 'bg-emerald-500/20 text-emerald-900 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-900 border border-red-500/30'
                          }`}>
                            {t.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#B45309] font-mono">
                          <span className="text-white/40">ผลจริง:</span> {t.actual}
                        </div>
                        {!t.passed && (
                          <div className="text-[11px] text-red-800 font-mono">
                            <span className="text-red-600">Expected:</span> {t.expected}
                          </div>
                        )}
                        <div className="text-[10px] text-white/50 italic">{t.details}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {!testResults && (
          <div className="text-center py-5 border border-dashed border-white/15 rounded-xl bg-white/[0.02]">
            <p className="text-xs text-white/50 font-medium">
              กดปุ่ม <span className="font-bold text-emerald-400">"รันผลทดสอบทั้งหมด"</span> เพื่อรันชุดทดสอบบัญชีอัตโนมัติ
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

