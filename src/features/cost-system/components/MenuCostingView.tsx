import React, { useState } from 'react';
import {
  Calculator,
  Search,
  CheckCircle2,
  Sparkles,
  X,
  TrendingUp,
} from 'lucide-react';
import {
  MenuItem,
  MenuVariant,
  Ingredient,
  Sauce,
  RestaurantSettings,
  RecipeCostBreakdown,
} from '../types';
import {
  calculateVariantCostBreakdown,
  calculateSuggestedPrices,
  getDeliveryCommissionPercent,
} from '../services/calculationEngine';

interface MenuCostingViewProps {
  menus: MenuItem[];
  ingredients: Ingredient[];
  sauces: Sauce[];
  settings: RestaurantSettings;
  onUpdateVariantPrice: (
    menuId: string,
    variantId: string,
    prices: { sellingPrice: number; takeawayPrice: number; deliveryPrice: number }
  ) => void;
}

type SortOption =
  | 'MARGIN_ASC'
  | 'MARGIN_DESC'
  | 'FOOD_COST_PCT_DESC'
  | 'FOOD_COST_PCT_ASC'
  | 'PROFIT_DESC'
  | 'PROFIT_ASC';

export const MenuCostingView: React.FC<MenuCostingViewProps> = ({
  menus,
  ingredients,
  sauces,
  settings,
  onUpdateVariantPrice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('MARGIN_ASC');
  const [activeChannel, setActiveChannel] = useState<'DINE_IN' | 'GRAB' | 'LINEMAN'>('DINE_IN');

  // Breakdown Modal state
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    menu: MenuItem;
    variant: MenuVariant;
    breakdown: RecipeCostBreakdown;
  } | null>(null);

  // Suggested Price custom sliders inside modal
  const [customTargetFcPercent, setCustomTargetFcPercent] = useState<number>(
    settings.targetFoodCostPercent || 40
  );
  const [customTargetProfit, setCustomTargetProfit] = useState<number>(40);

  // Fast maps
  const ingredientsMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));
  const saucesMap = new Map<string, Sauce>(sauces.map((s) => [s.id, s]));

  // Build rows of all variants
  const rows: Array<{
    menu: MenuItem;
    variant: MenuVariant;
    breakdown: RecipeCostBreakdown;
  }> = [];

  menus.forEach((menu) => {
    menu.variants.forEach((variant) => {
      const breakdown = calculateVariantCostBreakdown(
        variant,
        menu.name,
        ingredientsMap,
        saucesMap,
        settings,
        activeChannel === 'LINEMAN' ? 'lineman' : 'grab'
      );
      rows.push({ menu, variant, breakdown });
    });
  });

  // Filter & Search
  const filteredRows = rows.filter(({ menu, variant }) => {
    const matchesCategory =
      selectedCategory === 'ALL' || menu.category === selectedCategory;
    const matchesSearch =
      menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.proteinType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sorter
  filteredRows.sort((a, b) => {
    switch (sortOption) {
      case 'MARGIN_ASC':
        return activeChannel === 'DINE_IN'
          ? a.breakdown.restaurantMarginPercent - b.breakdown.restaurantMarginPercent
          : a.breakdown.deliveryMarginPercent - b.breakdown.deliveryMarginPercent;
      case 'MARGIN_DESC':
        return activeChannel === 'DINE_IN'
          ? b.breakdown.restaurantMarginPercent - a.breakdown.restaurantMarginPercent
          : b.breakdown.deliveryMarginPercent - a.breakdown.deliveryMarginPercent;
      case 'FOOD_COST_PCT_DESC':
        return b.breakdown.foodCostPercent - a.breakdown.foodCostPercent;
      case 'FOOD_COST_PCT_ASC':
        return a.breakdown.foodCostPercent - b.breakdown.foodCostPercent;
      case 'PROFIT_DESC':
        return b.breakdown.restaurantProfit - a.breakdown.restaurantProfit;
      case 'PROFIT_ASC':
        return a.breakdown.restaurantProfit - b.breakdown.restaurantProfit;
      default:
        return 0;
    }
  });

  const categories = ['ALL', ...Array.from(new Set(menus.map((m) => m.category)))];

  const handleApplySuggestedPrice = (newDineIn: number, newDelivery: number) => {
    if (!selectedBreakdown) return;
    onUpdateVariantPrice(selectedBreakdown.menu.id, selectedBreakdown.variant.id, {
      sellingPrice: newDineIn,
      takeawayPrice: newDineIn + (settings.takeawayPackagingCost ?? settings.packagingCostTakeaway ?? 5),
      deliveryPrice: newDelivery,
    });
    // Refresh modal
    const updatedVariant = {
      ...selectedBreakdown.variant,
      sellingPrice: newDineIn,
      deliveryPrice: newDelivery,
    };
    const newBd = calculateVariantCostBreakdown(
      updatedVariant,
      selectedBreakdown.menu.name,
      ingredientsMap,
      saucesMap,
      settings
    );
    setSelectedBreakdown({
      menu: selectedBreakdown.menu,
      variant: updatedVariant,
      breakdown: newBd,
    });
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Page Title & Channel Selector */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            วิเคราะห์ต้นทุนและกำไรต่อเมนู (Menu Profitability)
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            เจาะลึก Food Cost %, กำไรหน้าร้าน, กำไร GrabFood / LINE MAN หลังหัก GP ตามที่เจ้าของร้านกำหนด, และแนะนำราคาขาย
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveChannel('DINE_IN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChannel === 'DINE_IN'
                ? 'bg-[#F27D26] text-black shadow-md shadow-[#F27D26]/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            หน้าร้าน (Dine-in)
          </button>
          <button
            type="button"
            onClick={() => setActiveChannel('GRAB')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChannel === 'GRAB'
                ? 'bg-[#F27D26] text-black shadow-md shadow-[#F27D26]/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            GrabFood (GP {getDeliveryCommissionPercent(settings, 'grab')}%)
          </button>
          <button
            type="button"
            onClick={() => setActiveChannel('LINEMAN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeChannel === 'LINEMAN'
                ? 'bg-[#F27D26] text-black shadow-md shadow-[#F27D26]/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            LINE MAN (GP {getDeliveryCommissionPercent(settings, 'lineman')}%)
          </button>
        </div>
      </div>

      {/* Controls & Sorters */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="ค้นหาเมนู, เนื้อสัตว์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#F27D26]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs font-semibold text-white/90 focus:outline-none focus:border-[#F27D26] cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-[#1a1a1a] text-white">
                หมวด: {c === 'ALL' ? 'ทั้งหมด' : c}
              </option>
            ))}
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs font-semibold text-white/90 focus:outline-none focus:border-[#F27D26] cursor-pointer"
          >
            <option value="MARGIN_ASC" className="bg-[#1a1a1a] text-white">⚠️ กำไร % น้อยสุดก่อน (Lowest Margin)</option>
            <option value="MARGIN_DESC" className="bg-[#1a1a1a] text-white">★ กำไร % มากสุดก่อน (Highest Margin)</option>
            <option value="FOOD_COST_PCT_DESC" className="bg-[#1a1a1a] text-white">🔥 Food Cost % สูงสุดก่อน</option>
            <option value="FOOD_COST_PCT_ASC" className="bg-[#1a1a1a] text-white">💧 Food Cost % ต่ำสุดก่อน</option>
            <option value="PROFIT_DESC" className="bg-[#1a1a1a] text-white">💰 กำไรบาทสูงสุดก่อน</option>
            <option value="PROFIT_ASC" className="bg-[#1a1a1a] text-white">🔻 กำไรบาทต่ำสุดก่อน</option>
          </select>
        </div>
      </div>

      {/* PROFITABILITY TABLE */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/50 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">ชื่อเมนู / ชุด</th>
                <th className="py-3 px-3">เนื้อสัตว์/โปรตีน</th>
                <th className="py-3 px-3 text-right">
                  {activeChannel === 'DINE_IN' ? 'ราคาขายหน้าร้าน' : 'ราคาเดลิเวอรี'}
                </th>
                <th className="py-3 px-3 text-right">Food Cost</th>
                <th className="py-3 px-3 text-right">Food Cost %</th>
                <th className="py-3 px-3 text-right">ต้นทุนรวม (+โสหุ้ย)</th>
                <th className="py-3 px-3 text-right">
                  {activeChannel === 'DINE_IN' ? 'กำไรหน้าร้าน' : 'กำไรเดลิเวอรี (สุทธิ)'}
                </th>
                <th className="py-3 px-3 text-right">Margin %</th>
                <th className="py-3 px-4 text-center">ดูสูตร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRows.map(({ menu, variant, breakdown }) => {
                const isLowMargin =
                  activeChannel === 'DINE_IN'
                    ? breakdown.isLowMargin
                    : breakdown.deliveryMarginPercent < 20;

                const displayPrice =
                  activeChannel === 'DINE_IN' ? breakdown.sellingPrice : breakdown.deliveryPrice;
                const displayProfit =
                  activeChannel === 'DINE_IN'
                    ? breakdown.restaurantProfit
                    : breakdown.deliveryProfit;
                const displayMargin =
                  activeChannel === 'DINE_IN'
                    ? breakdown.restaurantMarginPercent
                    : breakdown.deliveryMarginPercent;

                return (
                  <tr
                    key={variant.id}
                    className={`hover:bg-white/10 transition-colors ${
                      isLowMargin ? 'bg-red-500/10' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span>{menu.name}</span>
                        <span className="text-[11px] font-medium text-white/50">
                          ({variant.name})
                        </span>
                        {isLowMargin && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-900 border border-red-500/30">
                            กำไรต่ำ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white/80 border border-white/5">
                        {variant.proteinType}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-white text-sm">
                      ฿{displayPrice.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-[#FFC107] font-bold">
                      ฿{breakdown.totalFoodCost.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                          breakdown.foodCostPercent > 45
                            ? 'bg-red-500/20 text-red-900 border border-red-500/30'
                            : breakdown.foodCostPercent > 35
                            ? 'bg-amber-500/20 text-amber-950 border border-amber-500/30'
                            : 'bg-green-500/20 text-green-950 border border-green-500/30'
                        }`}
                      >
                        {breakdown.foodCostPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-white/60">
                      ฿{breakdown.totalCostWithOverhead.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-sm">
                      <span className={displayProfit >= 25 ? 'text-green-400' : 'text-[#F27D26]'}>
                        ฿{displayProfit.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold">
                      <span className={displayMargin >= 40 ? 'text-green-400' : 'text-white/80'}>
                        {displayMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedBreakdown({ menu, variant, breakdown })}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Calculator className="w-3.5 h-3.5 text-[#F27D26]" />
                        <span>เจาะลึก</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL RECIPE COST BREAKDOWN MODAL */}
      {selectedBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-white/20 text-white">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30">
                    {selectedBreakdown.menu.category}
                  </span>
                  <span className="text-xs font-semibold text-white/50">
                    โปรตีน: {selectedBreakdown.variant.proteinType}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mt-1">
                  {selectedBreakdown.menu.name} - {selectedBreakdown.variant.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBreakdown(null)}
                className="p-1 text-white/50 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="mt-5 space-y-6 text-xs">
              {/* SEAFOOD CALLOUT */}
              {selectedBreakdown.breakdown.isSeafood && (
                <div className="p-4 bg-[#FFC107]/10 border border-[#FFC107]/30 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-[#FFC107] font-bold text-xs uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4 text-[#FFC107]" />
                    <span>เป็นไปตามกฎเหล็กอาหารทะเล (Seafood Rule Compliant)</span>
                  </div>
                  <p className="text-[11px] text-white/80">
                    ระบบแยกคำนวณต้นทุน <span className="font-bold text-[#FFC107]">กุ้งสด</span>{' '}
                    (นับเป็นตัว) และ <span className="font-bold text-[#FFC107]">ปลาหมึก</span>{' '}
                    (นับเป็นกรัมหลัง Yield) ออกจากกันเป็นรายการชัดเจน ไม่มีการยุบรวม
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/10 font-mono text-xs">
                    <div>
                      • ต้นทุนกุ้ง: ฿{selectedBreakdown.breakdown.shrimpCost?.toFixed(2)}
                    </div>
                    <div>
                      • ต้นทุนปลาหมึก: ฿{selectedBreakdown.breakdown.squidCost?.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* DETAILED INGREDIENT LIST WITH COSTS */}
              <div>
                <h3 className="font-bold text-white text-sm mb-2">
                  รายละเอียดวัตถุดิบทุกรายการ (Line Items Traceability)
                </h3>
                <div className="border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-white/50 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">รายการ</th>
                        <th className="py-2.5 px-2">ประเภท</th>
                        <th className="py-2.5 px-2 text-right">ปริมาณใช้</th>
                        <th className="py-2.5 px-2 text-right">ต้นทุน/หน่วย</th>
                        <th className="py-2.5 px-3 text-right">ต้นทุน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {selectedBreakdown.breakdown.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="py-2.5 px-3 font-sans font-semibold text-white">
                            {it.name}
                          </td>
                          <td className="py-2.5 px-2 font-sans text-[10px] text-white/50">
                            {it.type === 'SHRIMP' ? '🦐 กุ้ง (ตัว)' : it.type === 'SQUID' ? '🦑 หมึก (g)' : it.type === 'SAUCE' ? '🥫 ซอส' : '🌾 วัตถุดิบ'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-white/80">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2.5 px-2 text-right text-white/50">
                            ฿{it.unitCost.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#FFC107]">
                            ฿{it.lineCost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-white/5 font-mono font-bold text-white border-t border-white/10">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right">
                          รวมต้นทุนวัตถุดิบ (Food Cost):
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#FFC107] text-sm font-black">
                          ฿{selectedBreakdown.breakdown.totalFoodCost.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-2 px-3 text-right font-normal text-white/50 text-[11px]">
                          + ค่าโสหุ้ยร้าน (Overhead/แก๊ส/น้ำมัน):
                        </td>
                        <td className="py-2 px-3 text-right text-white/80 font-semibold text-xs">
                          ฿{selectedBreakdown.breakdown.overheadCost.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="bg-white/10">
                        <td colSpan={4} className="py-2.5 px-3 text-right font-black">
                          ต้นทุนสุทธิรวมต่อจาน (Total Cost):
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-white text-sm">
                          ฿{selectedBreakdown.breakdown.totalCostWithOverhead.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 2 CHANNELS FINANCIAL SUMMARY STRIP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dine-in box */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                  <div className="font-bold text-white text-xs flex items-center justify-between">
                    <span>หน้าร้าน (Dine-in)</span>
                    <span className="text-base font-black text-white font-mono">
                      ฿{selectedBreakdown.breakdown.sellingPrice}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs pt-2 border-t border-white/10">
                    <div className="flex justify-between text-white/60">
                      <span>ต้นทุนอาหาร:</span>
                      <span>฿{selectedBreakdown.breakdown.totalFoodCost.toFixed(2)} ({selectedBreakdown.breakdown.foodCostPercent.toFixed(1)}%)</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>ค่าโสหุ้ย:</span>
                      <span>฿{selectedBreakdown.breakdown.overheadCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-green-400 pt-1 border-t border-white/10">
                      <span>กำไรหน้าร้าน:</span>
                      <span>฿{selectedBreakdown.breakdown.restaurantProfit.toFixed(2)} ({selectedBreakdown.breakdown.restaurantMarginPercent.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>

                {/* Delivery box */}
                <div className="p-4 bg-[#F27D26]/10 rounded-2xl border border-[#F27D26]/20 space-y-2">
                  <div className="font-bold text-[#F27D26] text-xs flex items-center justify-between">
                    <span>เดลิเวอรี (หัก GP {getDeliveryCommissionPercent(settings, activeChannel === 'LINEMAN' ? 'lineman' : 'grab')}%)</span>
                    <span className="text-base font-black text-[#F27D26] font-mono">
                      ฿{selectedBreakdown.breakdown.deliveryPrice}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs pt-2 border-t border-[#F27D26]/20">
                    <div className="flex justify-between text-white/60">
                      <span>หัก GP {getDeliveryCommissionPercent(settings, activeChannel === 'LINEMAN' ? 'lineman' : 'grab')}%:</span>
                      <span>฿{selectedBreakdown.breakdown.deliveryCommissionFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>ค่ากล่องบรรจุภัณฑ์:</span>
                      <span>฿{selectedBreakdown.breakdown.deliveryPackagingCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-green-400 pt-1 border-t border-[#F27D26]/20">
                      <span>กำไรเดลิเวอรีสุทธิ:</span>
                      <span>฿{selectedBreakdown.breakdown.deliveryProfit.toFixed(2)} ({selectedBreakdown.breakdown.deliveryMarginPercent.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PRICING SUGGESTION ENGINE */}
              <div className="p-5 bg-black/40 border border-white/10 text-white rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F27D26]" />
                    <h4 className="font-bold text-sm text-white">
                      โปรแกรมแนะนำราคาขายอัจฉริยะ (Pricing Advisor)
                    </h4>
                  </div>
                  <span className="text-[11px] text-white/50 font-mono">
                    Food Cost: ฿{selectedBreakdown.breakdown.totalFoodCost.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Mode 1: Target Food Cost % */}
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <div className="text-white/80 font-semibold">
                      อิงเป้าหมาย Food Cost % ({customTargetFcPercent}%)
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="55"
                      step="1"
                      value={customTargetFcPercent}
                      onChange={(e) => setCustomTargetFcPercent(parseInt(e.target.value))}
                      className="w-full accent-[#F27D26] cursor-pointer"
                    />
                    {(() => {
                      const sp = calculateSuggestedPrices(
                        selectedBreakdown.breakdown.totalFoodCost,
                        customTargetFcPercent,
                        customTargetProfit,
                        selectedBreakdown.breakdown.overheadCost,
                        getDeliveryCommissionPercent(settings, activeChannel === 'LINEMAN' ? 'lineman' : 'grab'),
                        selectedBreakdown.breakdown.deliveryPackagingCost
                      );
                      return (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                          <div>
                            <span className="text-white/40 text-[10px]">ราคาหน้าร้านแนะนำ:</span>
                            <div className="font-mono text-base font-bold text-[#F27D26]">
                              ฿{sp.suggestedPriceByFc.toFixed(0)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplySuggestedPrice(
                                Math.round(sp.suggestedPriceByFc),
                                Math.round(sp.suggestedDeliveryPriceByFc)
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#F27D26] hover:bg-[#d96817] text-black font-bold text-[11px] cursor-pointer"
                          >
                            ปรับใช้ราคานี้
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Mode 2: Target Profit in Baht */}
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <div className="text-white/80 font-semibold">
                      อิงเป้าหมายกำไร (฿{customTargetProfit} บาท/จาน)
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={customTargetProfit}
                      onChange={(e) => setCustomTargetProfit(parseInt(e.target.value))}
                      className="w-full accent-[#FFC107] cursor-pointer"
                    />
                    {(() => {
                      const sp = calculateSuggestedPrices(
                        selectedBreakdown.breakdown.totalFoodCost,
                        customTargetFcPercent,
                        customTargetProfit,
                        selectedBreakdown.breakdown.overheadCost,
                        getDeliveryCommissionPercent(settings, activeChannel === 'LINEMAN' ? 'lineman' : 'grab'),
                        selectedBreakdown.breakdown.deliveryPackagingCost
                      );
                      return (
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                          <div>
                            <span className="text-white/40 text-[10px]">ราคาหน้าร้านแนะนำ:</span>
                            <div className="font-mono text-base font-bold text-[#FFC107]">
                              ฿{sp.suggestedPriceByProfit.toFixed(0)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleApplySuggestedPrice(
                                Math.round(sp.suggestedPriceByProfit),
                                Math.round(sp.suggestedDeliveryPriceByProfit)
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#FFC107] hover:bg-[#e0aa06] text-black font-bold text-[11px] cursor-pointer"
                          >
                            ปรับใช้ราคานี้
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBreakdown(null)}
                  className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
