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
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { soundService } from '../../utils/audio';
import { Modal } from '../common/Modal';
import { compressImageFile } from '../../utils/imageCompressor';

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
  const { categories, updateMenuItem, optionPresets, addOptionPreset } = usePOS();
  const { t, getName } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

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

      setEditingItem({
        ...item,
        variants,
        optionGroups: item.optionGroups ? JSON.parse(JSON.stringify(item.optionGroups)) : [],
      });
      setStorageError(null);
    } else if (!isOpen) {
      setEditingItem(null);
      setStorageError(null);
    }
  }, [item, isOpen]);

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
    soundService.playTap();
  };

  const handleMoveVariant = (idx: number, direction: 'up' | 'down') => {
    if (!editingItem || !editingItem.variants) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= editingItem.variants.length) return;
    const updated = [...editingItem.variants];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setEditingItem({
      ...editingItem,
      variants: updated,
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
    if (!editingItem) return;
    const currentGroups = editingItem.optionGroups || [];
    const exists = currentGroups.some(
      (grp) => grp.name === preset.name || grp.id === preset.id
    );

    if (exists) {
      setEditingItem({
        ...editingItem,
        optionGroups: currentGroups.filter(
          (grp) => grp.name !== preset.name && grp.id !== preset.id
        ),
      });
    } else {
      const clonedPreset: OptionGroup = {
        id: 'opt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: preset.name,
        nameEn: preset.nameEn || '',
        type: preset.type,
        required: preset.required || false,
        choices: preset.choices.map((c) => ({ ...c })),
      };
      setEditingItem({
        ...editingItem,
        optionGroups: [...currentGroups, clonedPreset],
      });
    }
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
          })),
      }));

    const payload: MenuItem = {
      ...(editingItem as MenuItem),
      id: item.id,
      name: editingItem.name.trim(),
      nameEn: editingItem.nameEn?.trim() || '',
      price: primaryPrice,
      cost: primaryCost,
      variants: validVariants,
      optionGroups: cleanOptionGroups,
      isSoldOut: Boolean(editingItem.isSoldOut),
      isRecommended: Boolean(editingItem.isRecommended),
    };

    updateMenuItem(item.id, payload);
    soundService.playReadyChime();
    onSave?.(payload);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`แก้ไขเมนู: ${getName(item)}`}
      maxWidth="max-w-2xl"
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
              onChange={(e) =>
                setEditingItem((prev) => (prev ? { ...prev, name: e.target.value } : null))
              }
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
              onChange={(e) =>
                setEditingItem((prev) => (prev ? { ...prev, nameEn: e.target.value } : null))
              }
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
            <div className="hidden sm:flex items-center text-[11px] font-bold text-slate-500 pl-8 pr-2 gap-2">
              <div className="flex-1">ชื่อตัวเลือกย่อย (ไทย / อังกฤษ)</div>
              <div className="w-20 text-center">ราคาขาย (฿)</div>
              <div className="w-16 text-center">ต้นทุน (฿)</div>
              <div className="w-24 text-center">หมด/พร้อมขาย</div>
              <div className="w-8"></div>
            </div>

            {(editingItem.variants || []).map((variant, idx) => {
              const varPrice = Number(variant.price) || 0;
              const varCost = Number(variant.cost) || 0;
              const varProfit = Math.max(0, varPrice - varCost);
              const varMarginPct = varPrice > 0 ? (varProfit / varPrice) * 100 : 0;
              const varFoodCostPct = varPrice > 0 ? (varCost / varPrice) * 100 : 0;

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
                  {varPrice > 0 && (
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-500 pl-7 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span>กำไร/จาน:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatBaht(varProfit)}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          (Margin: {varMarginPct.toFixed(0)}%)
                        </span>
                      </div>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Option Sets */}
        {optionPresets.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-slate-800/80 border border-amber-200/70 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                เลือกใช้งาน set เมนูย่อย (Option Sets)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {optionPresets.map((preset) => {
                const isSelected = isPresetSelected(preset);
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleToggleOptionPreset(preset)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer select-none flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-100/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/30 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate text-slate-900 dark:text-white">
                          {preset.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">
                          {preset.type === 'single' ? '1 อย่าง' : 'หลายอย่าง'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {preset.choices.map((c) => c.name).join(', ')}
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded text-amber-500 pointer-events-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
    </Modal>
  );
};
