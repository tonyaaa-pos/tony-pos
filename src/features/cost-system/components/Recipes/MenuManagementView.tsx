import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, UtensilsCrossed, AlertTriangle, ArrowUpRight, DollarSign, Package } from 'lucide-react';
import { MenuItem, PortionVariant, SalesChannel, Ingredient, SubRecipe, PackagingItem } from '../../types/domain';
import { calculatePortionCost } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface MenuManagementViewProps {
  menuItems: MenuItem[];
  ingredients?: Ingredient[];
  subRecipes?: SubRecipe[];
  packaging?: PackagingItem[];
  channels?: SalesChannel[];
  onSaveMenuItem: (menuItem: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  activeLanguage: 'th' | 'en';
}

export const MenuManagementView: React.FC<MenuManagementViewProps> = ({
  menuItems,
  ingredients,
  subRecipes,
  packaging,
  channels,
  onSaveMenuItem,
  onDeleteMenuItem,
  activeLanguage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    code: string;
    thaiName: string;
    englishName: string;
    category: string;
    description: string;
    portionName: string;
    sellingPrice: number;
    packagingCost: number;
  }>({
    code: `MENU-${String(menuItems.length + 1).padStart(3, '0')}`,
    thaiName: '',
    englishName: '',
    category: 'A La Carte',
    description: '',
    portionName: 'จานปกติ (Regular)',
    sellingPrice: 120,
    packagingCost: 5,
  });

  const categories = ['ALL', 'A La Carte', 'Set Menu', 'Appetizers', 'Beverages', 'Dessert'];

  const handleOpenAdd = () => {
    setEditingMenu(null);
    setFormData({
      code: `MENU-${String(menuItems.length + 1).padStart(3, '0')}`,
      thaiName: '',
      englishName: '',
      category: 'A La Carte',
      description: '',
      portionName: 'จานปกติ (Regular)',
      sellingPrice: 120,
      packagingCost: 5,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (menu: MenuItem) => {
    setEditingMenu(menu);
    const mainPortion = menu.portions[0];
    setFormData({
      code: menu.code,
      thaiName: menu.thaiName,
      englishName: menu.englishName,
      category: menu.category,
      description: menu.description || '',
      portionName: mainPortion?.name || 'จานปกติ',
      sellingPrice: mainPortion?.sellingPrice || 120,
      packagingCost: mainPortion?.packagingCost || 5,
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.thaiName.trim()) return;

    const existingPortions = editingMenu ? editingMenu.portions : [];
    const directFoodCost = existingPortions[0]?.directFoodCost || 38.5;
    const totalDirectCost = directFoodCost + formData.packagingCost;
    const foodCostPercent = formData.sellingPrice > 0 ? (directFoodCost / formData.sellingPrice) * 100 : 0;
    const totalCostPercent = formData.sellingPrice > 0 ? (totalDirectCost / formData.sellingPrice) * 100 : 0;
    const contributionProfit = formData.sellingPrice - totalDirectCost;
    const grossMarginPercent = formData.sellingPrice > 0 ? (contributionProfit / formData.sellingPrice) * 100 : 0;

    const updatedPortion: PortionVariant = {
      id: existingPortions[0]?.id || `p-${Date.now()}`,
      name: formData.portionName,
      portionMultiplier: 1.0,
      directFoodCost,
      packagingCost: formData.packagingCost,
      totalDirectCost,
      sellingPrice: formData.sellingPrice,
      targetFoodCostPercent: 30,
      foodCostPercent,
      grossMarginPercent,
      contributionProfit,
    };

    const newMenu: MenuItem = {
      id: editingMenu ? editingMenu.id : `menu-${Date.now()}`,
      code: formData.code,
      thaiName: formData.thaiName,
      englishName: formData.englishName || formData.thaiName,
      category: formData.category,
      description: formData.description,
      items: editingMenu?.items || [],
      portions: [updatedPortion, ...(existingPortions.slice(1) || [])],
      targetFoodCostPercent: editingMenu?.targetFoodCostPercent || 30,
      targetGrossMarginPercent: editingMenu?.targetGrossMarginPercent || 70,
      pricingMethod: editingMenu?.pricingMethod || 'food_cost_target',
      packagingCost: formData.packagingCost,
      active: true,
      createdAt: editingMenu ? editingMenu.createdAt : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSaveMenuItem(newMenu);
    setIsModalOpen(false);
  };

  const filteredMenuItems = menuItems.filter((m) => {
    const matchesSearch =
      m.thaiName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF6321] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6321]">
              Catalog & Margin Architecture
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'การจัดการเมนู & พอร์ชั่น (Menu Items & Portions)' : 'Menu Items & Portions'}</span>
            <span className="text-xs font-semibold bg-[#FF6321]/10 text-[#FF6321] px-2.5 py-0.5 rounded-full border border-[#FF6321]/20">
              {menuItems.length} {activeLanguage === 'th' ? 'เมนู' : 'dishes'}
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'ควบคุมต้นทุนอาหารทางตรง ค่ากล่องบรรจุภัณฑ์ และอัตรากำไรส่วนเกินของทุกเมนู'
              : 'Direct food cost, packaging cost, selling prices, and margins for each portion size.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{activeLanguage === 'th' ? 'เพิ่มเมนูอาหารใหม่' : 'Add Menu Item'}</span>
        </button>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-[#151518] p-3 rounded-xl border border-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeLanguage === 'th' ? 'ค้นหาชื่อเมนู หรือรหัส...' : 'Search menus...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-white/10 bg-[#0F0F11] text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded-lg border border-white/10 py-1.5 px-2.5 bg-[#0F0F11] text-white focus:border-[#FF6321] focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMenuItems.map((menu) => (
          <div
            key={menu.id}
            className="rounded-xl border border-white/5 bg-[#151518] p-5 hover:border-white/15 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-white/40">{menu.code}</div>
                  <h3 className="text-base font-semibold text-white mt-0.5">{menu.thaiName}</h3>
                  {menu.englishName && <div className="text-xs text-white/50">{menu.englishName}</div>}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(menu)}
                    className="p-1 text-white/40 hover:text-white rounded cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMenuItem(menu.id)}
                    className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Portions breakdown */}
              <div className="mt-3 space-y-2">
                {menu.portions.map((portion) => {
                  const isHighFoodCost = portion.foodCostPercent > 35;
                  return (
                    <div
                      key={portion.id}
                      className="bg-white/5 p-2.5 rounded-lg border border-white/5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-white/80">{portion.name}</span>
                        <span className="text-white font-mono text-sm">฿{portion.sellingPrice}</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-[11px] font-mono pt-1 border-t border-white/10">
                        <div>
                          <div className="text-[10px] text-white/40 font-sans">ต้นทุนอาหาร</div>
                          <div className="font-bold text-white">฿{portion.directFoodCost.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 font-sans">ค่ากล่อง</div>
                          <div className="text-white/60">฿{portion.packagingCost.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 font-sans">% Food Cost</div>
                          <div className={`font-bold ${isHighFoodCost ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                            {portion.foodCostPercent.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/40 font-sans">กำไรต่อจาน</div>
                          <div className="font-bold text-[#10B981]">฿{portion.contributionProfit.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Menu Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-[#151518] p-6 border border-white/10 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-white">
                {editingMenu ? 'แก้ไขเมนูอาหาร (Edit Menu)' : 'เพิ่มเมนูอาหารใหม่ (New Menu Item)'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">รหัสเมนู</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">หมวดหมู่</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อภาษาไทย *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ข้าวผัดกะเพราเนื้อโคขุน"
                    value={formData.thaiName}
                    onChange={(e) => setFormData({ ...formData, thaiName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อภาษาอังกฤษ</label>
                  <input
                    type="text"
                    placeholder="e.g. Stir-Fried Wagyu Basil"
                    value={formData.englishName}
                    onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
              </div>

              {/* Portion Pricing & Packaging */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ชื่อขนาดพอร์ชั่น</label>
                  <input
                    type="text"
                    value={formData.portionName}
                    onChange={(e) => setFormData({ ...formData, portionName: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">ราคาขายหน้าร้าน (฿)</label>
                    <NumericInput
                      type="number"
                      step="any"
                      required
                      min="1"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white font-mono font-bold focus:border-[#FF6321] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">ค่ากล่อง/บรรจุภัณฑ์ (฿)</label>
                    <NumericInput
                      type="number"
                      step="any"
                      min="0"
                      value={formData.packagingCost}
                      onChange={(e) => setFormData({ ...formData, packagingCost: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white font-mono focus:border-[#FF6321] focus:outline-none"
                    />
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
                  className="rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  บันทึกเมนู
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
