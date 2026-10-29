import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { Bill, MenuItem, OrderItem } from '../../types';
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
  Users,
  UtensilsCrossed,
  ShoppingBag,
  Store,
  DollarSign,
  PieChart as PieIcon,
  Calendar,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Printer,
  Sliders,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  Check,
  Percent,
  Calculator,
  Building,
  Briefcase,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight,
  Bike,
  Package,
} from 'lucide-react';
import { formatBaht, formatNumber, formatThaiDateTime, formatThaiTimeOnly } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { ReceiptPrint } from '../pos/ReceiptPrint';
import { soundService } from '../../utils/audio';

export type TimeFilterPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
export type DashboardTab = 'overview' | 'menu_profit' | 'shifts' | 'bills';
export type ChannelFilter = 'all' | 'dine_in' | 'delivery' | 'grab' | 'lineman' | 'shopeefood';

interface OpExSettings {
  laborPct: number; // e.g. 20%
  occupancyPct: number; // e.g. 10%
  customFixedExpense: number; // Baht per month/period
  defaultGrabGpRate: number; // e.g. 30% GP
  defaultLinemanGpRate: number; // e.g. 30% GP
  defaultPackagingCost: number; // e.g. 10 Baht per delivery order
}

const OPEX_STORAGE_KEY = 'kind_pos_opex_settings_v3';

const DEFAULT_OPEX: OpExSettings = {
  laborPct: 20,
  occupancyPct: 10,
  customFixedExpense: 0,
  defaultGrabGpRate: 30,
  defaultLinemanGpRate: 30,
  defaultPackagingCost: 10,
};

interface DashboardViewProps {
  onOpenShiftModal?: () => void;
  defaultTab?: DashboardTab;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ defaultTab = 'overview' }) => {
  const {
    bills,
    tables,
    menuItems,
    currentUser,
    currentShift,
    openShift,
    closeShift,
    createBillForOrder,
    setActiveNav,
    settings,
  } = usePOS();

  const { t, getName } = useLanguage();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<DashboardTab>(defaultTab);

  // Time Period state
  const [period, setPeriod] = useState<TimeFilterPeriod>('today');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // OpEx Settings (Operating Expenses to calculate True Net Profit)
  const [opExSettings, setOpExSettings] = useState<OpExSettings>(() => {
    try {
      const saved = localStorage.getItem(OPEX_STORAGE_KEY);
      return saved ? { ...DEFAULT_OPEX, ...JSON.parse(saved) } : DEFAULT_OPEX;
    } catch {
      return DEFAULT_OPEX;
    }
  });
  const [showOpExModal, setShowOpExModal] = useState(false);
  const [tempOpEx, setTempOpEx] = useState<OpExSettings>(opExSettings);

  // Shift Modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState<number>(3000);
  const [openShiftNote, setOpenShiftNote] = useState('');

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [closeShiftNote, setCloseShiftNote] = useState('');

  // Bill audit detail modal
  const [inspectingBill, setInspectingBill] = useState<Bill | null>(null);
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'paid' | 'open' | 'voided'>('all');

  // Filter bills based on period and selected dates
  const filteredBills = useMemo(() => {
    const targetDateObj = new Date(selectedDate);
    const targetYear = targetDateObj.getFullYear();
    const targetMonth = targetDateObj.getMonth();
    const targetDay = targetDateObj.getDate();

    return bills.filter((b) => {
      const billDate = new Date(b.closedAt || b.createdAt);

      if (period === 'today') {
        return (
          billDate.getFullYear() === targetYear &&
          billDate.getMonth() === targetMonth &&
          billDate.getDate() === targetDay
        );
      }

      if (period === 'week') {
        const startOfWeek = new Date(targetYear, targetMonth, targetDay - 6, 0, 0, 0);
        const endOfWeek = new Date(targetYear, targetMonth, targetDay, 23, 59, 59);
        return billDate >= startOfWeek && billDate <= endOfWeek;
      }

      if (period === 'month') {
        return billDate.getFullYear() === targetYear && billDate.getMonth() === targetMonth;
      }

      if (period === 'year') {
        return billDate.getFullYear() === targetYear;
      }

      if (period === 'custom') {
        const start = new Date(`${customStartDate}T00:00:00`);
        const end = new Date(`${customEndDate}T23:59:59`);
        return billDate >= start && billDate <= end;
      }

      return true;
    });
  }, [bills, period, selectedDate, customStartDate, customEndDate]);

  // Channel filtering
  const channelFilteredBills = useMemo(() => {
    if (channelFilter === 'all') return filteredBills;
    if (channelFilter === 'dine_in') {
      return filteredBills.filter((b) => b.orderType === 'dine_in' || b.orderType === 'takeaway');
    }
    if (channelFilter === 'delivery') {
      return filteredBills.filter((b) => b.orderType === 'delivery');
    }
    return filteredBills.filter((b) => b.deliveryPlatform === channelFilter);
  }, [filteredBills, channelFilter]);

  // All paid bills in the selected time period (for overall channel comparison)
  const allPeriodPaidBills = useMemo(
    () => filteredBills.filter((b) => b.status === 'paid'),
    [filteredBills]
  );

  // Financial metrics calculated according to international F&B standards for active filter
  const paidBills = useMemo(
    () => channelFilteredBills.filter((b) => b.status === 'paid'),
    [channelFilteredBills]
  );

  const pnl = useMemo(() => {
    let grossFoodSales = 0;
    let totalCogs = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    let totalServiceCharge = 0;
    let totalGuests = 0;
    let totalGpFee = 0;
    let totalPackagingCost = 0;
    let deliveryGrossSales = 0;
    let dineInGrossSales = 0;
    let deliveryOrdersCount = 0;
    let dineInOrdersCount = 0;

    paidBills.forEach((b) => {
      totalDiscount += b.discountAmount || 0;
      totalVat += b.vatAmount || 0;
      totalServiceCharge += b.serviceChargeAmount || 0;
      totalGuests += b.guestCount || 1;

      const isDelivery = b.orderType === 'delivery';
      if (isDelivery) {
        deliveryOrdersCount++;
      } else {
        dineInOrdersCount++;
      }

      // Calculate Platform GP Fee
      let billGp = b.deliveryGpAmount || 0;
      if (isDelivery && (!billGp || billGp === 0)) {
        const rate =
          b.deliveryGpRate ??
          (b.deliveryPlatform === 'grab'
            ? opExSettings.defaultGrabGpRate
            : b.deliveryPlatform === 'lineman'
            ? opExSettings.defaultLinemanGpRate
            : 30);
        billGp = Math.round(((b.subtotal || 0) * (rate / 100)) * 100) / 100;
      }
      totalGpFee += billGp;

      // Calculate Packaging cost
      let billPkg = b.packagingCost || 0;
      if (isDelivery && (!billPkg || billPkg === 0)) {
        billPkg = opExSettings.defaultPackagingCost ?? 10;
      }
      totalPackagingCost += billPkg;

      b.items.forEach((item) => {
        if (item.status !== 'voided') {
          const lineTotal = item.price * item.quantity;
          grossFoodSales += lineTotal;
          if (isDelivery) {
            deliveryGrossSales += lineTotal;
          } else {
            dineInGrossSales += lineTotal;
          }

          // Accurate COGS calculation: unit cost from item, or fallback to matching MenuItem cost
          let unitCost = item.cost;
          if (unitCost === undefined || unitCost === 0) {
            const matched = menuItems.find((m) => m.id === item.menuItemId);
            unitCost = matched?.cost || 0;
          }
          totalCogs += unitCost * item.quantity;
        }
      });
    });

    const netSales = Math.max(0, grossFoodSales - totalDiscount);
    // Net Realized Revenue = Gross Sales - Discounts - Platform GP Fee - Packaging Costs
    const netRealizedRevenue = Math.max(0, netSales - totalGpFee - totalPackagingCost);

    // Gross Profit = Net Realized Revenue - Food Cost (COGS)
    const grossProfit = netRealizedRevenue - totalCogs;
    const foodCostPct = netRealizedRevenue > 0 ? (totalCogs / netRealizedRevenue) * 100 : 0;
    const grossMarginPct = netRealizedRevenue > 0 ? (grossProfit / netRealizedRevenue) * 100 : 0;

    // Operating Expenses (OpEx)
    const laborCost = (netSales * opExSettings.laborPct) / 100;
    const occupancyCost = (netSales * opExSettings.occupancyPct) / 100;
    const fixedCost = opExSettings.customFixedExpense || 0;
    const totalOpEx = laborCost + occupancyCost + fixedCost;

    // Prime Cost = COGS + Labor Cost (F&B benchmark: under 55-60%)
    const primeCost = totalCogs + laborCost;
    const primeCostPct = netSales > 0 ? (primeCost / netSales) * 100 : 0;

    // Net Operating Profit (EBITDA / กำไรจากการดำเนินงานสุทธิ)
    const netProfit = grossProfit - totalOpEx;
    const netMarginPct = netRealizedRevenue > 0 ? (netProfit / netRealizedRevenue) * 100 : 0;

    const avgTicket = paidBills.length > 0 ? netSales / paidBills.length : 0;
    const avgPerGuest = totalGuests > 0 ? netSales / totalGuests : 0;

    return {
      grossFoodSales,
      totalDiscount,
      totalGpFee,
      totalPackagingCost,
      netSales,
      netRealizedRevenue,
      totalCogs,
      foodCostPct,
      grossProfit,
      grossMarginPct,
      laborCost,
      occupancyCost,
      fixedCost,
      totalOpEx,
      primeCost,
      primeCostPct,
      netProfit,
      netMarginPct,
      totalVat,
      totalServiceCharge,
      totalGuests,
      paidBillsCount: paidBills.length,
      deliveryOrdersCount,
      dineInOrdersCount,
      deliveryGrossSales,
      dineInGrossSales,
      avgTicket,
      avgPerGuest,
    };
  }, [paidBills, menuItems, opExSettings]);

  // Channel Comparison Matrix across ALL paid bills in this period
  const channelComparison = useMemo(() => {
    const channels: Record<
      string,
      {
        id: string;
        label: string;
        icon: string;
        color: string;
        count: number;
        gross: number;
        discount: number;
        gpFee: number;
        packaging: number;
        cogs: number;
        netPayout: number;
        profit: number;
        marginPct: number;
      }
    > = {
      dine_in: { id: 'dine_in', label: 'หน้าร้าน (Dine-in / Takeaway)', icon: '🍽️', color: '#f59e0b', count: 0, gross: 0, discount: 0, gpFee: 0, packaging: 0, cogs: 0, netPayout: 0, profit: 0, marginPct: 0 },
      grab: { id: 'grab', label: 'GrabFood', icon: '🟢', color: '#10b981', count: 0, gross: 0, discount: 0, gpFee: 0, packaging: 0, cogs: 0, netPayout: 0, profit: 0, marginPct: 0 },
      lineman: { id: 'lineman', label: 'LINE MAN', icon: '🟢', color: '#06c755', count: 0, gross: 0, discount: 0, gpFee: 0, packaging: 0, cogs: 0, netPayout: 0, profit: 0, marginPct: 0 },
      shopeefood: { id: 'shopeefood', label: 'ShopeeFood', icon: '🟠', color: '#ee4d2d', count: 0, gross: 0, discount: 0, gpFee: 0, packaging: 0, cogs: 0, netPayout: 0, profit: 0, marginPct: 0 },
      other_delivery: { id: 'other_delivery', label: 'เดลิเวอรีอื่นๆ / ส่งเอง', icon: '🛵', color: '#8b5cf6', count: 0, gross: 0, discount: 0, gpFee: 0, packaging: 0, cogs: 0, netPayout: 0, profit: 0, marginPct: 0 },
    };

    allPeriodPaidBills.forEach((b) => {
      let chKey = 'dine_in';
      if (b.orderType === 'delivery') {
        if (b.deliveryPlatform === 'grab') chKey = 'grab';
        else if (b.deliveryPlatform === 'lineman') chKey = 'lineman';
        else if (b.deliveryPlatform === 'shopeefood') chKey = 'shopeefood';
        else chKey = 'other_delivery';
      }

      const ch = channels[chKey];
      ch.count += 1;
      ch.discount += b.discountAmount || 0;

      let billGross = 0;
      let billCogs = 0;
      b.items.forEach((it) => {
        if (it.status !== 'voided') {
          billGross += it.price * it.quantity;
          const matched = menuItems.find((m) => m.id === it.menuItemId);
          billCogs += (it.cost || matched?.cost || 0) * it.quantity;
        }
      });
      ch.gross += billGross;
      ch.cogs += billCogs;

      let billGp = b.deliveryGpAmount || 0;
      if (b.orderType === 'delivery' && (!billGp || billGp === 0)) {
        const rate =
          b.deliveryGpRate ??
          (chKey === 'grab'
            ? opExSettings.defaultGrabGpRate
            : chKey === 'lineman'
            ? opExSettings.defaultLinemanGpRate
            : 30);
        billGp = Math.round(((b.subtotal || 0) * (rate / 100)) * 100) / 100;
      }
      ch.gpFee += billGp;

      let billPkg = b.packagingCost || 0;
      if (b.orderType === 'delivery' && (!billPkg || billPkg === 0)) {
        billPkg = opExSettings.defaultPackagingCost ?? 10;
      }
      ch.packaging += billPkg;
    });

    Object.values(channels).forEach((ch) => {
      ch.netPayout = Math.max(0, ch.gross - ch.discount - ch.gpFee);
      ch.profit = ch.netPayout - ch.packaging - ch.cogs;
      ch.marginPct = ch.gross > 0 ? (ch.profit / ch.gross) * 100 : 0;
    });

    return Object.values(channels);
  }, [allPeriodPaidBills, menuItems, opExSettings]);

  // Payment methods breakdown
  const paymentChartData = useMemo(() => {
    const counts: Record<string, number> = {
      cash: 0,
      qr: 0,
      card: 0,
      transfer: 0,
      ewallet: 0,
    };

    paidBills.forEach((b) => {
      b.payments.forEach((p) => {
        counts[p.method] = (counts[p.method] || 0) + p.amount;
      });
    });

    return [
      { name: 'เงินสด', value: counts.cash, color: '#10b981' },
      { name: 'สแกน QR', value: counts.qr, color: '#f59e0b' },
      { name: 'บัตรเครดิต', value: counts.card, color: '#3b82f6' },
      { name: 'โอนเงิน', value: counts.transfer, color: '#8b5cf6' },
      { name: 'E-Wallet', value: counts.ewallet, color: '#ec4899' },
    ].filter((p) => p.value > 0);
  }, [paidBills]);

  // Trend Chart Data (Sales vs Gross Profit)
  const trendChartData = useMemo(() => {
    if (period === 'today') {
      // Hourly (09:00 - 22:00)
      const hourly: Record<number, { sales: number; profit: number }> = {};
      for (let h = 9; h <= 22; h++) {
        hourly[h] = { sales: 0, profit: 0 };
      }

      paidBills.forEach((b) => {
        const hour = new Date(b.closedAt || b.createdAt).getHours();
        if (hourly[hour]) {
          const billNet = Math.max(0, b.grandTotal - (b.vatAmount || 0));
          let billCogs = 0;
          b.items.forEach((it) => {
            if (it.status !== 'voided') {
              const matched = menuItems.find((m) => m.id === it.menuItemId);
              billCogs += (it.cost || matched?.cost || 0) * it.quantity;
            }
          });
          hourly[hour].sales += billNet;
          hourly[hour].profit += billNet - billCogs;
        }
      });

      return Object.entries(hourly).map(([h, data]) => ({
        label: `${h}:00`,
        sales: Math.round(data.sales),
        profit: Math.round(data.profit),
      }));
    }

    if (period === 'week') {
      // 7 Days
      const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'];
      const targetDateObj = new Date(selectedDate);
      const points: { label: string; dateStr: string; sales: number; profit: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(targetDateObj.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStr = d.toISOString().split('T')[0];
        points.push({
          label: `${days[d.getDay()]} (${d.getDate()})`,
          dateStr: dayStr,
          sales: 0,
          profit: 0,
        });
      }

      paidBills.forEach((b) => {
        const bDateStr = new Date(b.closedAt || b.createdAt).toISOString().split('T')[0];
        const point = points.find((p) => p.dateStr === bDateStr);
        if (point) {
          const billNet = Math.max(0, b.grandTotal - (b.vatAmount || 0));
          let billCogs = 0;
          b.items.forEach((it) => {
            if (it.status !== 'voided') {
              const matched = menuItems.find((m) => m.id === it.menuItemId);
              billCogs += (it.cost || matched?.cost || 0) * it.quantity;
            }
          });
          point.sales += billNet;
          point.profit += billNet - billCogs;
        }
      });

      return points;
    }

    if (period === 'year') {
      // 12 Months
      const monthNames = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
      ];
      const monthly = monthNames.map((name) => ({
        label: name,
        sales: 0,
        profit: 0,
      }));

      paidBills.forEach((b) => {
        const m = new Date(b.closedAt || b.createdAt).getMonth();
        if (monthly[m]) {
          const billNet = Math.max(0, b.grandTotal - (b.vatAmount || 0));
          let billCogs = 0;
          b.items.forEach((it) => {
            if (it.status !== 'voided') {
              const matched = menuItems.find((m) => m.id === it.menuItemId);
              billCogs += (it.cost || matched?.cost || 0) * it.quantity;
            }
          });
          monthly[m].sales += billNet;
          monthly[m].profit += billNet - billCogs;
        }
      });

      return monthly;
    }

    // Default: Group by weeks or 5 intervals
    return [
      { label: 'ยอดขายรวม', sales: Math.round(pnl.netSales), profit: Math.round(pnl.grossProfit) },
    ];
  }, [period, selectedDate, paidBills, menuItems, pnl.netSales, pnl.grossProfit]);

  // Menu Engineering: Top dishes ranked by total profit contribution
  const menuProfitabilityList = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        name: string;
        nameEn?: string;
        qty: number;
        revenue: number;
        cogs: number;
        profit: number;
        unitPrice: number;
        unitCost: number;
      }
    > = {};

    paidBills.forEach((b) => {
      b.items.forEach((item) => {
        if (item.status !== 'voided') {
          const key = item.menuItemId || item.name;
          if (!map[key]) {
            const matched = menuItems.find((m) => m.id === item.menuItemId);
            const unitCost = item.cost || matched?.cost || 0;
            map[key] = {
              id: item.menuItemId,
              name: item.name,
              nameEn: item.nameEn,
              qty: 0,
              revenue: 0,
              cogs: 0,
              profit: 0,
              unitPrice: item.price,
              unitCost,
            };
          }
          const itemRev = item.price * item.quantity;
          const itemCost = map[key].unitCost * item.quantity;
          map[key].qty += item.quantity;
          map[key].revenue += itemRev;
          map[key].cogs += itemCost;
          map[key].profit += itemRev - itemCost;
        }
      });
    });

    const list = Object.values(map);
    // Sort by profit contribution descending
    return list.sort((a, b) => b.profit - a.profit);
  }, [paidBills, menuItems]);

  // Shift cash status
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

  // Active table counts
  const occupiedTables = tables.filter(
    (t) => t.status === 'occupied' || t.status === 'payment_pending'
  );

  const handleSaveOpEx = () => {
    setOpExSettings(tempOpEx);
    localStorage.setItem(OPEX_STORAGE_KEY, JSON.stringify(tempOpEx));
    setShowOpExModal(false);
    soundService.playSuccessTap();
  };

  const handleConfirmOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    openShift(Number(startingCashInput), openShiftNote.trim());
    setShowOpenShiftModal(false);
    soundService.playSuccessTap();
  };

  const handleConfirmCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    closeShift(Number(countedCashInput), closeShiftNote.trim());
    setShowCloseShiftModal(false);
    soundService.playSuccessTap();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header: Title + Period Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>แดชบอร์ด & รายงานยอดขาย</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                  ระบบ P&L สากล
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                วิเคราะห์ยอดขาย กำไร/ขาดทุนแท้จริง (F&B P&L), ต้นทุนอาหาร (COGS), เมนูทำกำไร และสรุปกะ
              </p>
            </div>
          </div>
        </div>

        {/* Period Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Mode Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold">
            {[
              { id: 'today', label: 'รายวัน' },
              { id: 'week', label: 'รายสัปดาห์ (7 วัน)' },
              { id: 'month', label: 'รายเดือน' },
              { id: 'year', label: 'รายปี' },
              { id: 'custom', label: 'กำหนดเอง' },
            ].map((tItem) => (
              <button
                key={tItem.id}
                type="button"
                onClick={() => {
                  setPeriod(tItem.id as TimeFilterPeriod);
                  soundService.playTap();
                }}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  period === tItem.id
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tItem.label}
              </button>
            ))}
          </div>

          {/* Date Picker Input */}
          {period === 'today' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            />
          )}

          {period === 'month' && (
            <input
              type="month"
              value={selectedDate.substring(0, 7)}
              onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            />
          )}

          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
              <span className="text-xs text-slate-400">ถึง</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* OpEx Cost Settings Button */}
          <button
            type="button"
            onClick={() => {
              setTempOpEx(opExSettings);
              setShowOpExModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title="ตั้งค่าต้นทุนค่าใช้จ่ายดำเนินงาน (ค่าแรง, ค่าเช่า, GP เดลิเวอรี, ค่ากล่อง) เพื่อคำนวณกำไรสุทธิ"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>ปรับต้นทุน OpEx & GP</span>
          </button>
        </div>

        {/* Channel Filter Selector */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> ช่องทางการขาย:
            </span>
            {[
              { id: 'all', label: 'ทั้งหมด (ทุกช่องทาง)', icon: '🌐' },
              { id: 'dine_in', label: 'หน้าร้าน (Dine-in / หน้าร้าน)', icon: '🍽️' },
              { id: 'delivery', label: 'เดลิเวอรีรวม', icon: '🛵' },
              { id: 'grab', label: 'GrabFood', icon: '🟢' },
              { id: 'lineman', label: 'LINE MAN', icon: '🟢' },
              { id: 'shopeefood', label: 'ShopeeFood', icon: '🟠' },
            ].map((cItem) => (
              <button
                key={cItem.id}
                type="button"
                onClick={() => {
                  setChannelFilter(cItem.id as ChannelFilter);
                  soundService.playTap();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  channelFilter === cItem.id
                    ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs ring-2 ring-slate-800/40 dark:ring-amber-400/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cItem.icon}</span>
                <span>{cItem.label}</span>
              </button>
            ))}
          </div>

          {channelFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setChannelFilter('all')}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              รีเซ็ตเป็นทุกช่องทาง
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: '📊 ภาพรวม & งบกำไร/ขาดทุน (P&L)', badge: undefined },
          { id: 'menu_profit', label: '🍲 เมนูขายดี & วิเคราะห์ความคุ้มค่า', badge: `${menuProfitabilityList.length}` },
          { id: 'shifts', label: '🏪 จัดการกะ & ตรวจสอบเงินสด', badge: shiftIsOpen ? 'เปิดอยู่' : 'ปิดอยู่' },
          { id: 'bills', label: '🧾 ประวัติและตรวจสอบบิล', badge: `${filteredBills.length}` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id as DashboardTab);
              soundService.playTap();
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black ring-2 ring-amber-400/30'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  activeTab === tab.id
                    ? 'bg-slate-950/20 text-slate-950 font-black'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & PROFIT/LOSS STATEMENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Shift Banner Status */}
          <div className="p-4 rounded-3xl bg-slate-900 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-2xl ${
                  shiftIsOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    {shiftIsOpen ? 'กะการขายปัจจุบันกำลังดำเนินอยู่' : 'ยังไม่ได้เปิดกะทำงาน'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      shiftIsOpen ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {shiftIsOpen ? 'เปิดกะอยู่' : 'ปิดกะ'}
                  </span>
                </div>
                {shiftIsOpen && currentShift ? (
                  <p className="text-xs text-slate-300 mt-0.5 space-x-2">
                    <span>เปิดโดย: {currentShift.openedBy}</span>
                    <span>· เงินทอน: <span className="font-mono text-amber-400">{formatBaht(currentShift.startingCash)}</span></span>
                    <span>· เงินสดคาดว่ามีในลิ้นชัก: <span className="font-mono text-emerald-400 font-bold">{formatBaht(shiftExpectedCash)}</span></span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">
                    เปิดกะเพื่อเริ่มต้นบันทึกเงินทอนและกระทบยอดเงินสดสิ้นวัน
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {shiftIsOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCountedCashInput(shiftExpectedCash);
                    setShowCloseShiftModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>ปิดกะและนับเงิน</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>เปิดกะใหม่</span>
                </button>
              )}
            </div>
          </div>

          {/* 5 Key Financial Metric Cards (F&B Standard) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Net Sales */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">ยอดขายสุทธิ (Net Sales)</span>
                <span className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {formatBaht(pnl.netSales)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
                <div>บิลชำระแล้ว: <span className="font-bold text-slate-700 dark:text-slate-300">{pnl.paidBillsCount}</span> บิล</div>
                <div>เฉลี่ย/บิล: <span className="font-bold text-slate-700 dark:text-slate-300">{formatBaht(pnl.avgTicket)}</span></div>
              </div>
            </div>

            {/* 2. COGS (Food Cost) */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">ต้นทุนอาหาร (COGS)</span>
                <span className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <UtensilsCrossed className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                {formatBaht(pnl.totalCogs)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                <div className="flex items-center justify-between">
                  <span>Food Cost %:</span>
                  <span className={`font-bold font-mono ${pnl.foodCostPct <= 35 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                    {pnl.foodCostPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {pnl.foodCostPct <= 32 ? '🟢 อยู่ในเกณฑ์ดีเยี่ยม (< 32%)' : '🟡 ควรตรวจนับวัตถุดิบ'}
                </div>
              </div>
            </div>

            {/* 3. Gross Profit */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">กำไรขั้นต้น (Gross Profit)</span>
                <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatBaht(pnl.grossProfit)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                <div className="flex items-center justify-between">
                  <span>Gross Margin:</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {pnl.grossMarginPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  (ยอดขายสุทธิ - ต้นทุนอาหาร)
                </div>
              </div>
            </div>

            {/* 4. Operating Expenses (OpEx) */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">ค่าใช้จ่ายดำเนินงาน (OpEx)</span>
                <button
                  type="button"
                  onClick={() => setShowOpExModal(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-amber-500"
                  title="ปรับแต่งสัดส่วน OpEx"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-300">
                {formatBaht(pnl.totalOpEx)}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
                <div>ค่าแรง ({opExSettings.laborPct}%): {formatBaht(pnl.laborCost)}</div>
                <div>ค่าเช่า/น้ำไฟ ({opExSettings.occupancyPct}%): {formatBaht(pnl.occupancyCost)}</div>
              </div>
            </div>

            {/* 5. Net Profit (True Profit/Loss) */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border-2 border-emerald-500/40 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white">กำไรสุทธิ (Net Profit)</span>
                <span className="p-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>
              <div className={`text-2xl font-black font-mono ${pnl.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                {formatBaht(pnl.netProfit)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                <div className="flex items-center justify-between">
                  <span>Net Margin:</span>
                  <span className={`font-bold font-mono ${pnl.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {pnl.netMarginPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  กำไรแท้จริงหลังหักต้นทุนทุกหมวด
                </div>
              </div>
            </div>
          </div>

          {/* Online Delivery vs Dine-in Analytics Section */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Bike className="w-4 h-4" />
                  </span>
                  <span>วิเคราะห์ยอดขายและกำไรเดลิเวอรีออนไลน์ (Grab / LINE MAN Delivery Analysis)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  คำนวณกำไรแท้จริงหลังจากหัก ค่า GP แพลตฟอร์ม (~30%), ค่ากล่องบรรจุภัณฑ์ และต้นทุนวัตถุดิบ (COGS)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  สัดส่วนออเดอร์เดลิเวอรี: <strong className="text-slate-900 dark:text-white">{pnl.paidBillsCount > 0 ? ((pnl.deliveryOrdersCount / pnl.paidBillsCount) * 100).toFixed(0) : 0}%</strong> ({pnl.deliveryOrdersCount} / {pnl.paidBillsCount} บิล)
                </span>
              </div>
            </div>

            {/* 4 Delivery Quick KPI Badges */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  🛵 ยอดขายบนแอปเดลิเวอรีรวม
                </span>
                <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                  {formatBaht(pnl.deliveryGrossSales)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {pnl.deliveryOrdersCount} ออเดอร์
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block mb-1">
                  🏷️ ค่าคอมมิชชั่น GP ที่ถูกหัก
                </span>
                <span className="font-mono font-black text-base text-rose-600 dark:text-rose-400">
                  -{formatBaht(pnl.totalGpFee)}
                </span>
                <span className="text-[10px] text-rose-500/80 block mt-0.5">
                  Grab & LINE MAN GP (~30%)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  📦 ค่ากล่อง & บรรจุภัณฑ์เดลิเวอรี
                </span>
                <span className="font-mono font-black text-base text-amber-600 dark:text-amber-400">
                  -{formatBaht(pnl.totalPackagingCost)}
                </span>
                <span className="text-[10px] text-amber-500/80 block mt-0.5">
                  กล่อง, ถุงหิ้ว, ช้อนส้อม
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block mb-1">
                  💵 ยอดเงินโอนเข้าบัญชีจริงสุทธิ
                </span>
                <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                  {formatBaht(pnl.netRealizedRevenue)}
                </span>
                <span className="text-[10px] text-emerald-600/80 block mt-0.5">
                  (ยอดขาย - ส่วนลด - GP - ค่ากล่อง)
                </span>
              </div>
            </div>

            {/* Side-by-Side Channel Comparison Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 text-left">
                    <th className="py-2.5 font-semibold">ช่องทางการขาย (Channel)</th>
                    <th className="py-2.5 font-semibold text-center">บิล</th>
                    <th className="py-2.5 font-semibold text-right">ยอดขายรวมบนแอป</th>
                    <th className="py-2.5 font-semibold text-right">GP หัก (~30%)</th>
                    <th className="py-2.5 font-semibold text-right">ค่ากล่อง</th>
                    <th className="py-2.5 font-semibold text-right">ต้นทุนอาหาร (COGS)</th>
                    <th className="py-2.5 font-semibold text-right">เงินโอนเข้าบัญชี</th>
                    <th className="py-2.5 font-semibold text-right">กำไรจริง (Profit)</th>
                    <th className="py-2.5 font-semibold text-right">% Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {channelComparison.map((ch) => (
                    <tr
                      key={ch.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                        channelFilter === ch.id ? 'bg-amber-50/40 dark:bg-amber-950/20 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5 flex items-center gap-2">
                        <span>{ch.icon}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ch.label}</span>
                      </td>
                      <td className="py-2.5 text-center font-mono">{ch.count}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatBaht(ch.gross)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                        {ch.gpFee > 0 ? `-${formatBaht(ch.gpFee)}` : '-'}
                      </td>
                      <td className="py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                        {ch.packaging > 0 ? `-${formatBaht(ch.packaging)}` : '-'}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-500">
                        {formatBaht(ch.cogs)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatBaht(ch.netPayout)}
                      </td>
                      <td className={`py-2.5 text-right font-mono font-black ${ch.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {formatBaht(ch.profit)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-black">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] ${
                            ch.marginPct >= 50
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : ch.marginPct >= 25
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {ch.marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Strategic Insight & Pricing Recommendation */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-300">
                  สูตรคำนวณและข้อแนะนำในการบริหารกำไรเดลิเวอรี (F&B Delivery Profit Strategy):
                </span>
                <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                  • <strong>สูตรเงินโอนเข้าบัญชีสุทธิ:</strong> ยอดขายบนแอป - ส่วนลดโปรโมชั่น - ค่าคอมมิชชั่น GP (Grab/LINE MAN 30-32.1%)
                  <br />
                  • <strong>สูตรกำไรสุทธิเดลิเวอรีแท้จริง:</strong> ยอดเงินโอนเข้าบัญชี - ค่ากล่อง/ช้อนส้อม - ต้นทุนวัตถุดิบ (COGS)
                  <br />
                  • <strong>ข้อแนะนำการตั้งราคา:</strong> สังเกตว่าออเดอร์หน้าร้านให้ Profit Margin สูงกว่า (~60-70%) เมื่อเทียบกับ Grab/LINE MAN (~30-35%) ดังนั้น เพื่อรักษากำไรสุทธิ แนะนำตั้งราคาอาหารบนแอปให้สูงกว่าหน้าร้าน 25% - 30% หรือจัดเป็นชุดเซ็ตคู่เครื่องดื่มเพื่อเพิ่มยอดเฉลี่ยต่อบิล
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row: Trend Chart + Payment Methods Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales vs Gross Profit Trend Chart */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    แนวโน้มยอดขายสุทธิ & กำไรขั้นต้น
                  </h3>
                  <p className="text-xs text-slate-400">
                    เปรียบเทียบยอดขาย (สีเหลือง) และกำไรขั้นต้น (สีเขียว)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">ยอดขาย</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                    <span className="text-slate-600 dark:text-slate-300 font-medium">กำไรขั้นต้น</span>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `฿${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                    <Tooltip
                      formatter={(val: any) => [formatBaht(Number(val)), '']}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                    />
                    <Bar dataKey="sales" fill="#f59e0b" radius={[6, 6, 0, 0]} name="ยอดขาย" />
                    <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} name="กำไรขั้นต้น" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                สัดส่วนช่องทางชำระเงิน
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                แยกตามวิธีชำระเงินที่ลูกค้าเลือก
              </p>

              {paymentChartData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-slate-400">
                  <PieIcon className="w-8 h-8 opacity-40 mb-2" />
                  <span className="text-xs">ยังไม่มีข้อมูลการชำระเงิน</span>
                </div>
              ) : (
                <>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {paymentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [formatBaht(Number(val)), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {paymentChartData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatBaht(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Professional F&B Income Statement (งบกำไรขาดทุนมาตรฐานร้านอาหารสากล) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>งบกำไรขาดทุนจากการดำเนินงาน (F&B P&L Statement)</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                    มาตรฐานสากล
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  แจกแจงรายได้ หักส่วนลด หักต้นทุนวัตถุดิบ (COGS) และหักค่าใช้จ่ายดำเนินงาน (OpEx)
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400">Prime Cost (COGS + ค่าแรง): </span>
                <span className={`text-xs font-mono font-black ${pnl.primeCostPct <= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pnl.primeCostPct.toFixed(1)}% (เป้าหมาย &lt; 60%)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 text-left">
                    <th className="py-2.5 font-semibold">รายการทางบัญชี (Accounting Item)</th>
                    <th className="py-2.5 font-semibold text-right">จำนวนเงิน (บาท)</th>
                    <th className="py-2.5 font-semibold text-right">% ต่อรายได้สุทธิ</th>
                    <th className="py-2.5 font-semibold pl-4">เกณฑ์มาตรฐานสากลร้านอาหาร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {/* Revenue */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      1. ยอดขายอาหารและเครื่องดื่มรวม (Gross Food & Beverage Sales)
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatBaht(pnl.grossFoodSales)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-500">
                      {pnl.netSales > 0 ? ((pnl.grossFoodSales / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">ยอดสั่งซื้อรวมก่อนหักส่วนลด</td>
                  </tr>

                  {/* Discounts */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-rose-600 dark:text-rose-400">
                    <td className="py-2.5 pl-4 flex items-center gap-1.5">
                      <span>หัก: ส่วนลดโปรโมชั่นและแต้มสมาชิก (Discounts & Promo)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      -{formatBaht(pnl.totalDiscount)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.totalDiscount / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">ไม่ควรเกิน 3-5% ของยอดขาย</td>
                  </tr>

                  {/* Net Food Sales before GP */}
                  <tr className="bg-amber-500/10 font-bold text-slate-900 dark:text-white">
                    <td className="py-2.5 pl-2 font-black text-amber-700 dark:text-amber-400">
                      = ยอดขายอาหารสุทธิก่อนหัก GP (Gross Net Sales)
                    </td>
                    <td className="py-2.5 text-right font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                      {formatBaht(pnl.netSales)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-black text-amber-700 dark:text-amber-400">
                      100.0%
                    </td>
                    <td className="py-2.5 pl-4 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                      ยอดขายจริงบนระบบก่อนหักค่าคอมมิชชั่นแอป
                    </td>
                  </tr>

                  {/* Delivery Platform GP Fees */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-rose-600 dark:text-rose-400">
                    <td className="py-2.5 pl-4 flex items-center gap-1.5">
                      <span>หัก: ค่าคอมมิชชั่น GP แพลตฟอร์มเดลิเวอรี (Grab / LINE MAN GP ~30%)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      -{formatBaht(pnl.totalGpFee)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.totalGpFee / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">
                      {pnl.deliveryOrdersCount > 0 ? `หักจากออเดอร์เดลิเวอรี ${pnl.deliveryOrdersCount} บิล` : 'ไม่มีออเดอร์เดลิเวอรี'}
                    </td>
                  </tr>

                  {/* Packaging Costs */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-amber-600 dark:text-amber-400">
                    <td className="py-2.5 pl-4 flex items-center gap-1.5">
                      <span>หัก: ค่ากล่องและบรรจุภัณฑ์เดลิเวอรี (Packaging & Cutlery)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      -{formatBaht(pnl.totalPackagingCost)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.totalPackagingCost / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">ต้นทุนกล่อง ถุง ช้อนส้อม ซอสซอง</td>
                  </tr>

                  {/* Realized Cash Payout */}
                  <tr className="bg-blue-50 dark:bg-blue-950/30 font-bold text-blue-900 dark:text-blue-200">
                    <td className="py-2.5 pl-2 font-black text-blue-700 dark:text-blue-300">
                      = ยอดเงินรายได้สุทธิที่ได้รับจริง (Net Realized Sales / Cash Payout)
                    </td>
                    <td className="py-2.5 text-right font-mono font-black text-blue-700 dark:text-blue-300 text-sm">
                      {formatBaht(pnl.netRealizedRevenue)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-black text-blue-700 dark:text-blue-300">
                      {pnl.netSales > 0 ? ((pnl.netRealizedRevenue / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2.5 pl-4 text-blue-800 dark:text-blue-300 text-[11px] font-semibold">
                      เงินที่โอนเข้าบัญชีและลิ้นชักจริง
                    </td>
                  </tr>

                  {/* COGS */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-rose-600 dark:text-rose-400">
                    <td className="py-2.5 pl-4">
                      2. หัก: ต้นทุนวัตถุดิบอาหารและเครื่องดื่ม (Cost of Goods Sold - COGS)
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      -{formatBaht(pnl.totalCogs)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      {pnl.foodCostPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">
                      {pnl.foodCostPct <= 35 ? '✅ อยู่ในเกณฑ์มาตรฐาน (28% - 35%)' : '⚠️ สูงกว่าเกณฑ์สากล (> 35%)'}
                    </td>
                  </tr>

                  {/* Gross Profit */}
                  <tr className="bg-emerald-50 dark:bg-emerald-950/30 font-bold text-emerald-700 dark:text-emerald-300">
                    <td className="py-2.5 pl-2 font-black">
                      = กำไรขั้นต้นที่แท้จริง (True Gross Profit)
                    </td>
                    <td className="py-2.5 text-right font-mono font-black text-sm">
                      {formatBaht(pnl.grossProfit)}
                    </td>
                    <td className="py-2.5 text-right font-mono font-black">
                      {pnl.grossMarginPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-4 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                      กำไรแท้จริงหลังหัก GP และต้นทุนวัตถุดิบ
                    </td>
                  </tr>

                  {/* Labor */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                    <td className="py-2.5 pl-4">
                      3. หัก: ค่าแรงและเงินเดือนพนักงาน (Labor Cost - ประมาณการ {opExSettings.laborPct}%)
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      -{formatBaht(pnl.laborCost)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {opExSettings.laborPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">มาตรฐานสากล 18% - 25%</td>
                  </tr>

                  {/* Occupancy & Utilities */}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                    <td className="py-2.5 pl-4">
                      4. หัก: ค่าเช่า ค่าน้ำ ค่าไฟ และแก๊ส (Occupancy & Utilities - ประมาณการ {opExSettings.occupancyPct}%)
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      -{formatBaht(pnl.occupancyCost)}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {opExSettings.occupancyPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 pl-4 text-slate-400 text-[11px]">มาตรฐานสากล 8% - 12%</td>
                  </tr>

                  {/* Custom Fixed Costs */}
                  {opExSettings.customFixedExpense > 0 && (
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                      <td className="py-2.5 pl-4">
                        5. หัก: ค่าใช้จ่ายคงที่อื่นๆ ที่ระบุเพิ่มเติม
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        -{formatBaht(opExSettings.customFixedExpense)}
                      </td>
                      <td className="py-2.5 text-right font-mono">
                        {pnl.netSales > 0 ? ((opExSettings.customFixedExpense / pnl.netSales) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="py-2.5 pl-4 text-slate-400 text-[11px]">ค่าใช้จ่ายอื่นๆ ประจำรอบ</td>
                    </tr>
                  )}

                  {/* Net Operating Profit */}
                  <tr className="bg-slate-900 text-white font-bold text-sm">
                    <td className="py-3 pl-3 font-black text-amber-400">
                      🏆 กำไรจากการดำเนินงานสุทธิที่แท้จริง (Net Operating Profit / EBITDA)
                    </td>
                    <td className="py-3 text-right font-mono font-black text-amber-400 text-base">
                      {formatBaht(pnl.netProfit)}
                    </td>
                    <td className="py-3 text-right font-mono font-black text-amber-400">
                      {pnl.netMarginPct.toFixed(1)}%
                    </td>
                    <td className="py-3 pl-4 text-emerald-400 text-xs font-semibold">
                      {pnl.netMarginPct >= 15 ? '🚀 ธุรกิจมีอัตรากำไรแข็งแกร่ง (> 15%)' : 'กำไรสุทธิหลังหักทุกค่าใช้จ่าย'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tax Note */}
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <HelpCircle className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <span className="font-bold">หมายเหตุสำคัญทางบัญชีภาษี: </span>
                ภาษีมูลค่าเพิ่ม (VAT 7%) จำนวน <span className="font-mono font-bold text-blue-600 dark:text-blue-300">{formatBaht(pnl.totalVat)}</span> และ ค่าบริการ (Service Charge) จำนวน <span className="font-mono font-bold text-blue-600 dark:text-blue-300">{formatBaht(pnl.totalServiceCharge)}</span> ไม่ถูกนับรวมเป็นกำไรของร้าน เนื่องจากเป็นภาระภาษีที่เรียกเก็บเพื่อนำส่งกรมสรรพากร และเงินกองกลางบริการของพนักงานตามมาตรฐานสากล
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MENU PROFITABILITY & MENU ENGINEERING */}
      {activeTab === 'menu_profit' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>ตารางวิเคราะห์ความคุ้มค่าและกำไรต่อเมนู (Menu Engineering Matrix)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                  {menuProfitabilityList.length} เมนู
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                จัดอันดับเมนูตาม "กำไรสะสมรวม" ที่นำเงินเข้ากระเป๋าร้านมากที่สุด (ราคาขาย - ต้นทุน x จำนวนจานที่ขาย)
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-bold">⭐ Stars (กำไรสูง+ขายดี)</span>
              <span className="px-2.5 py-1 rounded-xl bg-blue-100 text-blue-900 font-bold">🐎 Plowhorse (ขายดี)</span>
              <span className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 font-bold">🧩 Puzzle (กำไรสูง)</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-x-auto">
            {menuProfitabilityList.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <UtensilsCrossed className="w-10 h-10 opacity-30 mx-auto mb-2" />
                <p className="text-sm font-semibold">ยังไม่มีรายการอาหารที่ชำระเงินในรอบเวลานี้</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 font-semibold">
                    <th className="py-2.5 pl-2">อันดับ</th>
                    <th className="py-2.5">ชื่อเมนูอาหาร</th>
                    <th className="py-2.5 text-center">จำนวนที่ขาย</th>
                    <th className="py-2.5 text-right">ราคาขาย/จาน</th>
                    <th className="py-2.5 text-right">ต้นทุน/จาน</th>
                    <th className="py-2.5 text-right">กำไรต่อจาน</th>
                    <th className="py-2.5 text-right">% Margin</th>
                    <th className="py-2.5 text-right font-bold text-emerald-600">กำไรรวมที่ทำได้</th>
                    <th className="py-2.5 text-center">กลุ่มเมนู</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {menuProfitabilityList.map((item, index) => {
                    const unitMargin = item.unitPrice - item.unitCost;
                    const marginPct = item.unitPrice > 0 ? (unitMargin / item.unitPrice) * 100 : 0;
                    const isHighVolume = item.qty >= 5;
                    const isHighMargin = marginPct >= 60;

                    let tag = '🐕 Dog';
                    let tagClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                    if (isHighVolume && isHighMargin) {
                      tag = '⭐ Star';
                      tagClass = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200';
                    } else if (isHighVolume && !isHighMargin) {
                      tag = '🐎 Plowhorse';
                      tagClass = 'bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200';
                    } else if (!isHighVolume && isHighMargin) {
                      tag = '🧩 Puzzle';
                      tagClass = 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200';
                    }

                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 pl-2 font-bold font-mono text-slate-400">
                          #{index + 1}
                        </td>
                        <td className="py-3 font-bold text-slate-900 dark:text-white">
                          <div>{item.name}</div>
                          {item.nameEn && <div className="text-[10px] text-slate-400 font-normal">{item.nameEn}</div>}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {formatNumber(item.qty)} จาน
                        </td>
                        <td className="py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatBaht(item.unitPrice)}
                        </td>
                        <td className="py-3 text-right font-mono text-rose-500">
                          {formatBaht(item.unitCost)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatBaht(unitMargin)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {marginPct.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatBaht(item.profit)}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${tagClass}`}>
                            {tag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SHIFT & CASH AUDIT */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          {/* Shift Detail Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${shiftIsOpen ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-rose-500 text-white font-black'}`}>
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    สถานะกะการทำงานปัจจุบัน (Active Shift)
                  </h3>
                  <p className="text-xs text-slate-400">
                    ตรวจสอบเงินสดในลิ้นชัก กระทบยอดเงินทอน และปิดกะเพื่อพิมพ์รายงาน
                  </p>
                </div>
              </div>

              <div>
                {shiftIsOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCountedCashInput(shiftExpectedCash);
                      setShowCloseShiftModal(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>ปิดกะและกระทบยอดเงินสด</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowOpenShiftModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>เปิดกะการขายใหม่</span>
                  </button>
                )}
              </div>
            </div>

            {shiftIsOpen && currentShift ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">เงินทอนตั้งต้น (Starting Float)</div>
                  <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    {formatBaht(currentShift.startingCash)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">ผู้เปิดกะ: {currentShift.openedBy}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">เงินสดที่รับเพิ่มจากออเดอร์</div>
                  <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    +{formatBaht(shiftCashReceived)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">จากการชำระด้วยเงินสดในกะนี้</div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30">
                  <div className="text-xs text-amber-800 dark:text-amber-300 font-bold mb-1">
                    เงินสดที่ควรมีในลิ้นชัก (Expected Cash)
                  </div>
                  <div className="text-xl font-black font-mono text-amber-800 dark:text-amber-300">
                    {formatBaht(shiftExpectedCash)}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    (เงินทอนตั้งต้น + เงินสดรับจริง)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">เวลาที่เปิดกะ</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {formatThaiDateTime(currentShift.openedAt)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {currentShift.note ? `หมายเหตุ: ${currentShift.note}` : 'ไม่มีหมายเหตุ'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <Store className="w-12 h-12 opacity-30 mx-auto mb-3" />
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  ยังไม่มีกะการขายที่เปิดอยู่
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  กดปุ่ม "เปิดกะการขายใหม่" เพื่อระบุเงินทอนในลิ้นชักและเริ่มต้นบันทึกข้อมูลกะประจำวัน
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BILLS AUDIT & HISTORY */}
      {activeTab === 'bills' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                ประวัติบิลและรายการตรวจสอบ ({filteredBills.length} บิล)
              </h3>
              <p className="text-xs text-slate-400">
                ค้นหา ดูรายละเอียดบิล พิมพ์ใบเสร็จซ้ำ และตรวจสอบสถานะบิลในรอบเวลานี้
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขบิล หรือ โต๊ะ..."
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                {(['all', 'paid', 'open', 'voided'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setBillStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      billStatusFilter === st
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    {st === 'all' ? 'ทั้งหมด' : st === 'paid' ? 'ชำระแล้ว' : st === 'open' ? 'ค้างชำระ' : 'ยกเลิก'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-x-auto">
            {filteredBills.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Receipt className="w-10 h-10 opacity-30 mx-auto mb-2" />
                <p className="text-sm font-semibold">ไม่มีรายการบิลในรอบเวลานี้</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 font-semibold">
                    <th className="py-2.5 pl-2">เลขที่บิล</th>
                    <th className="py-2.5">โต๊ะ / ประเภท</th>
                    <th className="py-2.5">เวลาที่เปิด</th>
                    <th className="py-2.5 text-center">จำนวนรายการ</th>
                    <th className="py-2.5 text-right">ยอดรวมสุทธิ</th>
                    <th className="py-2.5 text-center">วิธีชำระ</th>
                    <th className="py-2.5 text-center">สถานะ</th>
                    <th className="py-2.5 text-right pr-2">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredBills
                    .filter((b) => {
                      if (billStatusFilter !== 'all' && b.status !== billStatusFilter) return false;
                      if (!billSearchQuery.trim()) return true;
                      const q = billSearchQuery.toLowerCase();
                      return (
                        b.billNumber.toLowerCase().includes(q) ||
                        (b.tableName && b.tableName.toLowerCase().includes(q))
                      );
                    })
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 pl-2 font-mono font-bold text-slate-900 dark:text-white">
                          {b.billNumber}
                        </td>
                        <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                          {b.tableName ? (
                            <span>โต๊ะ {b.tableName}</span>
                          ) : b.orderType === 'takeaway' ? (
                            <span>🛍️ กลับบ้าน</span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                🛵 {b.deliveryPlatform === 'grab' ? 'GrabFood' : b.deliveryPlatform === 'lineman' ? 'LINE MAN' : b.deliveryPlatform === 'shopeefood' ? 'Shopee' : 'เดลิเวอรี'}
                              </span>
                              {Boolean(b.deliveryGpAmount) && (
                                <span className="text-[10px] text-rose-500 font-mono">
                                  -GP {formatBaht(b.deliveryGpAmount || 0)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-slate-500 font-mono">
                          {formatThaiDateTime(b.createdAt)}
                        </td>
                        <td className="py-3 text-center font-mono">
                          {b.items.filter((i) => i.status !== 'voided').length} รายการ
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatBaht(b.grandTotal)}
                        </td>
                        <td className="py-3 text-center">
                          {b.payments.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                              {b.payments.map((p) => p.method).join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'paid'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : b.status === 'open'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {b.status === 'paid' ? 'ชำระแล้ว' : b.status === 'open' ? 'รอชำระ' : 'ยกเลิก'}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2">
                          <button
                            type="button"
                            onClick={() => setInspectingBill(b)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>ดูใบเสร็จ</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL: OpEx Settings (สำหรับคำนวณกำไรสุทธิแท้จริง) */}
      {showOpExModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowOpExModal(false)}
          title="ตั้งค่าสัดส่วนต้นทุนค่าใช้จ่ายดำเนินงาน (OpEx Setting)"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              ตามหลักมาตรฐานสากลของร้านอาหารมืออาชีพ การคำนวณกำไรสุทธิ (Net Operating Profit) ต้องหักต้นทุนค่าแรงและค่าเช่าสถานที่ออกจากกำไรขั้นต้น:
            </p>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  สัดส่วนค่าแรงพนักงาน (% Labor Cost)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tempOpEx.laborPct}
                    onChange={(e) => setTempOpEx({ ...tempOpEx, laborPct: Number(e.target.value) })}
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-sm"
                  />
                  <span className="text-slate-500 font-bold">% ของยอดขายสุทธิ (มาตรฐานอยู่ที่ 18% - 25%)</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  สัดส่วนค่าเช่า ค่าน้ำ ค่าไฟ และแก๊ส (% Occupancy Cost)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tempOpEx.occupancyPct}
                    onChange={(e) => setTempOpEx({ ...tempOpEx, occupancyPct: Number(e.target.value) })}
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-sm"
                  />
                  <span className="text-slate-500 font-bold">% ของยอดขายสุทธิ (มาตรฐานอยู่ที่ 8% - 12%)</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  ค่าใช้จ่ายคงที่อื่นๆ ที่ต้องการหักเพิ่ม (บาท)
                </label>
                <input
                  type="number"
                  min={0}
                  value={tempOpEx.customFixedExpense}
                  onChange={(e) => setTempOpEx({ ...tempOpEx, customFixedExpense: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-sm"
                  placeholder="0"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold text-amber-600 dark:text-amber-400 block mb-2">
                  🛵 ต้นทุนแพลตฟอร์มเดลิเวอรี (Online Delivery Settings)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      GrabFood GP (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tempOpEx.defaultGrabGpRate}
                      onChange={(e) => setTempOpEx({ ...tempOpEx, defaultGrabGpRate: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      LINE MAN GP (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tempOpEx.defaultLinemanGpRate}
                      onChange={(e) => setTempOpEx({ ...tempOpEx, defaultLinemanGpRate: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ต้นทุนกล่อง & บรรจุภัณฑ์เฉลี่ยต่อออเดอร์เดลิเวอรี (บาท)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={tempOpEx.defaultPackagingCost}
                      onChange={(e) => setTempOpEx({ ...tempOpEx, defaultPackagingCost: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOpExModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveOpEx}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs cursor-pointer"
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Open Shift */}
      {showOpenShiftModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowOpenShiftModal(false)}
          title="เปิดกะการขายใหม่ (Open Shift)"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmOpenShift} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                จำนวนเงินทอนเริ่มต้นในลิ้นชัก (บาท) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={startingCashInput}
                onChange={(e) => setStartingCashInput(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-base font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                บันทึกข้อความ / หมายเหตุ (ไม่บังคับ)
              </label>
              <input
                type="text"
                placeholder="เช่น กะเช้า 09:00 - 15:00 น."
                value={openShiftNote}
                onChange={(e) => setOpenShiftNote(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-xs cursor-pointer"
              >
                ยืนยันเปิดกะ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Close Shift */}
      {showCloseShiftModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCloseShiftModal(false)}
          title="ปิดกะและกระทบยอดเงินสด (Close Shift)"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleConfirmCloseShift} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">เงินทอนตั้งต้น:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatBaht(currentShift?.startingCash || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">เงินสดรับเพิ่มจากการขาย:</span>
                <span className="font-mono font-bold text-emerald-600">
                  +{formatBaht(shiftCashReceived)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                <span className="text-slate-900 dark:text-white">เงินสดที่ควรมีในลิ้นชัก:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {formatBaht(shiftExpectedCash)}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                จำนวนเงินสดที่นับได้จริง (บาท) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-base font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Difference indicator */}
            {(() => {
              const diff = countedCashInput - shiftExpectedCash;
              return (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    diff === 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : diff > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  <span>ผลต่างเงินสด (Difference):</span>
                  <span className="font-mono">
                    {diff === 0
                      ? 'พอดีเป๊ะ (0.00)'
                      : diff > 0
                      ? `เงินเกิน +${formatBaht(diff)}`
                      : `เงินขาด -${formatBaht(Math.abs(diff))}`}
                  </span>
                </div>
              );
            })()}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                บันทึกข้อความ / หมายเหตุการปิดกะ
              </label>
              <input
                type="text"
                placeholder="เช่น เงินสดถูกต้อง ยอดตรง"
                value={closeShiftNote}
                onChange={(e) => setCloseShiftNote(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer"
              >
                ยืนยันปิดกะ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Inspect Bill & Print Receipt */}
      {inspectingBill && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingBill(null)}
          title={`รายละเอียดบิล: ${inspectingBill.billNumber}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <ReceiptPrint bill={inspectingBill} settings={settings} />
            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setInspectingBill(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
