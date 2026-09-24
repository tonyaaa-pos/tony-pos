import React, { useState, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { MenuItem, MenuCategory, ItemVariantOption } from '../../types';
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
  Upload,
  Camera,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { compressImageFile } from '../../utils/imageCompressor';

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

  const { t, getName, getDescription } = useLanguage();

  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Hidden file input for photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryNameEnInput, setCategoryNameEnInput] = useState('');

  const filteredItems = menuItems.filter((item) => {
    const matchCat = selectedCatId === 'all' || item.categoryId === selectedCatId;
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleOpenAdd = () => {
    setIsNewItem(true);
    setStorageError(null);
    setEditingItem({
      name: '',
      nameEn: '',
      description: '',
      descriptionEn: '',
      price: 80,
      cost: 40,
      categoryId: categories[0]?.id || 'cat_1',
      image:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isAvailable: true,
      isSoldOut: false,
      isRecommended: false,
      promoActive: false,
      promoPrice: 70,
      variants: [
        {
          id: 'v_' + Date.now() + '_1',
          name: 'ปกติ',
          nameEn: 'Standard',
          price: 80,
          cost: 35,
          isAvailable: true,
        },
      ],
      optionGroups: [],
    });
  };

  const handleOpenEdit = (item: MenuItem) => {
    setIsNewItem(false);
    setStorageError(null);
    // Ensure item has variants
    const variants =
      item.variants && item.variants.length > 0
        ? [...item.variants]
        : [
            {
              id: 'v_std_' + item.id,
              name: 'ปกติ',
              nameEn: 'Standard',
              price: item.price || 0,
              cost: item.cost || 0,
              isAvailable: !item.isSoldOut,
              isSoldOut: item.isSoldOut,
            },
          ];

    setEditingItem({
      ...item,
      variants,
    });
  };

  // Image Upload Handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsCompressing(true);
    setStorageError(null);

    try {
      const compressedDataUrl = await compressImageFile(file, 800, 0.8);
      setEditingItem((prev) => (prev ? { ...prev, image: compressedDataUrl } : null));
    } catch (err: any) {
      console.error('Image compression failed:', err);
      setStorageError(t('menu_storage_full_err'));
    } finally {
      setIsCompressing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Variants management within editing item
  const handleAddVariant = () => {
    if (!editingItem) return;
    const currentVariants = editingItem.variants || [];
    const newVariant: ItemVariantOption = {
      id: 'v_' + Date.now() + '_' + (currentVariants.length + 1),
      name: '',
      nameEn: '',
      price: currentVariants[0]?.price || 80,
      cost: currentVariants[0]?.cost || 30,
      isAvailable: true,
    };
    setEditingItem({
      ...editingItem,
      variants: [...currentVariants, newVariant],
    });
  };

  const handleUpdateVariant = (idx: number, updates: Partial<ItemVariantOption>) => {
    if (!editingItem || !editingItem.variants) return;
    const updated = [...editingItem.variants];
    updated[idx] = { ...updated[idx], ...updates };
    setEditingItem({
      ...editingItem,
      variants: updated,
    });
  };

  const handleDeleteVariant = (idx: number) => {
    if (!editingItem || !editingItem.variants) return;
    if (editingItem.variants.length <= 1) {
      alert('เมนูต้องมีอย่างน้อย 1 ตัวเลือกราคา');
      return;
    }
    const updated = editingItem.variants.filter((_, i) => i !== idx);
    setEditingItem({
      ...editingItem,
      variants: updated,
    });
  };

  const handleMoveVariant = (idx: number, direction: 'up' | 'down') => {
    if (!editingItem || !editingItem.variants) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= editingItem.variants.length) return;

    const updated = [...editingItem.variants];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setEditingItem({
      ...editingItem,
      variants: updated,
    });
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name?.trim()) return;

    // Validate variants
    const validVariants = (editingItem.variants || []).filter((v) => v.name.trim().length > 0);
    if (validVariants.length === 0) {
      alert('กรุณาระบุชื่อตัวเลือกอย่างน้อย 1 รายการ');
      return;
    }

    // Default primary price & cost from first variant
    const primaryPrice = validVariants[0]?.price ?? editingItem.price ?? 80;
    const primaryCost = validVariants[0]?.cost ?? editingItem.cost ?? 40;

    const payload: MenuItem = {
      ...(editingItem as MenuItem),
      name: editingItem.name.trim(),
      nameEn: editingItem.nameEn?.trim() || '',
      description: editingItem.description?.trim() || '',
      descriptionEn: editingItem.descriptionEn?.trim() || '',
      price: primaryPrice,
      cost: primaryCost,
      variants: validVariants,
    };

    try {
      if (isNewItem) {
        addMenuItem(payload);
      } else if (payload.id) {
        updateMenuItem(payload.id, payload);
      }
      setEditingItem(null);
    } catch (err: any) {
      console.error('Failed to save menu item to localStorage:', err);
      setStorageError(t('menu_storage_full_err'));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('menu_mgmt_title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('menu_mgmt_sub')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setCategoryNameInput('');
              setCategoryNameEnInput('');
              setShowCategoryModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>{t('menu_mgmt_cat_btn')}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('menu_mgmt_add_btn')}</span>
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
            placeholder={t('menu_mgmt_search')}
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
            {t('all')} ({menuItems.length})
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
              {c.icon} {getName(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          const categoryName = getName(cat) || '';
          const variantCount = item.variants?.length || 1;

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
                  alt={getName(item)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" fill="%23cbd5e1"><rect width="200" height="150"/><text x="100" y="80" font-family="sans-serif" font-size="16" fill="%23475569" text-anchor="middle">Food</text></svg>';
                  }}
                />
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-xs">
                    {categoryName}
                  </span>
                  {item.isRecommended && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold">
                      {t('recommended_badge')}
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
                    {item.isSoldOut ? (
                      <Ban className="w-3 h-3" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    <span>{item.isSoldOut ? t('option_sold_out') : 'พร้อมขาย'}</span>
                  </button>
                </div>
              </div>

              {/* Item Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {getName(item)}
                  </h4>
                  {item.nameEn && item.nameEn !== item.name && (
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.nameEn}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {getDescription(item)}
                  </p>
                </div>

                {/* Variants preview & prices */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      {variantCount} {t('food_detail_options_title')}:
                    </span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {item.variants && item.variants.length > 0 ? (
                        item.variants.length === 1 ? (
                          formatBaht(item.variants[0].price)
                        ) : (
                          `฿${Math.min(...item.variants.map((v) => v.price))} - ฿${Math.max(
                            ...item.variants.map((v) => v.price)
                          )}`
                        )
                      ) : (
                        formatBaht(item.price)
                      )}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{t('edit')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemToDelete(item)}
                    className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title={t('delete')}
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
          title={
            isNewItem
              ? t('menu_form_new_title')
              : t('menu_form_edit_title', {
                  name: getName({ name: editingItem.name || '', nameEn: editingItem.nameEn }),
                })
          }
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSaveItem} className="space-y-4">
            {storageError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {storageError}
              </div>
            )}

            {/* Hidden file & camera inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageFileChange}
            />

            {/* Photo Upload Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {t('menu_form_photo_label')}
              </label>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="relative w-36 h-28 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                  <img
                    src={editingItem.image || ''}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" fill="%23cbd5e1"><rect width="100" height="80"/><text x="50" y="45" font-family="sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">No photo</text></svg>';
                    }}
                  />
                  {isCompressing && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-xs font-bold">
                      กำลังประมวลผล...
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{t('menu_form_photo_upload_btn')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{t('menu_form_photo_camera_btn')}</span>
                    </button>

                    {editingItem.image && (
                      <button
                        type="button"
                        onClick={() => setEditingItem((prev) => ({ ...prev, image: '' }))}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('menu_form_photo_remove')}</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('menu_form_photo_url_label')}
                    </label>
                    <input
                      type="text"
                      value={editingItem.image || ''}
                      onChange={(e) => setEditingItem((prev) => ({ ...prev, image: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Names (TH & EN) and Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('menu_form_name_th')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="เช่น ผัดกะเพราโบราณ"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('menu_form_name_en')}
                </label>
                <input
                  type="text"
                  value={editingItem.nameEn || ''}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, nameEn: e.target.value }))}
                  placeholder="e.g. Traditional Basil Stir-fry"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('menu_form_cat')}
                </label>
                <select
                  value={editingItem.categoryId || categories[0]?.id}
                  onChange={(e) => setEditingItem((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {getName(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4 pt-4 sm:pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.isRecommended || false}
                    onChange={(e) =>
                      setEditingItem((prev) => ({ ...prev, isRecommended: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('menu_form_recommended')}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.isSoldOut || false}
                    onChange={(e) =>
                      setEditingItem((prev) => ({ ...prev, isSoldOut: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {t('menu_form_sold_out')}
                  </span>
                </label>
              </div>
            </div>

            {/* Descriptions (TH & EN) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('menu_form_desc_th')}
                </label>
                <textarea
                  rows={2}
                  value={editingItem.description || ''}
                  onChange={(e) =>
                    setEditingItem((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="สูตรโบราณ รสเข้มข้น หอมใบกะเพราแท้..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('menu_form_desc_en')}
                </label>
                <textarea
                  rows={2}
                  value={editingItem.descriptionEn || ''}
                  onChange={(e) =>
                    setEditingItem((prev) => ({ ...prev, descriptionEn: e.target.value }))
                  }
                  placeholder="Traditional holy basil stir-fry, fragrant and spicy..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Options / Variants List Section (Prices belong here) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('menu_form_options_header')}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    กำหนดตัวเลือก เช่น หมูสับ, ไก่, ทะเล พร้อมราคาและต้นทุนของแต่ละตัวเลือก
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('menu_form_add_option_btn')}</span>
                </button>
              </div>

              <div className="space-y-2">
                {(editingItem.variants || []).map((variant, idx) => (
                  <div
                    key={variant.id || idx}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveVariant(idx, 'up')}
                        className={`p-1 rounded text-slate-400 hover:text-slate-600 ${
                          idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === (editingItem.variants?.length || 1) - 1}
                        onClick={() => handleMoveVariant(idx, 'down')}
                        className={`p-1 rounded text-slate-400 hover:text-slate-600 ${
                          idx === (editingItem.variants?.length || 1) - 1
                            ? 'opacity-30 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder={t('menu_form_option_name_th')}
                        value={variant.name}
                        onChange={(e) => handleUpdateVariant(idx, { name: e.target.value })}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                      />
                      <input
                        type="text"
                        placeholder={t('menu_form_option_name_en')}
                        value={variant.nameEn || ''}
                        onChange={(e) => handleUpdateVariant(idx, { nameEn: e.target.value })}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20">
                        <input
                          type="number"
                          required
                          min={0}
                          placeholder={t('price')}
                          value={variant.price}
                          onChange={(e) =>
                            handleUpdateVariant(idx, { price: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 text-amber-600 dark:text-amber-400"
                        />
                      </div>

                      <div className="w-16">
                        <input
                          type="number"
                          min={0}
                          placeholder={t('cost')}
                          value={variant.cost}
                          onChange={(e) =>
                            handleUpdateVariant(idx, { cost: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-500"
                        />
                      </div>

                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={variant.isSoldOut || false}
                          onChange={(e) =>
                            handleUpdateVariant(idx, { isSoldOut: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded text-rose-500"
                        />
                        <span>{t('menu_form_option_sold_out')}</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(idx)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title={t('delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs cursor-pointer"
              >
                {t('menu_form_save_btn')}
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
          title={t('menu_delete_confirm_title')}
          message={t('menu_delete_confirm_msg', { name: getName(itemToDelete) })}
        />
      )}

      {/* Categories Management Modal */}
      {showCategoryModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCategoryModal(false)}
          title={t('menu_mgmt_cat_btn')}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {editingCategory ? t('edit') : t('add')} {t('menu_form_cat')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  placeholder={t('bottom_category_name_label')}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
                <input
                  type="text"
                  value={categoryNameEnInput}
                  onChange={(e) => setCategoryNameEnInput(e.target.value)}
                  placeholder={t('bottom_category_name_en_label')}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
              <button
                type="button"
                disabled={!categoryNameInput.trim()}
                onClick={() => {
                  if (editingCategory) {
                    updateCategory(
                      editingCategory.id,
                      categoryNameInput,
                      editingCategory.icon,
                      editingCategory.color,
                      categoryNameEnInput
                    );
                    setEditingCategory(null);
                  } else {
                    addCategory(
                      categoryNameInput,
                      '🍽️',
                      '#f59e0b',
                      categoryNameEnInput
                    );
                  }
                  setCategoryNameInput('');
                  setCategoryNameEnInput('');
                }}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                {editingCategory ? t('save') : t('add')}
              </button>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{c.icon}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {getName(c)}
                    </span>
                    {c.nameEn && (
                      <span className="text-[10px] text-slate-400">({c.nameEn})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(c);
                        setCategoryNameInput(c.name);
                        setCategoryNameEnInput(c.nameEn || '');
                      }}
                      className="p-1 text-slate-500 hover:text-amber-500 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteCategory(c.id)}
                        className="p-1 text-slate-500 hover:text-rose-500 cursor-pointer"
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
