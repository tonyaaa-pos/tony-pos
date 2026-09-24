import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Bill, PaymentMethod, PaymentRecord } from '../../types';
import { usePOS } from '../../context/POSContext';
import {
  Banknote,
  QrCode,
  CreditCard,
  Building,
  Wallet,
  CheckCircle2,
  Printer,
  Sparkles,
  Users,
  Split,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { ReceiptPrint } from './ReceiptPrint';
import { soundService } from '../../utils/audio';

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
    applyBillDiscount,
    applyMembershipDiscount,
    members,
    findMemberByPhone,
  } = usePOS();

  // Discount controls
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>(
    bill.discountValue > 0 ? bill.discountType : 'none'
  );
  const [discountValue, setDiscountValue] = useState<number>(bill.discountValue || 0);

  // Membership lookup
  const [memberPhone, setMemberPhone] = useState(bill.membershipPhone || '');
  const [redeemPoints, setRedeemPoints] = useState<number>(bill.membershipDiscountPoints || 0);

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

  // Split mode: 'single' | 'equal'
  const [splitMode, setSplitMode] = useState<'single' | 'equal'>('single');
  const [splitPersons, setSplitPersons] = useState<number>(2);

  // Completion state
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);

  // Calculate live amount due
  const totalPaidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingDue = Math.max(0, Math.round((bill.grandTotal - totalPaidSoFar) * 100) / 100);

  const matchedMember = memberPhone ? findMemberByPhone(memberPhone) : undefined;

  // Handle applying discount
  const handleApplyDiscount = (type: 'percentage' | 'fixed', val: number) => {
    applyBillDiscount(bill.id, type, val);
  };

  const handleApplyMemberPoints = () => {
    if (memberPhone && redeemPoints > 0) {
      applyMembershipDiscount(bill.id, memberPhone, redeemPoints);
    }
  };

  // Quick banknote buttons
  const banknotes = [20, 50, 100, 500, 1000];

  const handleQuickCash = (amount: number) => {
    setCashReceived(String(amount));
  };

  // Add payment to list
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
    soundService.playReadyChime();
    const finalPayments = payments.length > 0 ? payments : [
      {
        method: activeMethod,
        amount: bill.grandTotal,
        receivedAmount: activeMethod === 'cash' ? (parseFloat(cashReceived) || bill.grandTotal) : undefined,
        change: activeMethod === 'cash' ? Math.max(0, (parseFloat(cashReceived) || bill.grandTotal) - bill.grandTotal) : 0,
        ref: activeMethod === 'card' ? cardRef : activeMethod === 'qr' ? 'QR-PAID' : undefined,
        qrImageId: activeMethod === 'qr' ? selectedQrId : undefined,
      } as PaymentRecord
    ];

    const result = completeBillPayment(bill.id, finalPayments);
    if (result.success) {
      setCompletedBill(result.bill);
    }
  };

  // Selected QR image object
  const activeQrImage = qrImages.find((q) => q.id === selectedQrId) || qrImages[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={completedBill ? 'ชำระเงินสำเร็จ' : `ชำระเงินบิล: ${bill.billNumber} (${bill.tableName ? `โต๊ะ ${bill.tableName}` : 'ออเดอร์'})`}
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
              ยอดสุทธิ: {formatBaht(completedBill.grandTotal)} · โต๊ะ {completedBill.tableName || '-'} พร้อมใช้งานใหม่
            </p>
          </div>

          {/* Receipt Preview */}
          <ReceiptPrint bill={completedBill} settings={settings} />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm"
            >
              เสร็จสิ้น / ปิดหน้าต่าง
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top Bar: Grand Total & Split selector */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400">ยอดที่ต้องชำระทั้งหมด</div>
              <div className="text-3xl font-extrabold font-mono tabular-nums text-amber-400">
                {formatBaht(bill.grandTotal)}
              </div>
              {remainingDue > 0 && remainingDue < bill.grandTotal && (
                <div className="text-xs text-rose-400 font-mono mt-1">
                  ยอดคงเหลือที่ต้องจ่าย: {formatBaht(remainingDue)}
                </div>
              )}
            </div>

            {/* Split options */}
            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setSplitMode('single')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  splitMode === 'single' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                จ่ายรวม
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  splitMode === 'equal' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>หารเท่ากัน</span>
              </button>
            </div>
          </div>

          {/* Equal split helper */}
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
                  {formatBaht(Math.ceil(bill.grandTotal / splitPersons))}
                </span>
              </div>
            </div>
          )}

          {/* Discounts & Member Point Redemption */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>ส่วนลด & สมาชิกสะสมแต้ม</span>
              </span>

              {/* Discount Segment */}
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('none');
                    handleApplyDiscount('fixed', 0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    discountType === 'none' ? 'bg-slate-200 dark:bg-slate-700 font-bold' : 'text-slate-500'
                  }`}
                >
                  ไม่มี
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('percentage');
                    handleApplyDiscount('percentage', discountValue || 10);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    discountType === 'percentage' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500'
                  }`}
                >
                  ลด %
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('fixed');
                    handleApplyDiscount('fixed', discountValue || 50);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    discountType === 'fixed' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500'
                  }`}
                >
                  ลดบาท (฿)
                </button>
              </div>
            </div>

            {discountType !== 'none' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">ระบุจำนวนลด:</span>
                <input
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setDiscountValue(val);
                    handleApplyDiscount(discountType, val);
                  }}
                  className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold font-mono"
                />
                <span className="text-xs font-bold text-rose-600">
                  (-{formatBaht(bill.discountAmount)})
                </span>
              </div>
            )}

            {/* Member phone input */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <input
                  type="tel"
                  placeholder="เบอร์โทรสมาชิก (เช่น 0812345678)"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs flex-1"
                />
              </div>

              {matchedMember ? (
                <div className="text-xs flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    {matchedMember.name} (มี {matchedMember.points} แต้ม)
                  </span>
                  {matchedMember.points > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const pts = Math.min(matchedMember.points, Math.floor(bill.grandTotal));
                        setRedeemPoints(pts);
                        applyMembershipDiscount(bill.id, memberPhone, pts);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      ใช้แต้มลด {matchedMember.points}฿
                    </button>
                  )}
                </div>
              ) : memberPhone.length >= 9 ? (
                <span className="text-[11px] text-slate-400">ไม่พบสมาชิกเบอร์นี้</span>
              ) : null}
            </div>
          </div>

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
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
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
            {/* 1. Cash Method */}
            {activeMethod === 'cash' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    ยอดเงินสดที่รับมา (บาท):
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={String(remainingDue)}
                    className="w-40 px-3.5 py-2 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-bold font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Quick banknotes */}
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">ปุ่มด่วนตามมูลค่าธนบัตร:</div>
                  <div className="flex flex-wrap gap-2">
                    {banknotes.map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => handleQuickCash(note)}
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold font-mono text-sm hover:bg-amber-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        +{note}฿
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleQuickCash(remainingDue)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold text-xs cursor-pointer"
                    >
                      พอดี ({formatBaht(remainingDue, false)})
                    </button>
                  </div>
                </div>

                {/* Change calculation */}
                {parseFloat(cashReceived) > remainingDue && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      เงินทอน (Change):
                    </span>
                    <span className="text-xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatBaht(parseFloat(cashReceived) - remainingDue)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 2. QR Payment: DISPLAY UPLOADED QR IMAGE LARGE AND CLEAR WITH AMOUNT */}
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
                    {formatBaht(remainingDue)}
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
                    {formatBaht(remainingDue)}
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
                    {formatBaht(remainingDue)}
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
                    <span className="font-bold font-mono">{formatBaht(p.amount)}</span>
                    <button
                      type="button"
                      onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              ยกเลิก
            </button>

            <div className="flex items-center gap-2">
              {/* Optional: Add partial payment */}
              {remainingDue > 0 && payments.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
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
