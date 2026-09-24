import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Receipt, Plus, X, Tag } from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { MenuCategory } from '../../types';

export const BottomBar: React.FC = () => {
  const {
    activeNav,
    setActiveNav,
    activeCategory,
    setActiveCategory,
    categories,
    addCategory,
    deleteCategory,
    bills,
    activeBill,
    currentUser,
  } = usePOS();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🍛');
  const [newCatColor, setNewCatColor] = useState('#f59e0b');

  // Edit / Delete mode toggle
  const [isEditMode, setIsEditMode] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<MenuCategory | null>(null);

  // Bill stats for the permanent first card
  const openBills = bills.filter((b) => b.status === 'open');
  const openBillsCount = openBills.length;
  const currentTotal = activeBill ? activeBill.grandTotal : 0;
  const isBillCardActive = activeCategory === null;

  const handleOpenTables = () => {
    setActiveCategory(null);
    setActiveNav('tables');
  };

  const handleSelectCategory = (catId: string) => {
    if (isEditMode) return;
    setActiveCategory(catId);
    setActiveNav('pos');
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim(), newCatIcon, newCatColor);
    setNewCatName('');
    setIsAddModalOpen(false);
  };

  const quickIcons = ['🍛', '🍲', '🥗', '🍢', '🧋', '🍜', '🍣', '🥩', '🍰', '🍺', '☕', '🥣'];
  const quickColors = [
    '#f59e0b', // amber
    '#ef4444', // red
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#64748b', // slate
  ];

  if (!currentUser) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-xl transition-all duration-200">
        <div className="max-w-full px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {/* Card 1: Permanent 'Bill' Card (Far Left) */}
          <button
            type="button"
            onClick={handleOpenTables}
            className={`shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition shadow-xs cursor-pointer text-left ${
              isBillCardActive
                ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold ring-2 ring-amber-400/50'
                : 'bg-slate-900 text-white dark:bg-slate-800 dark:text-amber-400 border-slate-800 hover:bg-slate-800'
            }`}
            title="ไปที่ผังโต๊ะและจัดการบิล"
          >
            <div className={`p-1.5 rounded-xl ${isBillCardActive ? 'bg-slate-950/15' : 'bg-white/10'}`}>
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80 leading-none">
                บิล (Bills)
              </div>
              <div className="text-xs font-bold leading-tight truncate">
                {activeBill ? (
                  <span>
                    โต๊ะ {activeBill.tableName || 'กลับบ้าน'}: {formatBaht(currentTotal)}
                  </span>
                ) : (
                  <span>{openBillsCount} บิลเปิดอยู่</span>
                )}
              </div>
            </div>
          </button>

          <div className="h-7 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-1" />

          {/* Category Cards */}
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <div key={cat.id} className="relative shrink-0 group">
                <button
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold whitespace-nowrap transition shadow-2xs cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                  }`}
                >
                  <span className="text-base leading-none">{cat.icon || '🍽️'}</span>
                  <span>{cat.name}</span>
                </button>

                {/* Delete button shown when in edit mode */}
                {isEditMode && cat.id !== 'cat_uncategorized' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(cat);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 cursor-pointer text-[10px]"
                    title="ลบหมวดหมู่นี้"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* All Categories Button in POS */}
          <button
            type="button"
            onClick={() => {
              if (isEditMode) return;
              setActiveCategory('all');
              setActiveNav('pos');
            }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
            }`}
          >
            <span>✨</span>
            <span>ดูทั้งหมด</span>
          </button>

          {/* Manage / Delete Mode Toggle Button */}
          {categories.length > 0 && (
            <button
              type="button"
              onClick={() => setIsEditMode((prev) => !prev)}
              className={`shrink-0 px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                isEditMode
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-300 dark:border-rose-800'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 border-dashed border-slate-300 dark:border-slate-700'
              }`}
              title={isEditMode ? 'เสร็จสิ้นการแก้ไข' : 'จัดการลบหมวดหมู่'}
            >
              {isEditMode ? 'เสร็จสิ้น' : 'จัดการ'}
            </button>
          )}

          {/* "+" Card: Add New Category */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="เพิ่มหมวดหมู่ใหม่"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มหมวด</span>
          </button>
        </div>
      </div>

      {/* Modal: Add Category */}
      {isAddModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddModalOpen(false)}
          title="เพิ่มหมวดหมู่อาหารใหม่"
          maxWidth="max-w-sm"
        >
          <form onSubmit={handleAddCategorySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ชื่อหมวดหมู่
              </label>
              <input
                type="text"
                required
                placeholder="เช่น อาหารเส้น, ย่าง/ทอด, ไวน์"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                เลือกไอคอนอิโมจิ
              </label>
              <div className="flex flex-wrap gap-2">
                {quickIcons.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setNewCatIcon(ico)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition cursor-pointer ${
                      newCatIcon === ico
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                เลือกธีมสี
              </label>
              <div className="flex items-center gap-2">
                {quickColors.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewCatColor(col)}
                    className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                      newCatColor === col ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs cursor-pointer"
              >
                เพิ่มหมวดหมู่
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog: Delete Category */}
      {categoryToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={() => {
            deleteCategory(categoryToDelete.id);
            setCategoryToDelete(null);
          }}
          title="ยืนยันการลบหมวดหมู่"
          message={`ต้องการลบหมวดหมู่ "${categoryToDelete.name}" ใช่หรือไม่? หากมีรายการอาหารในหมวดนี้ เมนูจะถูกย้ายไปยัง "ไม่ระบุหมวดหมู่" โดยอัตโนมัติ (ไม่สูญหาย)`}
        />
      )}
    </>
  );
};
