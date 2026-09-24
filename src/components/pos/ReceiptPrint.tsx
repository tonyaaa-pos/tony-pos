import React from 'react';
import { Bill, ShopSettings } from '../../types';
import { formatBaht, formatThaiDateTime } from '../../utils/formatters';
import { Printer, Download, X } from 'lucide-react';

interface ReceiptPrintProps {
  bill: Bill;
  settings: ShopSettings;
  onClose?: () => void;
}

export const ReceiptPrint: React.FC<ReceiptPrintProps> = ({ bill, settings, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const paymentLabels: Record<string, string> = {
    cash: 'เงินสด (Cash)',
    qr: 'สแกน QR (PromptPay)',
    card: 'บัตรเครดิต/เดบิต',
    transfer: 'โอนเงินธนาคาร',
    ewallet: 'กระเป๋าเงินอิเล็กทรอนิกส์ (E-Wallet)',
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Action Bar (Not printed) */}
      <div className="flex items-center justify-between w-full max-w-sm px-2 print:hidden">
        <span className="text-xs font-semibold text-slate-500">ตัวอย่างใบเสร็จรับเงิน 80 มม.</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์ใบเสร็จ (Print / PDF)</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* The Printable 80mm Receipt Area */}
      <div
        id="printable-receipt"
        className="w-full max-w-[320px] bg-white text-slate-950 p-6 rounded-2xl shadow-md border border-slate-200 font-sans text-xs select-text"
        style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', monospace, sans-serif" }}
      >
        {/* Shop Header */}
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
          <div className="text-base font-bold tracking-tight text-slate-950">{settings.shopName}</div>
          <div className="text-[11px] text-slate-600 leading-snug">{settings.address}</div>
          <div className="text-[11px] text-slate-600">โทร: {settings.phone}</div>
          {settings.taxId && <div className="text-[11px] text-slate-600">เลขประจำตัวผู้เสียภาษี: {settings.taxId}</div>}
          <div className="text-[12px] font-bold mt-2 pt-1 border-t border-slate-200">
            ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ
          </div>
        </div>

        {/* Bill Meta */}
        <div className="py-2.5 text-[11px] space-y-0.5 border-b border-dashed border-slate-300 text-slate-700">
          <div className="flex justify-between">
            <span>เลขที่บิล:</span>
            <span className="font-mono font-bold text-slate-950">{bill.billNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>วันที่ / เวลา:</span>
            <span>{formatThaiDateTime(bill.closedAt || bill.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>พนักงาน:</span>
            <span>{bill.createdByName}</span>
          </div>
          <div className="flex justify-between">
            <span>ประเภท:</span>
            <span>
              {bill.tableName
                ? `โต๊ะ ${bill.tableName} (${bill.guestCount || 1} ท่าน)`
                : bill.orderType === 'takeaway'
                ? 'สั่งกลับบ้าน (Takeaway)'
                : 'เดลิเวอรี (Delivery)'}
            </span>
          </div>
        </div>

        {/* Item List */}
        <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
          <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-100 text-slate-800">
            <span>รายการ</span>
            <span>จำนวน x ราคา = รวม</span>
          </div>

          {bill.items
            .filter((item) => item.status !== 'voided')
            .map((item) => (
              <div key={item.id} className="text-[11px]">
                <div className="flex justify-between items-start font-medium text-slate-900">
                  <span className="max-w-[170px] truncate">{item.name}</span>
                  <span className="tabular-nums font-mono">
                    {item.quantity} x {item.price} = {formatBaht(item.price * item.quantity, false)}
                  </span>
                </div>
                {item.selectedOptions.length > 0 && (
                  <div className="text-[10px] text-slate-500 pl-2">
                    {item.selectedOptions.map((o) => o.choiceName).join(', ')}
                  </div>
                )}
                {item.note && (
                  <div className="text-[10px] text-slate-400 pl-2 italic">
                    *{item.note}
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Financial Calculation Breakdown */}
        <div className="py-2.5 text-[11px] space-y-1 border-b border-dashed border-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-600">ยอดรวมสินค้า (Subtotal):</span>
            <span className="font-mono tabular-nums">{formatBaht(bill.subtotal)}</span>
          </div>

          {bill.discountAmount > 0 && (
            <div className="flex justify-between text-rose-600 font-medium">
              <span>ส่วนลด (Discount):</span>
              <span className="font-mono tabular-nums">-{formatBaht(bill.discountAmount)}</span>
            </div>
          )}

          {bill.serviceChargeAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>ค่าบริการ (Service {bill.serviceChargeRate}%):</span>
              <span className="font-mono tabular-nums">{formatBaht(bill.serviceChargeAmount)}</span>
            </div>
          )}

          {bill.vatRate > 0 && (
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>
                {bill.vatIncluded ? `ภาษีมูลค่าเพิ่ม VAT ${bill.vatRate}% (รวมในราคา)` : `ภาษีมูลค่าเพิ่ม VAT ${bill.vatRate}%`}
              </span>
              <span className="font-mono tabular-nums">{formatBaht(bill.vatAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-bold pt-1.5 border-t border-slate-200 text-slate-950">
            <span>ยอดสุทธิ (Total):</span>
            <span className="font-mono tabular-nums">{formatBaht(bill.grandTotal)}</span>
          </div>
        </div>

        {/* Payments Summary */}
        <div className="py-2.5 text-[11px] space-y-1 border-b border-dashed border-slate-300">
          {bill.payments.length > 0 ? (
            bill.payments.map((p, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-medium">
                  <span>ชำระโดย: {paymentLabels[p.method] || p.method}</span>
                  <span className="font-mono tabular-nums font-bold">{formatBaht(p.amount)}</span>
                </div>
                {p.receivedAmount !== undefined && (
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>รับเงินมา:</span>
                    <span className="font-mono tabular-nums">{formatBaht(p.receivedAmount)}</span>
                  </div>
                )}
                {p.change !== undefined && p.change > 0 && (
                  <div className="flex justify-between text-[10px] text-emerald-700 font-semibold">
                    <span>เงินทอน:</span>
                    <span className="font-mono tabular-nums">{formatBaht(p.change)}</span>
                  </div>
                )}
                {p.ref && (
                  <div className="text-[10px] text-slate-400">
                    เลขอ้างอิง: {p.ref}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-rose-500 text-center font-bold">ยังไม่ชำระเงิน (Unpaid)</div>
          )}
        </div>

        {/* Custom Receipt Footer Message */}
        <div className="pt-4 text-center space-y-1 text-[10px] text-slate-500">
          {settings.receiptFooter.split('\n').map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
