import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Bill } from '../../types';
import {
  Search,
  Receipt,
  Printer,
  Ban,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { formatBaht, formatThaiDateTime } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ReceiptPrint } from '../pos/ReceiptPrint';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const BillsView: React.FC = () => {
  const { bills, settings, voidBill } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid' | 'voided'>('all');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<Bill | null>(null);

  // Void confirmation
  const [billToVoid, setBillToVoid] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Filter bills
  const filteredBills = bills.filter((bill) => {
    const matchStatus = statusFilter === 'all' || bill.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      bill.billNumber.toLowerCase().includes(q) ||
      (bill.tableName && bill.tableName.toLowerCase().includes(q)) ||
      (bill.deliveryInfo?.customerName && bill.deliveryInfo.customerName.toLowerCase().includes(q));

    return matchStatus && matchSearch;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['เลขที่บิล', 'ประเภท', 'โต๊ะ', 'ยอดรวม', 'ส่วนลด', 'VAT', 'ยอดสุทธิ', 'สถานะ', 'วันที่เปิด'];
    const rows = filteredBills.map((b) => [
      b.billNumber,
      b.orderType,
      b.tableName || '-',
      b.subtotal,
      b.discountAmount,
      b.vatAmount,
      b.grandTotal,
      b.status,
      b.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kind_pos_bills_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmVoid = () => {
    if (billToVoid && voidReason.trim()) {
      voidBill(billToVoid.id, voidReason.trim());
      setBillToVoid(null);
      setVoidReason('');
      if (selectedBill?.id === billToVoid.id) {
        setSelectedBill(null);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            ประวัติการขายและรายการบิล
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ตรวจสอบข้อมูลบิลทั้งหมด พิมพ์ใบเสร็จซ้ำ และจัดการยกเลิกบิล
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>ส่งออกรายงาน (CSV)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาตามเลขที่บิล, โต๊ะ หรือชื่อลูกค้า..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'open', label: 'เปิดอยู่' },
            { id: 'paid', label: 'ชำระแล้ว' },
            { id: 'voided', label: 'ยกเลิก (Void)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="py-3.5 px-4">เลขที่บิล</th>
                <th className="py-3.5 px-4">โต๊ะ / ประเภท</th>
                <th className="py-3.5 px-4">เวลาเปิดบิล</th>
                <th className="py-3.5 px-4">พนักงาน</th>
                <th className="py-3.5 px-4">จำนวนรายการ</th>
                <th className="py-3.5 px-4 text-right">ยอดสุทธิ</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    ไม่พบบันทึกบิลตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  let statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      เปิดบิล
                    </span>
                  );
                  if (bill.status === 'paid') {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ชำระแล้ว</span>
                      </span>
                    );
                  } else if (bill.status === 'voided') {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        ยกเลิก
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                      onClick={() => setSelectedBill(bill)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {bill.billNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {bill.tableName ? `โต๊ะ ${bill.tableName}` : bill.orderType === 'takeaway' ? 'สั่งกลับบ้าน' : 'เดลิเวอรี'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {formatThaiDateTime(bill.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {bill.createdByName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 tabular-nums">
                        {bill.items.filter((i) => i.status !== 'voided').length} รายการ
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatBaht(bill.grandTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {statusBadge}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setShowPrintModal(bill)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="พิมพ์ใบเสร็จ"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {bill.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => setBillToVoid(bill)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                              title="ยกเลิกบิลนี้ (Void)"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBill(null)}
          title={`รายละเอียดบิล: ${selectedBill.billNumber}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            {/* Meta summary */}
            <div className="grid grid-cols-2 gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
              <div>
                <span className="text-slate-400">ประเภท:</span>{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedBill.tableName ? `โต๊ะ ${selectedBill.tableName}` : selectedBill.orderType}
                </span>
              </div>
              <div>
                <span className="text-slate-400">เวลาเปิดบิล:</span>{' '}
                <span className="font-mono">{formatThaiDateTime(selectedBill.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-400">พนักงานเปิด:</span>{' '}
                <span>{selectedBill.createdByName}</span>
              </div>
              <div>
                <span className="text-slate-400">สถานะ:</span>{' '}
                <span className="font-bold uppercase">{selectedBill.status}</span>
              </div>
            </div>

            {/* Void detail if voided */}
            {selectedBill.status === 'voided' && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
                <div className="font-bold">บิลนี้ถูกยกเลิก (Voided):</div>
                <div>เหตุผล: {selectedBill.voidReason || 'ไม่ระบุ'}</div>
                <div>โดย: {selectedBill.voidedBy} ({selectedBill.voidedAt && formatThaiDateTime(selectedBill.voidedAt)})</div>
              </div>
            )}

            {/* Item list */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {selectedBill.items.map((item) => (
                <div key={item.id} className="p-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {item.name} x{item.quantity}
                    </div>
                    {item.selectedOptions.length > 0 && (
                      <div className="text-[11px] text-slate-400">
                        {item.selectedOptions.map((o) => o.choiceName).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-bold tabular-nums">
                    {formatBaht(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial breakdown */}
            <div className="space-y-1 text-xs pt-2">
              <div className="flex justify-between">
                <span>ยอดรวมอาหาร:</span>
                <span className="font-mono">{formatBaht(selectedBill.subtotal)}</span>
              </div>
              {selectedBill.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>ส่วนลด:</span>
                  <span className="font-mono">-{formatBaht(selectedBill.discountAmount)}</span>
                </div>
              )}
              {selectedBill.serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>ค่าบริการ ({selectedBill.serviceChargeRate}%):</span>
                  <span className="font-mono">{formatBaht(selectedBill.serviceChargeAmount)}</span>
                </div>
              )}
              {selectedBill.vatRate > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>VAT ({selectedBill.vatRate}%):</span>
                  <span className="font-mono">{formatBaht(selectedBill.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>ยอดสุทธิ:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {formatBaht(selectedBill.grandTotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPrintModal(selectedBill);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ใบเสร็จ</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Print Receipt Modal */}
      {showPrintModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowPrintModal(null)}
          title="พิมพ์ใบเสร็จรับเงิน"
          maxWidth="max-w-md"
        >
          <ReceiptPrint
            bill={showPrintModal}
            settings={settings}
            onClose={() => setShowPrintModal(null)}
          />
        </Modal>
      )}

      {/* Void Dialog */}
      {billToVoid && (
        <Modal
          isOpen={true}
          onClose={() => setBillToVoid(null)}
          title="ยืนยันการยกเลิกบิล (Void Bill)"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-xs">
              คำเตือน: บิลเลขที่ {billToVoid.billNumber} จะถูกยกเลิก และหากเป็นโต๊ะที่เปิดอยู่ โต๊ะจะถูกเปลี่ยนสถานะเป็นโต๊ะว่าง
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                เหตุผลในการยกเลิกบิล <span className="text-rose-500">*</span>:
              </label>
              <textarea
                rows={2}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น ลูกค้ายกเลิกโต๊ะ, คีย์ผิดบิลซ้ำซ้อน..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBillToVoid(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={!voidReason.trim()}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 cursor-pointer"
              >
                ยืนยันการยกเลิกบิล
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
