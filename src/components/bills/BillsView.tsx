import React, { useState, useRef } from 'react';
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
  CreditCard,
  Calendar,
  X,
} from 'lucide-react';
import { formatBaht, formatThaiDateTime } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ReceiptPrint } from '../pos/ReceiptPrint';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { canPay, PayBlockReason } from '../../utils/orderRules';
import { UnsavedItemsPaymentDialog } from '../pos/UnsavedItemsPaymentDialog';
import { PaymentModal } from '../pos/PaymentModal';

export const BillsView: React.FC = () => {
  const { bills, settings, voidBill, confirmOrder, setActiveNav, loadArchivedBills, cloudConnected } = usePOS();

  const toLocalDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid' | 'voided'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'date'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateStr(new Date()));
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<Bill | null>(null);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveLoadMessage, setArchiveLoadMessage] = useState<string | null>(null);

  // Payment states
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [payBlockReason, setPayBlockReason] = useState<PayBlockReason>('unsaved_items');
  const [billForBlockedPay, setBillForBlockedPay] = useState<Bill | null>(null);

  // Void confirmation
  const [billToVoid, setBillToVoid] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const liveSelectedBill = selectedBill ? bills.find((b) => b.id === selectedBill.id) || selectedBill : null;
  const livePayingBill = payingBill ? bills.find((b) => b.id === payingBill.id) || payingBill : null;

  const handleStartPayment = (bill: Bill) => {
    const check = canPay(bill);
    if (!check.allowed) {
      setPayBlockReason(check.reason || 'unsaved_items');
      setBillForBlockedPay(bill);
      setShowBlockedDialog(true);
      return;
    }
    setPayingBill(bill);
  };

  const handleLoadArchive = async () => {
    setIsLoadingArchive(true);
    setArchiveLoadMessage(null);
    try {
      const count = await loadArchivedBills();
      setArchiveLoadMessage(`โหลดบิลประวัติเก่าเพิ่มเติมแล้ว ${count} รายการ`);
      setTimeout(() => setArchiveLoadMessage(null), 4000);
    } catch {
      setArchiveLoadMessage('เกิดข้อผิดพลาดในการโหลดบิลเก่า');
      setTimeout(() => setArchiveLoadMessage(null), 4000);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  // Filter bills
  const filteredBills = bills.filter((bill) => {
    const matchStatus = statusFilter === 'all' || bill.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      bill.billNumber.toLowerCase().includes(q) ||
      (bill.tableName && bill.tableName.toLowerCase().includes(q)) ||
      (bill.deliveryInfo?.customerName && bill.deliveryInfo.customerName.toLowerCase().includes(q));

    let matchDate = true;
    if (dateFilter !== 'all') {
      const billDate = new Date(bill.createdAt);
      if (Number.isNaN(billDate.getTime())) {
        matchDate = false;
      } else {
        const now = new Date();
        if (dateFilter === 'today') {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          matchDate = billDate >= start && billDate <= end;
        } else if (dateFilter === 'yesterday') {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
          matchDate = billDate >= start && billDate <= end;
        } else if (dateFilter === 'this_week') {
          const dayOfWeek = now.getDay();
          const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
          const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
          matchDate = billDate >= start && billDate <= end;
        } else if (dateFilter === 'date' && selectedDate) {
          const [y, m, d] = selectedDate.split('-').map(Number);
          if (y && m && d) {
            const start = new Date(y, m - 1, d, 0, 0, 0, 0);
            const end = new Date(y, m - 1, d, 23, 59, 59, 999);
            matchDate = billDate >= start && billDate <= end;
          }
        }
      }
    }

    return matchStatus && matchSearch && matchDate;
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

        <div className="flex items-center gap-2">
          {cloudConnected && (
            <button
              type="button"
              onClick={handleLoadArchive}
              disabled={isLoadingArchive}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="ดึงบิลย้อนหลังเก่ากว่า 30 วันจาก Cloud มาตรวจสอบ"
            >
              <Clock className={`w-4 h-4 ${isLoadingArchive ? 'animate-spin' : ''}`} />
              <span>{isLoadingArchive ? 'กำลังโหลด...' : 'ดึงบิลเก่ากว่า 30 วัน'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออกรายงาน (CSV)</span>
          </button>
        </div>
      </div>

      {archiveLoadMessage && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{archiveLoadMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Collapsible Search: Magnifying Glass Icon Only -> Expands Input on Click */}
          {!isSearchOpen ? (
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 0);
              }}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer shrink-0 flex items-center justify-center"
              title="ค้นหาบิล"
              aria-label="ค้นหาบิล"
            >
              <Search className="w-4 h-4" />
            </button>
          ) : (
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }
                }}
                placeholder="ค้นหาตามเลขที่บิล, โต๊ะ หรือชื่อลูกค้า..."
                className="w-full pl-10 pr-9 py-2 rounded-xl border border-amber-400 dark:border-amber-600 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                title="ปิดช่องค้นหา"
                aria-label="ปิดช่องค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Date Quick Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold flex-wrap">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'today', label: 'วันนี้' },
              { id: 'yesterday', label: 'เมื่อวาน' },
              { id: 'this_week', label: 'อาทิตย์นี้' },
            ].map((dTab) => (
              <button
                key={dTab.id}
                type="button"
                onClick={() => {
                  const mode = dTab.id as 'all' | 'today' | 'yesterday' | 'this_week';
                  setDateFilter(mode);
                  if (mode === 'today') {
                    setSelectedDate(toLocalDateStr(new Date()));
                  } else if (mode === 'yesterday') {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setSelectedDate(toLocalDateStr(y));
                  }
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  dateFilter === dTab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dTab.label}
              </button>
            ))}
          </div>

          {/* Calendar Date Picker */}
          <div
            onClick={() => {
              try {
                (dateInputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
              } catch {
                dateInputRef.current?.focus();
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              dateFilter === 'date'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 ring-1 ring-amber-400/40'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
            title="เลือกวันที่จากปฏิทินเพื่อดูบิล"
          >
            <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setSelectedDate(val);
                  setDateFilter('date');
                } else {
                  setDateFilter('all');
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              aria-label="เลือกวันที่จากปฏิทิน"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold shrink-0 self-start lg:self-auto">
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
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
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
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartPayment(bill)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                                title="ชำระเงิน"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setBillToVoid(bill)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                                title="ยกเลิกบิลนี้ (Void)"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
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
      {liveSelectedBill && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBill(null)}
          title={`รายละเอียดบิล: ${liveSelectedBill.billNumber}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            {/* Meta summary */}
            <div className="grid grid-cols-2 gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
              <div>
                <span className="text-slate-400">ประเภท:</span>{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {liveSelectedBill.tableName ? `โต๊ะ ${liveSelectedBill.tableName}` : liveSelectedBill.orderType}
                </span>
              </div>
              <div>
                <span className="text-slate-400">เวลาเปิดบิล:</span>{' '}
                <span className="font-mono">{formatThaiDateTime(liveSelectedBill.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-400">พนักงานเปิด:</span>{' '}
                <span>{liveSelectedBill.createdByName}</span>
              </div>
              <div>
                <span className="text-slate-400">สถานะ:</span>{' '}
                <span className="font-bold uppercase">{liveSelectedBill.status}</span>
              </div>
            </div>

            {/* Void detail if voided */}
            {liveSelectedBill.status === 'voided' && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
                <div className="font-bold">บิลนี้ถูกยกเลิก (Voided):</div>
                <div>เหตุผล: {liveSelectedBill.voidReason || 'ไม่ระบุ'}</div>
                <div>โดย: {liveSelectedBill.voidedBy} ({liveSelectedBill.voidedAt && formatThaiDateTime(liveSelectedBill.voidedAt)})</div>
              </div>
            )}

            {/* Item list */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {liveSelectedBill.items.map((item) => (
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
                <span className="font-mono">{formatBaht(liveSelectedBill.subtotal)}</span>
              </div>
              {liveSelectedBill.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>ส่วนลด:</span>
                  <span className="font-mono">-{formatBaht(liveSelectedBill.discountAmount)}</span>
                </div>
              )}
              {liveSelectedBill.serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>ค่าบริการ ({liveSelectedBill.serviceChargeRate}%):</span>
                  <span className="font-mono">{formatBaht(liveSelectedBill.serviceChargeAmount)}</span>
                </div>
              )}
              {liveSelectedBill.vatRate > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>VAT ({liveSelectedBill.vatRate}%):</span>
                  <span className="font-mono">{formatBaht(liveSelectedBill.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>ยอดสุทธิ:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {formatBaht(liveSelectedBill.grandTotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPrintModal(liveSelectedBill);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ใบเสร็จ</span>
              </button>

              {liveSelectedBill.status === 'open' && (
                <button
                  type="button"
                  onClick={() => {
                    const bill = liveSelectedBill;
                    setSelectedBill(null);
                    handleStartPayment(bill);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>ชำระเงิน</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Blocked payment modal */}
      {showBlockedDialog && billForBlockedPay && (
        <UnsavedItemsPaymentDialog
          isOpen={true}
          onClose={() => {
            setShowBlockedDialog(false);
            setBillForBlockedPay(null);
          }}
          reason={payBlockReason}
          isDineInWithoutTable={Boolean(billForBlockedPay.orderType === 'dine_in' && !billForBlockedPay.tableId)}
          onSaveAndGoToFloorPlan={() => {
            confirmOrder(billForBlockedPay.id);
            setShowBlockedDialog(false);
            if (billForBlockedPay.orderType === 'dine_in') {
              setActiveNav('tables');
            }
            setBillForBlockedPay(null);
          }}
        />
      )}

      {/* Payment Modal */}
      {livePayingBill && livePayingBill.status === 'open' && (
        <PaymentModal
          isOpen={true}
          bill={livePayingBill}
          onClose={() => setPayingBill(null)}
        />
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
