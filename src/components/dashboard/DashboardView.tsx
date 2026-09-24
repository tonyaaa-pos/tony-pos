import React from 'react';
import { usePOS } from '../../context/POSContext';
import {
  TrendingUp,
  Receipt,
  Users,
  UtensilsCrossed,
  ShoppingBag,
  ChefHat,
  Clock,
  ArrowRight,
  PlusCircle,
  Store,
} from 'lucide-react';
import { formatBaht, formatNumber, formatThaiTimeOnly } from '../../utils/formatters';

interface DashboardViewProps {
  onOpenShiftModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenShiftModal }) => {
  const { bills, tables, setActiveNav, createBillForOrder, currentShift } = usePOS();

  // Filter bills today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayBills = bills.filter((b) => {
    const d = new Date(b.createdAt);
    return d >= today;
  });

  const paidTodayBills = todayBills.filter((b) => b.status === 'paid');
  const todayTotalSales = paidTodayBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const paidBillsCount = paidTodayBills.length;
  const avgBillValue = paidBillsCount > 0 ? todayTotalSales / paidBillsCount : 0;

  // Active / open tables
  const occupiedTables = tables.filter((t) => t.status === 'occupied' || t.status === 'payment_pending');

  // Top selling items from today's orders
  const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
  todayBills.forEach((b) => {
    b.items.forEach((item) => {
      if (item.status !== 'voided') {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemCounts[item.name].qty += item.quantity;
        itemCounts[item.name].revenue += item.price * item.quantity;
      }
    });
  });

  const topItems = Object.values(itemCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const handleQuickTakeaway = () => {
    createBillForOrder('takeaway');
    setActiveNav('pos');
  };

  const handleQuickDelivery = () => {
    createBillForOrder('delivery');
    setActiveNav('pos');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Shift Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{currentShift?.status === 'open' ? 'กะการขายปัจจุบันกำลังดำเนินอยู่' : 'ยังไม่ได้เปิดกะทำงาน'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {currentShift?.status === 'open'
                ? `เปิดกะโดย ${currentShift.openedBy} · เงินทอนตั้งต้น: ${formatBaht(currentShift.startingCash, false)}`
                : 'กรุณาเปิดกะเพื่อเริ่มต้นบันทึกการรับเงินทอนและปิดยอดสิ้นวัน'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveNav('reports')}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer"
        >
          จัดการกะและสรุปเงินสด
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">ยอดขายชำระแล้ววันนี้</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatBaht(todayTotalSales)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            จากทั้งหมด {formatNumber(paidBillsCount)} บิลที่ชำระเงินแล้ว
          </div>
        </div>

        {/* Card 2: Number of bills */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">จำนวนบิลทั้งหมดวันนี้</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatNumber(todayBills.length)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            เปิดอยู่ {todayBills.filter((b) => b.status === 'open').length} บิล · ชำระแล้ว {paidBillsCount}
          </div>
        </div>

        {/* Card 3: Average bill value */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">ยอดเฉลี่ยต่อบิล</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatBaht(avgBillValue)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            คำนวณจากบิลที่ปิดยอดสำเร็จ
          </div>
        </div>

        {/* Card 4: Open tables */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">โต๊ะที่กำลังใช้งาน</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {occupiedTables.length} / {tables.length}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            ว่าง {tables.filter((t) => t.status === 'available').length} โต๊ะ · จองแล้ว {tables.filter((t) => t.status === 'reserved').length}
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveNav('tables')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 transition flex items-center gap-3 shadow-2xs group cursor-pointer"
        >
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-900 dark:text-white">ดูผังโต๊ะ</div>
            <div className="text-xs text-slate-400">เปิดโต๊ะ & จัดการ</div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleQuickTakeaway}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 transition flex items-center gap-3 shadow-2xs group cursor-pointer"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-900 dark:text-white">สั่งกลับบ้าน</div>
            <div className="text-xs text-slate-400">Takeaway ออเดอร์</div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleQuickDelivery}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-purple-400 transition flex items-center gap-3 shadow-2xs group cursor-pointer"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-900 dark:text-white">เดลิเวอรี</div>
            <div className="text-xs text-slate-400">บันทึกที่อยู่จัดส่ง</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('kitchen')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 transition flex items-center gap-3 shadow-2xs group cursor-pointer"
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition">
            <ChefHat className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-900 dark:text-white">เปิดจอครัว</div>
            <div className="text-xs text-slate-400">จัดการคิวทำอาหาร</div>
          </div>
        </button>
      </div>

      {/* Main Grid: Top Selling Items + Active Live Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              เมนูขายดีวันนี้
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('reports')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>ดูรายงานทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {topItems.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">ยังไม่มีข้อมูลยอดขายวันนี้</p>
            ) : (
              topItems.map((item, idx) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold font-mono flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {item.qty} จาน
                    </div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      {formatBaht(item.revenue)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Active Orders */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              ออเดอร์ที่กำลังรับประทานอยู่ในร้าน
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('tables')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>ไปที่ผังโต๊ะ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {todayBills.filter((b) => b.status === 'open').length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">ไม่มีออเดอร์เปิดค้างอยู่ขณะนี้</p>
            ) : (
              todayBills
                .filter((b) => b.status === 'open')
                .slice(0, 5)
                .map((bill) => (
                  <div
                    key={bill.id}
                    onClick={() => {
                      setActiveNav('tables');
                    }}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {bill.tableName ? `โต๊ะ ${bill.tableName}` : bill.orderType === 'takeaway' ? 'สั่งกลับบ้าน' : 'เดลิเวอรี'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {bill.billNumber}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>เปิดเมื่อ {formatThaiTimeOnly(bill.createdAt)}</span>
                        <span>· {bill.items.length} รายการ</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {formatBaht(bill.grandTotal)}
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                        เปิดบิล
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
