import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  ChevronRight,
  Edit2,
  Trash2,
  Info,
  X,
} from 'lucide-react';
import { Sauce, Ingredient, SauceRecipeItem } from '../types';
import { calculateSauceCost } from '../services/calculationEngine';

interface SaucesViewProps {
  sauces: Sauce[];
  ingredients: Ingredient[];
  onSaveSauce: (sauce: Sauce) => void;
}

export const SaucesView: React.FC<SaucesViewProps> = ({
  sauces,
  ingredients,
  onSaveSauce,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSauce, setSelectedSauce] = useState<Sauce | null>(sauces[0] || null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSauce, setEditingSauce] = useState<Partial<Sauce> | null>(null);

  const ingredientsMap = new Map<string, Ingredient>(ingredients.map((i) => [i.id, i]));

  const filteredSauces = sauces.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    const newSauce: Partial<Sauce> = {
      id: `sauce_${Date.now()}`,
      name: '',
      category: 'ซอสปรุงรส',
      productionQuantity: 1000,
      productionUnit: 'g',
      yieldPercent: 100,
      actualQuantity: 1000,
      productionCost: 0,
      actualCost: 0,
      costPerGram: 0,
      items: [],
      active: true,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingSauce(newSauce);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (sauce: Sauce) => {
    setEditingSauce({ ...sauce, items: [...sauce.items] });
    setIsEditModalOpen(true);
  };

  const [sauceItemCategoryOverrides, setSauceItemCategoryOverrides] = useState<Record<number, string>>({});

  const uniqueCategories = React.useMemo(() => {
    const defaultOrder = [
      'เนื้อสัตว์และอาหารทะเล',
      'ผักและสมุนไพร',
      'เครื่องปรุงและซอส',
      'ข้าวและเส้น',
      'ไข่และเต้าหู้',
      'ของแห้งและเบ็ดเตล็ด',
      'บรรจุภัณฑ์',
    ];
    const set = new Set<string>();
    ingredients.forEach((ing) => {
      if (ing.category) set.add(ing.category);
    });
    const ordered: string[] = [];
    defaultOrder.forEach((cat) => {
      if (set.has(cat)) {
        ordered.push(cat);
        set.delete(cat);
      }
    });
    set.forEach((cat) => ordered.push(cat));
    return ordered;
  }, [ingredients]);

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'เนื้อสัตว์และอาหารทะเล':
        return '🥩';
      case 'ผักและสมุนไพร':
        return '🥬';
      case 'เครื่องปรุงและซอส':
        return '🧂';
      case 'ข้าวและเส้น':
        return '🍚';
      case 'ไข่และเต้าหู้':
        return '🥚';
      case 'บรรจุภัณฑ์':
        return '🥡';
      case 'ของแห้งและเบ็ดเตล็ด':
        return '📦';
      default:
        return '📁';
    }
  };

  const handleAddItemToEditing = () => {
    if (!editingSauce) return;
    const seasoningIng =
      ingredients.find((i) => i.category === 'เครื่องปรุงและซอส') || ingredients[0];
    const newItem: SauceRecipeItem = {
      ingredientId: seasoningIng ? seasoningIng.id : '',
      ingredientName: seasoningIng ? seasoningIng.name : '',
      quantity: 100,
      unit: seasoningIng?.usageUnit || 'g',
      unitCost: seasoningIng ? seasoningIng.costPerBaseUnit : 0,
      lineCost: seasoningIng ? 100 * seasoningIng.costPerBaseUnit : 0,
    };
    const newItems = [...(editingSauce.items || []), newItem];
    const newIdx = newItems.length - 1;
    if (seasoningIng?.category) {
      setSauceItemCategoryOverrides((prev) => ({
        ...prev,
        [newIdx]: seasoningIng.category!,
      }));
    }
    setEditingSauce({
      ...editingSauce,
      items: newItems,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!editingSauce || !editingSauce.items) return;
    const updated = [...editingSauce.items];
    updated.splice(index, 1);
    setEditingSauce({ ...editingSauce, items: updated });
  };

  const handleUpdateItemIngredient = (index: number, ingId: string) => {
    if (!editingSauce || !editingSauce.items) return;
    const ing = ingredientsMap.get(ingId);
    if (!ing) return;
    const updated = [...editingSauce.items];
    const current = updated[index];
    current.ingredientId = ing.id;
    current.ingredientName = ing.name;
    current.unit = ing.usageUnit;
    current.unitCost = ing.costPerBaseUnit;
    current.lineCost = current.quantity * ing.costPerBaseUnit;
    setEditingSauce({ ...editingSauce, items: updated });
  };

  const handleUpdateItemQuantity = (index: number, qty: number) => {
    if (!editingSauce || !editingSauce.items) return;
    const updated = [...editingSauce.items];
    const current = updated[index];
    current.quantity = qty;
    current.lineCost = qty * current.unitCost;
    setEditingSauce({ ...editingSauce, items: updated });
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSauce || !editingSauce.name) return;

    // Recalculate
    const tempSauce: Sauce = {
      id: editingSauce.id || `sauce_${Date.now()}`,
      name: editingSauce.name.trim(),
      category: editingSauce.category || 'ซอสปรุงรส',
      productionQuantity: Number(editingSauce.productionQuantity) || 1000,
      productionUnit: editingSauce.productionUnit || 'g',
      yieldPercent: Number(editingSauce.yieldPercent) || 100,
      actualQuantity: Number(editingSauce.actualQuantity) || 1000,
      productionCost: 0,
      actualCost: 0,
      costPerGram: 0,
      items: editingSauce.items || [],
      active: editingSauce.active !== undefined ? editingSauce.active : true,
      notes: editingSauce.notes,
      createdAt: editingSauce.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const calc = calculateSauceCost(tempSauce, ingredientsMap);
    const completeSauce: Sauce = {
      ...tempSauce,
      productionCost: calc.productionCost,
      actualCost: calc.actualCost,
      costPerGram: calc.costPerGram,
    };

    onSaveSauce(completeSauce);
    setSelectedSauce(completeSauce);
    setIsEditModalOpen(false);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#F27D26] uppercase">
            <FlaskConical className="w-4 h-4" />
            <span>สินค้ากึ่งสำเร็จรูป (Semi-finished Products)</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
            ซอสหลักและวัตถุดิบเตรียม (Sauces & Prepared Items)
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            คำนวณต้นทุนการผสมซอสแบบแม่นยำ พร้อมสูญเสีย Yield ก่อนนำไปคิดในสูตรอาหาร
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#d96817] text-black font-bold rounded-xl text-xs shadow-lg shadow-[#F27D26]/20 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ เพิ่มสูตรซอสใหม่</span>
        </button>
      </div>

      {/* Main Layout: Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Sauce List (5 cols) */}
        <div className="lg:col-span-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="ค้นหาซอส..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#F27D26]"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredSauces.map((sauce) => {
              const isSelected = selectedSauce?.id === sauce.id;
              const calc = calculateSauceCost(sauce, ingredientsMap);
              return (
                <div
                  key={sauce.id}
                  onClick={() => setSelectedSauce(sauce)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#F27D26]/15 border-[#F27D26] shadow-md shadow-[#F27D26]/10'
                      : 'bg-white/5 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">{sauce.name}</h3>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-[#F27D26] translate-x-1' : 'text-white/40'
                      }`}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between font-mono text-xs">
                    <span className="text-white/50">ต้นทุนรวม: ฿{calc.actualCost.toFixed(2)}</span>
                    <span className="font-bold text-[#FFC107] text-sm">
                      ฿{calc.costPerGram.toFixed(6)} / g
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-white/40">
                    <span>ผลิต {sauce.productionQuantity}g (Yield {sauce.yieldPercent}%)</span>
                    <span>{sauce.items.length} ส่วนผสม</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Sauce Cost Drill-Down (7 cols) */}
        <div className="lg:col-span-7 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
          {selectedSauce ? (
            (() => {
              const calc = calculateSauceCost(selectedSauce, ingredientsMap);
              return (
                <>
                  <div className="flex items-start justify-between border-b border-white/10 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30">
                          {selectedSauce.category || 'ซอสเตรียม'}
                        </span>
                        <span className="text-xs text-white/40">
                          อัปเดตล่าสุด: {new Date(selectedSauce.updatedAt).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white mt-1">
                        {selectedSauce.name}
                      </h2>
                      {selectedSauce.notes && (
                        <p className="text-xs text-white/60 mt-1">{selectedSauce.notes}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(selectedSauce)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>แก้ไขสูตร</span>
                    </button>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-3 gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 font-mono text-xs">
                    <div>
                      <span className="text-white/50 block text-[11px]">ต้นทุนวัตถุดิบรวม</span>
                      <span className="text-base font-bold text-white">
                        ฿{calc.productionCost.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-white/50 block text-[11px]">ต้นทุนจริงหลัง Yield ({selectedSauce.yieldPercent}%)</span>
                      <span className="text-base font-bold text-white">
                        ฿{calc.actualCost.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#FFC107] block text-[11px] font-bold">ต้นทุนต่อกรัม (บาท/g)</span>
                      <span className="text-lg font-bold text-[#FFC107]">
                        ฿{calc.costPerGram.toFixed(6)}
                      </span>
                    </div>
                  </div>

                  {/* Component Breakdown Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>ส่วนผสมในสูตร (Component Ingredients)</span>
                      <span className="text-white/40">{calc.itemsWithCost.length} รายการ</span>
                    </div>

                    <div className="overflow-hidden border border-white/10 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-white/50 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">วัตถุดิบ</th>
                            <th className="py-2.5 px-3 text-right">ปริมาณ</th>
                            <th className="py-2.5 px-3 text-right">ต้นทุน/หน่วย</th>
                            <th className="py-2.5 px-3 text-right">ต้นทุนรวม (บาท)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          {calc.itemsWithCost.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/5">
                              <td className="py-2.5 px-3 font-sans font-medium text-white">
                                {item.ingredientName}
                              </td>
                              <td className="py-2.5 px-3 text-right text-white/80">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right text-white/40">
                                ฿{item.unitCost.toFixed(4)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#FFC107]">
                                ฿{item.lineCost.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-white/5 font-mono font-bold text-white border-t border-white/10">
                          <tr>
                            <td colSpan={3} className="py-2.5 px-3 text-right">รวมต้นทุนการผลิต:</td>
                            <td className="py-2.5 px-3 text-right text-[#FFC107]">
                              ฿{calc.productionCost.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Practical usage example box */}
                  <div className="p-4 bg-[#F27D26]/10 rounded-2xl border border-[#F27D26]/20 text-xs text-white space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[#F27D26]">
                      <Info className="w-4 h-4 text-[#F27D26] shrink-0" />
                      <span>ตัวอย่างการคำนวณในเมนูจริง:</span>
                    </div>
                    <p className="text-[11px] text-white/70">
                      หากเมนูกะเพราใช้ <span className="font-bold text-white">{selectedSauce.name}</span> จำนวน{' '}
                      <span className="font-bold text-white">30 กรัม</span> → ต้นทุนซอสในจานจะเท่ากับ{' '}
                      <span className="font-bold font-mono text-[#FFC107]">
                        30 × ฿{calc.costPerGram.toFixed(4)} = ฿{(30 * calc.costPerGram).toFixed(2)}
                      </span>{' '}
                      บาท โดยไม่ต้องคำนวณวัตถุดิบย่อยซ้ำ
                    </p>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="text-center py-12 text-white/40">
              กรุณาเลือกซอสจากรายการด้านซ้ายเพื่อดูรายละเอียด
            </div>
          )}
        </div>
      </div>

      {/* EDIT / ADD SAUCE MODAL */}
      {isEditModalOpen && editingSauce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-white/20 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white">
                {editingSauce.id ? 'แก้ไขสูตรซอส' : 'สร้างสูตรซอสใหม่'}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-white/40 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-white/80 mb-1">ชื่อซอส / ของเตรียม</label>
                <input
                  type="text"
                  required
                  value={editingSauce.name || ''}
                  onChange={(e) => setEditingSauce({ ...editingSauce, name: e.target.value })}
                  className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl font-medium text-white focus:border-[#F27D26] focus:outline-none"
                  placeholder="เช่น ซอสผัดกระทะมาตรฐาน, น้ำมะขามผัดไทย"
                />
              </div>

              {/* Items in recipe */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white/80">ส่วนผสมย่อยในซอส</span>
                  <button
                    type="button"
                    onClick={handleAddItemToEditing}
                    className="px-2.5 py-1 bg-[#F27D26]/20 hover:bg-[#F27D26]/30 border border-[#F27D26]/30 text-[#F27D26] rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + เพิ่มส่วนผสม
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(editingSauce.items || []).map((item, idx) => {
                    const seasoningOptions = ingredients.filter((i) => i.category === 'เครื่องปรุงและซอส');
                    const currentIng = ingredientsMap.get(item.ingredientId);
                    const displayOptions =
                      currentIng && !seasoningOptions.some((i) => i.id === currentIng.id)
                        ? [currentIng, ...seasoningOptions]
                        : seasoningOptions.length > 0
                        ? seasoningOptions
                        : ingredients;

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-black/30 p-2.5 rounded-xl border border-white/10"
                      >
                        {/* Ingredient selector - only เครื่องปรุงและซอส, displaying name only */}
                        <select
                          value={item.ingredientId}
                          onChange={(e) => handleUpdateItemIngredient(idx, e.target.value)}
                          className="flex-1 p-1.5 bg-[#1a1a1a] border border-white/15 rounded-lg text-xs font-medium text-white cursor-pointer"
                        >
                          {displayOptions.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1 w-28">
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItemQuantity(idx, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 p-1.5 bg-[#1a1a1a] border border-white/15 rounded-lg text-xs font-mono font-bold text-right text-white"
                          />
                          <span className="text-white/40 text-[11px]">{item.unit}</span>
                        </div>

                        <div className="w-20 text-right font-mono font-bold text-[#FFC107] text-xs">
                          ฿{item.lineCost.toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-white/40 hover:text-red-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-[#d96817] text-black rounded-xl font-bold shadow-md shadow-[#F27D26]/20 cursor-pointer"
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
