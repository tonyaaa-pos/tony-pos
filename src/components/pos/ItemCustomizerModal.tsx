import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MenuItem, OrderItem, SelectedOption, ItemVariantOption } from '../../types';
import { Plus, Minus, Check, Sparkles } from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { soundService } from '../../utils/audio';
import { useLanguage } from '../../context/LanguageContext';

interface ItemCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem;
  onAddToCart: (item: OrderItem) => void;
}

export const ItemCustomizerModal: React.FC<ItemCustomizerModalProps> = ({
  isOpen,
  onClose,
  menuItem,
  onAddToCart,
}) => {
  const { t, getName, getDescription } = useLanguage();

  // Ensure variants exist, fallback to "Standard" / "ปกติ"
  const variants: ItemVariantOption[] =
    menuItem.variants && menuItem.variants.length > 0
      ? menuItem.variants
      : [
          {
            id: `v_std_${menuItem.id}`,
            name: 'ปกติ',
            nameEn: 'Standard',
            price: menuItem.price || 0,
            cost: menuItem.cost || 0,
            isAvailable: !menuItem.isSoldOut,
            isSoldOut: menuItem.isSoldOut,
          },
        ];

  // Selected active variant
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    const available = variants.find((v) => !v.isSoldOut && v.isAvailable !== false);
    return available ? available.id : variants[0].id;
  });

  // Quantity per option or overall
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    variants.forEach((v) => {
      initial[v.id] = 1;
    });
    return initial;
  });

  // Single choice options
  const [selectedSingleOptions, setSelectedSingleOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    menuItem.optionGroups?.forEach((group) => {
      if (group.type === 'single' && group.choices.length > 0) {
        initial[group.id] = group.choices[0].id;
      }
    });
    return initial;
  });

  // Multiple choice options
  const [selectedMultipleOptions, setSelectedMultipleOptions] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // Calculate add-on deltas
  let addOnsDelta = 0;
  menuItem.optionGroups?.forEach((group) => {
    if (group.type === 'single') {
      const choiceId = selectedSingleOptions[group.id];
      const choice = group.choices.find((c) => c.id === choiceId);
      if (choice) addOnsDelta += choice.priceDelta;
    } else if (group.type === 'multiple') {
      const choiceIds = selectedMultipleOptions[group.id] || [];
      choiceIds.forEach((cId) => {
        const choice = group.choices.find((c) => c.id === cId);
        if (choice) addOnsDelta += choice.priceDelta;
      });
    }
  });

  const handleUpdateQty = (variantId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [variantId]: Math.max(1, (prev[variantId] || 1) + delta),
    }));
  };

  const handleAddVariant = (variant: ItemVariantOption) => {
    if (variant.isSoldOut || variant.isAvailable === false) return;

    soundService.playTap();

    // Flatten options
    const allSelectedOptions: SelectedOption[] = [];

    menuItem.optionGroups?.forEach((group) => {
      if (group.type === 'single') {
        const choiceId = selectedSingleOptions[group.id];
        const choice = group.choices.find((c) => c.id === choiceId);
        if (choice) {
          allSelectedOptions.push({
            groupId: group.id,
            groupName: group.name,
            groupNameEn: group.nameEn,
            choiceId: choice.id,
            choiceName: choice.name,
            choiceNameEn: choice.nameEn,
            priceDelta: choice.priceDelta,
          });
        }
      } else if (group.type === 'multiple') {
        const choiceIds = selectedMultipleOptions[group.id] || [];
        choiceIds.forEach((cId) => {
          const choice = group.choices.find((c) => c.id === cId);
          if (choice) {
            allSelectedOptions.push({
              groupId: group.id,
              groupName: group.name,
              groupNameEn: group.nameEn,
              choiceId: choice.id,
              choiceName: choice.name,
              choiceNameEn: choice.nameEn,
              priceDelta: choice.priceDelta,
            });
          }
        });
      }
    });

    const qty = quantities[variant.id] || 1;
    const finalUnitPrice = variant.price + addOnsDelta;

    const variantNameDisplay = getName(variant);
    const itemNameDisplay = getName(menuItem);
    const fullDisplayName =
      variants.length === 1 && (variant.name === 'ปกติ' || variant.name === 'Standard')
        ? itemNameDisplay
        : `${itemNameDisplay} (${variantNameDisplay})`;

    const orderItem: OrderItem = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      menuItemId: menuItem.id,
      variantId: variant.id,
      variantName: variant.name,
      variantNameEn: variant.nameEn,
      name: fullDisplayName,
      nameEn: `${menuItem.nameEn || menuItem.name} (${variant.nameEn || variant.name})`,
      price: finalUnitPrice,
      cost: variant.cost,
      quantity: qty,
      selectedOptions: allSelectedOptions,
      note: note.trim(),
      status: 'confirmed',
      isNewUnsent: true,
    };

    onAddToCart(orderItem);

    // Show temporary added banner/toast
    setAddedNotice(`${t('food_detail_added_toast')} ${variantNameDisplay} x${qty}`);
    setTimeout(() => {
      setAddedNotice(null);
    }, 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getName(menuItem)}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Added Toast Alert */}
        {addedNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-md transition animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{addedNotice}</span>
            </div>
            <span className="text-[10px] opacity-90">{t('cart_unconfirmed_badge')}</span>
          </div>
        )}

        {/* Top Header: Food Photo + Name + Description */}
        <div className="flex gap-4 items-start pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs">
            <img
              src={menuItem.image}
              alt={getName(menuItem)}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23cbd5e1"><rect width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="14" fill="%23475569" text-anchor="middle">Food</text></svg>';
              }}
            />
            {menuItem.isRecommended && (
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{t('recommended_badge')}</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {getName(menuItem)}
            </h3>
            {menuItem.nameEn && menuItem.nameEn !== menuItem.name && (
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {menuItem.nameEn}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
              {getDescription(menuItem)}
            </p>
          </div>
        </div>

        {/* Section 1: Options & Variants (Prices are ONLY shown here!) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>{t('food_detail_options_title')}</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {variants.length} {t('items_unit')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {variants.map((variant) => {
              const isSoldOut = variant.isSoldOut || variant.isAvailable === false;
              const isSelected = selectedVariantId === variant.id;
              const currentQty = quantities[variant.id] || 1;
              const optionPrice = variant.price + addOnsDelta;

              return (
                <div
                  key={variant.id}
                  onClick={() => {
                    if (!isSoldOut) {
                      setSelectedVariantId(variant.id);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition flex flex-col justify-between select-none ${
                    isSoldOut
                      ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {getName(variant)}
                        </span>
                        {isSoldOut && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white">
                            {t('option_sold_out')}
                          </span>
                        )}
                      </div>
                      {variant.nameEn && variant.nameEn !== variant.name && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {variant.nameEn}
                        </p>
                      )}
                    </div>

                    {/* Price displayed ONLY here */}
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400 tabular-nums">
                        {formatBaht(optionPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Add Button per Option */}
                  {!isSoldOut && (
                    <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      {/* Qty controls */}
                      <div
                        className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(variant.id, -1)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          aria-label="Decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(variant.id, 1)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          aria-label="Increase"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddVariant(variant);
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('food_detail_add_button')}</span>
                        <span className="font-mono tabular-nums opacity-90">
                          ({formatBaht(optionPrice * currentQty)})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Option Groups / Customization (Spiciness, Size, Add-ons) */}
        {menuItem.optionGroups && menuItem.optionGroups.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {menuItem.optionGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {getName(group)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {group.type === 'single'
                      ? t('food_detail_single_choice_hint')
                      : t('food_detail_multi_choice_hint')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.choices.map((choice) => {
                    const isSelected =
                      group.type === 'single'
                        ? selectedSingleOptions[group.id] === choice.id
                        : (selectedMultipleOptions[group.id] || []).includes(choice.id);

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => {
                          if (group.type === 'single') {
                            setSelectedSingleOptions((prev) => ({ ...prev, [group.id]: choice.id }));
                          } else {
                            setSelectedMultipleOptions((prev) => {
                              const curr = prev[group.id] || [];
                              const next = curr.includes(choice.id)
                                ? curr.filter((id) => id !== choice.id)
                                : [...curr, choice.id];
                              return { ...prev, [group.id]: next };
                            });
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{getName(choice)}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          {choice.priceDelta > 0 && (
                            <span className="tabular-nums font-mono opacity-90 text-[11px]">
                              +{choice.priceDelta}฿
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section 3: Kitchen Note */}
        <div className="pt-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t('food_detail_kitchen_note')}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('food_detail_kitchen_note_placeholder')}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Bottom Close Bar */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer text-center"
          >
            {t('food_detail_close')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
