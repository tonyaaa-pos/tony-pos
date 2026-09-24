import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Receipt,
  Store,
  DollarSign,
  PieChart as PieIcon,
  Calendar,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { formatBaht, formatNumber, formatThaiDateTime } from '../../utils/formatters';
import { Modal } from '../common/Modal';

export const ReportsView: React.FC = () => {
  const { bills, currentShift, openShift, closeShift, currentUser } = usePOS();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Shift modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState<number>(3000);
  const [openShiftNote, setOpenShiftNote] = useState('');

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [closeShiftNote, setCloseShiftNote] = useState('');

  // Date filtering logic
  const now = new Date();
  const filteredBills = bills.filter((b) => {
    const billDate = new Date(b.closedAt || b.createdAt);
    if (dateFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return billDate >= startOfDay;
    }
    if (dateFilter === 'week') {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return billDate >= startOfWeek;
    }
    if (dateFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return billDate >= startOfMonth;
    }
    return true;
  });

  const paidBills = filteredBills.filter((b) => b.status === 'paid');
  const totalRevenue = paidBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalDiscount = paidBills.reduce((sum, b) => sum + b.discountAmount, 0);
  const totalVat = paidBills.reduce((sum, b) => sum + b.vatAmount, 0);

  // Calculate COGS and Gross Profit
  let totalCost = 0;
  paidBills.forEach((b) => {
    b.items.forEach((i) => {
      if (i.status !== 'voided') {
        totalCost += (i.cost || 0) * i.quantity;
      }
    });
  });
  const grossProfit = totalRevenue - totalCost;

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {
    cash: 0,
    qr: 0,
    card: 0,
    transfer: 0,
    ewallet: 0,
  };

  paidBills.forEach((b) => {
    b.payments.forEach((p) => {
      paymentBreakdown[p.method] = (paymentBreakdown[p.method] || 0) + p.amount;
    });
  });

  const paymentChartData = [
    { name: 'เงินสด', value: paymentBreakdown.cash, color: '#10b981' },
    { name: 'สแกน QR', value: paymentBreakdown.qr, color: '#f59e0b' },
    { name: 'บัตรเครดิต', value: paymentBreakdown.card, color: '#3b82f6' },
    { name: 'โอนเงิน', value: paymentBreakdown.transfer, color: '#8b5cf6' },
    { name: 'E-Wallet', value: paymentBreakdown.ewallet, color: '#ec4899' },
  ].filter((p) => p.value > 0);

  // Hourly Sales Data (for Today)
  const hourlySalesMap: Record<number, number> = {};
  for (let h = 9; h <= 22; h++) {
    hourlySalesMap[h] = 0;
  }

  paidBills.forEach((b) => {
    const hour = new Date(b.closedAt || b.createdAt).getHours();
    if (hourlySalesMap[hour] !== undefined) {
      hourlySalesMap[hour] += b.grandTotal;
    }
  });

  const hourlyChartData = Object.entries(hourlySalesMap).map(([hour, val]) => ({
    time: `${hour}:00`,
    sales: val,
  }));

  // Shift status & calculations
  const shiftIsOpen = currentShift?.status === 'open';
  let shiftCashReceived = 0;
  if (shiftIsOpen && currentShift) {
    const shiftStart = new Date(currentShift.openedAt).getTime();
    const shiftBills = bills.filter(
      (b) =>
        b.status === 'paid' &&
        b.closedAt &&
        new Date(b.closedAt).getTime() >= shiftStart
    );
    shiftBills.forEach((b) => {
      b.payments.forEach((p) => {
        if (p.method === 'cash') shiftCashReceived += p.amount;
      });
    });
  }
  const shiftExpectedCash = (currentShift?.startingCash || 0) + shiftCashReceived;

  const handleConfirmOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    openShift(Number(startingCashInput), openShiftNote.trim());
    setShowOpenShiftModal(false);
  };

  const handleConfirmCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    closeShift(Number(countedCashInput), closeShiftNote.trim());
    setShowCloseShiftModal(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            รายงานยอดขายและวิเคราะห์ธุรกิจ
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            วิเคราะห์แนวโน้มยอดขาย กำไรขั้นต้น ช่องทางชำระเงิน และการเปิด-ปิดกะ
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          {[
            { id: 'today', label: 'วันนี้' },
            { id: 'week', label: '7 วันล่าสุด' },
            { id: 'month', label: 'เดือนนี้' },
            { id: 'all', label: 'ทั้งหมด' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDateFilter(tab.id as typeof dateFilter)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                dateFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shift Management Banner Card */}
      <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl ${shiftIsOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">
                {shiftIsOpen ? 'กะการขายปัจจุบันกำลังดำเนินอยู่' : 'ยังไม่ได้เปิดกะทำงาน'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${shiftIsOpen ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                {shiftIsOpen ? 'เปิดอยู่' : 'ปิดอยู่'}
              </span>
            </div>
            {shiftIsOpen && currentShift ? (
              <div className="text-xs text-slate-300 mt-1 space-x-2">
                <span>เปิดเมื่อ: {formatThaiDateTime(currentShift.openedAt)}</span>
                <span>· ผู้เปิดกะ: {currentShift.openedBy}</span>
                <span>· เงินทอนเริ่มต้น: <span className="font-mono text-amber-400 font-bold">{formatBaht(currentShift.startingCash)}</span></span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">
                กรุณาเปิดกะเพื่อเริ่มต้นบันทึกการรับเงินสดและกระทบยอดเงินทอน
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {shiftIsOpen ? (
            <button
              type="button"
              onClick={() => {
                setCountedCashInput(shiftExpectedCash);
                setShowCloseShiftModal(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>ปิดกะและสรุปเงินสด</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowOpenShiftModal(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>เปิดกะการขายใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">ยอดขายสุทธิ (Revenue)</div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
            {formatBaht(totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            จากบิลที่ชำระแล้ว {paidBills.length} บิล
          </div>
        </div>

        {/* Card 2: Estimated Gross Profit */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">กำไรขั้นต้นโดยประมาณ (Gross Profit)</div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatBaht(grossProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            หักต้นทุนอาหาร (COGS: {formatBaht(totalCost)})
          </div>
        </div>

        {/* Card 3: Discounts Given */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">ส่วนลดที่ให้ลูกค้า (Discounts)</div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {formatBaht(totalDiscount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            โปรโมชั่นและแต้มสมาชิก
          </div>
        </div>

        {/* Card 4: VAT Collected */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
          <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 tabular-nums">
            {formatBaht(totalVat)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            ภาษีสำหรับนำส่งสรรพากร
          </div>
        </div>
      </div>

      {/* Charts Grid: Hourly Sales + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Sales Bar Chart (Span 2) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">
            ช่วงเวลายอดขายรายชั่วโมง (09:00 - 22:00 น.)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any) => [formatBaht(Number(value) || 0), 'ยอดขาย']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="sales" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut Chart */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">
            สัดส่วนการชำระเงิน
          </h3>
          <div className="h-48 w-full flex items-center justify-center">
            {paymentChartData.length === 0 ? (
              <p className="text-xs text-slate-400">ยังไม่มีข้อมูลการชำระเงิน</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatBaht(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {paymentChartData.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-slate-600 dark:text-slate-300">{p.name}</span>
                </div>
                <span className="font-mono font-bold">{formatBaht(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Open Shift */}
      {showOpenShiftModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowOpenShiftModal(null as any)}
          title="เปิดกะการขายใหม่"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmOpenShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                จำนวนเงินทอนตั้งต้นในลิ้นชัก (฿) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={startingCashInput}
                onChange={(e) => setStartingCashInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                value={openShiftNote}
                onChange={(e) => setOpenShiftNote(e.target.value)}
                placeholder="เช่น กะเช้า, เงินทอนเหรียญครบ"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950"
              >
                ยืนยันเปิดกะ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Close Shift & Cash Reconciliation */}
      {showCloseShiftModal && currentShift && (
        <Modal
          isOpen={true}
          onClose={() => setShowCloseShiftModal(false)}
          title="ปิดกะและกระทบยอดเงินสด"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmCloseShift} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>เงินทอนตั้งต้น:</span>
                <span className="font-mono font-bold">{formatBaht(currentShift.startingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span>ยอดขายเงินสดในกะนี้:</span>
                <span className="font-mono font-bold text-emerald-600">+{formatBaht(shiftCashReceived)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                <span>ยอดเงินสดที่ควรมีในลิ้นชัก (Expected):</span>
                <span className="font-mono">{formatBaht(shiftExpectedCash)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ยอดเงินสดที่นับได้จริง (Counted Cash) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-bold font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Difference Calculation */}
            {countedCashInput !== shiftExpectedCash && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                  countedCashInput < shiftExpectedCash
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                }`}
              >
                <span>
                  {countedCashInput < shiftExpectedCash ? 'เงินสดขาดไป (Shortage):' : 'เงินสดเกินมา (Overage):'}
                </span>
                <span className="font-mono text-sm">
                  {formatBaht(Math.abs(countedCashInput - shiftExpectedCash))}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                หมายเหตุการปิดกะ
              </label>
              <textarea
                rows={2}
                value={closeShiftNote}
                onChange={(e) => setCloseShiftNote(e.target.value)}
                placeholder="ระบุสาเหตุเงินขาด/เกิน หรือรายละเอียดเพิ่มเติม..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                ยืนยันการปิดกะ
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
