import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, DollarSign, Percent, ArrowRight, Save, Scale } from 'lucide-react';
import { Ingredient, SubRecipe, MenuItem, PortionSize, UnitType } from '../../types/domain';
import { calculatePortionCost, calculateTargetPriceFromCost } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface RecipeBuilderViewProps {
  ingredients: Ingredient[];
  subRecipes: SubRecipe[];
  onSaveToMenu?: (menuItem: Partial<MenuItem>) => void;
  activeLanguage: 'th' | 'en';
}

export const RecipeBuilderView: React.FC<RecipeBuilderViewProps> = ({
  ingredients,
  subRecipes,
  onSaveToMenu,
  activeLanguage,
}) => {
  const [recipeName, setRecipeName] = useState('ข้าวผัดกะเพราเนื้อวากิวไข่ดาว (ทดลอง)');
  const [category, setCategory] = useState('A La Carte');
  const [sellingPrice, setSellingPrice] = useState<number>(189);
  const [packagingCost, setPackagingCost] = useState<number>(5.5);
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState<number>(30);

  // Raw Ingredient items in recipe
  const [rawItems, setRawItems] = useState<{
    id: string;
    ingredientId: string;
    quantity: number;
    unit: UnitType;
  }[]>([
    { id: '1', ingredientId: ingredients[0]?.id || '', quantity: 150, unit: 'g' },
    { id: '2', ingredientId: ingredients[4]?.id || '', quantity: 1, unit: 'egg' },
    { id: '3', ingredientId: ingredients[5]?.id || '', quantity: 180, unit: 'g' },
    { id: '4', ingredientId: ingredients[6]?.id || '', quantity: 20, unit: 'g' },
  ]);

  // Sub-Recipe / Sauce items in recipe
  const [subItems, setSubItems] = useState<{
    id: string;
    subRecipeId: string;
    quantity: number;
    unit: UnitType;
  }>([
    { id: 'sub-1', subRecipeId: subRecipes[0]?.id || '', quantity: 30, unit: 'ml' },
  ]);

  const handleAddRawItem = () => {
    setRawItems([
      ...rawItems,
      { id: `raw-${Date.now()}`, ingredientId: ingredients[0]?.id || '', quantity: 50, unit: 'g' },
    ]);
  };

  const handleRemoveRawItem = (id: string) => {
    setRawItems(rawItems.filter((i) => i.id !== id));
  };

  const handleAddSubItem = () => {
    if (subRecipes.length === 0) return;
    setSubItems([
      ...subItems,
      { id: `sub-${Date.now()}`, subRecipeId: subRecipes[0]?.id || '', quantity: 20, unit: 'ml' },
    ]);
  };

  const handleRemoveSubItem = (id: string) => {
    setSubItems(subItems.filter((i) => i.id !== id));
  };

  // Calculate Direct Food Cost from Raw Ingredients
  const rawCostDetails = rawItems.map((it) => {
    const ing = ingredients.find((i) => i.id === it.ingredientId);
    const baseCost = ing ? ing.costPerBaseUnit : 0;
    let cost = 0;
    if (it.unit === 'kg' || it.unit === 'l') {
      cost = baseCost * it.quantity * 1000;
    } else {
      cost = baseCost * it.quantity;
    }
    return { ...it, name: ing?.thaiName || 'Unknown', cost };
  });

  // Calculate Direct Food Cost from Sub Recipes / Sauces
  const subCostDetails = subItems.map((it) => {
    const sub = subRecipes.find((s) => s.id === it.subRecipeId);
    const unitCost = sub ? sub.costPerFinalUnit : 0;
    let cost = 0;
    if (it.unit === 'kg' || it.unit === 'l') {
      cost = unitCost * it.quantity * 1000;
    } else {
      cost = unitCost * it.quantity;
    }
    return { ...it, name: sub?.thaiName || 'Unknown', cost };
  });

  const totalRawCost = rawCostDetails.reduce((sum, i) => sum + i.cost, 0);
  const totalSubCost = subCostDetails.reduce((sum, i) => sum + i.cost, 0);
  const directFoodCost = totalRawCost + totalSubCost;
  const totalDirectCost = directFoodCost + packagingCost;

  const actualFoodCostPercent = sellingPrice > 0 ? (directFoodCost / sellingPrice) * 100 : 0;
  const actualTotalCostPercent = sellingPrice > 0 ? (totalDirectCost / sellingPrice) * 100 : 0;
  const contributionMargin = sellingPrice - totalDirectCost;
  const grossMarginPercent = sellingPrice > 0 ? (contributionMargin / sellingPrice) * 100 : 0;

  // Suggested Selling Prices based on target food cost %
  const suggestedPriceAtTarget = calculateTargetPriceFromCost(directFoodCost, targetFoodCostPercent);
  const suggestedPriceAt30 = calculateTargetPriceFromCost(directFoodCost, 30);
  const suggestedPriceAt35 = calculateTargetPriceFromCost(directFoodCost, 35);
  const suggestedPriceAt40 = calculateTargetPriceFromCost(directFoodCost, 40);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF6321] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6321]">
              Recipe Formulation & Yield Sandbox
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'ตัวสร้างสูตรอาหาร & ทดลองต้นทุน (Recipe Cost Builder)' : 'Recipe Cost Builder'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'คำนวณต้นทุนต่อจานแบบ Real-Time จากวัตถุดิบดิบและซอสปรุงสำเร็จ พร้อมแนะนำราคาขายที่เหมาะสม'
              : 'Interactive recipe sandbox to formulate dishes and see instant food cost %, margins, and suggested pricing.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Recipe Formulation Canvas */}
        <div className="lg:col-span-2 space-y-5">
          {/* Dish Header Info */}
          <div className="bg-[#151518] p-4 rounded-xl border border-white/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">ชื่อเมนู (Menu Name)</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-semibold text-white focus:border-[#FF6321] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1">หมวดหมู่ (Category)</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 1. Raw Ingredients Box */}
          <div className="bg-[#151518] p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <span>1. วัตถุดิบดิบ (Raw Materials & Proteins)</span>
                <span className="text-[11px] font-normal text-white/30">({rawItems.length} รายการ)</span>
              </h2>
              <button
                type="button"
                onClick={handleAddRawItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#10B981] hover:text-[#10B981]/80 bg-[#10B981]/10 px-2.5 py-1 rounded-lg border border-[#10B981]/20 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>เพิ่มวัตถุดิบ</span>
              </button>
            </div>

            <div className="space-y-2">
              {rawCostDetails.map((it, idx) => (
                <div key={`${it.id}-${idx}`} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5 text-xs">
                  <select
                    value={it.ingredientId}
                    onChange={(e) => {
                      const updated = rawItems.map((r) =>
                        r.id === it.id ? { ...r, ingredientId: e.target.value } : r
                      );
                      setRawItems(updated);
                    }}
                    className="flex-1 rounded border border-white/10 px-2 py-1 text-xs bg-[#0F0F11] text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.thaiName}
                      </option>
                    ))}
                  </select>

                  <NumericInput
                    type="number"
                    step="any"
                    min="0.1"
                    value={it.quantity}
                    onChange={(e) => {
                      const updated = rawItems.map((r) =>
                        r.id === it.id ? { ...r, quantity: parseFloat(e.target.value) || 0 } : r
                      );
                      setRawItems(updated);
                    }}
                    className="w-20 rounded border border-white/10 px-2 py-1 text-xs bg-[#0F0F11] text-white font-mono focus:border-[#FF6321] focus:outline-none"
                  />

                  <select
                    value={it.unit}
                    onChange={(e) => {
                      const updated = rawItems.map((r) =>
                        r.id === it.id ? { ...r, unit: e.target.value as any } : r
                      );
                      setRawItems(updated);
                    }}
                    className="w-16 rounded border border-white/10 px-1.5 py-1 text-xs bg-[#0F0F11] text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                    <option value="egg">egg</option>
                    <option value="piece">pc</option>
                  </select>

                  <div className="w-24 text-right font-mono font-bold text-white">
                    ฿{it.cost.toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveRawItem(it.id)}
                    className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Sub-Recipes & Sauces Box */}
          <div className="bg-[#151518] p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <span>2. ซอส & วัตถุดิบเตรียมพร้อมใช้ (Sub-Recipes & Sauces)</span>
                <span className="text-[11px] font-normal text-white/30">({subItems.length} รายการ)</span>
              </h2>
              <button
                type="button"
                onClick={handleAddSubItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#10B981] hover:text-[#10B981]/80 bg-[#10B981]/10 px-2.5 py-1 rounded-lg border border-[#10B981]/20 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>เพิ่มซอส</span>
              </button>
            </div>

            <div className="space-y-2">
              {subCostDetails.map((it, idx) => (
                <div key={`${it.id}-${idx}`} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5 text-xs">
                  <select
                    value={it.subRecipeId}
                    onChange={(e) => {
                      const updated = subItems.map((r) =>
                        r.id === it.id ? { ...r, subRecipeId: e.target.value } : r
                      );
                      setSubItems(updated);
                    }}
                    className="flex-1 rounded border border-white/10 px-2 py-1 text-xs bg-[#0F0F11] text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    {subRecipes.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.thaiName}
                      </option>
                    ))}
                  </select>

                  <NumericInput
                    type="number"
                    step="any"
                    min="0.1"
                    value={it.quantity}
                    onChange={(e) => {
                      const updated = subItems.map((r) =>
                        r.id === it.id ? { ...r, quantity: parseFloat(e.target.value) || 0 } : r
                      );
                      setSubItems(updated);
                    }}
                    className="w-20 rounded border border-white/10 px-2 py-1 text-xs bg-[#0F0F11] text-white font-mono focus:border-[#FF6321] focus:outline-none"
                  />

                  <select
                    value={it.unit}
                    onChange={(e) => {
                      const updated = subItems.map((r) =>
                        r.id === it.id ? { ...r, unit: e.target.value as any } : r
                      );
                      setSubItems(updated);
                    }}
                    className="w-16 rounded border border-white/10 px-1.5 py-1 text-xs bg-[#0F0F11] text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="portion">portion</option>
                  </select>

                  <div className="w-24 text-right font-mono font-bold text-white">
                    ฿{it.cost.toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSubItem(it.id)}
                    className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Real-time Costing & Price Recommendation Panel */}
        <div className="space-y-5">
          <div className="rounded-xl border border-white/5 bg-[#151518] p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 border-b border-white/5 pb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#10B981]" />
              <span>สรุปต้นทุน & แนะนำราคาขาย</span>
            </h2>

            {/* Direct Costs Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>ต้นทุนวัตถุดิบดิบ:</span>
                <span className="font-mono font-bold text-white">฿{totalRawCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>ต้นทุนซอส/สูตรเตรียม:</span>
                <span className="font-mono font-bold text-white">฿{totalSubCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-bold pt-1.5 border-t border-white/5">
                <span>ต้นทุนอาหารทางตรง (Food Cost):</span>
                <span className="font-mono text-[#10B981] text-sm">฿{directFoodCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-white/60 pt-1">
                <span>ค่ากล่อง/บรรจุภัณฑ์:</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white/40">฿</span>
                  <NumericInput
                    type="number"
                    step="any"
                    min="0"
                    value={packagingCost}
                    onChange={(e) => setPackagingCost(parseFloat(e.target.value) || 0)}
                    className="w-16 rounded border border-white/10 bg-[#0F0F11] px-1.5 py-0.5 text-xs text-right font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-between text-white font-bold pt-1.5 border-t border-white/5">
                <span>ต้นทุนทางตรงรวม:</span>
                <span className="font-mono text-white">฿{totalDirectCost.toFixed(2)}</span>
              </div>
            </div>

            {/* Selling Price Input & Resulting Food Cost % */}
            <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  กำหนดราคาขายทดสอบ (Selling Price ฿)
                </label>
                <NumericInput
                  type="number"
                  step="any"
                  min="1"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-base font-bold font-mono text-white focus:border-[#FF6321] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-center font-mono">
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="text-[10px] text-white/40 font-sans">% Food Cost</div>
                  <div className={`text-base font-bold ${
                    actualFoodCostPercent > 35 ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`}>
                    {actualFoodCostPercent.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="text-[10px] text-white/40 font-sans">กำไรส่วนเกินต่อจาน</div>
                  <div className="text-base font-bold text-white">
                    ฿{contributionMargin.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Suggested Pricing Matrix */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-white/70">
                ราคาขายที่แนะนำตามเป้าหมาย % Food Cost:
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between p-2 rounded-lg bg-[#10B981]/10 text-[#10B981] font-bold border border-[#10B981]/20">
                  <span>เป้าหมาย 30% Food Cost:</span>
                  <span>฿{suggestedPriceAt30}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/5 text-white/70 border border-white/5">
                  <span>เป้าหมาย 35% Food Cost:</span>
                  <span>฿{suggestedPriceAt35}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-white/5 text-white/70 border border-white/5">
                  <span>เป้าหมาย 40% Food Cost:</span>
                  <span>฿{suggestedPriceAt40}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
