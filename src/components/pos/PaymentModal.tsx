import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Bill, PaymentMethod, PaymentRecord } from '../../types';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Banknote,
  QrCode,
  CreditCard,
  Building,
  Wallet,
  CheckCircle2,
  Users,
  Split,
  Plus,
  Minus,
  Trash2,
  Check,
} from 'lucide-react';
import { ReceiptPrint } from './ReceiptPrint';
import { soundService } from '../../utils/audio';

const formatAmount = (amount: number, showDecimals = true): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return showDecimals ? '0.00' : '0';
  }
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, bill }) => {
  const {
    settings,
    qrImages,
    completeBillPayment,
    canPay,
    splitBill,
    bills,
  } = usePOS();
  const { getName } = useLanguage();

  const [finalizeError, setFinalizeError] = useState<string>('');

  // Active bill tracking (supporting split bills for the same table)
  const [activeBillId, setActiveBillId] = useState<string>(bill.id);
  const activeBill = bills.find((b) => b.id === activeBillId) || bill;

  // Sync activeBillId if prop bill changes
  useEffect(() => {
    setActiveBillId(bill.id);
    setPayments([]);
    setCashReceived('');
    setCardRef('');
    setTransferRef('');
    setItemSplits({});
    setSplitMode('single');
  }, [bill.id]);

  // Payments list (supporting mixed payments!)
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('cash');

  // Input fields for current method
  const [cashReceived, setCashReceived] = useState<string>('');
  const [cardRef, setCardRef] = useState<string>('');
  const [transferRef, setTransferRef] = useState<string>('');
  const [selectedQrId, setSelectedQrId] = useState<string>(() => {
    const def = qrImages.find((q) => q.isDefault);
    return def ? def.id : qrImages[0]?.id || '';
  });

  // Split mode: 'single' | 'equal' | 'items'
  const [splitMode, setSplitMode] = useState<'single' | 'equal' | 'items'>('single');
  const [splitPersons, setSplitPersons] = useState<number>(2);
  const [itemSplits, setItemSplits] = useState<Record<string, number>>({});

  // Completion state
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);

  // Calculate live amount due
  const totalPaidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingDue = Math.max(0, Math.round((activeBill.grandTotal - totalPaidSoFar) * 100) / 100);

  // Related open bills for this table
  const tableOpenBills = bills.filter(
    (b) => b.tableId && b.tableId === activeBill.tableId && b.status === 'open'
  );

  // Active valid items in this bill
  const validItems = activeBill.items.filter((i) => i.status !== 'voided');

  const totalItemsCount = validItems.reduce((sum, i) => sum + i.quantity, 0);

  const splitSelectedCount = Object.values(itemSplits).reduce((sum, q) => sum + q, 0);

  const splitSelectedTotal = validItems.reduce(
    (sum, item) => sum + item.price * (itemSplits[item.id] || 0),
    0
  );

  // Add partial payment to list
  const handleAddPayment = () => {
    soundService.playTap();

    if (activeMethod === 'cash') {
      const received = parseFloat(cashReceived) || remainingDue;
      const amountToPay = Math.min(remainingDue, received);
      const change = Math.max(0, received - amountToPay);

      const record: PaymentRecord = {
        method: 'cash',
        amount: amountToPay,
        receivedAmount: received,
        change,
      };

      setPayments((prev) => [...prev, record]);
      setCashReceived('');
    } else if (activeMethod === 'qr') {
      const record: PaymentRecord = {
        method: 'qr',
        amount: remainingDue,
        qrImageId: selectedQrId,
        ref: 'QR-CONFIRMED',
      };
      setPayments((prev) => [...prev, record]);
    } else if (activeMethod === 'card') {
      const record: PaymentRecord = {
        method: 'card',
        amount: remainingDue,
        ref: cardRef || 'CARD',
      };
      setPayments((prev) => [...prev, record]);
      setCardRef('');
    } else if (activeMethod === 'transfer') {
      const record: PaymentRecord = {
        method: 'transfer',
        amount: remainingDue,
        ref: transferRef || 'TRANSFER',
      };
      setPayments((prev) => [...prev, record]);
      setTransferRef('');
    } else if (activeMethod === 'ewallet') {
      const record: PaymentRecord = {
        method: 'ewallet',
        amount: remainingDue,
        ref: transferRef || 'E-WALLET',
      };
      setPayments((prev) => [...prev, record]);
      setTransferRef('');
    }
  };

  // Complete entire bill
  const handleFinalize = () => {
    const check = canPay(activeBill);
    if (!check.allowed) {
      setFinalizeError(
        check.reason === 'empty'
          ? 'บิลนี้ยังไม่มีรายการอาหาร'
          : 'คุณมีรายการที่ยังไม่ได้บันทึกลงโต๊ะ กรุณากดบันทึกออเดอร์ลงโต๊ะก่อนชำระเงิน'
      );
      return;
    }
    setFinalizeError('');
    soundService.playReadyChime();
    const finalPayments = payments.length > 0 ? payments : [
      {
        method: activeMethod,
        amount: activeBill.grandTotal,
        receivedAmount: activeMethod === 'cash' ? (parseFloat(cashReceived) || activeBill.grandTotal) : undefined,
        change: activeMethod === 'cash' ? Math.max(0, (parseFloat(cashReceived) || activeBill.grandTotal) - activeBill.grandTotal) : 0,
        ref: activeMethod === 'card' ? cardRef : activeMethod === 'qr' ? 'QR-PAID' : undefined,
        qrImageId: activeMethod === 'qr' ? selectedQrId : undefined,
      } as PaymentRecord
    ];

    const result = completeBillPayment(activeBill.id, finalPayments);
    if (result.success) {
      setCompletedBill(result.bill);
    }
  };

  // Handle Calculator Numpad key press
  const handleNumpadPress = (key: string) => {
    soundService.playTap();
    if (key === 'C') {
      setCashReceived('');
    } else if (key === 'backspace') {
      setCashReceived((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
    } else if (key === 'exact') {
      setCashReceived(String(remainingDue));
    } else if (key === '+100') {
      const current = parseFloat(cashReceived) || 0;
      setCashReceived(String(current + 100));
    } else if (key === '.') {
      if (!cashReceived) {
        setCashReceived('0.');
      } else if (!cashReceived.includes('.')) {
        setCashReceived((prev) => prev + '.');
      }
    } else {
      // Numbers: 0-9, 00
      if (cashReceived === '0' && key !== '.') {
        setCashReceived(key);
      } else {
        setCashReceived((prev) => prev + key);
      }
    }
  };

  // Handle Item Split Quantity Stepper
  const handleItemSplitChange = (itemId: string, maxQty: number, delta: number) => {
    soundService.playTap();
    setItemSplits((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  // Set all of an item to split
  const handleItemSplitAll = (itemId: string, maxQty: number) => {
    soundService.playTap();
    setItemSplits((prev) => {
      if (prev[itemId] === maxQty) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: maxQty };
    });
  };

  // Execute Split Bill into a new Bill
  const handleConfirmSplitBill = () => {
    if (splitSelectedCount === 0) return;
    if (splitSelectedCount >= totalItemsCount) {
      alert('ไม่สามารถแยกรายการทั้งหมดได้ (กรุณาใช้ปุ่ม "จ่ายรวม" สำหรับการชำระทั้งบิล)');
      return;
    }

    const payload = Object.entries(itemSplits)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    const res = splitBill(activeBill.id, payload);
    if (res) {
      soundService.playReadyChime();
      setItemSplits({});
      setSplitMode('single');
      // Automatically switch to the newly created bill to pay!
      setActiveBillId(res.newBill.id);
      setPayments([]);
      setCashReceived('');
    }
  };

  // Selected QR image object
  const activeQrImage = qrImages.find((q) => q.id === selectedQrId) || qrImages[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        completedBill
          ? 'ชำระเงินสำเร็จ'
          : `ชำระเงินบิล: ${activeBill.billNumber} (${
              activeBill.tableName ? `โต๊ะ ${activeBill.tableName}` : 'ออเดอร์'
            })`
      }
      maxWidth="max-w-2xl"
    >
      {completedBill ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 dark:text-emerald-400 mb-2" />
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              บันทึกการชำระเงินเรียบร้อยแล้ว
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ยอดสุทธิ: {formatAmount(completedBill.grandTotal)} · โต๊ะ {completedBill.tableName || '-'} พร้อมใช้งานใหม่
            </p>
          </div>

          {/* Receipt Preview */}
          <ReceiptPrint bill={completedBill} settings={settings} />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm cursor-pointer"
            >
              เสร็จสิ้น / ปิดหน้าต่าง
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-bill switcher tabs if multiple open bills exist for this table */}
          {tableOpenBills.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                บิลแยกในโต๊ะนี้ ({tableOpenBills.length}):
              </span>
              {tableOpenBills.map((b, index) => {
                const isActive = b.id === activeBill.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setActiveBillId(b.id);
                      setPayments([]);
                      setCashReceived('');
                      setItemSplits({});
                      setSplitMode('single');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    บิล {index + 1}: {b.billNumber} ({formatAmount(b.grandTotal)})
                  </button>
                );
              })}
            </div>
          )}

          {/* Top Bar: Grand Total & Split selector */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400">ยอดที่ต้องชำระทั้งหมด</div>
              <div className="text-3xl font-extrabold font-mono tabular-nums text-amber-400">
                {formatAmount(activeBill.grandTotal)}
              </div>
              {remainingDue > 0 && remainingDue < activeBill.grandTotal && (
                <div className="text-xs text-rose-400 font-mono mt-1">
                  ยอดคงเหลือที่ต้องจ่าย: {formatAmount(remainingDue)}
                </div>
              )}
            </div>

            {/* Split options: จ่ายรวม, หารเท่ากัน, จ่ายแยก */}
            <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setSplitMode('single')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  splitMode === 'single' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                จ่ายรวม
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  splitMode === 'equal' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>หารเท่ากัน</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('items')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  splitMode === 'items' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>จ่ายแยก</span>
              </button>
            </div>
          </div>

          {/* 1. Equal split helper */}
          {splitMode === 'equal' && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-900 dark:text-blue-300">
                  จำนวนคนหาร:
                </span>
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={splitPersons}
                  onChange={(e) => setSplitPersons(Math.max(2, Number(e.target.value)))}
                  className="w-16 px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-center font-bold font-mono"
                />
              </div>
              <div className="text-right">
                <span className="text-slate-500">คนละ: </span>
                <span className="text-base font-bold font-mono text-blue-700 dark:text-blue-400">
                  {formatAmount(Math.ceil(activeBill.grandTotal / splitPersons))}
                </span>
              </div>
            </div>
          )}

          {/* 2. Items split interface (แยกรายการออกเป็นบิลใหม่) */}
          {splitMode === 'items' && (
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Split className="w-4 h-4 text-amber-600" />
                    <span>เลือกรายการอาหารเพื่อแยกบิล</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    ปรับจำนวนเพื่อแยกรายการออกไปเป็นอีก 1 บิล สำหรับลูกค้าที่จ่ายแยก
                  </p>
                </div>
                {splitSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setItemSplits({})}
                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    ล้างที่เลือก
                  </button>
                )}
              </div>

              {/* Items List to Split */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {validItems.map((item) => {
                  const splitQty = itemSplits[item.id] || 0;
                  const isSelected = splitQty > 0;
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-600 shadow-xs'
                          : 'bg-white/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {getName(item)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            (สั่งไว้ x {item.quantity})
                          </span>
                        </div>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {item.selectedOptions.map((o) => o.choiceName).join(', ')}
                          </div>
                        )}
                        <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                          {formatAmount(item.price)} / รายการ
                        </div>
                      </div>

                      {/* Stepper Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleItemSplitChange(item.id, item.quantity, -1)}
                          disabled={splitQty <= 0}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-30 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-sm">
                          {splitQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleItemSplitChange(item.id, item.quantity, 1)}
                          disabled={splitQty >= item.quantity}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-30 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-slate-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleItemSplitAll(item.id, item.quantity)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                            splitQty === item.quantity
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                          }`}
                        >
                          ทั้งหมด
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Split Summary & Confirmation CTA */}
              <div className="p-3 bg-amber-100/70 dark:bg-amber-950/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-600 dark:text-slate-300">
                    เลือกแยก:{' '}
                    <strong className="text-slate-900 dark:text-white font-mono">
                      {splitSelectedCount}
                    </strong>{' '}
                    รายการ
                  </span>
                  <div className="text-sm font-extrabold font-mono text-amber-700 dark:text-amber-400">
                    ยอดแยกบิลใหม่: {formatAmount(splitSelectedTotal)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemSplits({});
                      setSplitMode('single');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSplitBill}
                    disabled={splitSelectedCount === 0 || splitSelectedCount >= totalItemsCount}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ยืนยันแยกบิล ({formatAmount(splitSelectedTotal)})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selector Tabs */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              เลือกวิธีชำระเงิน
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'cash', label: 'เงินสด', icon: Banknote },
                { id: 'qr', label: 'สแกน QR', icon: QrCode },
                { id: 'card', label: 'บัตรเครดิต', icon: CreditCard },
                { id: 'transfer', label: 'โอนเงิน', icon: Building },
                { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = activeMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveMethod(m.id as PaymentMethod)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-sm scale-102'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs whitespace-nowrap">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Method Details Input Area */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            {/* 1. Cash Method with Calculator Numpad */}
            {activeMethod === 'cash' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    ยอดเงินสดที่รับมา (บาท):
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={cashReceived}
                    placeholder={String(remainingDue)}
                    className="w-48 px-3.5 py-2.5 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xl font-bold font-mono text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                {/* Calculator Numpad */}
                <div className="grid grid-cols-4 gap-2 pt-1 max-w-sm mx-auto">
                  {/* Row 1 */}
                  {['7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadPress(num)}
                      className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('C')}
                    className="py-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-lg font-bold font-mono text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 active:scale-95 transition cursor-pointer"
                  >
                    C
                  </button>

                  {/* Row 2 */}
                  {['4', '5', '6'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadPress(num)}
                      className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('backspace')}
                    className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer flex items-center justify-center"
                    title="ลบตัวเลข"
                  >
                    ⌫
                  </button>

                  {/* Row 3 */}
                  {['1', '2', '3'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumpadPress(num)}
                      className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('exact')}
                    className="py-2.5 px-1 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-900 dark:text-amber-300 hover:bg-amber-500/30 active:scale-95 transition cursor-pointer flex flex-col items-center justify-center leading-tight"
                  >
                    <span>พอดี</span>
                    <span className="text-[10px] font-mono">({formatAmount(remainingDue, false)})</span>
                  </button>

                  {/* Row 4 */}
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('0')}
                    className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('00')}
                    className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
                  >
                    00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('.')}
                    className="py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-lg font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer shadow-xs"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumpadPress('+100')}
                    className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer"
                  >
                    +100
                  </button>
                </div>

                {/* Change calculation */}
                {parseFloat(cashReceived) > remainingDue && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      เงินทอน (Change):
                    </span>
                    <span className="text-xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatAmount(parseFloat(cashReceived) - remainingDue)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 2. QR Payment */}
            {activeMethod === 'qr' && (
              <div className="space-y-4 flex flex-col items-center text-center">
                {qrImages.length > 1 && (
                  <div className="w-full max-w-xs">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      เลือกบัญชี QR ชำระเงิน:
                    </label>
                    <select
                      value={selectedQrId}
                      onChange={(e) => setSelectedQrId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      {qrImages.map((qr) => (
                        <option key={qr.id} value={qr.id}>
                          {qr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Big Text Amount */}
                <div>
                  <div className="text-xs text-slate-500">ยอดเงินที่ต้องสแกนจ่าย</div>
                  <div className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {formatAmount(remainingDue)}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    {activeQrImage?.label}
                  </div>
                </div>

                {/* The Uploaded QR Image */}
                {activeQrImage ? (
                  <div className="p-3 bg-white rounded-2xl shadow-lg border-2 border-slate-200 dark:border-slate-700 max-w-[240px]">
                    <img
                      src={activeQrImage.imageData}
                      alt={activeQrImage.label}
                      className="w-48 h-48 object-contain rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="p-6 text-center text-rose-500 text-xs">
                    ยังไม่มีรูป QR ชำระเงิน (สามารถอัปโหลดได้ในเมนูตั้งค่าระบบ)
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  ให้ลูกค้าสแกน QR ด้านบน เมื่อลูกค้าโอนสำเร็จให้กด &quot;ยืนยันรับเงินแล้ว&quot;
                </div>
              </div>
            )}

            {/* 3. Card Method */}
            {activeMethod === 'card' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">ยอดชำระผ่านบัตร:</span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {formatAmount(remainingDue)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    เลขอ้างอิงสลิปบัตร หรือ เลข 4 หลักท้าย (ไม่บังคับ):
                  </label>
                  <input
                    type="text"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="เช่น 4421 หรือ EDC-8899"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* 4. Bank Transfer / E-Wallet */}
            {(activeMethod === 'transfer' || activeMethod === 'ewallet') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">ยอดที่ต้องบันทึก:</span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {formatAmount(remainingDue)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    หมายเหตุเลขอ้างอิงการโอน / E-Wallet (ไม่บังคับ):
                  </label>
                  <input
                    type="text"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="เช่น สลิปโอนกสิกรไทย / TrueMoney"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Mixed Payments List if any recorded */}
          {payments.length > 0 && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                รายการชำระแล้วในบิลนี้:
              </div>
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800">
                  <span>{p.method.toUpperCase()} ({p.ref || 'ชำระแล้ว'})</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono">{formatAmount(p.amount)}</span>
                    <button
                      type="button"
                      onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {finalizeError && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
              {finalizeError}
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              ยกเลิก
            </button>

            <div className="flex items-center gap-2">
              {/* Optional: Add partial payment */}
              {remainingDue > 0 && payments.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มยอดวิธีนี้</span>
                </button>
              )}

              {/* Complete Payment Button */}
              <button
                type="button"
                onClick={handleFinalize}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {activeMethod === 'qr'
                    ? 'ยืนยันรับเงินแล้ว (ปิดบิล)'
                    : 'ยืนยันการชำระเงินและพิมพ์ใบเสร็จ'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
