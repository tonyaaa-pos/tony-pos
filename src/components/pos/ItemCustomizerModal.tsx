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

  // Overall item quantity placed at the bottom bar
  const [quantity, setQuantity] = useState<number>(1);

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

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0];
  const unitPrice = selectedVariant.price + addOnsDelta;
  const totalPrice = unitPrice * quantity;

  const handleConfirmAdd = () => {
    if (selectedVariant.isSoldOut || selectedVariant.isAvailable === false) return;

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

    const variantNameDisplay = getName(selectedVariant);
    const itemNameDisplay = getName(menuItem);
    const fullDisplayName =
      variants.length === 1 && (selectedVariant.name === 'ปกติ' || selectedVariant.name === 'Standard')
        ? itemNameDisplay
        : `${itemNameDisplay} (${variantNameDisplay})`;

    const orderItem: OrderItem = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      menuItemId: menuItem.id,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      variantNameEn: selectedVariant.nameEn,
      name: fullDisplayName,
      nameEn: `${menuItem.nameEn || menuItem.name} (${selectedVariant.nameEn || selectedVariant.name})`,
      price: unitPrice,
      cost: selectedVariant.cost,
      quantity,
      selectedOptions: allSelectedOptions,
      note: note.trim(),
      status: 'confirmed',
      isNewUnsent: true,
    };

    onAddToCart(orderItem);
    onClose(); // Automatically close modal and return to POS to order next dish
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getName(menuItem)}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Top Header: Dish Name & Description ONLY (No Food Photo per user request) */}
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
              {getName(menuItem)}
            </h3>
            {menuItem.isRecommended && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{t('recommended_badge')}</span>
              </span>
            )}
          </div>
          {menuItem.nameEn && menuItem.nameEn !== menuItem.name && (
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {menuItem.nameEn}
            </p>
          )}
          {menuItem.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
              {getDescription(menuItem)}
            </p>
          )}
        </div>

        {/* Section 1: Options & Variants (Shows ONLY option name and price, no quantity selector per option) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>{t('food_detail_options_title')}</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {variants.length} {t('items_unit')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {variants.map((variant) => {
              const isSoldOut = variant.isSoldOut || variant.isAvailable === false;
              const isSelected = selectedVariantId === variant.id;
              const optionPrice = variant.price + addOnsDelta;

              return (
                <div
                  key={variant.id}
                  onClick={() => {
                    if (!isSoldOut) {
                      setSelectedVariantId(variant.id);
                      soundService.playTap();
                    }
                  }}
                  className={`p-3 rounded-2xl border transition flex items-center justify-between select-none ${
                    isSoldOut
                      ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500 ring-2 ring-amber-400/50 shadow-xs cursor-pointer'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="min-w-0 flex-1">
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

                  {/* Price & Selected Checkmark */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400 tabular-nums">
                      {formatBaht(optionPrice)}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Option Groups / Customization (Spiciness, Size, Add-ons) */}
        {menuItem.optionGroups && menuItem.optionGroups.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                          soundService.playTap();
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
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t('food_detail_kitchen_note')}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('food_detail_kitchen_note_placeholder')}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Bottom Bar: Quantity Selector + Close Button + Add Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Quantity Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              จำนวน:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-center font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Action Buttons: Close + Add */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              {t('food_detail_close')}
            </button>

            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={selectedVariant.isSoldOut || selectedVariant.isAvailable === false}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>เพิ่ม ({formatBaht(totalPrice)})</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
