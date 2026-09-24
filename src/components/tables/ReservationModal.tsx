import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ReservationInfo } from '../../types';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  defaultCapacity: number;
  onSaveReservation: (reservation: ReservationInfo) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  tableNumber,
  defaultCapacity,
  onSaveReservation,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [reservedTime, setReservedTime] = useState('18:00');
  const [partySize, setPartySize] = useState(defaultCapacity);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('กรุณาระบุชื่อลูกค้า');
      return;
    }
    if (!phone.trim()) {
      setError('กรุณาระบุเบอร์โทรศัพท์');
      return;
    }

    onSaveReservation({
      customerName: customerName.trim(),
      phone: phone.trim(),
      reservedTime,
      partySize: Number(partySize) || defaultCapacity,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`บันทึกการจองโต๊ะ ${tableNumber}`} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            ชื่อลูกค้าผู้จอง <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setError('');
            }}
            placeholder="เช่น คุณสมศักดิ์"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            เบอร์โทรศัพท์ติดต่อ <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            placeholder="เช่น 081-234-5678"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              เวลาที่จอง
            </label>
            <input
              type="time"
              value={reservedTime}
              onChange={(e) => setReservedTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              จำนวนท่าน
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            หมายเหตุเพิ่มเติม
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ขอเก้าอี้เด็ก, งานวันเกิด"
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
          >
            บันทึกการจอง
          </button>
        </div>
      </form>
    </Modal>
  );
};
