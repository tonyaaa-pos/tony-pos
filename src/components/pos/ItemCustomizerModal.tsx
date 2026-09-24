import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { MenuItem, OrderItem, SelectedOption } from '../../types';
import { Plus, Minus, Check } from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { soundService } from '../../utils/audio';

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
  const [quantity, setQuantity] = useState(1);
  const [selectedSingleOptions, setSelectedSingleOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    menuItem.optionGroups?.forEach((group) => {
      if (group.type === 'single' && group.choices.length > 0) {
        initial[group.id] = group.choices[0].id;
      }
    });
    return initial;
  });

  const [selectedMultipleOptions, setSelectedMultipleOptions] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');

  // Calculate live item price including selected choices
  let unitPrice = menuItem.promoActive && menuItem.promoPrice ? menuItem.promoPrice : menuItem.price;

  // Add single choice deltas
  menuItem.optionGroups?.forEach((group) => {
    if (group.type === 'single') {
      const choiceId = selectedSingleOptions[group.id];
      const choice = group.choices.find((c) => c.id === choiceId);
      if (choice) unitPrice += choice.priceDelta;
    } else if (group.type === 'multiple') {
      const choiceIds = selectedMultipleOptions[group.id] || [];
      choiceIds.forEach((cId) => {
        const choice = group.choices.find((c) => c.id === cId);
        if (choice) unitPrice += choice.priceDelta;
      });
    }
  });

  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
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
            choiceId: choice.id,
            choiceName: choice.name,
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
              choiceId: choice.id,
              choiceName: choice.name,
              priceDelta: choice.priceDelta,
            });
          }
        });
      }
    });

    const orderItem: OrderItem = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: unitPrice,
      cost: menuItem.cost,
      quantity,
      selectedOptions: allSelectedOptions,
      note: note.trim(),
      status: 'confirmed',
      isNewUnsent: true,
    };

    onAddToCart(orderItem);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={menuItem.name} maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Item Header Info */}
        <div className="flex gap-4 items-start">
          <img
            src={menuItem.image}
            alt={menuItem.name}
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-100 dark:bg-slate-800"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23cbd5e1"><rect width="100" height="100"/><text x="50" y="55" font-family="sans-serif" font-size="14" fill="%23475569" text-anchor="middle">อาหาร</text></svg>';
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {menuItem.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {menuItem.description}
            </p>
            <div className="mt-2 text-base font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {formatBaht(menuItem.price)}
            </div>
          </div>
        </div>

        {/* Option Groups */}
        {menuItem.optionGroups && menuItem.optionGroups.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {menuItem.optionGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {group.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {group.type === 'single' ? '(เลือกได้ 1 รายการ)' : '(เลือกได้หลายรายการ)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="flex items-center gap-2">
                          <span className="truncate">{choice.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {choice.priceDelta > 0 && (
                            <span className="tabular-nums font-mono opacity-90">
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

        {/* Free-text Special Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            ข้อความเพิ่มเติมถึงครัว (เช่น ไม่ใส่ผักชี, หวานน้อย, เผ็ดพิเศษ)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="พิมพ์ข้อความที่ต้องการแจ้งครัว..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Quantity and Add Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-4">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold text-sm font-mono tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-sm shadow-sm transition flex items-center justify-between cursor-pointer"
          >
            <span>ใส่ตะกร้า</span>
            <span className="font-mono tabular-nums">{formatBaht(totalPrice)}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
