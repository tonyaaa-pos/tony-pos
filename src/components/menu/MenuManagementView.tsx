import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { MenuItem, MenuCategory, OptionGroup } from '../../types';
import {
  Plus,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Sparkles,
  Tag,
  Search,
  UtensilsCrossed,
  Layers,
  Percent,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const MenuManagementView: React.FC = () => {
  const {
    categories,
    menuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleSoldOut,
    addCategory,
    updateCategory,
    deleteCategory,
  } = usePOS();

  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');

  const filteredItems = menuItems.filter((item) => {
    const matchCat = selectedCatId === 'all' || item.categoryId === selectedCatId;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleOpenAdd = () => {
    setIsNewItem(true);
    setEditingItem({
      name: '',
      description: '',
      price: 80,
      cost: 40,
      categoryId: categories[0]?.id || 'cat_1',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isSoldOut: false,
      isRecommended: false,
      promoActive: false,
      promoPrice: 70,
      optionGroups: [],
    });
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name?.trim()) return;

    if (isNewItem) {
      addMenuItem(editingItem as Omit<MenuItem, 'id'>);
    } else if (editingItem.id) {
      updateMenuItem(editingItem.id, editingItem);
    }
    setEditingItem(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            จัดการเมนูอาหารและหมวดหมู่
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            เพิ่ม ลบ แก้ไขราคาเมนู ท็อปปิ้ง ผูกสูตรตัดสต็อก และกำหนดสินค้าขายหมด
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setCategoryNameInput('');
              setShowCategoryModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>จัดการหมวดหมู่</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ เพิ่มเมนูใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อเมนู..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCatId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCatId === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            ทั้งหมด ({menuItems.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCatId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCatId === c.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => {
          const categoryName = categories.find((c) => c.id === item.categoryId)?.name || '';

          return (
            <div
              key={item.id}
              className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col justify-between transition ${
                item.isSoldOut ? 'opacity-70 border-rose-300' : ''
              }`}
            >
              <div className="relative aspect-16/10 overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" fill="%23cbd5e1"><rect width="200" height="150"/><text x="100" y="80" font-family="sans-serif" font-size="16" fill="%23475569" text-anchor="middle">ภาพอาหาร</text></svg>';
                  }}
                />
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-xs">
                    {categoryName}
                  </span>
                  {item.promoActive && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold">
                      โปร {formatBaht(item.promoPrice || item.price)}
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2">
                  <button
                    type="button"
                    onClick={() => toggleSoldOut(item.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs transition cursor-pointer flex items-center gap-1 ${
                      item.isSoldOut
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {item.isSoldOut ? <Ban className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                    <span>{item.isSoldOut ? 'ขายหมด' : 'พร้อมขาย'}</span>
                  </button>
                </div>
              </div>

              {/* Item Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400">ราคาขาย: </span>
                    <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                      {formatBaht(item.price)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    ต้นทุน: {formatBaht(item.cost)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewItem(false);
                      setEditingItem({ ...item });
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>แก้ไข</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemToDelete(item)}
                    className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="ลบเมนูนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Menu Item Modal */}
      {editingItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditingItem(null)}
          title={isNewItem ? 'เพิ่มเมนูอาหารใหม่' : `แก้ไขเมนู: ${editingItem.name}`}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อเมนูอาหาร / เครื่องดื่ม <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="เช่น ผัดกะเพราหมูกรอบ"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมวดหมู่อาหาร
                </label>
                <select
                  value={editingItem.categoryId || categories[0]?.id}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                คำอธิบายสั้นๆ
              </label>
              <textarea
                rows={2}
                value={editingItem.description || ''}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="ระบุส่วนผสมหลัก หรือความพิเศษของจานนี้..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ราคาขายปกติ (฿) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editingItem.price ?? 80}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ต้นทุน (฿)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editingItem.cost ?? 40}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, cost: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ราคาโปรโมชั่น (฿)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editingItem.promoPrice ?? 0}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, promoPrice: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>

            {/* Checkboxes: Promo active, Recommended, Sold Out */}
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.promoActive || false}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, promoActive: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">เปิดใช้ราคาโปรโมชั่น</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.isRecommended || false}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, isRecommended: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">เมนูแนะนำ</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingItem.isSoldOut || false}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, isSoldOut: e.target.checked }))}
                  className="w-4 h-4 rounded text-rose-500"
                />
                <span className="font-semibold text-rose-600 dark:text-rose-400">สถานะขายหมด</span>
              </label>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                URL รูปภาพประกอบเมนู
              </label>
              <input
                type="text"
                value={editingItem.image || ''}
                onChange={(e) => setEditingItem((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 shadow-xs cursor-pointer"
              >
                บันทึกเมนู
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Item Confirm */}
      {itemToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setItemToDelete(null)}
          onConfirm={() => {
            deleteMenuItem(itemToDelete.id);
            setItemToDelete(null);
          }}
          title="ยืนยันการลบเมนูอาหาร"
          message={`คุณต้องการลบเมนู "${itemToDelete.name}" ออกจากระบบหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
        />
      )}

      {/* Categories Management Modal */}
      {showCategoryModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCategoryModal(false)}
          title="จัดการหมวดหมู่อาหาร"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={categoryNameInput}
                onChange={(e) => setCategoryNameInput(e.target.value)}
                placeholder="ชื่อหมวดหมู่ใหม่..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (categoryNameInput.trim()) {
                    if (editingCategory) {
                      updateCategory(editingCategory.id, categoryNameInput.trim());
                      setEditingCategory(null);
                    } else {
                      addCategory(categoryNameInput.trim());
                    }
                    setCategoryNameInput('');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                {editingCategory ? 'อัปเดต' : 'เพิ่ม'}
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
              {categories.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {c.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(c);
                        setCategoryNameInput(c.name);
                      }}
                      className="p-1 text-slate-500 hover:text-amber-600"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteCategory(c.id)}
                        className="p-1 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
