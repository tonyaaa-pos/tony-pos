import React, { useState, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { MenuItem, MenuCategory, ItemVariantOption, OptionGroup, OptionChoice } from '../../types';
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
  GripVertical,
  Sliders,
  Check,
  Copy,
  PlusCircle,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { compressImageFile } from '../../utils/imageCompressor';
import { isDishInCategory } from '../pos/POSView';

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
    activeCategory,
    setActiveCategory,
    optionPresets,
    addOptionPreset,
    updateOptionPreset,
    deleteOptionPreset,
    reorderOptionPresets,
  } = usePOS();

  const { t, getName, getDescription } = useLanguage();

  const currentCategory = activeCategory || 'all';
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Drag and drop state for Option Groups within editing item
  const [draggedOptionGroupIndex, setDraggedOptionGroupIndex] = useState<number | null>(null);
  const [dragOverOptionGroupIndex, setDragOverOptionGroupIndex] = useState<number | null>(null);

  // Master Option Presets Modal
  const [showOptionPresetsModal, setShowOptionPresetsModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<OptionGroup | null>(null);
  const [isNewPreset, setIsNewPreset] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<OptionGroup | null>(null);
  const [draggedPresetIndex, setDraggedPresetIndex] = useState<number | null>(null);
  const [dragOverPresetIndex, setDragOverPresetIndex] = useState<number | null>(null);

  // Hidden file input for photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryNameEnInput, setCategoryNameEnInput] = useState('');

  const filteredItems = menuItems.filter((item) => {
    const matchCat = isDishInCategory(item, currentCategory, categories);
    const matchSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleOpenAdd = () => {
    setIsNewItem(true);
    setStorageError(null);
    const defaultCatId =
      currentCategory !== 'all' && categories.some((c) => c.id === currentCategory)
        ? currentCategory
        : categories[0]?.id || 'cat_1';

    setEditingItem({
      name: '',
      nameEn: '',
      description: '',
      descriptionEn: '',
      price: 80,
      cost: 40,
      categoryId: defaultCatId,
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
      optionGroups: item.optionGroups ? JSON.parse(JSON.stringify(item.optionGroups)) : [],
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

  // Option Groups selection within editing item
  const isPresetSelected = (preset: OptionGroup): boolean => {
    if (!editingItem?.optionGroups) return false;
    return editingItem.optionGroups.some(
      (g) =>
        g.id === preset.id ||
        g.name === preset.name ||
        (g as any).presetId === preset.id ||
        g.id.startsWith(`opt_${preset.id}_`)
    );
  };

  const handleToggleOptionPreset = (preset: OptionGroup) => {
    if (!editingItem) return;
    const currentGroups = editingItem.optionGroups || [];
    const isSelected = isPresetSelected(preset);

    if (isSelected) {
      // Unselect / Remove
      const updated = currentGroups.filter(
        (g) =>
          g.id !== preset.id &&
          g.name !== preset.name &&
          (g as any).presetId !== preset.id &&
          !g.id.startsWith(`opt_${preset.id}_`)
      );
      setEditingItem({
        ...editingItem,
        optionGroups: updated,
      });
    } else {
      // Select / Add clone
      const newGroup: OptionGroup = {
        ...preset,
        id: `opt_${preset.id}_${Date.now()}`,
        choices: (preset.choices || []).map((c, i) => ({
          ...c,
          id: `ch_${c.id || i}_${Date.now()}`,
        })),
      };
      (newGroup as any).presetId = preset.id;
      setEditingItem({
        ...editingItem,
        optionGroups: [...currentGroups, newGroup],
      });
    }
  };

  const handleAddOptionGroupFromPreset = (preset: OptionGroup) => {
    handleToggleOptionPreset(preset);
  };

  const handleUpdateOptionGroup = (idx: number, updates: Partial<OptionGroup>) => {
    if (!editingItem || !editingItem.optionGroups) return;
    const updated = [...editingItem.optionGroups];
    updated[idx] = { ...updated[idx], ...updates };
    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
  };

  const handleDeleteOptionGroup = (idx: number) => {
    if (!editingItem || !editingItem.optionGroups) return;
    const updated = editingItem.optionGroups.filter((_, i) => i !== idx);
    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
  };

  const handleMoveOptionGroup = (idx: number, direction: 'up' | 'down') => {
    if (!editingItem || !editingItem.optionGroups) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= editingItem.optionGroups.length) return;

    const updated = [...editingItem.optionGroups];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
  };

  const handleOptionGroupDragStart = (idx: number) => {
    setDraggedOptionGroupIndex(idx);
  };

  const handleOptionGroupDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverOptionGroupIndex !== idx) {
      setDragOverOptionGroupIndex(idx);
    }
  };

  const handleOptionGroupDrop = (idx: number) => {
    if (
      draggedOptionGroupIndex === null ||
      draggedOptionGroupIndex === idx ||
      !editingItem ||
      !editingItem.optionGroups
    ) {
      setDraggedOptionGroupIndex(null);
      setDragOverOptionGroupIndex(null);
      return;
    }
    const updated = [...editingItem.optionGroups];
    const [movedItem] = updated.splice(draggedOptionGroupIndex, 1);
    updated.splice(idx, 0, movedItem);

    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
    setDraggedOptionGroupIndex(null);
    setDragOverOptionGroupIndex(null);
  };

  const handleAddChoiceToGroup = (groupIdx: number) => {
    if (!editingItem || !editingItem.optionGroups) return;
    const updated = [...editingItem.optionGroups];
    const targetGroup = updated[groupIdx];
    const newChoice: OptionChoice = {
      id: 'ch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: '',
      nameEn: '',
      priceDelta: 0,
    };
    updated[groupIdx] = {
      ...targetGroup,
      choices: [...(targetGroup.choices || []), newChoice],
    };
    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
  };

  const handleUpdateChoiceInGroup = (
    groupIdx: number,
    choiceIdx: number,
    updates: Partial<OptionChoice>
  ) => {
    if (!editingItem || !editingItem.optionGroups) return;
    const updated = [...editingItem.optionGroups];
    const targetGroup = updated[groupIdx];
    const choices = [...targetGroup.choices];
    choices[choiceIdx] = { ...choices[choiceIdx], ...updates };
    updated[groupIdx] = {
      ...targetGroup,
      choices,
    };
    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
  };

  const handleDeleteChoiceFromGroup = (groupIdx: number, choiceIdx: number) => {
    if (!editingItem || !editingItem.optionGroups) return;
    const updated = [...editingItem.optionGroups];
    const targetGroup = updated[groupIdx];
    const choices = targetGroup.choices.filter((_, i) => i !== choiceIdx);
    updated[groupIdx] = {
      ...targetGroup,
      choices,
    };
    setEditingItem({
      ...editingItem,
      optionGroups: updated,
    });
  };

  // Master Presets Handlers
  const handleMovePreset = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= optionPresets.length) return;
    const updated = [...optionPresets];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    reorderOptionPresets(updated);
  };

  const handlePresetDragStart = (idx: number) => {
    setDraggedPresetIndex(idx);
  };

  const handlePresetDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverPresetIndex !== idx) {
      setDragOverPresetIndex(idx);
    }
  };

  const handlePresetDrop = (idx: number) => {
    if (draggedPresetIndex === null || draggedPresetIndex === idx) {
      setDraggedPresetIndex(null);
      setDragOverPresetIndex(null);
      return;
    }
    const updated = [...optionPresets];
    const [movedItem] = updated.splice(draggedPresetIndex, 1);
    updated.splice(idx, 0, movedItem);
    reorderOptionPresets(updated);
    setDraggedPresetIndex(null);
    setDragOverPresetIndex(null);
  };

  const handleOpenAddPreset = () => {
    setIsNewPreset(true);
    setEditingPreset({
      id: 'preset_' + Date.now(),
      name: '',
      nameEn: '',
      type: 'single',
      required: false,
      choices: [
        {
          id: 'ch_' + Date.now() + '_1',
          name: '',
          nameEn: '',
          priceDelta: 0,
        },
      ],
    });
  };

  const handleOpenEditPreset = (preset: OptionGroup) => {
    setIsNewPreset(false);
    setEditingPreset(JSON.parse(JSON.stringify(preset)));
  };

  const handleSaveEditingPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset || !editingPreset.name?.trim()) return;

    const validChoices = (editingPreset.choices || [])
      .filter((c) => c.name.trim().length > 0)
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        nameEn: c.nameEn?.trim() || '',
        priceDelta: Number(c.priceDelta) || 0,
      }));

    if (validChoices.length === 0) {
      alert('กรุณาระบุตัวเลือกย่อยอย่างน้อย 1 รายการ');
      return;
    }

    const payload: OptionGroup = {
      ...editingPreset,
      name: editingPreset.name.trim(),
      nameEn: editingPreset.nameEn?.trim() || '',
      choices: validChoices,
    };

    if (isNewPreset) {
      addOptionPreset(payload);
    } else {
      updateOptionPreset(payload.id, payload);
    }
    setEditingPreset(null);
  };

  const handleAddChoiceToEditingPreset = () => {
    if (!editingPreset) return;
    const newChoice: OptionChoice = {
      id: 'ch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: '',
      nameEn: '',
      priceDelta: 0,
    };
    setEditingPreset({
      ...editingPreset,
      choices: [...(editingPreset.choices || []), newChoice],
    });
  };

  const handleUpdateChoiceInEditingPreset = (choiceIdx: number, updates: Partial<OptionChoice>) => {
    if (!editingPreset) return;
    const choices = [...editingPreset.choices];
    choices[choiceIdx] = { ...choices[choiceIdx], ...updates };
    setEditingPreset({
      ...editingPreset,
      choices,
    });
  };

  const handleDeleteChoiceFromEditingPreset = (choiceIdx: number) => {
    if (!editingPreset) return;
    const choices = editingPreset.choices.filter((_, i) => i !== choiceIdx);
    setEditingPreset({
      ...editingPreset,
      choices,
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

    // Clean option groups
    const cleanOptionGroups: OptionGroup[] = (editingItem.optionGroups || [])
      .filter((grp) => grp.name && grp.name.trim().length > 0)
      .map((grp) => ({
        ...grp,
        name: grp.name.trim(),
        nameEn: grp.nameEn?.trim() || '',
        choices: (grp.choices || [])
          .filter((c) => c.name && c.name.trim().length > 0)
          .map((c) => ({
            ...c,
            name: c.name.trim(),
            nameEn: c.nameEn?.trim() || '',
            priceDelta: Number(c.priceDelta) || 0,
          })),
      }));

    const payload: MenuItem = {
      ...(editingItem as MenuItem),
      name: editingItem.name.trim(),
      nameEn: editingItem.nameEn?.trim() || '',
      description: editingItem.description?.trim() || '',
      descriptionEn: editingItem.descriptionEn?.trim() || '',
      price: primaryPrice,
      cost: primaryCost,
      variants: validVariants,
      optionGroups: cleanOptionGroups,
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
            onClick={() => setShowOptionPresetsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold hover:bg-amber-100 transition cursor-pointer"
            title="จัดการ set เมนูย่อยแม่แบบที่ใช้ซ้ำได้"
          >
            <Sliders className="w-4 h-4" />
            <span>จัดการ set เมนูย่อยแม่แบบ</span>
          </button>

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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              currentCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-2xs font-extrabold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('all')} ({menuItems.length})
          </button>
          {categories.map((c) => {
            const count = menuItems.filter((m) => isDishInCategory(m, c.id, categories)).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  currentCategory === c.id
                    ? 'bg-amber-500 text-slate-950 shadow-2xs font-extrabold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{c.icon}</span>
                <span>{getName(c)}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    currentCategory === c.id
                      ? 'bg-slate-950/20 text-slate-950 font-black'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
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

            {/* Section: เลือกใช้งาน set เมนูย่อย (Option Sets) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-slate-800/80 border border-amber-200/70 dark:border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      เลือกใช้งาน set เมนูย่อย (Option Sets)
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    คลิกเลือก set เมนูย่อยที่สร้างไว้เพื่อใช้กับเมนูนี้ (สามารถลากย้ายตำแหน่ง หรือใช้ลูกศรขึ้น-ลงได้)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOptionPresetsModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 text-xs font-bold hover:bg-amber-200 transition cursor-pointer shrink-0 self-start sm:self-auto"
                  title="เปิดหน้าต่างจัดการหรือเพิ่ม set เมนูย่อยแม่แบบ"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>จัดการ set เมนูย่อยแม่แบบ</span>
                </button>
              </div>

              {/* Selection list of Master Presets */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  คลิกเพื่อเลือกใช้งาน set เมนูย่อย:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {optionPresets.map((preset) => {
                    const isSelected = isPresetSelected(preset);

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleToggleOptionPreset(preset)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer select-none flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500 ring-1 ring-amber-400/50 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {preset.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                                preset.type === 'single'
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {preset.type === 'single' ? 'เลือกได้ 1 อย่าง' : 'เลือกได้หลายอย่าง'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {preset.choices
                              .map((c) => c.name + (c.priceDelta > 0 ? ` (+${c.priceDelta}฿)` : ''))
                              .join(', ')}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="w-4 h-4 rounded text-amber-500 pointer-events-none cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Sets Order List */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    ลำดับ set เมนูย่อยที่ใช้งานในเมนูนี้ ({editingItem.optionGroups?.length || 0} set)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    คลิกค้างแล้วลาก หรือใช้ลูกศรขึ้น-ลง เพื่อจัดลำดับการแสดงผล
                  </span>
                </div>

                {(!editingItem.optionGroups || editingItem.optionGroups.length === 0) ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center bg-white/40 dark:bg-slate-900/40">
                    <p className="text-xs text-slate-400">
                      ยังไม่ได้เลือกใช้งาน set เมนูย่อยใดๆ (คลิกเลือก set จากรายการด้านบน)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingItem.optionGroups.map((group, gIdx) => {
                      const isDragging = draggedOptionGroupIndex === gIdx;
                      const isOver = dragOverOptionGroupIndex === gIdx;

                      return (
                        <div
                          key={group.id || gIdx}
                          draggable
                          onDragStart={() => handleOptionGroupDragStart(gIdx)}
                          onDragOver={(e) => handleOptionGroupDragOver(e, gIdx)}
                          onDrop={() => handleOptionGroupDrop(gIdx)}
                          onDragEnd={() => {
                            setDraggedOptionGroupIndex(null);
                            setDragOverOptionGroupIndex(null);
                          }}
                          className={`p-2.5 rounded-xl bg-white dark:bg-slate-900 border transition-all ${
                            isDragging
                              ? 'opacity-40 border-dashed border-amber-500 scale-[0.99]'
                              : isOver
                              ? 'border-amber-500 ring-2 ring-amber-400/30'
                              : 'border-slate-200 dark:border-slate-700 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Drag handle */}
                              <div
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
                                title="คลิกค้างแล้วลากเพื่อย้ายลำดับ"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              {/* Up / Down arrows */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={gIdx === 0}
                                  onClick={() => handleMoveOptionGroup(gIdx, 'up')}
                                  className={`p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                    gIdx === 0
                                      ? 'opacity-25 cursor-not-allowed'
                                      : 'cursor-pointer hover:text-amber-600'
                                  }`}
                                  title="เลื่อนขึ้น"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={gIdx === (editingItem.optionGroups?.length || 1) - 1}
                                  onClick={() => handleMoveOptionGroup(gIdx, 'down')}
                                  className={`p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                    gIdx === (editingItem.optionGroups?.length || 1) - 1
                                      ? 'opacity-25 cursor-not-allowed'
                                      : 'cursor-pointer hover:text-amber-600'
                                  }`}
                                  title="เลื่อนลง"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono shrink-0">
                                #{gIdx + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {group.name}
                                  </span>
                                  {group.nameEn && (
                                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                                      ({group.nameEn})
                                    </span>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                                      group.type === 'single'
                                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    }`}
                                  >
                                    {group.type === 'single' ? 'เลือกได้ 1 อย่าง' : 'เลือกได้หลายอย่าง'}
                                  </span>
                                </div>

                                {/* Choices preview pills */}
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(group.choices || []).map((c) => (
                                    <span
                                      key={c.id}
                                      className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                                    >
                                      {c.name}
                                      {c.priceDelta > 0 && (
                                        <span className="text-amber-600 dark:text-amber-400 font-bold ml-1 font-mono">
                                          +{c.priceDelta}฿
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteOptionGroup(gIdx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
                              title="ยกเลิกการเลือก set นี้"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* Option Presets Library Modal (จัดการ set เมนูย่อยแม่แบบ) */}
      {showOptionPresetsModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowOptionPresetsModal(false)}
          title="จัดการ set เมนูย่อยแม่แบบ (Option Sets Library)"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
              <div>
                <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                  หมวด set แม่แบบ (เช่น set เพิ่มไข่ดาว, เลือกความเผ็ด, เลือกท๊อปปิ้ง)
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  คลิกค้างแล้วลากเพื่อย้ายลำดับ หรือใช้ลูกศรขึ้น-ลง เพื่อจัดลำดับ set แม่แบบ
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddPreset}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม set แม่แบบใหม่</span>
              </button>
            </div>

            {/* Presets List with Drag & Drop and Up/Down Arrows */}
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {optionPresets.map((preset, idx) => {
                const isDragging = draggedPresetIndex === idx;
                const isOver = dragOverPresetIndex === idx;

                return (
                  <div
                    key={preset.id}
                    draggable
                    onDragStart={() => handlePresetDragStart(idx)}
                    onDragOver={(e) => handlePresetDragOver(e, idx)}
                    onDrop={() => handlePresetDrop(idx)}
                    onDragEnd={() => {
                      setDraggedPresetIndex(null);
                      setDragOverPresetIndex(null);
                    }}
                    className={`p-3 rounded-xl bg-white dark:bg-slate-900 border transition-all ${
                      isDragging
                        ? 'opacity-40 border-dashed border-amber-500 scale-[0.99]'
                        : isOver
                        ? 'border-amber-500 ring-2 ring-amber-400/30'
                        : 'border-slate-200 dark:border-slate-700 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Drag Handle */}
                        <div
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing"
                          title="คลิกค้างแล้วลากเพื่อย้ายลำดับ"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Up / Down Arrows */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMovePreset(idx, 'up')}
                            className={`p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              idx === 0 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer hover:text-amber-600'
                            }`}
                            title="เลื่อนขึ้น"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === optionPresets.length - 1}
                            onClick={() => handleMovePreset(idx, 'down')}
                            className={`p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                              idx === optionPresets.length - 1
                                ? 'opacity-25 cursor-not-allowed'
                                : 'cursor-pointer hover:text-amber-600'
                            }`}
                            title="เลื่อนลง"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {preset.name}
                            </span>
                            {preset.nameEn && (
                              <span className="text-[11px] text-slate-400">({preset.nameEn})</span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                preset.type === 'single'
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {preset.type === 'single' ? 'เลือกได้ 1 อย่าง' : 'เลือกได้หลายอย่าง'}
                            </span>
                          </div>

                          {/* Choices Preview */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {preset.choices.map((c) => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                              >
                                {c.name}
                                {c.priceDelta > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400 font-bold ml-1 font-mono">
                                    +{c.priceDelta}฿
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPreset(preset)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="แก้ไข set นี้"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresetToDelete(preset)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="ลบ set นี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOptionPresetsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Editing Master Preset Modal */}
      {editingPreset && (
        <Modal
          isOpen={true}
          onClose={() => setEditingPreset(null)}
          title={isNewPreset ? 'เพิ่ม set เมนูย่อยแม่แบบ' : 'แก้ไข set เมนูย่อยแม่แบบ'}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSaveEditingPreset} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ set แม่แบบ (ภาษาไทย) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                  placeholder="เช่น เพิ่มไข่ดาว, เลือกระดับความเผ็ด"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ set แม่แบบ (English)
                </label>
                <input
                  type="text"
                  value={editingPreset.nameEn || ''}
                  onChange={(e) => setEditingPreset({ ...editingPreset, nameEn: e.target.value })}
                  placeholder="e.g. Add Eggs, Spiciness Level"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ประเภทการเลือก
                </label>
                <p className="text-[11px] text-slate-400">
                  {editingPreset.type === 'single'
                    ? 'ลูกค้าสามารถเลือกได้เพียง 1 รายการเท่านั้น'
                    : 'ลูกค้าสามารถเลือกได้หลายรายการพร้อมกัน'}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingPreset({ ...editingPreset, type: 'single' })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    editingPreset.type === 'single'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  เลือกได้ 1 อย่าง (Single)
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPreset({ ...editingPreset, type: 'multiple' })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    editingPreset.type === 'multiple'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  เลือกได้หลายอย่าง (Multiple)
                </button>
              </div>
            </div>

            {/* Choices list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  รายการตัวเลือกย่อย ({editingPreset.choices.length} รายการ)
                </label>
                <button
                  type="button"
                  onClick={handleAddChoiceToEditingPreset}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มตัวเลือกย่อย</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {editingPreset.choices.map((choice, cIdx) => (
                  <div
                    key={choice.id || cIdx}
                    className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <span className="text-[11px] text-slate-400 font-mono w-4 text-center">
                      {cIdx + 1}
                    </span>

                    <input
                      type="text"
                      required
                      placeholder="ชื่อตัวเลือก (ไทย)"
                      value={choice.name}
                      onChange={(e) =>
                        handleUpdateChoiceInEditingPreset(cIdx, { name: e.target.value })
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />

                    <input
                      type="text"
                      placeholder="Name (EN)"
                      value={choice.nameEn || ''}
                      onChange={(e) =>
                        handleUpdateChoiceInEditingPreset(cIdx, { nameEn: e.target.value })
                      }
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs hidden sm:block"
                    />

                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <span className="text-[11px] text-slate-400 font-mono">+฿</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={choice.priceDelta}
                        onChange={(e) =>
                          handleUpdateChoiceInEditingPreset(cIdx, {
                            priceDelta: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                        title="ราคาบวกเพิ่ม (0 = ฟรี)"
                      />
                    </div>

                    {editingPreset.choices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteChoiceFromEditingPreset(cIdx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                        title="ลบตัวเลือกนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Delete Master Preset */}
      {presetToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setPresetToDelete(null)}
          onConfirm={() => {
            deleteOptionPreset(presetToDelete.id);
            setPresetToDelete(null);
          }}
          title="ยืนยันการลบ set เมนูย่อยแม่แบบ"
          message={`คุณแน่ใจหรือไม่ว่าต้องการลบ set แม่แบบ "${presetToDelete.name}"? (เมนูอาหารเดิมที่ใช้ set นี้ไปแล้วจะไม่ได้รับผลกระทบ)`}
        />
      )}
    </div>
  );
};
