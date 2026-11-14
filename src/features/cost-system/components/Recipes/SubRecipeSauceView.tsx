import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Layers, Search, Check, X, ArrowUpRight, Scale } from 'lucide-react';
import { SubRecipe, Ingredient, SubRecipeItem, RecipeItem, UnitType } from '../../types/domain';
import { calculateSubRecipeBatchCost } from '../../engine/calculations';

interface SubRecipeSauceViewProps {
  subRecipes: SubRecipe[];
  ingredients: Ingredient[];
  onSaveSubRecipe: (subRecipe: SubRecipe) => void;
  onDeleteSubRecipe: (id: string) => void;
  activeLanguage: 'th' | 'en';
}

export const SubRecipeSauceView: React.FC<SubRecipeSauceViewProps> = ({
  subRecipes,
  ingredients,
  onSaveSubRecipe,
  onDeleteSubRecipe,
  activeLanguage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubRecipe, setEditingSubRecipe] = useState<SubRecipe | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    code: string;
    thaiName: string;
    englishName: string;
    category: string;
    outputUnit: UnitType;
    preparationYieldPercent: number;
    notes: string;
    items: {
      ingredientId: string;
      quantity: number;
      unit: UnitType;
    }[];
  }>({
    code: `SUB-${String(subRecipes.length + 1).padStart(3, '0')}`,
    thaiName: '',
    englishName: '',
    category: 'Sauce',
    outputUnit: 'ml',
    preparationYieldPercent: 96,
    notes: '',
    items: [
      { ingredientId: ingredients[0]?.id || '', quantity: 100, unit: 'g' },
    ],
  });

  const handleOpenAdd = () => {
    setEditingSubRecipe(null);
    setFormData({
      code: `SUB-${String(subRecipes.length + 1).padStart(3, '0')}`,
      thaiName: '',
      englishName: '',
      category: 'Sauce',
      outputUnit: 'ml',
      preparationYieldPercent: 96,
      notes: '',
      items: [
        { ingredientId: ingredients[0]?.id || '', quantity: 100, unit: 'g' },
      ],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: SubRecipe) => {
    setEditingSubRecipe(sub);
    setFormData({
      code: sub.code,
      thaiName: sub.thaiName,
      englishName: sub.englishName,
      category: sub.category,
      outputUnit: sub.outputUnit,
      preparationYieldPercent: sub.preparationYieldPercent,
      notes: sub.notes || '',
      items: sub.items.map((it) => ({
        ingredientId: it.ingredientId,
        quantity: it.quantity,
        unit: it.unit,
      })),
    });
    setIsModalOpen(true);
  };

  // Add Item row to recipe
  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { ingredientId: ingredients[0]?.id || '', quantity: 50, unit: 'g' },
      ],
    });
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  };

  // Live Batch Calculation
  const liveItemsWithCost: SubRecipeItem[] = formData.items.map((it, idx) => {
    const ing = ingredients.find((i) => i.id === it.ingredientId);
    const baseCost = ing ? ing.costPerBaseUnit : 0;
    // Calculate direct item cost
    let itemCost = 0;
    if (it.unit === 'kg' || it.unit === 'l') {
      itemCost = baseCost * it.quantity * 1000;
    } else {
      itemCost = baseCost * it.quantity;
    }

    return {
      id: `item-${idx}`,
      ingredientId: it.ingredientId,
      ingredientName: ing ? ing.thaiName : 'Unknown',
      quantity: it.quantity,
      unit: it.unit,
      unitCost: baseCost,
      extendedCost: itemCost,
    };
  });

  const totalRawQuantity = formData.items.reduce((sum, it) => {
    return sum + (it.unit === 'kg' || it.unit === 'l' ? it.quantity * 1000 : it.quantity);
  }, 0);

  const finalOutputQuantity = totalRawQuantity * (formData.preparationYieldPercent / 100);
  const totalBatchCost = liveItemsWithCost.reduce((sum, it) => sum + it.extendedCost, 0);
  const costPerFinalUnit = finalOutputQuantity > 0 ? totalBatchCost / finalOutputQuantity : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.thaiName.trim()) return;

    const subRecipeToSave: SubRecipe = {
      id: editingSubRecipe ? editingSubRecipe.id : `sub-${Date.now()}`,
      code: formData.code,
      thaiName: formData.thaiName,
      englishName: formData.englishName || formData.thaiName,
      category: formData.category,
      items: liveItemsWithCost,
      batchQuantity: totalRawQuantity,
      preparationYieldPercent: formData.preparationYieldPercent,
      finalBatchQuantity: finalOutputQuantity,
      outputUnit: formData.outputUnit,
      batchCost: totalBatchCost,
      costPerFinalUnit,
      notes: formData.notes,
      active: true,
      dependentMenuIds: editingSubRecipe ? editingSubRecipe.dependentMenuIds : [],
      createdAt: editingSubRecipe ? editingSubRecipe.createdAt : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSaveSubRecipe(subRecipeToSave);
    setIsModalOpen(false);
  };

  const filteredSubRecipes = subRecipes.filter((s) =>
    s.thaiName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
              Prep & Sauce Batches
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'ซอส & วัตถุดิบเตรียมพร้อมใช้ (Sub-Recipes & Sauces)' : 'Sub-Recipes & Sauces'}</span>
            <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-0.5 rounded-full border border-[#10B981]/20">
              {subRecipes.length} {activeLanguage === 'th' ? 'สูตร' : 'batches'}
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'คำนวณต้นทุนซอสที่ปรุงเป็นแบทช์ใหญ่ พร้อมหัก Yield การเคี่ยว/ลดทอน เพื่อนำไปใช้เป็นส่วนผสมในเมนูขาย'
              : 'Calculate master sauce batch costs with cooking reduction yield for menu costing.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{activeLanguage === 'th' ? 'สร้างสูตรซอส/เตรียมใหม่' : 'New Sub-Recipe'}</span>
        </button>
      </div>

      {/* Sub Recipes List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSubRecipes.map((sub) => (
          <div
            key={sub.id}
            className="rounded-xl border border-white/5 bg-[#151518] p-5 hover:border-white/15 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-white/40">{sub.code}</div>
                  <h3 className="text-base font-semibold text-white mt-0.5">{sub.thaiName}</h3>
                  {sub.englishName && <div className="text-xs text-white/50">{sub.englishName}</div>}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(sub)}
                    className="p-1 text-white/40 hover:text-white rounded cursor-pointer"
                    title="แก้ไข"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSubRecipe(sub.id)}
                    className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                    title="ลบ"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Items List in Sub Recipe */}
              <div className="mt-3 space-y-1 bg-white/5 p-2.5 rounded-lg border border-white/5 text-xs">
                <div className="text-[11px] font-semibold text-white/50 mb-1">
                  ส่วนผสม ({sub.items.length} รายการ):
                </div>
                {sub.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-white/70">
                    <span>• {it.name}</span>
                    <span className="font-mono text-white/40">
                      {it.quantity} {it.unit} (฿{it.totalCost.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics Footer */}
            <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-xs font-mono">
              <div>
                <div className="text-[10px] text-white/40 font-sans">ผลลัพธ์แบทช์</div>
                <div className="font-bold text-white">{sub.finalBatchQuantity.toLocaleString()} {sub.outputUnit}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40 font-sans">ต้นทุนรวมแบทช์</div>
                <div className="font-bold text-white">฿{sub.batchCost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40 font-sans">ต้นทุนต่อหน่วย</div>
                <div className="font-bold text-[#10B981]">฿{sub.costPerFinalUnit.toFixed(4)} /{sub.outputUnit}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Sub-Recipe Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-[#151518] p-6 border border-white/10 text-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-white">
                {editingSubRecipe ? 'แก้ไขสูตรซอส/วัตถุดิบเตรียม' : 'สร้างสูตรซอส/วัตถุดิบเตรียม (Sub-Recipe)'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">รหัสสูตร</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">หน่วยผลลัพธ์ (Output Unit)</label>
                  <select
                    value={formData.outputUnit}
                    onChange={(e) => setFormData({ ...formData, outputUnit: e.target.value as any })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    <option value="ml">มิลลิลิตร (ml)</option>
                    <option value="g">กรัม (g)</option>
                    <option value="l">ลิตร (L)</option>
                    <option value="kg">กิโลกรัม (kg)</option>
                    <option value="portion">พอร์ชั่น (portion)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อซอส/สูตรเตรียม (ภาษาไทย) *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ซอสผัดกะเพราสูตรลับ"
                    value={formData.thaiName}
                    onChange={(e) => setFormData({ ...formData, thaiName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อภาษาอังกฤษ</label>
                  <input
                    type="text"
                    placeholder="e.g. Signature Holy Basil Sauce"
                    value={formData.englishName}
                    onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
              </div>

              {/* Recipe Items Matrix */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/80">รายการวัตถุดิบในแบทช์:</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#10B981] hover:text-[#10B981]/80 bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>เพิ่มวัตถุดิบ</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {formData.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#0F0F11] p-2 rounded-lg border border-white/10 text-xs">
                      <select
                        value={it.ingredientId}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].ingredientId = e.target.value;
                          setFormData({ ...formData, items: updated });
                        }}
                        className="flex-1 rounded border border-white/10 bg-[#151518] text-white px-2 py-1 text-xs focus:border-[#FF6321] focus:outline-none"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.thaiName}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={it.quantity}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].quantity = parseFloat(e.target.value) || 0;
                          setFormData({ ...formData, items: updated });
                        }}
                        className="w-20 rounded border border-white/10 bg-[#151518] text-white px-2 py-1 text-xs font-mono focus:border-[#FF6321] focus:outline-none"
                      />

                      <select
                        value={it.unit}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].unit = e.target.value as any;
                          setFormData({ ...formData, items: updated });
                        }}
                        className="w-16 rounded border border-white/10 bg-[#151518] text-white px-1.5 py-1 text-xs focus:border-[#FF6321] focus:outline-none"
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="kg">kg</option>
                        <option value="l">l</option>
                        <option value="egg">egg</option>
                        <option value="piece">pc</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Yield & Final Batch Cost Preview */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/80">Yield การเคี่ยว/เตรียม (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.preparationYieldPercent}
                    onChange={(e) => setFormData({ ...formData, preparationYieldPercent: parseFloat(e.target.value) || 0 })}
                    className="w-24 rounded border border-white/10 bg-[#0F0F11] px-2 py-1 text-xs font-mono font-bold text-[#10B981] focus:border-[#FF6321] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-white/40 font-sans">ปริมาณแบทช์สุทธิ</div>
                    <div className="font-bold text-white">{finalOutputQuantity.toFixed(1)} {formData.outputUnit}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 font-sans">ต้นทุนรวมทั้งหม้อ</div>
                    <div className="font-bold text-white">฿{totalBatchCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 font-sans">ต้นทุนต่อหน่วยผลลัพธ์</div>
                    <div className="font-bold text-[#10B981]">฿{costPerFinalUnit.toFixed(4)} /{formData.outputUnit}</div>
                  </div>
                </div>
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
                  className="rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  บันทึกสูตรซอส
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
