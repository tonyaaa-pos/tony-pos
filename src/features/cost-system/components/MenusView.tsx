import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronRight,
  Edit2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { MenuItem, MenuVariant, RestaurantSettings } from '../types';
import { NumericInput } from './common/NumericInput';

interface MenusViewProps {
  menus: MenuItem[];
  settings: RestaurantSettings;
  onSaveMenu: (menu: MenuItem) => void;
  onNavigateToCosting: () => void;
  onNavigateToRecipeBuilder: (variantId: string) => void;
}

export const MenusView: React.FC<MenusViewProps> = ({
  menus,
  settings,
  onSaveMenu,
  onNavigateToCosting,
  onNavigateToRecipeBuilder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(menus[0] || null);

  // Edit Menu Modal
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Partial<MenuItem> | null>(null);

  // Edit Variant Modal
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Partial<MenuVariant> | null>(null);

  const categories = ['ALL', ...Array.from(new Set(menus.map((m) => m.category)))];

  const filteredMenus = menus.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.variants.some((v) => v.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAddMenu = () => {
    const newMenu: Partial<MenuItem> = {
      id: `menu_${Date.now()}`,
      name: '',
      category: 'ผัดและกะเพรา',
      variants: [],
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingMenu(newMenu);
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenu = (menu: MenuItem) => {
    setEditingMenu({ ...menu });
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu || !editingMenu.name) return;

    const finalMenu: MenuItem = {
      id: editingMenu.id || `menu_${Date.now()}`,
      name: editingMenu.name.trim(),
      category: editingMenu.category || 'ผัดและกะเพรา',
      displayOrder: editingMenu.displayOrder || 1,
      variants: editingMenu.variants || [],
      active: editingMenu.active !== undefined ? editingMenu.active : true,
      description: editingMenu.description,
      createdAt: editingMenu.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveMenu(finalMenu);
    setSelectedMenu(finalMenu);
    setIsMenuModalOpen(false);
  };

  const handleOpenAddVariant = () => {
    if (!selectedMenu) return;
    const newVariant: Partial<MenuVariant> = {
      id: `var_${Date.now()}`,
      menuId: selectedMenu.id,
      name: 'ธรรมดา',
      proteinType: 'หมูหมัก',
      sellingPrice: 60,
      takeawayPrice: 65,
      deliveryPrice: 85,
      overheadCost: 6.0,
      recipeItems: [],
      active: true,
    };
    setEditingVariant(newVariant);
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariant = (v: MenuVariant) => {
    setEditingVariant({ ...v });
    setIsVariantModalOpen(true);
  };

  const handleSaveVariantModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !editingVariant || !editingVariant.name) return;

    const finalVariant: MenuVariant = {
      id: editingVariant.id || `var_${Date.now()}`,
      menuId: selectedMenu.id,
      name: editingVariant.name.trim(),
      proteinType: editingVariant.proteinType || 'หมูหมัก',
      sellingPrice: Number(editingVariant.sellingPrice) || 0,
      takeawayPrice: Number(editingVariant.takeawayPrice) || 0,
      deliveryPrice: Number(editingVariant.deliveryPrice) || 0,
      overheadCost: Number(editingVariant.overheadCost) || 6.0,
      recipeItems: editingVariant.recipeItems || [],
      active: editingVariant.active !== undefined ? editingVariant.active : true,
    };

    const existingIdx = selectedMenu.variants.findIndex((v) => v.id === finalVariant.id);
    let updatedVariants: MenuVariant[];
    if (existingIdx >= 0) {
      updatedVariants = [...selectedMenu.variants];
      updatedVariants[existingIdx] = finalVariant;
    } else {
      updatedVariants = [...selectedMenu.variants, finalVariant];
    }

    const updatedMenu = { ...selectedMenu, variants: updatedVariants };
    onSaveMenu(updatedMenu);
    setSelectedMenu(updatedMenu);
    setIsVariantModalOpen(false);
  };

  const handleToggleVariantActive = (variantId: string) => {
    if (!selectedMenu) return;
    const updatedVariants = selectedMenu.variants.map((v) =>
      v.id === variantId ? { ...v, active: !v.active } : v
    );
    const updatedMenu = { ...selectedMenu, variants: updatedVariants };
    onSaveMenu(updatedMenu);
    setSelectedMenu(updatedMenu);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            รายการเมนูอาหารและชุดโปรตีน (Menu Catalog)
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            จัดการโครงสร้างเมนู, สูตรตามประเภทเนื้อสัตว์, และราคาขาย 3 ช่องทาง
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToCosting}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            ตารางต้นทุนเมนู
          </button>
          <button
            type="button"
            onClick={handleOpenAddMenu}
            className="px-4 py-2 bg-[#F27D26] hover:bg-[#d96817] text-black rounded-xl text-xs font-bold shadow-lg shadow-[#F27D26]/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ เพิ่มเมนูใหม่</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Menu Selector & Variant Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Menus List (5 cols) */}
        <div className="lg:col-span-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:border-[#F27D26] focus:outline-none"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-2 bg-black/30 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#1a1a1a]">
                  {c === 'ALL' ? 'ทุกหมวด' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredMenus.map((menu) => {
              const isSelected = selectedMenu?.id === menu.id;
              return (
                <div
                  key={menu.id}
                  onClick={() => setSelectedMenu(menu)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#F27D26]/15 border-[#F27D26] shadow-md shadow-[#F27D26]/10'
                      : 'bg-white/5 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{menu.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-semibold border border-white/5">
                        {menu.category}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-[#F27D26] translate-x-1' : 'text-white/40'
                      }`}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                    <span>{menu.variants.length} ตัวเลือกโปรตีน</span>
                    <span className="font-mono text-white/80 font-bold">
                      {menu.variants.length > 0
                        ? `฿${Math.min(...menu.variants.map((v) => v.sellingPrice))} - ฿${Math.max(
                            ...menu.variants.map((v) => v.sellingPrice)
                          )}`
                        : 'ยังไม่มีราคา'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Variants in Selected Menu (7 cols) */}
        <div className="lg:col-span-7 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-5">
          {selectedMenu ? (
            <>
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-xs font-bold text-[#F27D26] uppercase tracking-wide">
                    หมวด: {selectedMenu.category}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{selectedMenu.name}</h2>
                  {selectedMenu.description && (
                    <p className="text-xs text-white/50 mt-1">{selectedMenu.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditMenu(selectedMenu)}
                    className="p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-white/10"
                    title="แก้ไขชื่อเมนู"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddVariant}
                    className="px-3 py-2 bg-[#F27D26] hover:bg-[#d96817] text-black rounded-xl text-xs font-bold shadow-md shadow-[#F27D26]/20 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มตัวเลือกโปรตีน</span>
                  </button>
                </div>
              </div>

              {/* Variants list */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  ตัวเลือกและราคาขาย (Variants & Selling Prices)
                </div>

                {selectedMenu.variants.length === 0 ? (
                  <div className="text-center py-8 text-white/40 bg-white/5 rounded-2xl border border-dashed border-white/10 text-xs">
                    ยังไม่มีตัวเลือกในเมนูนี้ กด "เพิ่มตัวเลือกโปรตีน" เพื่อเพิ่ม
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedMenu.variants.map((v) => (
                      <div
                        key={v.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          v.active
                            ? 'bg-white/5 border-white/10 hover:border-white/20'
                            : 'bg-white/5 border-white/5 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {v.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 border border-white/10 text-white/80">
                              {v.proteinType}
                            </span>
                            {v.proteinType === 'ทะเล' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFC107]/20 text-[#FFC107] border border-[#FFC107]/30">
                                🦐+🦑 แยกกุ้ง/หมึก
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleVariantActive(v.id)}
                              className="p-1.5 text-white/40 hover:text-white rounded-lg cursor-pointer"
                              title={v.active ? 'ปิดการขาย' : 'เปิดการขาย'}
                            >
                              {v.active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-white/40" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditVariant(v)}
                              className="p-1.5 text-white/40 hover:text-white rounded-lg cursor-pointer"
                              title="แก้ไขราคาและตัวเลือก"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Prices across 3 channels */}
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 font-mono text-xs">
                          <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                            <span className="text-white/40 text-[10px] block">หน้าร้าน:</span>
                            <span className="font-bold text-white text-sm">
                              ฿{v.sellingPrice}
                            </span>
                          </div>
                          <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                            <span className="text-white/40 text-[10px] block">กลับบ้าน:</span>
                            <span className="font-bold text-white/80 text-sm">
                              ฿{v.takeawayPrice}
                            </span>
                          </div>
                          <div className="bg-[#F27D26]/10 p-2.5 rounded-xl border border-[#F27D26]/30">
                            <span className="text-[#F27D26] text-[10px] block font-bold">เดลิเวอรี:</span>
                            <span className="font-bold text-[#F27D26] text-sm">
                              ฿{v.deliveryPrice}
                            </span>
                          </div>
                        </div>

                        {/* Recipe builder shortcut */}
                        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-white/10">
                          <span className="text-white/50 text-[11px]">
                            {v.recipeItems.length} วัตถุดิบในสูตร
                          </span>
                          <button
                            type="button"
                            onClick={() => onNavigateToRecipeBuilder(v.id)}
                            className="text-[#F27D26] font-bold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>แก้ไขสูตรอาหาร</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-white/40 text-xs">
              เลือกเมนูจากรายการทางซ้ายเพื่อดูตัวเลือก
            </div>
          )}
        </div>
      </div>

      {/* EDIT MENU MODAL */}
      {isMenuModalOpen && editingMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF9] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EAE4D9] text-[#1C1917]">
            <div className="flex items-center justify-between border-b border-[#EAE4D9] pb-3">
              <h3 className="font-bold text-[#1C1917] text-base">
                {editingMenu.id ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveMenuModal} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">ชื่อเมนู</label>
                <input
                  type="text"
                  required
                  value={editingMenu.name || ''}
                  onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D6CEBE] rounded-xl font-medium text-stone-900 focus:border-[#F27D26] focus:outline-none"
                  placeholder="เช่น ผัดกะเพราโบราณ, ข้าวผัดรถไฟ"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">หมวดหมู่</label>
                <input
                  type="text"
                  required
                  value={editingMenu.category || ''}
                  onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D6CEBE] rounded-xl font-medium text-stone-900 focus:border-[#F27D26] focus:outline-none"
                  placeholder="เช่น ผัดและกะเพรา, ทอดและกระเทียม, ต้มยำ"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">คำอธิบาย</label>
                <textarea
                  rows={2}
                  value={editingMenu.description || ''}
                  onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#D6CEBE] rounded-xl font-medium text-stone-900 focus:border-[#F27D26] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EAE4D9]">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-[#d96817] text-white rounded-xl font-bold shadow-md shadow-[#F27D26]/20 transition-colors cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VARIANT MODAL */}
      {isVariantModalOpen && editingVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-[#FFFDF9] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#EAE4D9] text-[#1C1917]">
            <div className="flex items-center justify-between border-b border-[#EAE4D9] pb-3">
              <h3 className="font-bold text-[#1C1917] text-base">
                ตัวเลือกโปรตีนและราคาขาย (Variant Pricing)
              </h3>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveVariantModal} className="space-y-3.5 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">ชื่อชุด/ขนาด</label>
                  <input
                    type="text"
                    required
                    value={editingVariant.name || ''}
                    onChange={(e) => setEditingVariant({ ...editingVariant, name: e.target.value })}
                    className="w-full p-2 bg-white border border-[#D6CEBE] rounded-xl font-medium text-stone-900 focus:border-[#F27D26] focus:outline-none"
                    placeholder="เช่น ธรรมดา, พิเศษ"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">ประเภทโปรตีน</label>
                  <input
                    type="text"
                    required
                    value={editingVariant.proteinType || ''}
                    onChange={(e) =>
                      setEditingVariant({ ...editingVariant, proteinType: e.target.value })
                    }
                    className="w-full p-2 bg-white border border-[#D6CEBE] rounded-xl font-medium text-stone-900 focus:border-[#F27D26] focus:outline-none"
                    placeholder="เช่น หมูหมัก, ทะเล, เนื้อ"
                  />
                </div>
              </div>

              {/* Prices across 3 channels */}
              <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EAE4D9] space-y-2.5">
                <div className="font-bold text-[#F27D26] text-[11px] uppercase tracking-wider">
                  ราคาขาย 3 ช่องทาง (บาท)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-stone-600 mb-1 font-medium">หน้าร้าน</label>
                    <NumericInput
                      type="number"
                      required
                      value={editingVariant.sellingPrice || ''}
                      onChange={(e) =>
                        setEditingVariant({
                          ...editingVariant,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 bg-white border border-[#D6CEBE] rounded-xl font-mono font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-600 mb-1 font-medium">กลับบ้าน</label>
                    <NumericInput
                      type="number"
                      required
                      value={editingVariant.takeawayPrice || ''}
                      onChange={(e) =>
                        setEditingVariant({
                          ...editingVariant,
                          takeawayPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 bg-white border border-[#D6CEBE] rounded-xl font-mono font-bold text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[#F27D26] mb-1 font-bold">เดลิเวอรี</label>
                    <NumericInput
                      type="number"
                      required
                      value={editingVariant.deliveryPrice || ''}
                      onChange={(e) =>
                        setEditingVariant({
                          ...editingVariant,
                          deliveryPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 bg-white border-2 border-[#F27D26] rounded-xl font-mono font-bold text-[#F27D26]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  ค่าโสหุ้ยต่อจาน (Overhead / แก๊ส / น้ำมัน) (บาท)
                </label>
                <NumericInput
                  type="number"
                  step="0.5"
                  value={editingVariant.overheadCost || ''}
                  onChange={(e) =>
                    setEditingVariant({
                      ...editingVariant,
                      overheadCost: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2 bg-white border border-[#D6CEBE] rounded-xl font-mono font-bold text-stone-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EAE4D9]">
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-[#d96817] text-white rounded-xl font-bold shadow-md shadow-[#F27D26]/20 transition-colors cursor-pointer"
                >
                  บันทึกตัวเลือก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
