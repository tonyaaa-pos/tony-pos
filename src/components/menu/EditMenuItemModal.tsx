import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { MenuItem, ItemVariantOption, OptionGroup, OptionChoice } from '../../types';
import {
  Upload,
  Camera,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Check,
  Sliders,
  Sparkles,
  Edit,
  X,
  GripVertical,
  Calculator,
  Link2,
  PlusCircle,
  Lock,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { soundService } from '../../utils/audio';
import { Modal } from '../common/Modal';
import { compressImageFile } from '../../utils/imageCompressor';
import { BilingualNameInput } from '../common/BilingualNameInput';
import { FoodCostVariantPickerModal } from './FoodCostVariantPickerModal';
import { translateThaiToEnglishFast } from '../../utils/thaiToEnglishTranslator';
import {
  getCachedCostBundle,
  getCachedCostBundleMeta,
  getEffectiveCostMenuVariants,
  findMatchingCostMenu,
  findMatchingCostVariant,
  getVariantRecipeCost,
  buildVariantsFromCostMenu,
  syncSellingPriceUpdatesToCostBundle,
  COST_BUNDLE_UPDATED_EVENT,
  type TonysKitchenMenu,
  type CostBundleMeta,
} from '../../services/costSyncService';

interface EditMenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem | null;
  onSave?: (updatedItem: MenuItem) => void;
}

export const EditMenuItemModal: React.FC<EditMenuItemModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
}) => {
  const { categories, updateMenuItem, optionPresets } = usePOS();
  const { t, getName } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Option Picker Modal & Drag/Drop reorder states
  const [showOptionPickerModal, setShowOptionPickerModal] = useState(false);
  const [draggedOptionGroupIndex, setDraggedOptionGroupIndex] = useState<number | null>(null);
  const [dragOverOptionGroupIndex, setDragOverOptionGroupIndex] = useState<number | null>(null);

  // Food Cost System (หลักสากล) link & variant picker state
  const [showFoodCostVariantPicker, setShowFoodCostVariantPicker] = useState(false);
  const [costMenus, setCostMenus] = useState<TonysKitchenMenu[]>(
    () => getCachedCostBundle()?.payload?.menus || []
  );
  const [costMeta, setCostMeta] = useState<CostBundleMeta>(() => getCachedCostBundleMeta());

  // Sync state when item changes or modal opens
  useEffect(() => {
    if (item && isOpen) {
      const variants: ItemVariantOption[] =
        item.variants && item.variants.length > 0
          ? JSON.parse(JSON.stringify(item.variants))
          : [
              {
                id: 'v_std_' + item.id,
                name: 'ปกติ',
                nameEn: 'Standard',
                price: item.price || 0,
                cost: item.cost || 0,
                isAvailable: !item.isSoldOut,
                isSoldOut: item.isSoldOut || false,
              },
            ];

      const latestCostMenus = getCachedCostBundle()?.payload?.menus || [];
      setCostMenus(latestCostMenus);
      setCostMeta(getCachedCostBundleMeta());
      const autoCostMenu = item.costMenuId
        ? latestCostMenus.find((m) => m.id === item.costMenuId)
        : findMatchingCostMenu(item.name, latestCostMenus, undefined, item.id);

      const syncedVariants = variants.map((v) => {
        if (autoCostMenu && (v.costVariantId || v.costMenuId === autoCostMenu.id)) {
          const matchedCv = findMatchingCostVariant(
            v.name,
            getEffectiveCostMenuVariants(autoCostMenu),
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
      setStorageError(null);
    } else if (!isOpen) {
      setEditingItem(null);
      setStorageError(null);
      setShowFoodCostVariantPicker(false);
    }
  }, [item, isOpen]);

  const reconcileEditingItemWithMenus = (latestMenus: TonysKitchenMenu[], isExternal = true) => {
    if (latestMenus.length === 0) return;
    setEditingItem((prev) => {
      if (!prev || !prev.variants) return prev;
      const linkedMenu = prev.costMenuId
        ? latestMenus.find((m) => m.id === prev.costMenuId)
        : undefined;
      if (!linkedMenu) return prev;
      const effVars = getEffectiveCostMenuVariants(linkedMenu);
      let changed = false;
      const nextVars = prev.variants.map((v) => {
        if (!v.costVariantId && v.costMenuId !== linkedMenu.id) return v;
        const cv = findMatchingCostVariant(
          v.name,
          effVars,
          v.costVariantId,
          v.id,
          prev.name
        );
        if (!cv) return v;
        const nextCost = getVariantRecipeCost(cv);
        const remoteSell = cv.sellingPrice ?? cv.price ?? 0;
        const nextPrice = isExternal && remoteSell > 0 ? remoteSell : v.price;
        if (nextCost !== v.cost || nextPrice !== v.price || v.costMenuId !== linkedMenu.id) {
          changed = true;
          return {
            ...v,
            cost: nextCost,
            price: nextPrice,
            costMenuId: linkedMenu.id,
            costVariantId: cv.id,
            costVariantName: cv.name || cv.variantName || v.name,
          };
        }
        return v;
      });
      if (!changed) return prev;
      return {
        ...prev,
        costMenuName: linkedMenu.name || prev.costMenuName,
        price: nextVars[0]?.price ?? prev.price,
        cost: nextVars[0]?.cost ?? prev.cost,
        variants: nextVars,
      };
    });
  };

  // Keep costMenus synced with local Cost & Profit bundle updates while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const syncFromCache = () => {
      const bundle = getCachedCostBundle();
      const latestMenus = bundle?.payload?.menus || [];
      setCostMenus(latestMenus);
      setCostMeta(getCachedCostBundleMeta());
      reconcileEditingItemWithMenus(
        latestMenus,
        bundle?.syncedFrom !== 'POS_CostProfitIntegration'
      );
    };
    syncFromCache();
    window.addEventListener(COST_BUNDLE_UPDATED_EVENT, syncFromCache);
    window.addEventListener('storage', syncFromCache);

    return () => {
      window.removeEventListener(COST_BUNDLE_UPDATED_EVENT, syncFromCache);
      window.removeEventListener('storage', syncFromCache);
    };
  }, [isOpen]);

  if (!isOpen || !editingItem) return null;

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
      soundService.playTap();
    } catch (err: any) {
      console.error('Image compression failed:', err);
      setStorageError(t('menu_storage_full_err') || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
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
      isSoldOut: false,
    };
    setEditingItem({
      ...editingItem,
      variants: [...currentVariants, newVariant],
    });
    soundService.playTap();
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
    soundService.playTap();
  };

  const handleMoveVariant = (idx: number, direction: 'up' | 'down') => {
    setEditingItem((prev) => {
      if (!prev || !prev.variants) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.variants.length) return prev;
      const updated = [...prev.variants];
      const [moved] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, moved);
      return { ...prev, variants: updated };
    });
    soundService.playTap();
  };

  // Option Preset toggling
  const isPresetSelected = (preset: OptionGroup) => {
    return (
      editingItem?.optionGroups?.some(
        (grp) => grp.name === preset.name || grp.id === preset.id
      ) || false
    );
  };

  const handleToggleOptionPreset = (preset: OptionGroup) => {
    setEditingItem((prev) => {
      if (!prev) return prev;
      const currentGroups = prev.optionGroups || [];
      const exists = currentGroups.some(
        (grp) => grp.name === preset.name || grp.id === preset.id
      );

      if (exists) {
        return {
          ...prev,
          optionGroups: currentGroups.filter(
            (grp) => grp.name !== preset.name && grp.id !== preset.id
          ),
        };
      } else {
        const clonedPreset: OptionGroup = {
          id: 'opt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: preset.name,
          nameEn: preset.nameEn || '',
          type: preset.type,
          required: preset.required || false,
          choices: preset.choices.map((c) => ({ ...c })),
        };
        return {
          ...prev,
          optionGroups: [...currentGroups, clonedPreset],
        };
      }
    });
    soundService.playTap();
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
    soundService.playTap();
  };

  const handleDeleteOptionGroup = (idx: number) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      return {
        ...prev,
        optionGroups: prev.optionGroups.filter((_, i) => i !== idx),
      };
    });
    soundService.playTap();
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

  const handleUpdateOptionGroup = (idx: number, updates: Partial<OptionGroup>) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const updated = [...prev.optionGroups];
      updated[idx] = { ...updated[idx], ...updates };
      return { ...prev, optionGroups: updated };
    });
  };

  const handleAddChoiceToGroup = (groupIdx: number) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const updated = [...prev.optionGroups];
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
      return { ...prev, optionGroups: updated };
    });
  };

  const handleUpdateChoiceInGroup = (
    groupIdx: number,
    choiceIdx: number,
    updates: Partial<OptionChoice>
  ) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const updated = [...prev.optionGroups];
      const targetGroup = updated[groupIdx];
      const choices = [...(targetGroup.choices || [])];
      choices[choiceIdx] = { ...choices[choiceIdx], ...updates };
      updated[groupIdx] = { ...targetGroup, choices };
      return { ...prev, optionGroups: updated };
    });
  };

  const handleDeleteChoiceFromGroup = (groupIdx: number, choiceIdx: number) => {
    setEditingItem((prev) => {
      if (!prev || !prev.optionGroups) return prev;
      const updated = [...prev.optionGroups];
      const targetGroup = updated[groupIdx];
      const choices = (targetGroup.choices || []).filter((_, i) => i !== choiceIdx);
      updated[groupIdx] = { ...targetGroup, choices };
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
    soundService.playTap();
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name?.trim() || !item) return;

    // Validate variants
    const validVariants = (editingItem.variants || []).filter((v) => v.name.trim().length > 0);
    if (validVariants.length === 0) {
      alert('กรุณาระบุชื่อตัวเลือกอย่างน้อย 1 รายการ');
      return;
    }

    const primaryPrice = validVariants[0]?.price ?? editingItem.price ?? 80;
    const primaryCost = validVariants[0]?.cost ?? editingItem.cost ?? 40;

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
      id: item.id,
      name: editingItem.name.trim(),
      nameEn: editingItem.nameEn?.trim() || '',
      costMenuId: editingItem.costMenuId || '',
      costMenuName: editingItem.costMenuName || '',
      price: primaryPrice,
      cost: primaryCost,
      variants: validVariants,
      optionGroups: cleanOptionGroups,
      isSoldOut: Boolean(editingItem.isSoldOut),
      isRecommended: Boolean(editingItem.isRecommended),
    };

    updateMenuItem(item.id, payload);
    void syncSellingPriceUpdatesToCostBundle(payload.costMenuId, payload.variants || []);
    soundService.playReadyChime();
    onSave?.(payload);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`แก้ไขเมนู: ${getName(item)}`}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSaveItem} className="space-y-4">
        {storageError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold">
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
                    onClick={() => setEditingItem((prev) => (prev ? { ...prev, image: '' } : null))}
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
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, image: e.target.value } : null))
                  }
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
          onChangeTh={(val) => setEditingItem((prev) => (prev ? { ...prev, name: val } : null))}
          onChangeEn={(val) => setEditingItem((prev) => (prev ? { ...prev, nameEn: val } : null))}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('menu_form_cat')}
            </label>
            <select
              value={editingItem.categoryId || categories[0]?.id}
              onChange={(e) =>
                setEditingItem((prev) => (prev ? { ...prev, categoryId: e.target.value } : null))
              }
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
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editingItem.isRecommended || false}
                onChange={(e) =>
                  setEditingItem((prev) =>
                    prev ? { ...prev, isRecommended: e.target.checked } : null
                  )
                }
                className="w-4 h-4 rounded text-amber-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('menu_form_recommended')}</span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editingItem.isSoldOut || false}
                onChange={(e) =>
                  setEditingItem((prev) => (prev ? { ...prev, isSoldOut: e.target.checked } : null))
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
        <div className="p-3 rounded-2xl bg-amber-500/5 dark:bg-slate-800/70 border border-amber-200/80 dark:border-slate-700 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Calculator className="w-3.5 h-3.5 text-amber-500" />
              <span>รายการเมนูอาหารที่เชื่อมโยง (Food Cost System)</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  costMeta.source === 'import'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {costMeta.source === 'import'
                  ? `นำเข้าแล้ว (${costMenus.length} เมนู)`
                  : 'ตัวอย่างในเครื่อง'}
              </span>
            </label>
          </div>

          <select
            value={editingItem.costMenuId || ''}
            onChange={(e) => {
              const chosen = costMenus.find((m) => m.id === e.target.value);
              setEditingItem((prev) => {
                if (!prev) return null;
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
                const nextVariants = buildVariantsFromCostMenu(chosen, prev.variants || []);
                const translatedEn = translateThaiToEnglishFast(chosen.name);
                const autoNameEn =
                  translatedEn && !/[\u0E00-\u0E7F]/.test(translatedEn) ? translatedEn : '';
                return {
                  ...prev,
                  name: prev.name?.trim() ? prev.name : chosen.name,
                  nameEn: prev.nameEn?.trim() ? prev.nameEn : autoNameEn,
                  costMenuId: chosen.id,
                  costMenuName: chosen.name,
                  price: nextVariants[0]?.price ?? prev.price,
                  cost: nextVariants[0]?.cost ?? prev.cost,
                  variants: nextVariants,
                };
              });
              soundService.playTap();
            }}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">-- เลือกรายการเมนูอาหาร (เพื่อดึงตัวเลือกและต้นทุนจากแอปคำนวณต้นทุน) --</option>
            {costMenus.map((cm) => {
              const varCount = cm.variants?.length || 0;
              return (
                <option key={cm.id} value={cm.id}>
                  {cm.name} ({varCount > 0 ? `${varCount} ตัวเลือก` : 'เมนูเดี่ยว'})
                </option>
              );
            })}
          </select>

          {editingItem.costMenuId && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-1.5 font-bold">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  เชื่อมโยงกับ: {editingItem.costMenuName || costMenus.find((m) => m.id === editingItem.costMenuId)?.name || editingItem.costMenuId} (
                  {(editingItem.variants || []).filter((v) => v.costMenuId || v.costVariantId).length} ตัวเลือกผูกสูตร)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFoodCostVariantPicker(true)}
                className="font-bold underline hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer"
              >
                จัดการตัวเลือกที่เชื่อมโยง
              </button>
            </div>
          )}

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
              <div className="w-24 text-center">หมด/พร้อมขาย</div>
              <div className="w-8"></div>
            </div>

            {(editingItem.variants || []).map((variant, idx) => {
              const varPrice = Number(variant.price) || 0;
              const varCost = Number(variant.cost) || 0;
              const varProfit = Math.max(0, varPrice - varCost);
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

                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400 select-none">
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

                  {/* Financial Breakdown per variant */}
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
                            <span>กำไร/จาน:</span>
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
                            {varFoodCostPct <= 35 ? '(✅ ปกติ)' : '(⚠️ สูง)'}
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

        {/* Section: Option Sets for this menu */}
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

          {/* Selected Option Groups List with Drag & Drop and Arrows */}
          {editingItem.optionGroups && editingItem.optionGroups.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                <span>คลิกค้างแล้วลาก หรือกดลูกศรขึ้น-ลง เพื่อจัดลำดับ</span>
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
          ) : (
            <div className="p-3 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400">ยังไม่มีการเพิ่มตัวเลือกย่อยในเมนูนี้</p>
            </div>
          )}

          {/* Bottom actions to open Option Sets Selector or create custom group */}
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

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{t('save')}</span>
          </button>
        </div>
      </form>

      {/* Option Sets Selector Modal */}
      {showOptionPickerModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowOptionPickerModal(false)}
          title="เลือกใช้งาน set เมนูย่อย (Option Sets)"
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end">
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

      {/* Food Cost Variant Picker Modal */}
      {showFoodCostVariantPicker && editingItem && (
        <FoodCostVariantPickerModal
          isOpen={showFoodCostVariantPicker}
          onClose={() => setShowFoodCostVariantPicker(false)}
          selectedCostMenuId={editingItem.costMenuId}
          onSelectCostMenuId={(costMenuId, costMenuName, chosenMenu) => {
            setEditingItem((prev) => {
              if (!prev) return null;
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
              if (!prev) return null;
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
              if (!prev) return null;
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
    </Modal>
  );
};
