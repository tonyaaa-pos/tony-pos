import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Table, Bill } from '../../types';
import { usePOS } from '../../context/POSContext';
import {
  Users,
  Clock,
  ArrowRightLeft,
  Merge,
  Receipt,
  PlusCircle,
  CreditCard,
  XCircle,
} from 'lucide-react';
import { formatBaht, formatElapsedTime } from '../../utils/formatters';
import { canPay, PayBlockReason } from '../../utils/orderRules';
import { UnsavedItemsPaymentDialog } from '../pos/UnsavedItemsPaymentDialog';

interface TableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table;
  bill: Bill | null;
  onOpenPOS: () => void;
  onOpenPayment: () => void;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  isOpen,
  onClose,
  table,
  bill,
  onOpenPOS,
  onOpenPayment,
}) => {
  const { tables, moveTable, mergeTables, requestTableBill, cancelReservation, confirmOrder } = usePOS();
  const [subMode, setSubMode] = useState<'main' | 'move' | 'merge'>('main');
  const [targetTableId, setTargetTableId] = useState('');
  const [selectedMergeTableIds, setSelectedMergeTableIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Payment blocked dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [payBlockReason, setPayBlockReason] = useState<PayBlockReason>('unsaved_items');

  const availableTables = tables.filter((t) => t.id !== table.id && t.status === 'available');
  const otherOccupiedTables = tables.filter((t) => t.id !== table.id && t.status === 'occupied');

  const elapsed = formatElapsedTime(table.seatedAt);

  const handleMove = () => {
    if (!targetTableId) {
      setErrorMsg('กรุณาเลือกโต๊ะปลายทาง');
      return;
    }
    const ok = moveTable(table.id, targetTableId);
    if (ok) {
      onClose();
    } else {
      setErrorMsg('ไม่สามารถย้ายโต๊ะได้');
    }
  };

  const handleMerge = () => {
    if (selectedMergeTableIds.length === 0) {
      setErrorMsg('กรุณาเลือกโต๊ะที่ต้องการรวม');
      return;
    }
    const ok = mergeTables(selectedMergeTableIds, table.id);
    if (ok) {
      onClose();
    } else {
      setErrorMsg('ไม่สามารถรวมโต๊ะได้');
    }
  };

  const handlePayClick = () => {
    const check = canPay(bill);
    if (!check.allowed) {
      setPayBlockReason(check.reason || 'unsaved_items');
      setShowUnsavedDialog(true);
      return;
    }
    onClose();
    onOpenPayment();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`โต๊ะ ${table.number} (${table.zone === 'indoor' ? 'ในห้องแอร์' : table.zone === 'outdoor' ? 'รับลมด้านนอก' : 'VIP'})`}
        maxWidth="max-w-md"
      >
        {subMode === 'main' && (
          <div className="space-y-5">
            {/* Status Bar */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    table.status === 'occupied'
                      ? 'bg-amber-500'
                      : table.status === 'payment_pending'
                      ? 'bg-rose-500'
                      : table.status === 'reserved'
                      ? 'bg-blue-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {table.status === 'occupied'
                    ? 'มีลูกค้าใช้บริการ'
                    : table.status === 'payment_pending'
                    ? 'รอชำระเงิน'
                    : table.status === 'reserved'
                    ? 'จองแล้ว'
                    : 'โต๊ะว่าง'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span className="tabular-nums font-medium">{table.guestCount || table.capacity} ท่าน</span>
                </span>
                {table.seatedAt && (
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsed.text}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Reservation Card if reserved */}
            {table.reservation && (
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <div className="font-bold text-blue-900 dark:text-blue-300">
                  ข้อมูลการจอง: คุณ{table.reservation.customerName} ({table.reservation.partySize} ท่าน)
                </div>
                <div>โทร: {table.reservation.phone} · เวลาจอง: {table.reservation.reservedTime} น.</div>
                {table.reservation.note && <div className="text-slate-500">หมายเหตุ: {table.reservation.note}</div>}
                <button
                  type="button"
                  onClick={() => {
                    cancelReservation(table.id);
                    onClose();
                  }}
                  className="mt-2 text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  ยกเลิกการจองนี้
                </button>
              </div>
            )}

            {/* Active Bill Preview */}
            {bill && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    บิลเลขที่: {bill.billNumber}
                  </span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                    ยอดรวม: {formatBaht(bill.grandTotal)}
                  </span>
                </div>

                {/* Order items count summary */}
                <div className="text-xs text-slate-600 dark:text-slate-300 max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {bill.items.filter((i) => i.status !== 'voided').map((item) => (
                    <div key={item.id} className="py-1.5 flex items-center justify-between">
                      <span className="truncate">
                        {item.name} x{item.quantity}
                        {item.isNewUnsent && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">
                            ยังไม่บันทึก
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500 shrink-0 ml-2">
                        {formatBaht(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPOS();
                }}
                className="p-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>สั่งอาหารเพิ่ม / แก้ไข</span>
              </button>

              {bill && bill.items.length > 0 && (
                <button
                  type="button"
                  onClick={handlePayClick}
                  className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>ชำระเงิน / ปิดบิล</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSubMode('move')}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>ย้ายโต๊ะ</span>
              </button>

              <button
                type="button"
                onClick={() => setSubMode('merge')}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Merge className="w-4 h-4" />
                <span>รวมโต๊ะ</span>
              </button>

              {table.status === 'occupied' && (
                <button
                  type="button"
                  onClick={() => {
                    requestTableBill(table.id);
                    onClose();
                  }}
                  className="col-span-2 p-2.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>เปลี่ยนสถานะเป็น &quot;ขอเช็คบิล&quot;</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sub Mode: Move Table */}
        {subMode === 'move' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              เลือกโต๊ะว่างที่ต้องการย้ายออเดอร์จากโต๊ะ {table.number} ไปยัง:
            </p>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {availableTables.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">ไม่มีโต๊ะว่างในขณะนี้</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTargetTableId(t.id);
                      setErrorMsg('');
                    }}
                    className={`p-3 rounded-xl border font-bold text-sm transition cursor-pointer ${
                      targetTableId === t.id
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t.number}
                    <div className="text-[10px] font-normal opacity-75">{t.capacity} ที่นั่ง</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSubMode('main');
                  setErrorMsg('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={handleMove}
                disabled={!targetTableId}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-500 text-slate-950 disabled:opacity-50 cursor-pointer"
              >
                ยืนยันการย้ายโต๊ะ
              </button>
            </div>
          </div>
        )}

        {/* Sub Mode: Merge Tables */}
        {subMode === 'merge' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              เลือกโต๊ะที่มีลูกค้าที่ต้องการนำมารวมกับโต๊ะ {table.number}:
            </p>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {otherOccupiedTables.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">ไม่มีโต๊ะอื่นที่มีออเดอร์เปิดอยู่</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {otherOccupiedTables.map((t) => {
                  const isChecked = selectedMergeTableIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setErrorMsg('');
                            if (e.target.checked) {
                              setSelectedMergeTableIds((prev) => [...prev, t.id]);
                            } else {
                              setSelectedMergeTableIds((prev) => prev.filter((id) => id !== t.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          โต๊ะ {t.number}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {t.guestCount || t.capacity} ท่าน
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSubMode('main');
                  setErrorMsg('');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={selectedMergeTableIds.length === 0}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-500 text-slate-950 disabled:opacity-50 cursor-pointer"
              >
                ยืนยันการรวมโต๊ะ
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Blocked payment modal */}
      {showUnsavedDialog && (
        <UnsavedItemsPaymentDialog
          isOpen={true}
          onClose={() => setShowUnsavedDialog(false)}
          reason={payBlockReason}
          onSaveAndGoToFloorPlan={() => {
            if (bill) {
              confirmOrder(bill.id);
            }
            setShowUnsavedDialog(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
