import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { OrderItem } from '../../types';
import { AlertCircle } from 'lucide-react';

interface VoidItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: OrderItem;
  onConfirmVoid: (reason: string) => void;
}

export const VoidItemModal: React.FC<VoidItemModalProps> = ({
  isOpen,
  onClose,
  item,
  onConfirmVoid,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const commonReasons = [
    'ลูกค้าเปลี่ยนใจ / ขอยกเลิก',
    'คีย์รายการอาหารผิดพลาด',
    'วัตถุดิบหมดกะทันหัน',
    'ลูกค้ารอนานเกินไป',
    'อาหารไม่ได้มาตรฐาน / ผิดสเปก',
  ];

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลในการยกเลิกรายการนี้');
      return;
    }
    onConfirmVoid(reason.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ยืนยันการยกเลิกรายการ (Void Item)" maxWidth="max-w-md">
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-300">
            <span className="font-bold">รายการที่จะยกเลิก:</span> {item.name} (จำนวน {item.quantity} จาน)
            <div className="text-[11px] opacity-80 mt-0.5">
              การยกเลิกรายการจะถูกบันทึกในระบบพร้อมระบุชื่อผู้กดยกเลิกและเวลา
            </div>
          </div>
        </div>

        {error && (
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            เลือกเหตุผลทั่วไป:
          </label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {commonReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r);
                  setError('');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  reason === r
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            หรือระบุเหตุผลด้วยตนเอง <span className="text-rose-500">*</span>:
          </label>
          <textarea
            rows={2}
            required
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            placeholder="พิมพ์เหตุผลการยกเลิก..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
          >
            บันทึกการยกเลิกรายการ
          </button>
        </div>
      </form>
    </Modal>
  );
};
