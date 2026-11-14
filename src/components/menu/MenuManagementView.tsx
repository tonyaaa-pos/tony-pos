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
  ChevronLeft,
  ChevronRight,
  Calculator,
  Link2,
  Lock,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { soundService } from '../../utils/audio';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { compressImageFile } from '../../utils/imageCompressor';
import { isDishInCategory } from '../pos/POSView';
import { BilingualNameInput } from '../common/BilingualNameInput';
import { FoodCostVariantPickerModal } from './FoodCostVariantPickerModal';
import {
  getCachedCostBundle,
  findMatchingCostMenu,
  findMatchingCostVariant,
  getVariantRecipeCost,
  buildVariantsFromCostMenu,
  syncSellingPriceUpdatesToCostBundle,
  fetchRemoteCostManagementStatus,
  COST_BUNDLE_UPDATED_EVENT,
  type TonysKitchenMenu,
} from '../../services/costSyncService';

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
    reorderCategories,
    activeCategory,
    setActiveCategory,
    optionPresets,
    addOptionPreset,
    updateOptionPreset,
    deleteOptionPreset,
    reorderOptionPresets,
  } = usePOS();

  const { t, getName, getDescription } = useLanguage();

  const currentCategory =
    activeCategory && categories.some((c) => c.id === activeCategory)
      ? activeCategory
      : categories[0]?.id || 'all';
  const [searchQuery, setSearchQuery] = useState('');

  // Category Pills Bar drag-and-drop state
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);
  const [dragOverCatIndex, setDragOverCatIndex] = useState<number | null>(null);

  // Category Modal drag-and-drop state
  const [draggedModalCatIndex, setDraggedModalCatIndex] = useState<number | null>(null);
  const [dragOverModalCatIndex, setDragOverModalCatIndex] = useState<number | null>(null);

  // Category movement helper for horizontal pills bar
  const handleMoveCategoryHorizontal = (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    reorderCategories(idx, targetIdx);
    soundService.playTap();
  };

  // Category movement helper for modal list
  const handleMoveCategoryVertical = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    reorderCategories(idx, targetIdx);
    soundService.playTap();
  };

  // Modals
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Drag and drop state for Option Groups within editing item
  const [draggedOptionGroupIndex, setDraggedOptionGroupIndex] = useState<number | null>(null);
  const [dragOverOptionGroupIndex, setDragOverOptionGroupIndex] = useState<number | null>(null);
  const [showOptionPickerModal, setShowOptionPickerModal] = useState(false);

  // Food Cost System (หลักสากล) link & variant picker state
  const [showFoodCostVariantPicker, setShowFoodCostVariantPicker] = useState(false);
  const [costMenus, setCostMenus] = useState<TonysKitchenMenu[]>(
    () => getCachedCostBundle()?.payload?.menus || []
  );

  const refreshCachedCostMenus = async () => {
    setCostMenus(getCachedCostBundle()?.payload?.menus || []);
    try {
      const res = await fetchRemoteCostManagementStatus();
      if (res.status === 'found' && res.data?.payload?.menus) {
        setCostMenus(res.data.payload.menus);
      }
    } catch {
      // Keep cached menus
    }
  };

  React.useEffect(() => {
    const syncFromCache = () => {
      setCostMenus(getCachedCostBundle()?.payload?.menus || []);
    };
    window.addEventListener(COST_BUNDLE_UPDATED_EVENT, syncFromCache);
    window.addEventListener('storage', syncFromCache);
    return () => {
      window.removeEventListener(COST_BUNDLE_UPDATED_EVENT, syncFromCache);
      window.removeEventListener('storage', syncFromCache);
    };
  }, []);

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
    void refreshCachedCostMenus();
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
      costMenuId: '',
      costMenuName: '',
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
    void refreshCachedCostMenus();
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

    const latestCostMenus = getCachedCostBundle()?.payload?.menus || [];
    const autoCostMenu = item.costMenuId
      ? latestCostMenus.find((m) => m.id === item.costMenuId)
      : findMatchingCostMenu(item.name, latestCostMenus, undefined, item.id);

    const syncedVariants = variants.map((v) => {
      if (autoCostMenu && v.costVariantId) {
        const matchedCv = findMatchingCostVariant(
          v.name,
          autoCostMenu.variants || [],
          v.costVariantId,
          v.id,
          item.name
        );
        if (matchedCv) {
          return {
            ...v,
            cost: getVariantRecipeCost(matchedCv),
            costMenuId: autoCostMenu.id,
            costVariantId: matchedCv.id,
            costVariantName: matchedCv.name || matchedCv.variantName || v.name,
          };
        }
      }
      return v;
    });

    setEditingItem({
      ...item,
      costMenuId: item.costMenuId || autoCostMenu?.id || '',
      costMenuName: item.costMenuName || autoCostMenu?.name || '',
      variants: syncedVariants,
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
    setEditingItem((prev) => {
      if (!prev || !prev.variants) return prev;
      const updated = [...prev.variants];
      updated[idx] = { ...updated[idx], ...updates };
      return { ...prev, variants: updated };
    });
  };

  const handleDeleteVariant = (idx: number) => {
    setEditingItem((prev) => {
      if (!prev || !prev.variants) return prev;
      if (prev.variants.length <= 1) {
        alert('เมนูต้องมีอย่างน้อย 1 ตัวเลือกราคา');
        return prev;
      }
      return { ...prev, variants: prev.variants.filter((_, i) => i !== idx) };
    });
  };

  const handleMoveVariant = (idx: number, direction: 'up' | 'down') => {
    setEditingItem((prev) => {
      if (!prev || !prev.variants) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.variants.length) return prev;
      const updated = [...prev.variants];
      const temp = updated[idx];
      updated[idx] = updated[targetIdx];
      updated[targetIdx] = temp;
      return { ...prev, variants: updated };
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
    setEditingItem((prev) => {
      if (!prev) return prev;
      const currentGroups = prev.optionGroups || [];
      const isSelected = currentGroups.some(
        (g) =>
          g.id === preset.id ||
          g.name === preset.name ||
          (g as any).presetId === preset.id ||
          g.id.startsWith(`opt_${preset.id}_`)
      );

      if (isSelected) {
        // Unselect / Remove
        const updated = currentGroups.filter(
          (g) =>
            g.id !== preset.id &&
            g.name !== preset.name &&
            (g as any).presetId !== preset.id &&
            !g.id.startsWith(`opt_${preset.id}_`)
        );
        return { ...prev, optionGroups: updated };
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
        return { ...prev, optionGroups: [...currentGroups, newGroup] };
      }
    });
  };

  const handleAddOptionGroupFromPreset = (preset: OptionGroup) => {
    handleToggleOptionPreset(preset);
  };

  const handleUpdateOptionGroup = (idx: number, updates: Partial<OptionGroup>) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const updated = [...prev.optionGroups];
      updated[idx] = { ...updated[idx], ...updates };
      return { ...prev, optionGroups: updated };
    });
  };

  const handleDeleteOptionGroup = (idx: number) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      return { ...prev, optionGroups: prev.optionGroups.filter((_, i) => i !== idx) };
    });
  };

  const handleMoveOptionGroup = (idx: number, direction: 'up' | 'down') => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.optionGroups.length) return prev;
      const updated = [...prev.optionGroups];
      const temp = updated[idx];
      updated[idx] = updated[targetIdx];
      updated[targetIdx] = temp;
      return { ...prev, optionGroups: updated };
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
      draggedOptionGroupIndex === idx
    ) {
      setDraggedOptionGroupIndex(null);
      setDragOverOptionGroupIndex(null);
      return;
    }
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const updated = [...prev.optionGroups];
      const [movedItem] = updated.splice(draggedOptionGroupIndex, 1);
      updated.splice(idx, 0, movedItem);
      return { ...prev, optionGroups: updated };
    });
    setDraggedOptionGroupIndex(null);
    setDragOverOptionGroupIndex(null);
  };

  const handleAddCustomOptionGroup = () => {
    setEditingItem((prev) => {
      if (!prev) return prev;
      const newGroup: OptionGroup = {
        id: 'opt_custom_' + Date.now(),
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
            costDelta: 0,
          },
        ],
      };
      return {
        ...prev,
        optionGroups: [...(prev.optionGroups || []), newGroup],
      };
    });
    soundService.playTap();
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
      costDelta: 0,
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
        costDelta: Number(c.costDelta) || 0,
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
      costDelta: 0,
    };
    setEditingPreset({
      ...editingPreset,
      choices: [...(editingPreset.choices || []), newChoice],
    });
  };

  const handleUpdateChoiceInEditingPreset = (choiceIdx: number, updates: Partial<OptionChoice>) => {
    setEditingPreset((prev) => {
      if (!prev) return prev;
      const choices = [...prev.choices];
      choices[choiceIdx] = { ...choices[choiceIdx], ...updates };
      return { ...prev, choices };
    });
  };

  const handleDeleteChoiceFromEditingPreset = (choiceIdx: number) => {
    setEditingPreset((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        choices: prev.choices.filter((_, i) => i !== choiceIdx),
      };
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
            costDelta: Number(c.costDelta) || 0,
          })),
      }));

    const payload: MenuItem = {
      ...(editingItem as MenuItem),
      name: editingItem.name.trim(),
      nameEn: editingItem.nameEn?.trim() || '',
      description: editingItem.description?.trim() || '',
      descriptionEn: editingItem.descriptionEn?.trim() || '',
      costMenuId: editingItem.costMenuId || '',
      costMenuName: editingItem.costMenuName || '',
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
      void syncSellingPriceUpdatesToCostBundle(payload.costMenuId, payload.variants || []);
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

        {/* Categories Pills with Drag & Drop and Left/Right Arrow Reordering */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scroll-smooth">
          {categories.map((c, index) => {
            const count = menuItems.filter((m) => isDishInCategory(m, c.id, categories)).length;
            const isSelected = currentCategory === c.id;
            const isDragging = draggedCatIndex === index;
            const isDragOver = dragOverCatIndex === index;

            return (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => {
                  setDraggedCatIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverCatIndex !== index) {
                    setDragOverCatIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverCatIndex === index) {
                    setDragOverCatIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedCatIndex !== null && draggedCatIndex !== index) {
                    reorderCategories(draggedCatIndex, index);
                    soundService.playTap();
                  }
                  setDraggedCatIndex(null);
                  setDragOverCatIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedCatIndex(null);
                  setDragOverCatIndex(null);
                }}
                title="คลิกค้างแล้วลากเพื่อย้ายตำแหน่ง หรือกดลูกศร ◀ ▶ เพื่อสลับตำแหน่ง"
                className={`relative shrink-0 flex items-center rounded-xl border transition-all select-none shadow-2xs ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                } ${
                  isDragging ? 'opacity-40 scale-95 border-dashed border-2 border-amber-500' : ''
                } ${
                  isDragOver ? 'ring-2 ring-amber-500 scale-105 shadow-md' : ''
                }`}
              >
                {/* Left Arrow Button */}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveCategoryHorizontal(index, 'left');
                  }}
                  className={`h-full px-1.5 py-1.5 flex items-center justify-center transition rounded-l-xl ${
                    index === 0
                      ? 'opacity-20 cursor-not-allowed text-slate-400'
                      : isSelected
                      ? 'hover:bg-slate-950/20 text-slate-950 cursor-pointer'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer'
                  }`}
                  title="ย้ายตำแหน่งไปทางซ้าย"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Category Button (Draggable & Clickable) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveCategory(c.id);
                    soundService.playTap();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap cursor-grab active:cursor-grabbing select-none"
                >
                  <span className="text-sm leading-none pointer-events-none">{c.icon || '🍽️'}</span>
                  <span className="pointer-events-none">{getName(c)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md pointer-events-none ${
                      isSelected
                        ? 'bg-slate-950/20 text-slate-950 font-black'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </div>

                {/* Right Arrow Button */}
                <button
                  type="button"
                  disabled={index === categories.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveCategoryHorizontal(index, 'right');
                  }}
                  className={`h-full px-1.5 py-1.5 flex items-center justify-center transition rounded-r-xl ${
                    index === categories.length - 1
                      ? 'opacity-20 cursor-not-allowed text-slate-400'
                      : isSelected
                      ? 'hover:bg-slate-950/20 text-slate-950 cursor-pointer'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer'
                  }`}
                  title="ย้ายตำแหน่งไปทางขวา"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
        {filteredItems.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          const categoryName = getName(cat) || '';

          return (
            <div
              key={item.id}
              className={`rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col justify-between transition ${
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
                <div className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1 max-w-[55%]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-semibold backdrop-blur-xs truncate max-w-full">
                    {categoryName}
                  </span>
                  {item.isRecommended && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-bold">
                      {t('recommended_badge')}
                    </span>
                  )}
                </div>

                <div className="absolute top-1.5 right-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSoldOut(item.id)}
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-xs transition cursor-pointer flex items-center gap-0.5 ${
                      item.isSoldOut
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {item.isSoldOut ? (
                      <Ban className="w-2.5 h-2.5" />
                    ) : (
                      <CheckCircle className="w-2.5 h-2.5" />
                    )}
                    <span>{item.isSoldOut ? t('option_sold_out') : 'พร้อมขาย'}</span>
                  </button>
                </div>
              </div>

              {/* Item Info */}
              <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="font-bold text-[21px] leading-snug text-slate-900 dark:text-white text-center line-clamp-2">
                    {getName(item)}
                  </h4>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="flex-1 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{t('edit')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemToDelete(item)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title={t('delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
          maxWidth="max-w-4xl"
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

            {/* Names (TH & EN) - Thai primary with auto-translation and edit button */}
            <BilingualNameInput
              labelTh={t('menu_form_name_th')}
              labelEn={t('menu_form_name_en')}
              placeholderTh="เช่น ผัดกะเพราโบราณ"
              placeholderEn="e.g. Traditional Basil Stir-fry"
              valueTh={editingItem.name || ''}
              valueEn={editingItem.nameEn || ''}
              onChangeTh={(val) => setEditingItem((prev) => ({ ...prev, name: val }))}
              onChangeEn={(val) => setEditingItem((prev) => ({ ...prev, nameEn: val }))}
              required
            />

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

            {/* Food Cost System (หลักสากล) Menu Link Dropdown */}
            <div className="p-3 rounded-2xl bg-amber-500/5 dark:bg-slate-800/70 border border-amber-200/80 dark:border-slate-700 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Calculator className="w-3.5 h-3.5 text-amber-500" />
                <span>รายการเมนูอาหารที่เชื่อมโยง (Food Cost System)</span>
              </label>
              <select
                value={editingItem.costMenuId || ''}
                onChange={(e) => {
                  const chosen = costMenus.find((m) => m.id === e.target.value);
                  setEditingItem((prev) => {
                    if (!prev) return prev;
                    if (!chosen) {
                      return {
                        ...prev,
                        costMenuId: '',
                        costMenuName: '',
                        variants: (prev.variants || []).map((v) => ({
                          ...v,
                          costMenuId: undefined,
                          costVariantId: undefined,
                          costVariantName: undefined,
                        })),
                      };
                    }
                    return {
                      ...prev,
                      costMenuId: chosen.id,
                      costMenuName: chosen.name,
                      variants: buildVariantsFromCostMenu(chosen, prev.variants || []),
                    };
                  });
                  soundService.playTap();
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- เลือกรายการเมนูอาหาร (เพื่อดึงตัวเลือกและต้นทุนจากแอปคำนวณต้นทุน) --</option>
                {costMenus.map((cm) => (
                  <option key={cm.id} value={cm.id}>
                    {cm.name} ({cm.variants?.length || 0} ตัวเลือก)
                  </option>
                ))}
              </select>
            </div>

            {/* Options / Variants List Section (Prices belong here) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('menu_form_options_header')}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    กด &ldquo;{t('menu_form_add_option_btn')}&rdquo; เพื่อเลือกตัวเลือกเนื้อสัตว์จาก Food Cost System ของเมนูนี้โดยอัตโนมัติ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFoodCostVariantPicker(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('menu_form_add_option_btn')}</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="hidden sm:flex items-center text-[11px] font-bold text-slate-500 pl-8 pr-2 gap-2">
                  <div className="flex-1">ชื่อตัวเลือกย่อย (ไทย / อังกฤษ)</div>
                  <div className="w-24 text-center">ราคาขาย (฿)</div>
                  <div className="w-24 text-center">ต้นทุน (฿)</div>
                  <div className="w-28 text-center">กำไร/จาน</div>
                </div>

                {(editingItem.variants || []).map((variant, idx) => {
                  const varPrice = Number(variant.price) || 0;
                  const varCost = Number(variant.cost) || 0;
                  const varRawProfit = varPrice - varCost;
                  const varProfit = Math.max(0, varRawProfit);
                  const varMarginPct = varPrice > 0 ? (varProfit / varPrice) * 100 : 0;
                  const varFoodCostPct = varPrice > 0 ? (varCost / varPrice) * 100 : 0;
                  const isCostLocked = Boolean(variant.costVariantId);

                  return (
                    <div
                      key={variant.id || idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col gap-2"
                    >
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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

                        <BilingualNameInput
                          compact
                          placeholderTh={t('menu_form_option_name_th')}
                          placeholderEn={t('menu_form_option_name_en')}
                          valueTh={variant.name || ''}
                          valueEn={variant.nameEn || ''}
                          onChangeTh={(val) => handleUpdateVariant(idx, { name: val })}
                          onChangeEn={(val) => handleUpdateVariant(idx, { nameEn: val })}
                          required
                        />

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <div className="w-24">
                            <input
                              type="number"
                              required
                              min={0}
                              placeholder={t('price')}
                              value={variant.price}
                              onChange={(e) =>
                                handleUpdateVariant(idx, {
                                  price: Number(e.target.value),
                                  priceUpdatedAt: new Date().toISOString(),
                                })
                              }
                              title="ปรับเปลี่ยนราคาขายได้ (ระบบจะอัปเดตเป็นค่าล่าสุดในการเชื่อมโยง)"
                              className="w-full px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-mono font-bold bg-amber-50/40 dark:bg-slate-800 text-amber-600 dark:text-amber-400"
                            />
                          </div>

                          <div className="w-24 relative">
                            <input
                              type="number"
                              min={0}
                              readOnly={isCostLocked}
                              disabled={isCostLocked}
                              tabIndex={isCostLocked ? -1 : undefined}
                              placeholder={t('cost')}
                              value={variant.cost}
                              onChange={(e) => {
                                if (!isCostLocked) {
                                  handleUpdateVariant(idx, { cost: Number(e.target.value) });
                                }
                              }}
                              title={
                                isCostLocked
                                  ? 'ต้นทุนจากสูตรอาหาร Food Cost System (ไม่สามารถแก้ไขได้)'
                                  : 'ต้นทุนวัตถุดิบ (฿)'
                              }
                              className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono ${
                                isCostLocked
                                  ? 'pr-6 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 text-slate-500 cursor-not-allowed select-none'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500'
                              }`}
                            />
                            {isCostLocked && (
                              <Lock
                                className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                aria-label="Locked Recipe Cost"
                              />
                            )}
                          </div>

                          <div
                            className={`w-28 px-2 py-1.5 rounded-lg border text-xs font-mono font-bold text-center ${
                              varRawProfit >= 0
                                ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                            }`}
                            title="กำไร/จาน = ราคาขาย - ต้นทุน"
                          >
                            {varRawProfit >= 0
                              ? `+${formatBaht(varRawProfit)}`
                              : `-${formatBaht(Math.abs(varRawProfit))}`}
                          </div>
                        </div>
                      </div>

                      {/* Live Profit and Food Cost percentage indicators */}
                      {(varPrice > 0 || variant.costVariantId) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-500 pl-7 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {variant.costVariantId && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                <Link2 className="w-2.5 h-2.5" />
                                <span>เชื่อมสูตร: {variant.costVariantName || variant.name}</span>
                              </span>
                            )}
                            {varPrice > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span>กำไรขั้นต้น/จาน:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  +{formatBaht(varProfit)}
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                  (Margin: {varMarginPct.toFixed(0)}%)
                                </span>
                              </div>
                            )}
                          </div>
                          {varPrice > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span>Food Cost:</span>
                              <span
                                className={`font-mono font-bold ${
                                  varFoodCostPct <= 35
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600'
                                }`}
                              >
                                {varFoodCostPct.toFixed(1)}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {varFoodCostPct <= 35 ? '(✅ อยู่ในเกณฑ์ 28-35%)' : '(⚠️ สูงกว่าเกณฑ์สากล)'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: ตัวเลือกย่อยของเมนูนี้ (Option Sets) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-slate-800/80 border border-amber-200/70 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    ตัวเลือกย่อยของเมนูนี้ (Option Sets)
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  {editingItem.optionGroups?.length || 0} รายการ
                </span>
              </div>

              {/* Selected Sets Order List */}
              {(!editingItem.optionGroups || editingItem.optionGroups.length === 0) ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center bg-white/40 dark:bg-slate-900/40 space-y-2">
                  <p className="text-xs text-slate-400">
                    ยังไม่ได้เลือกใช้งาน set เมนูย่อยใดๆ ในเมนูนี้
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span>คลิกค้างแล้วลาก หรือกดลูกศรขึ้น-ลง เพื่อจัดลำดับการแสดงผล</span>
                  </div>

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
                              title="คลิกค้างแล้วลากเพื่อย้ายตำแหน่ง"
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

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <BilingualNameInput
                                    compact
                                    placeholderTh="ชื่อกลุ่มตัวเลือก (ภาษาไทย)"
                                    placeholderEn="Group Name (EN)"
                                    valueTh={group.name || ''}
                                    valueEn={group.nameEn || ''}
                                    onChangeTh={(val) => handleUpdateOptionGroup(gIdx, { name: val })}
                                    onChangeEn={(val) => handleUpdateOptionGroup(gIdx, { nameEn: val })}
                                    required
                                  />
                                </div>
                                <select
                                  value={group.type}
                                  onChange={(e) =>
                                    handleUpdateOptionGroup(gIdx, {
                                      type: e.target.value as 'single' | 'multiple',
                                    })
                                  }
                                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shrink-0"
                                >
                                  <option value="single">เลือกได้ 1 อย่าง</option>
                                  <option value="multiple">เลือกได้หลายอย่าง</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteOptionGroup(gIdx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0 self-start"
                            title="ลบตัวเลือกย่อยนี้ออกจากเมนู"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Editable Bilingual Sub-Options List */}
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5 pl-1 sm:pl-6">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                            <span>รายการตัวเลือกย่อย (ไทย / อังกฤษ)</span>
                            <button
                              type="button"
                              onClick={() => handleAddChoiceToGroup(gIdx)}
                              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>เพิ่มตัวเลือกย่อย</span>
                            </button>
                          </div>

                          {(group.choices || []).map((c, cIdx) => (
                            <div
                              key={c.id || cIdx}
                              className="flex flex-col sm:flex-row sm:items-center gap-1.5 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70"
                            >
                              <div className="flex-1 min-w-0">
                                <BilingualNameInput
                                  compact
                                  placeholderTh="ชื่อตัวเลือก (ไทย)"
                                  placeholderEn="Option Name (EN)"
                                  valueTh={c.name || ''}
                                  valueEn={c.nameEn || ''}
                                  onChangeTh={(val) =>
                                    handleUpdateChoiceInGroup(gIdx, cIdx, { name: val })
                                  }
                                  onChangeEn={(val) =>
                                    handleUpdateChoiceInGroup(gIdx, cIdx, { nameEn: val })
                                  }
                                  required
                                />
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-center gap-1 w-22">
                                  <span className="text-[10px] text-slate-400 font-mono">+฿</span>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={c.priceDelta ?? 0}
                                    onChange={(e) =>
                                      handleUpdateChoiceInGroup(gIdx, cIdx, {
                                        priceDelta: Number(e.target.value),
                                      })
                                    }
                                    className="w-full px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                                    title="ราคาขายเพิ่ม (฿)"
                                  />
                                </div>
                                <div className="flex items-center gap-1 w-24">
                                  <span className="text-[10px] text-slate-400">ทุน</span>
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={c.costDelta ?? 0}
                                    onChange={(e) =>
                                      handleUpdateChoiceInGroup(gIdx, cIdx, {
                                        costDelta: Number(e.target.value),
                                      })
                                    }
                                    className="w-full px-1.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-rose-500"
                                    title="ต้นทุนวัตถุดิบเพิ่ม (฿)"
                                  />
                                </div>
                                {(group.choices?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChoiceFromGroup(gIdx, cIdx)}
                                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                    title="ลบตัวเลือกนี้"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom actions to add Option Sets or custom group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowOptionPickerModal(true)}
                  className="py-2.5 px-3 rounded-xl border border-dashed border-amber-400 dark:border-amber-600/70 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    {editingItem.optionGroups && editingItem.optionGroups.length > 0
                      ? 'เลือกจาก set เมนูย่อยเพิ่มเติม'
                      : 'เลือกจาก set เมนูย่อย'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomOptionGroup}
                  className="py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/60 hover:border-amber-400 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-amber-500" />
                  <span>สร้างกลุ่มตัวเลือกใหม่เอง</span>
                </button>
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

      {/* Food Cost Variant Picker Modal */}
      {showFoodCostVariantPicker && editingItem && (
        <FoodCostVariantPickerModal
          isOpen={showFoodCostVariantPicker}
          onClose={() => setShowFoodCostVariantPicker(false)}
          selectedCostMenuId={editingItem.costMenuId}
          onSelectCostMenuId={(costMenuId, costMenuName, chosenMenu) => {
            setEditingItem((prev) => {
              if (!prev) return prev;
              if (!chosenMenu) {
                return {
                  ...prev,
                  costMenuId: '',
                  costMenuName: '',
                  variants: (prev.variants || []).map((v) => ({
                    ...v,
                    costMenuId: undefined,
                    costVariantId: undefined,
                    costVariantName: undefined,
                  })),
                };
              }
              return {
                ...prev,
                costMenuId,
                costMenuName,
                variants: buildVariantsFromCostMenu(chosenMenu, prev.variants || []),
              };
            });
          }}
          existingVariants={editingItem.variants || []}
          onPickVariant={(pickedVariant) => {
            setEditingItem((prev) => {
              if (!prev) return prev;
              const current = prev.variants || [];
              const existingIdx = current.findIndex(
                (v) =>
                  (pickedVariant.costVariantId && v.costVariantId === pickedVariant.costVariantId) ||
                  v.name.trim().toLowerCase() === pickedVariant.name.trim().toLowerCase()
              );
              const cleanedCurrent =
                current.length === 1 &&
                current[0].name === 'ปกติ' &&
                !current[0].costVariantId
                  ? []
                  : [...current];

              if (existingIdx >= 0 && cleanedCurrent[existingIdx]) {
                cleanedCurrent[existingIdx] = {
                  ...cleanedCurrent[existingIdx],
                  cost: pickedVariant.cost,
                  costMenuId: pickedVariant.costMenuId,
                  costVariantId: pickedVariant.costVariantId,
                  costVariantName: pickedVariant.costVariantName,
                  price:
                    cleanedCurrent[existingIdx].price > 0
                      ? cleanedCurrent[existingIdx].price
                      : pickedVariant.price,
                };
              } else {
                cleanedCurrent.push(pickedVariant);
              }
              return {
                ...prev,
                costMenuId: pickedVariant.costMenuId || prev.costMenuId,
                variants: cleanedCurrent,
              };
            });
          }}
          onPickAllVariants={(menu) => {
            setEditingItem((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                costMenuId: menu.id,
                costMenuName: menu.name,
                variants: buildVariantsFromCostMenu(menu, prev.variants || []),
              };
            });
          }}
          onAddCustomVariant={handleAddVariant}
        />
      )}

      {/* Option Sets Selector Modal */}
      {showOptionPickerModal && editingItem && (
        <Modal
          isOpen={true}
          onClose={() => setShowOptionPickerModal(false)}
          title="เลือกใช้งาน set เมนูย่อย (Option Sets)"
          maxWidth="max-w-lg"
          footer={
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowOptionPresetsModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                title="จัดการหรือสร้าง set เมนูย่อยแม่แบบใหม่"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>จัดการ set แม่แบบ</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOptionPickerModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>เสร็จสิ้น / บันทึกตัวเลือก</span>
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              คลิกเลือกชุดตัวเลือกย่อยที่ต้องการใช้กับเมนูนี้ (สามารถเลือกได้หลายชุด):
            </p>

            <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
              {optionPresets.map((preset) => {
                const isSelected = isPresetSelected(preset);
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleToggleOptionPreset(preset)}
                    className={`p-3 rounded-xl border transition cursor-pointer select-none flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-100/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/30 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 shadow-xs truncate">
                          {preset.name}
                        </span>
                        {preset.nameEn && (
                          <span className="text-[11px] text-slate-400">({preset.nameEn})</span>
                        )}
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
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                        {preset.choices
                          .map((c) => c.name + (c.priceDelta > 0 ? ` (+${c.priceDelta}฿)` : ''))
                          .join(', ')}
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded text-amber-500 pointer-events-none cursor-pointer shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>
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
            <div className="space-y-3">
              <BilingualNameInput
                labelTh={t('category_name')}
                labelEn="ชื่อภาษาอังกฤษ (Auto)"
                placeholderTh={t('bottom_category_name_label')}
                placeholderEn={t('bottom_category_name_en_label')}
                valueTh={categoryNameInput}
                valueEn={categoryNameEnInput}
                onChangeTh={setCategoryNameInput}
                onChangeEn={setCategoryNameEnInput}
                required
              />
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

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>ลำดับหมวดหมู่อาหาร ({categories.length} หมวดหมู่)</span>
                <span>คลิกค้างแล้วลาก หรือกดลูกศรขึ้น-ลงเพื่อสลับตำแหน่ง</span>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {categories.map((c, idx) => {
                  const isDragging = draggedModalCatIndex === idx;
                  const isOver = dragOverModalCatIndex === idx;

                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedModalCatIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverModalCatIndex !== idx) {
                          setDragOverModalCatIndex(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverModalCatIndex === idx) {
                          setDragOverModalCatIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedModalCatIndex !== null && draggedModalCatIndex !== idx) {
                          reorderCategories(draggedModalCatIndex, idx);
                          soundService.playTap();
                        }
                        setDraggedModalCatIndex(null);
                        setDragOverModalCatIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedModalCatIndex(null);
                        setDragOverModalCatIndex(null);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        isDragging
                          ? 'opacity-40 border-dashed border-amber-500 scale-[0.99] bg-amber-50 dark:bg-amber-950/20'
                          : isOver
                          ? 'border-amber-500 ring-2 ring-amber-400/30 bg-white dark:bg-slate-900 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Drag Handle */}
                        <div
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
                          title="คลิกค้างแล้วลากเพื่อย้ายลำดับ"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Up / Down Arrow Buttons */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCategoryVertical(idx, 'up')}
                            className={`p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 ${
                              idx === 0
                                ? 'opacity-25 cursor-not-allowed'
                                : 'cursor-pointer hover:text-amber-600'
                            }`}
                            title="เลื่อนขึ้น"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === categories.length - 1}
                            onClick={() => handleMoveCategoryVertical(idx, 'down')}
                            className={`p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 ${
                              idx === categories.length - 1
                                ? 'opacity-25 cursor-not-allowed'
                                : 'cursor-pointer hover:text-amber-600'
                            }`}
                            title="เลื่อนลง"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-base leading-none">{c.icon}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {getName(c)}
                        </span>
                        {c.nameEn && (
                          <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                            ({c.nameEn})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(c);
                            setCategoryNameInput(c.name);
                            setCategoryNameEnInput(c.nameEn || '');
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          title="แก้ไขชื่อหมวดหมู่"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {categories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteCategory(c.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                            title="ลบหมวดหมู่นี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
            {/* Preset Name (TH & EN) - Thai primary with auto-translation and edit button */}
            <BilingualNameInput
              labelTh="ชื่อ set แม่แบบ (ภาษาไทย)"
              labelEn="ชื่อ set แม่แบบ (English)"
              placeholderTh="เช่น เพิ่มไข่ดาว, เลือกระดับความเผ็ด"
              placeholderEn="e.g. Add Eggs, Spiciness Level"
              valueTh={editingPreset.name || ''}
              valueEn={editingPreset.nameEn || ''}
              onChangeTh={(val) => setEditingPreset({ ...editingPreset, name: val })}
              onChangeEn={(val) => setEditingPreset({ ...editingPreset, nameEn: val })}
              required
            />

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

                    <BilingualNameInput
                      compact
                      placeholderTh="ชื่อตัวเลือก (ไทย)"
                      placeholderEn="Name (EN)"
                      valueTh={choice.name || ''}
                      valueEn={choice.nameEn || ''}
                      onChangeTh={(val) =>
                        handleUpdateChoiceInEditingPreset(cIdx, { name: val })
                      }
                      onChangeEn={(val) =>
                        handleUpdateChoiceInEditingPreset(cIdx, { nameEn: val })
                      }
                      required
                    />

                    <div className="flex items-center gap-1 w-22 shrink-0">
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

                    <div className="flex items-center gap-1 w-22 shrink-0">
                      <span className="text-[10px] text-slate-400">ทุน</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={choice.costDelta ?? 0}
                        onChange={(e) =>
                          handleUpdateChoiceInEditingPreset(cIdx, {
                            costDelta: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-rose-500"
                        title="ต้นทุนเพิ่ม (฿)"
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
