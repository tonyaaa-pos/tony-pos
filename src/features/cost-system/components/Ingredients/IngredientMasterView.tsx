import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  TrendingUp,
  AlertTriangle,
  History,
  Percent,
  Check,
  X,
} from 'lucide-react';
import { Ingredient, UnitType, YieldType, IngredientCategory } from '../../types/domain';
import { calculateUsableQuantity, calculateEffectiveCost } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface IngredientMasterViewProps {
  ingredients: Ingredient[];
  onSaveIngredient: (ingredient: Ingredient) => void;
  onDeleteIngredient: (id: string) => void;
  activeLanguage: 'th' | 'en';
  currency: string;
}

export const IngredientMasterView: React.FC<IngredientMasterViewProps> = ({
  ingredients,
  onSaveIngredient,
  onDeleteIngredient,
  activeLanguage,
  currency,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    code: string;
    thaiName: string;
    englishName: string;
    category: IngredientCategory;
    purchaseUnit: UnitType;
    purchaseQuantity: number;
    purchasePrice: number;
    supplierName: string;
    preparationMethod: string;
    yieldType: YieldType;
    yieldPercent: number;
    minimumStock: number;
    currentStock: number;
  }>({
    code: `ING-${String(ingredients.length + 1).padStart(3, '0')}`,
    thaiName: '',
    englishName: '',
    category: 'Meat & Poultry',
    purchaseUnit: 'kg',
    purchaseQuantity: 1,
    purchasePrice: 100,
    supplierName: '',
    preparationMethod: '',
    yieldType: 'loss',
    yieldPercent: 90,
    minimumStock: 2,
    currentStock: 5,
  });

  const categories: IngredientCategory[] = [
    'Meat & Poultry',
    'Seafood',
    'Vegetables & Herbs',
    'Sauces & Condiments',
    'Dairy & Eggs',
    'Dry Goods & Grains',
    'Oils & Fats',
    'Spices & Seasonings',
    'Packaging',
    'Beverages',
    'Other',
  ];

  const handleOpenAdd = () => {
    setEditingIngredient(null);
    setFormData({
      code: `ING-${String(ingredients.length + 1).padStart(3, '0')}`,
      thaiName: '',
      englishName: '',
      category: 'Meat & Poultry',
      purchaseUnit: 'kg',
      purchaseQuantity: 1,
      purchasePrice: 100,
      supplierName: '',
      preparationMethod: '',
      yieldType: 'loss',
      yieldPercent: 90,
      minimumStock: 2,
      currentStock: 5,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setFormData({
      code: ing.code,
      thaiName: ing.thaiName,
      englishName: ing.englishName,
      category: ing.category,
      purchaseUnit: ing.purchaseUnit,
      purchaseQuantity: ing.purchaseQuantity,
      purchasePrice: ing.purchasePrice,
      supplierName: ing.supplierName || '',
      preparationMethod: ing.preparationMethod || '',
      yieldType: ing.yieldType,
      yieldPercent: ing.yieldPercent,
      minimumStock: ing.minimumStock,
      currentStock: ing.currentStock,
    });
    setIsModalOpen(true);
  };

  // Live calculations for form
  const liveUsableQty = calculateUsableQuantity(formData.purchaseQuantity, formData.yieldPercent);
  const liveEffectiveCost = calculateEffectiveCost(formData.purchasePrice, liveUsableQty);
  const liveCostPerBase = formData.purchaseUnit === 'kg' || formData.purchaseUnit === 'l'
    ? liveEffectiveCost / 1000
    : liveEffectiveCost;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.thaiName.trim()) return;

    const usableQuantity = liveUsableQty;
    const effectiveCost = liveEffectiveCost;
    const costPerBaseUnit = liveCostPerBase;

    const newIng: Ingredient = {
      id: editingIngredient ? editingIngredient.id : `ing-${Date.now()}`,
      code: formData.code,
      thaiName: formData.thaiName,
      englishName: formData.englishName || formData.thaiName,
      category: formData.category,
      purchaseUnit: formData.purchaseUnit,
      purchaseQuantity: formData.purchaseQuantity,
      purchasePrice: formData.purchasePrice,
      supplierName: formData.supplierName,
      preparationMethod: formData.preparationMethod,
      yieldType: formData.yieldPercent > 100 ? 'absorption' : formData.yieldType,
      yieldPercent: formData.yieldPercent,
      usableQuantity,
      effectiveCost,
      baseUnit: formData.purchaseUnit === 'l' || formData.purchaseUnit === 'ml' ? 'ml' : formData.purchaseUnit === 'egg' ? 'egg' : 'g',
      costPerBaseUnit,
      minimumStock: formData.minimumStock,
      currentStock: formData.currentStock,
      active: true,
      priceHistory: editingIngredient
        ? [
            ...editingIngredient.priceHistory,
            ...(editingIngredient.purchasePrice !== formData.purchasePrice
              ? [
                  {
                    id: `ph-${Date.now()}`,
                    date: new Date().toISOString().split('T')[0],
                    price: formData.purchasePrice,
                    quantity: formData.purchaseQuantity,
                    unit: formData.purchaseUnit,
                    supplierName: formData.supplierName,
                  },
                ]
              : []),
          ]
        : [
            {
              id: `ph-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              price: formData.purchasePrice,
              quantity: formData.purchaseQuantity,
              unit: formData.purchaseUnit,
              supplierName: formData.supplierName,
            },
          ],
      createdAt: editingIngredient ? editingIngredient.createdAt : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSaveIngredient(newIng);
    setIsModalOpen(false);
  };

  const filteredIngredients = ingredients.filter((ing) => {
    const matchesSearch =
      ing.thaiName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || ing.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
              Inventory & Yield Engine
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'ทะเบียนวัตถุดิบ & ต้นทุนที่แท้จริง' : 'Ingredient Master & Usable Yield'}</span>
            <span className="text-xs font-mono font-normal bg-white/5 text-white/60 px-2.5 py-0.5 rounded-full border border-white/10">
              {ingredients.length} {activeLanguage === 'th' ? 'รายการ' : 'items'}
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'คำนวณต้นทุนต่อหน่วยที่ใช้ได้จริงหลังหักการสูญเสียจากการตัดแต่ง หรือการดูดซึมน้ำ'
              : 'Calculate real usable cost per unit after trimming loss or cooking water absorption.'}
          </p>
        </div>

        <button
          id="btn-add-ingredient"
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{activeLanguage === 'th' ? 'เพิ่มวัตถุดิบใหม่' : 'Add Ingredient'}</span>
        </button>
      </div>

      {/* Filter and Search Box */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-[#151518] p-3 rounded-xl border border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeLanguage === 'th' ? 'ค้นหาชื่อวัตถุดิบ รหัส หรือซัพพลายเออร์...' : 'Search by name, code, supplier...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-white/10 bg-[#0F0F11] text-white focus:outline-none focus:border-[#FF6321] placeholder:text-white/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/40" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded-lg border border-white/10 py-1.5 px-2.5 focus:outline-none focus:border-[#FF6321] bg-[#0F0F11] text-white"
          >
            <option value="ALL">{activeLanguage === 'th' ? 'ทุกหมวดหมู่ (All Categories)' : 'All Categories'}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Ingredient Table */}
      <div className="rounded-xl border border-white/5 bg-[#151518] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/30 font-normal uppercase tracking-tighter text-xs">
                <th className="py-3 px-3.5">รหัส / ชื่อวัตถุดิบ</th>
                <th className="py-3 px-3">หมวดหมู่</th>
                <th className="py-3 px-3 text-right">ราคาซื้อ (฿)</th>
                <th className="py-3 px-3 text-right">Yield %</th>
                <th className="py-3 px-3 text-right">ปริมาณใช้ได้จริง</th>
                <th className="py-3 px-3 text-right">ต้นทุนจริง (Effective Cost)</th>
                <th className="py-3 px-3 text-right">ต้นทุนฐาน (ต่อ g/ml)</th>
                <th className="py-3 px-3">ซัพพลายเออร์</th>
                <th className="py-3 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80 font-mono">
              {filteredIngredients.map((ing) => {
                const isExpansion = ing.yieldPercent > 100;
                return (
                  <tr key={ing.id} className="hover:bg-white/[0.02] transition-colors">
                    <td
                      className="py-3 px-3.5 font-sans cursor-pointer select-none"
                      onDoubleClick={() => handleOpenEdit(ing)}
                      title="ดับเบิลคลิกเพื่อแก้ไขข้อมูลวัตถุดิบ"
                    >
                      <div className="font-semibold text-white hover:text-[#F27D26] hover:underline transition-colors">{ing.thaiName}</div>
                      <div className="text-[11px] text-white/30 font-mono flex items-center gap-1.5">
                        <span>{ing.code}</span>
                        {ing.englishName && <span className="text-white/30">· {ing.englishName}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-white/5 text-white/60 border border-white/5">
                        {ing.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white/70">
                      ฿{ing.purchasePrice.toFixed(2)} / {ing.purchaseQuantity} {ing.purchaseUnit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          isExpansion
                            ? 'bg-[#00B1FF]/10 text-[#00B1FF] border border-[#00B1FF]/20'
                            : ing.yieldPercent < 70
                            ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20'
                            : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'
                        }`}
                        title={isExpansion ? 'Yield การดูดซึมน้ำ (>100%)' : 'Yield การตัดแต่ง'}
                      >
                        {ing.yieldPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white/60">
                      {ing.usableQuantity.toFixed(2)} {ing.purchaseUnit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ฿{ing.effectiveCost.toFixed(2)} / {ing.purchaseUnit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#10B981]">
                      ฿{ing.costPerBaseUnit.toFixed(4)} /{ing.baseUnit}
                    </td>
                    <td className="py-3 px-3 text-white/40 text-[11px] font-sans">{ing.supplierName || '-'}</td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ing)}
                          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                          title="แก้ไข"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteIngredient(ing.id)}
                          className="p-1.5 text-white/30 hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-colors cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Ingredient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl bg-[#151518] p-6 border border-white/10 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-white">
                {editingIngredient ? 'แก้ไขข้อมูลวัตถุดิบ (Edit Ingredient)' : 'เพิ่มวัตถุดิบใหม่ (Add Ingredient)'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">รหัสวัตถุดิบ</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">หมวดหมู่</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อภาษาไทย *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น อกไก่สดลอกหนัง"
                    value={formData.thaiName}
                    onChange={(e) => setFormData({ ...formData, thaiName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none placeholder:text-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อภาษาอังกฤษ</label>
                  <input
                    type="text"
                    placeholder="e.g. Fresh Chicken Breast"
                    value={formData.englishName}
                    onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none placeholder:text-white/20"
                  />
                </div>
              </div>

              {/* Purchase Details */}
              <div className="grid grid-cols-3 gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                <div>
                  <label className="block text-xs text-white/60 mb-1">หน่วยที่ซื้อ (Unit)</label>
                  <select
                    value={formData.purchaseUnit}
                    onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value as any })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="kg">กิโลกรัม (kg)</option>
                    <option value="g">กรัม (g)</option>
                    <option value="l">ลิตร (L)</option>
                    <option value="ml">มิลลิลิตร (ml)</option>
                    <option value="egg">ฟอง (egg)</option>
                    <option value="piece">ชิ้น / หัว (piece)</option>
                    <option value="pack">แพ็ค (pack)</option>
                    <option value="bottle">ขวด (bottle)</option>
                    <option value="box">กล่อง (box)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">ปริมาณที่ซื้อ</label>
                  <NumericInput
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    value={formData.purchaseQuantity}
                    onChange={(e) => setFormData({ ...formData, purchaseQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">ราคาซื้อรวม (฿)</label>
                  <NumericInput
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              {/* Yield Configuration */}
              <div className="bg-[#10B981]/10 p-3.5 rounded-xl border border-[#10B981]/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5" />
                    <span>Yield การใช้งาน (%)</span>
                  </label>
                  <span className="text-[11px] text-[#10B981] font-medium">
                    {formData.yieldPercent > 100 ? '⚡ การดูดซึมน้ำ/การขยายตัว (>100%)' : '🔪 การตัดแต่ง/การสูญเสีย (<=100%)'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <NumericInput
                    type="number"
                    step="any"
                    required
                    min="1"
                    max="500"
                    value={formData.yieldPercent}
                    onChange={(e) => setFormData({ ...formData, yieldPercent: parseFloat(e.target.value) || 0 })}
                    className="w-32 rounded-lg border border-[#10B981]/30 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono font-bold text-[#10B981]"
                  />
                  <span className="text-xs text-white/50">
                    (เช่น 92% สำหรับอกไก่, 240% สำหรับเส้นแห้งต้มสุก)
                  </span>
                </div>

                {/* Calculation Preview Banner */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs font-mono">
                  <div>
                    <div className="text-[11px] text-white/40 font-sans">ปริมาณใช้ได้จริง</div>
                    <div className="font-bold text-white">{liveUsableQty.toFixed(2)} {formData.purchaseUnit}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/40 font-sans">ต้นทุนจริง (Effective)</div>
                    <div className="font-bold text-[#10B981]">฿{liveEffectiveCost.toFixed(2)} /{formData.purchaseUnit}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/40 font-sans">ต้นทุนฐาน (ต่อ g/ml)</div>
                    <div className="font-bold text-white">฿{liveCostPerBase.toFixed(4)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ซัพพลายเออร์</label>
                  <input
                    type="text"
                    placeholder="เช่น Betagro, Makro, ตลาดไท"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">วิธีเตรียมวัตถุดิบ</label>
                  <input
                    type="text"
                    placeholder="เช่น ตัดแต่งเอ็น, ลวกสุก"
                    value={formData.preparationMethod}
                    onChange={(e) => setFormData({ ...formData, preparationMethod: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                  />
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
                  className="rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
