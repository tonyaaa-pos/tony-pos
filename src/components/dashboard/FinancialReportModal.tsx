import React, { useRef, useState, useEffect } from 'react';
import { Bill, ShopSettings, User, Shift } from '../../types';
import { TimeFilterPeriod } from './DashboardView';
import { formatBaht, formatThaiDateTime } from '../../utils/formatters';
import {
  Printer,
  Download,
  X,
  FileText,
  TrendingUp,
  Store,
  DollarSign,
  Scale,
  Award,
  ShieldCheck,
  Bike,
  Building,
} from 'lucide-react';

interface BreakEvenMetrics {
  periodFixedCost: number;
  monthlyFixedCost: number;
  cmRatio: number;
  breakEvenSales: number;
  breakEvenBills: number;
  actualRevenue: number;
  progressPct: number;
  isBreakevenAchieved: boolean;
  surplusOrDeficit: number;
  marginOfSafetyPct: number;
  avgTicket: number;
  rentCost: number;
  salariesCost: number;
  utilitiesCost: number;
}

interface FinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: TimeFilterPeriod;
  selectedDate: string;
  customStartDate?: string;
  customEndDate?: string;
  pnl: {
    grossFoodSales: number;
    totalDiscount: number;
    totalGpFee: number;
    totalPackagingCost: number;
    netSales: number;
    netRealizedRevenue: number;
    totalCogs: number;
    foodCostPct: number;
    grossProfit: number;
    grossMarginPct: number;
    laborCost: number;
    occupancyCost: number;
    fixedCost: number;
    totalOpEx: number;
    primeCost: number;
    primeCostPct: number;
    netProfit: number;
    netMarginPct: number;
    totalVat: number;
    totalServiceCharge: number;
    totalGuests: number;
    paidBillsCount: number;
    deliveryOrdersCount: number;
    dineInOrdersCount: number;
    deliveryGrossSales: number;
    dineInGrossSales: number;
    avgTicket: number;
    avgPerGuest: number;
  };
  channelComparison: {
    id: string;
    label: string;
    icon: string;
    count: number;
    gross: number;
    gpFee: number;
    packaging: number;
    cogs: number;
    netPayout: number;
    profit: number;
    marginPct: number;
  }[];
  breakEvenData: BreakEvenMetrics;
  currentShift: Shift | null;
  paidBills: Bill[];
  topProfitableDishes: {
    name: string;
    qty: number;
    revenue: number;
    cogs: number;
    profit: number;
    marginPct: number;
  }[];
  settings: ShopSettings;
  currentUser: User | null;
}

export const FinancialReportModal: React.FC<FinancialReportModalProps> = ({
  isOpen,
  onClose,
  period,
  selectedDate,
  customStartDate,
  customEndDate,
  pnl,
  channelComparison,
  breakEvenData,
  currentShift,
  paidBills,
  topProfitableDishes,
  settings,
  currentUser,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [printBlobUrl, setPrintBlobUrl] = useState<string>('');

  if (!isOpen) return null;

  // Period label for report header
  const getPeriodLabel = () => {
    if (period === 'today') {
      return `ประจำวันที่ ${new Date(selectedDate).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`;
    }
    if (period === 'week') {
      return `ประจำสัปดาห์ (7 วันล่าสุด ถึง ${new Date(selectedDate).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })})`;
    }
    if (period === 'month') {
      return `ประจำเดือน ${new Date(selectedDate).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
      })}`;
    }
    if (period === 'year') {
      return `ประจำปี พ.ศ. ${new Date(selectedDate).getFullYear() + 543}`;
    }
    return `ช่วงวันที่ ${customStartDate} ถึง ${customEndDate}`;
  };

  const reportTypeTitle =
    period === 'today'
      ? 'รายงานงบกำไรขาดทุนและสรุปกะประจำวัน (Daily P&L & Shift Report)'
      : period === 'month'
      ? 'รายงานงบกำไรขาดทุนและการวิเคราะห์จุดคุ้มทุนประจำเดือน (Monthly P&L & Break-Even Statement)'
      : period === 'year'
      ? 'รายงานงบการเงินประจำปี (Annual Financial Statement & P&L)'
      : 'รายงานสรุปผลประกอบการและจุดคุ้มทุน (Financial & Break-Even Statement)';

  // Build fully standalone, un-sandboxed HTML document for printing
  const buildPrintableHtml = (contentHtml: string) => {
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${settings.shopName} - ${reportTypeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      padding: 24px;
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0 !important; background: #ffffff !important; }
    }
    .no-print-bar {
      background: #0f172a;
      color: #ffffff;
      padding: 14px 24px;
      margin: -24px -24px 24px -24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #f59e0b;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    }
    .print-btn {
      background: #f59e0b;
      color: #020617;
      border: none;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 900;
      border-radius: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(245,158,11,0.4);
    }
    .print-btn:hover { background: #d97706; }
    .close-btn {
      background: #334155;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
    }
    .close-btn:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="no-print no-print-bar">
    <div>
      <div style="font-weight: 900; font-size: 16px;">🖨️ หน้าต่างสั่งพิมพ์รายงานงบการเงิน (${settings.shopName})</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
        ระบบกำลังส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์ (Printer) ที่ต่ออยู่กับเครื่องคอมพิวเตอร์ของคุณอัตโนมัติ
      </div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button class="print-btn" onclick="window.focus(); window.print();">
        🖨️ สั่งพิมพ์เอกสารออกเครื่องปริ้น (Print Now)
      </button>
      <button class="close-btn" onclick="window.close();">
        ✕ ปิดหน้าต่างนี้
      </button>
    </div>
  </div>

  <div class="report-content max-w-4xl mx-auto">
    ${contentHtml}
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;
  };

  // Pre-generate blob URL whenever modal is opened
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const content = printAreaRef.current?.innerHTML || '';
      if (!content) return;
      const html = buildPrintableHtml(content);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setPrintBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, pnl, breakEvenData, channelComparison, period, selectedDate, settings]);

  // Direct print function that opens un-sandboxed tab and auto-launches system printer dialog
  const handlePrint = () => {
    // 1. Try opening the prepared blob URL in a new un-sandboxed window/tab
    if (printBlobUrl) {
      const win = window.open(printBlobUrl, '_blank');
      if (win) {
        win.focus();
        return;
      }
    }

    // 2. On-the-fly generation if clicked before timer finished
    const content = printAreaRef.current?.innerHTML || '';
    if (content) {
      const html = buildPrintableHtml(content);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setPrintBlobUrl(url);
      const win = window.open(url, '_blank');
      if (win) {
        win.focus();
        return;
      }
    }

    // 3. Fallback: native window.print() if outside sandbox
    try {
      window.focus();
      window.print();
    } catch (err) {
      console.warn('Native window.print() suppressed by sandbox', err);
    }
  };

  // Export to CSV function (with Thai UTF-8 BOM)
  const handleExportCSV = () => {
    const rows: string[][] = [
      [`${settings.shopName} - ${reportTypeTitle}`],
      [`รอบระยะเวลา: ${getPeriodLabel()}`],
      [`พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}`],
      [`ผู้จัดทำ: ${currentUser?.name || 'ผู้จัดการร้าน'}`],
      [''],
      ['--- สรุปตัวชี้วัดหลักทางการเงิน (Key Financial Metrics) ---'],
      ['หัวข้อ', 'จำนวนเงิน (บาท)', '% ต่อรายได้', 'เกณฑ์สากล'],
      ['ยอดขายอาหารและเครื่องดื่มรวม (Gross Food Sales)', pnl.grossFoodSales.toFixed(2), '', ''],
      ['หัก: ส่วนลดและโปรโมชั่น (Discounts)', `-${pnl.totalDiscount.toFixed(2)}`, `${pnl.netSales > 0 ? ((pnl.totalDiscount / pnl.netSales) * 100).toFixed(1) : 0}%`, 'ไม่ควรเกิน 3-5%'],
      ['ยอดขายอาหารสุทธิก่อนหัก GP (Gross Net Sales)', pnl.netSales.toFixed(2), '100.0%', ''],
      ['หัก: ค่าคอมมิชชั่น GP แพลตฟอร์มเดลิเวอรี (Grab/LINE MAN)', `-${pnl.totalGpFee.toFixed(2)}`, `${pnl.netSales > 0 ? ((pnl.totalGpFee / pnl.netSales) * 100).toFixed(1) : 0}%`, ''],
      ['หัก: ค่ากล่องและบรรจุภัณฑ์เดลิเวอรี (Packaging)', `-${pnl.totalPackagingCost.toFixed(2)}`, `${pnl.netSales > 0 ? ((pnl.totalPackagingCost / pnl.netSales) * 100).toFixed(1) : 0}%`, ''],
      ['ยอดเงินโอนเข้าบัญชีและรับจริงสุทธิ (Net Realized Sales)', pnl.netRealizedRevenue.toFixed(2), `${pnl.netSales > 0 ? ((pnl.netRealizedRevenue / pnl.netSales) * 100).toFixed(1) : 0}%`, ''],
      ['หัก: ต้นทุนวัตถุดิบอาหาร (COGS)', `-${pnl.totalCogs.toFixed(2)}`, `${pnl.foodCostPct.toFixed(1)}%`, '28% - 35%'],
      ['กำไรขั้นต้นที่แท้จริง (True Gross Profit)', pnl.grossProfit.toFixed(2), `${pnl.grossMarginPct.toFixed(1)}%`, '65% - 72%'],
      ['หัก: ค่าแรงพนักงาน (Labor Cost)', `-${pnl.laborCost.toFixed(2)}`, `${pnl.netSales > 0 ? ((pnl.laborCost / pnl.netSales) * 100).toFixed(1) : 0}%`, '18% - 25%'],
      ['หัก: ค่าเช่าและสาธารณูปโภค (Occupancy Cost)', `-${pnl.occupancyCost.toFixed(2)}`, `${pnl.netSales > 0 ? ((pnl.occupancyCost / pnl.netSales) * 100).toFixed(1) : 0}%`, '8% - 12%'],
      ['หัก: ค่าใช้จ่ายคงที่อื่นๆ (Fixed Expense)', `-${pnl.fixedCost.toFixed(2)}`, '', ''],
      ['กำไรจากการดำเนินงานสุทธิ (Net Operating Profit / EBITDA)', pnl.netProfit.toFixed(2), `${pnl.netMarginPct.toFixed(1)}%`, '> 15% แข็งแกร่ง'],
      ['Prime Cost (COGS + ค่าแรง)', pnl.primeCost.toFixed(2), `${pnl.primeCostPct.toFixed(1)}%`, 'เป้าหมาย < 60%'],
      [''],
      ['--- การวิเคราะห์จุดคุ้มทุน (Break-Even Analysis) ---'],
      ['ดัชนี', 'ค่า', 'หน่วย'],
      ['ต้นทุนคงที่สำหรับรอบนี้ (Fixed Costs for Period)', breakEvenData.periodFixedCost.toFixed(2), 'บาท'],
      ['อัตรากำไรส่วนเกิน (Contribution Margin Ratio)', (breakEvenData.cmRatio * 100).toFixed(1), '%'],
      ['ยอดขายจุดคุ้มทุน (Break-Even Sales Target)', breakEvenData.breakEvenSales.toFixed(2), 'บาท'],
      ['จำนวนบิลที่ต้องขายได้ (Break-Even Orders Required)', Math.ceil(breakEvenData.breakEvenBills).toString(), 'บิล'],
      ['ยอดขายจริงที่ทำได้ (Actual Realized Revenue)', breakEvenData.actualRevenue.toFixed(2), 'บาท'],
      ['ความคืบหน้าสู่จุดคุ้มทุน (Progress)', breakEvenData.progressPct.toFixed(1), '%'],
      ['สถานะจุดคุ้มทุน', breakEvenData.isBreakevenAchieved ? 'คุ้มทุนแล้ว (กำไรส่วนเกิน)' : 'ยังไม่ถึงจุดคุ้มทุน', ''],
      ['ผลต่าง (Surplus / Deficit)', breakEvenData.surplusOrDeficit.toFixed(2), 'บาท'],
      ['ส่วนเผื่อเพื่อความปลอดภัย (Margin of Safety)', breakEvenData.marginOfSafetyPct.toFixed(1), '%'],
      [''],
      ['--- ยอดขายแยกตามช่องทาง (Sales by Channel) ---'],
      ['ช่องทาง', 'จำนวนบิล', 'ยอดขายรวมบนแอป', 'GP หัก', 'ค่ากล่อง', 'ต้นทุน COGS', 'เงินเข้าบัญชีจริง', 'กำไรจริง', '% Margin'],
      ...channelComparison.map((ch) => [
        ch.label,
        ch.count.toString(),
        ch.gross.toFixed(2),
        ch.gpFee.toFixed(2),
        ch.packaging.toFixed(2),
        ch.cogs.toFixed(2),
        ch.netPayout.toFixed(2),
        ch.profit.toFixed(2),
        `${ch.marginPct.toFixed(1)}%`,
      ]),
      [''],
      ['--- 5 อันดับเมนูทำกำไรสูงสุด ---'],
      ['ชื่อเมนู', 'จำนวนจานที่ขาย', 'ยอดขายรวม', 'ต้นทุนรวม', 'กำไรรวม', '% Margin'],
      ...topProfitableDishes.map((m) => [
        m.name,
        m.qty.toString(),
        m.revenue.toFixed(2),
        m.cogs.toFixed(2),
        m.profit.toFixed(2),
        `${m.marginPct.toFixed(1)}%`,
      ]),
    ];

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) =>
          r
            .map((field) => {
              const str = String(field ?? '');
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Financial_Report_${settings.shopName.replace(/\s+/g, '_')}_${selectedDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible print:block">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none print:overflow-visible print:static print:block">
        {/* Modal Toolbar (hidden on print) */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-base">
                รายงานงบการเงินและจุดคุ้มทุนมาตรฐานสากล (F&B Financial Statement)
              </h2>
              <p className="text-xs text-slate-400">{getPeriodLabel()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>ส่งออก CSV (Excel)</span>
            </button>

            <a
              href={printBlobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!printBlobUrl) {
                  e.preventDefault();
                  handlePrint();
                }
              }}
              onMouseEnter={() => {
                if (!printBlobUrl && printAreaRef.current?.innerHTML) {
                  const html = buildPrintableHtml(printAreaRef.current.innerHTML);
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  setPrintBlobUrl(URL.createObjectURL(blob));
                }
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 no-underline select-none"
              title="สั่งพิมพ์รายงานออกเครื่องปริ้นที่เชื่อมต่อกับคอมพิวเตอร์ทันที"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ออกเครื่องปริ้น (Print)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Content */}
        <div
          ref={printAreaRef}
          id="printable-financial-report"
          className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-100 print:text-black print:p-0 print:space-y-4 print:overflow-visible print:block"
        >
          {/* Header & Restaurant Info */}
          <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-950 dark:text-white print:text-black tracking-tight">
                {settings.shopName}
              </h1>
              <p className="text-xs text-slate-500 print:text-slate-600 mt-1">
                {settings.address || 'ที่อยู่ร้านอาหาร KinD POS'}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 print:text-slate-600 mt-1">
                {settings.phone && <span>โทร: {settings.phone}</span>}
                {settings.taxId && <span>เลขประจำตัวผู้เสียภาษี: {settings.taxId}</span>}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 rounded-full bg-slate-900 text-white print:bg-slate-200 print:text-black text-xs font-bold uppercase tracking-wider mb-1">
                {period === 'today' ? 'Daily P&L' : period === 'month' ? 'Monthly P&L' : 'Annual Report'}
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white print:text-black">
                {reportTypeTitle}
              </h2>
              <p className="text-xs text-slate-500 print:text-slate-600 font-mono mt-0.5">
                {getPeriodLabel()}
              </p>
              <p className="text-[11px] text-slate-400 print:text-slate-500 mt-1">
                ออกรายงานเมื่อ: {formatThaiDateTime(new Date().toISOString())}
              </p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 print:bg-slate-100 border border-slate-200 dark:border-slate-700 print:border-slate-300">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                ยอดขายอาหารสุทธิ (Net Sales)
              </span>
              <span className="font-mono font-black text-base text-slate-900 dark:text-white print:text-black">
                {formatBaht(pnl.netSales)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {pnl.paidBillsCount} บิล (เฉลี่ย {formatBaht(pnl.avgTicket)}/บิล)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 print:bg-slate-100 border border-emerald-200 dark:border-emerald-900/40 print:border-slate-300">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 print:text-black block mb-0.5">
                เงินรับเข้ากระเป๋าจริง (Realized Payout)
              </span>
              <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400 print:text-black">
                {formatBaht(pnl.netRealizedRevenue)}
              </span>
              <span className="text-[10px] text-emerald-600/80 print:text-slate-600 block mt-0.5">
                หัก GP ({formatBaht(pnl.totalGpFee)}) & กล่องแล้ว
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 print:bg-slate-100 border border-amber-200 dark:border-amber-900/40 print:border-slate-300">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 print:text-black block mb-0.5">
                Prime Cost (COGS + ค่าแรง)
              </span>
              <span className="font-mono font-black text-base text-amber-600 dark:text-amber-400 print:text-black">
                {pnl.primeCostPct.toFixed(1)}%
              </span>
              <span className="text-[10px] text-amber-600/80 print:text-slate-600 block mt-0.5">
                {pnl.primeCostPct <= 60 ? '✅ อยู่ในเกณฑ์ดี (<60%)' : '⚠️ สูงกว่าเกณฑ์สากล'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 text-white print:bg-slate-200 print:text-black border border-slate-800 print:border-slate-400">
              <span className="text-[11px] font-bold text-amber-400 print:text-black block mb-0.5">
                กำไรสุทธิจากการดำเนินงาน (EBITDA)
              </span>
              <span className="font-mono font-black text-base text-amber-400 print:text-black">
                {formatBaht(pnl.netProfit)}
              </span>
              <span className="text-[10px] text-slate-300 print:text-slate-700 block mt-0.5">
                Margin: {pnl.netMarginPct.toFixed(1)}% ของรายได้สุทธิ
              </span>
            </div>
          </div>

          {/* SECTION 1: Break-Even Analysis Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 print:bg-transparent border border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-500 print:text-black" />
                <span>ผลการวิเคราะห์จุดคุ้มทุน (Break-Even Analysis Summary)</span>
              </h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  breakEvenData.isBreakevenAchieved
                    ? 'bg-emerald-100 text-emerald-800 print:border print:border-black'
                    : 'bg-rose-100 text-rose-800 print:border print:border-black'
                }`}
              >
                {breakEvenData.isBreakevenAchieved
                  ? `🎉 ผ่านจุดคุ้มทุนแล้ว (${breakEvenData.progressPct.toFixed(1)}%)`
                  : `⚠️ ยังไม่ถึงจุดคุ้มทุน (${breakEvenData.progressPct.toFixed(1)}%)`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">ต้นทุนคงที่สำหรับรอบนี้ (FC):</span>
                <span className="font-mono font-bold">{formatBaht(breakEvenData.periodFixedCost)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">อัตรากำไรส่วนเกิน (CMR):</span>
                <span className="font-mono font-bold">{(breakEvenData.cmRatio * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">ยอดขายจุดคุ้มทุน (BEP):</span>
                <span className="font-mono font-bold text-amber-600 print:text-black">
                  {formatBaht(breakEvenData.breakEvenSales)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">ส่วนเผื่อความปลอดภัย (Margin of Safety):</span>
                <span className={`font-mono font-bold ${breakEvenData.marginOfSafetyPct >= 0 ? 'text-emerald-600 print:text-black' : 'text-rose-600 print:text-black'}`}>
                  {breakEvenData.marginOfSafetyPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Official Income Statement (P&L) */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500 print:text-black" />
              <span>งบกำไรขาดทุนจากการดำเนินงาน (Statement of Operations)</span>
            </h3>

            <div className="border border-slate-200 dark:border-slate-800 print:border-slate-400 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 print:bg-slate-200 text-slate-600 print:text-black border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-3 text-left font-bold">รายการบัญชี</th>
                    <th className="py-2 px-3 text-right font-bold">จำนวนเงิน (บาท)</th>
                    <th className="py-2 px-3 text-right font-bold">% ต่อรายได้</th>
                    <th className="py-2 px-3 text-left font-bold">เกณฑ์สากลร้านอาหาร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  <tr>
                    <td className="py-2 px-3 font-bold">1. ยอดขายอาหารและเครื่องดื่มรวม (Gross Sales)</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{formatBaht(pnl.grossFoodSales)}</td>
                    <td className="py-2 px-3 text-right font-mono">100.0%</td>
                    <td className="py-2 px-3 text-slate-400 print:text-slate-600 text-[11px]">ยอดขายก่อนหักส่วนลด</td>
                  </tr>
                  <tr className="text-rose-600 dark:text-rose-400 print:text-black">
                    <td className="py-1.5 px-3 pl-6">หัก: ส่วนลดและโปรโมชั่น (Discounts)</td>
                    <td className="py-1.5 px-3 text-right font-mono">-{formatBaht(pnl.totalDiscount)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.totalDiscount / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 print:text-slate-600 text-[11px]">ไม่ควรเกิน 3-5%</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/30 print:bg-slate-100 font-bold">
                    <td className="py-2 px-3">ยอดขายอาหารสุทธิก่อนหัก GP (Gross Net Sales)</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{formatBaht(pnl.netSales)}</td>
                    <td className="py-2 px-3 text-right font-mono">100.0%</td>
                    <td className="py-2 px-3 text-slate-400 print:text-slate-600 text-[11px]">ฐานคำนวณ</td>
                  </tr>
                  <tr className="text-rose-600 dark:text-rose-400 print:text-black">
                    <td className="py-1.5 px-3 pl-6">หัก: ค่าคอมมิชชั่น GP แพลตฟอร์มเดลิเวอรี (Grab/LINE MAN)</td>
                    <td className="py-1.5 px-3 text-right font-mono">-{formatBaht(pnl.totalGpFee)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.totalGpFee / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 print:text-slate-600 text-[11px]">
                      {pnl.deliveryOrdersCount} ออเดอร์เดลิเวอรี
                    </td>
                  </tr>
                  <tr className="text-amber-600 dark:text-amber-400 print:text-black">
                    <td className="py-1.5 px-3 pl-6">หัก: ค่ากล่องและบรรจุภัณฑ์ (Packaging Costs)</td>
                    <td className="py-1.5 px-3 text-right font-mono">-{formatBaht(pnl.totalPackagingCost)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.totalPackagingCost / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 print:text-slate-600 text-[11px]">กล่อง ถุง ช้อนส้อม</td>
                  </tr>
                  <tr className="bg-blue-50/50 dark:bg-blue-950/20 print:bg-slate-100 font-bold text-blue-900 dark:text-blue-200 print:text-black">
                    <td className="py-2 px-3 font-black">= รายได้สุทธิที่ได้รับเข้าบัญชีจริง (Net Realized Sales)</td>
                    <td className="py-2 px-3 text-right font-mono font-black">{formatBaht(pnl.netRealizedRevenue)}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.netRealizedRevenue / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-2 px-3 text-blue-800 print:text-black text-[11px]">เงินสดและเงินโอนจริง</td>
                  </tr>
                  <tr className="text-rose-600 dark:text-rose-400 print:text-black">
                    <td className="py-2 px-3 pl-6">2. หัก: ต้นทุนวัตถุดิบอาหารและเครื่องดื่ม (COGS)</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">-{formatBaht(pnl.totalCogs)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{pnl.foodCostPct.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-slate-400 print:text-slate-600 text-[11px]">
                      {pnl.foodCostPct <= 35 ? '✅ มาตรฐานสากล (28% - 35%)' : '⚠️ เกิน 35%'}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 dark:bg-emerald-950/30 print:bg-slate-100 font-bold text-emerald-800 dark:text-emerald-300 print:text-black">
                    <td className="py-2 px-3 font-black">= กำไรขั้นต้นที่แท้จริง (True Gross Profit)</td>
                    <td className="py-2 px-3 text-right font-mono font-black">{formatBaht(pnl.grossProfit)}</td>
                    <td className="py-2 px-3 text-right font-mono font-black">{pnl.grossMarginPct.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-emerald-800 print:text-black text-[11px]">65% - 72% เกณฑ์ดี</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 pl-6">3. หัก: ค่าแรงพนักงาน (Labor Cost)</td>
                    <td className="py-1.5 px-3 text-right font-mono">-{formatBaht(pnl.laborCost)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.laborCost / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 print:text-slate-600 text-[11px]">18% - 25%</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 pl-6">4. หัก: ค่าเช่าและสาธารณูปโภค (Occupancy Cost)</td>
                    <td className="py-1.5 px-3 text-right font-mono">-{formatBaht(pnl.occupancyCost)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">
                      {pnl.netSales > 0 ? ((pnl.occupancyCost / pnl.netSales) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 print:text-slate-600 text-[11px]">8% - 12%</td>
                  </tr>
                  {pnl.fixedCost > 0 && (
                    <tr>
                      <td className="py-1.5 px-3 pl-6">5. หัก: ค่าใช้จ่ายคงที่อื่นๆ ที่ระบุเพิ่มเติม</td>
                      <td className="py-1.5 px-3 text-right font-mono">-{formatBaht(pnl.fixedCost)}</td>
                      <td className="py-1.5 px-3 text-right font-mono">
                        {pnl.netSales > 0 ? ((pnl.fixedCost / pnl.netSales) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="py-1.5 px-3 text-slate-400 print:text-slate-600 text-[11px]">-</td>
                    </tr>
                  )}
                  <tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black font-black text-xs">
                    <td className="py-2.5 px-3 text-amber-400 print:text-black">
                      🏆 กำไรจากการดำเนินงานสุทธิ (Net Operating Profit / EBITDA)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-400 print:text-black text-sm">
                      {formatBaht(pnl.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-400 print:text-black">
                      {pnl.netMarginPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 print:text-black text-[11px]">
                      {pnl.netMarginPct >= 15 ? '🚀 อัตรากำไรแข็งแกร่งมาก (> 15%)' : 'กำไรแท้จริง'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: Sales by Channel Table */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2 flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-emerald-500 print:text-black" />
              <span>สรุปยอดขายแยกตามช่องทาง (Sales by Channel)</span>
            </h3>

            <div className="border border-slate-200 dark:border-slate-800 print:border-slate-400 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 print:bg-slate-200 text-slate-600 print:text-black border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-3 text-left font-bold">ช่องทาง</th>
                    <th className="py-2 px-3 text-center font-bold">บิล</th>
                    <th className="py-2 px-3 text-right font-bold">ยอดขายรวมบนแอป</th>
                    <th className="py-2 px-3 text-right font-bold">GP หัก</th>
                    <th className="py-2 px-3 text-right font-bold">ค่ากล่อง</th>
                    <th className="py-2 px-3 text-right font-bold">เงินเข้าบัญชีจริง</th>
                    <th className="py-2 px-3 text-right font-bold">กำไรจริง</th>
                    <th className="py-2 px-3 text-right font-bold">% Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {channelComparison.map((ch) => (
                    <tr key={ch.id}>
                      <td className="py-2 px-3 font-bold flex items-center gap-1.5">
                        <span>{ch.icon}</span>
                        <span>{ch.label}</span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{ch.count}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatBaht(ch.gross)}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-600 print:text-black">
                        {ch.gpFee > 0 ? `-${formatBaht(ch.gpFee)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-amber-600 print:text-black">
                        {ch.packaging > 0 ? `-${formatBaht(ch.packaging)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-blue-600 print:text-black">
                        {formatBaht(ch.netPayout)}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-black ${ch.profit >= 0 ? 'text-emerald-600 print:text-black' : 'text-rose-600 print:text-black'}`}>
                        {formatBaht(ch.profit)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{ch.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: Shift Cash Reconciliation (if Daily / Shift mode) */}
          {period === 'today' && currentShift && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-500 print:text-black" />
                <span>การกระทบยอดเงินสดในลิ้นชัก (Cash Drawer Audit)</span>
              </h3>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 print:border-slate-400 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">เงินทอนตั้งต้น:</span>
                  <span className="font-mono font-bold">{formatBaht(currentShift.startingCash)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">ผู้รับผิดชอบเปิดกะ:</span>
                  <span className="font-bold">{currentShift.openedBy}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">เวลาที่เปิดกะ:</span>
                  <span className="font-mono">{formatThaiDateTime(currentShift.openedAt)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">สถานะกะ:</span>
                  <span className="font-bold text-emerald-600 print:text-black">
                    {currentShift.status === 'open' ? 'กะกำลังดำเนินอยู่' : 'ปิดกะเรียบร้อย'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: Top 5 Profitable Menu Items */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 print:text-black mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500 print:text-black" />
              <span>5 อันดับเมนูที่ทำกำไรรวมสูงสุด (Top Profitable Dishes)</span>
            </h3>

            <div className="border border-slate-200 dark:border-slate-800 print:border-slate-400 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 print:bg-slate-200 text-slate-600 print:text-black border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-3 text-left font-bold">ชื่อเมนู</th>
                    <th className="py-2 px-3 text-center font-bold">จำนวนจาน</th>
                    <th className="py-2 px-3 text-right font-bold">ยอดขาย</th>
                    <th className="py-2 px-3 text-right font-bold">ต้นทุน COGS</th>
                    <th className="py-2 px-3 text-right font-bold">กำไรรวม</th>
                    <th className="py-2 px-3 text-right font-bold">% Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {topProfitableDishes.slice(0, 5).map((dish, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold">{dish.name}</td>
                      <td className="py-2 px-3 text-center font-mono">{dish.qty}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatBaht(dish.revenue)}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{formatBaht(dish.cogs)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 print:text-black">
                        {formatBaht(dish.profit)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{dish.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit & Sign-off Boxes */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-700 print:border-slate-400 grid grid-cols-2 gap-8 text-xs">
            <div className="text-center space-y-8">
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                  ({currentUser?.name || '...................................................'})
                </p>
                <p className="text-[11px] text-slate-400 print:text-slate-600">
                  ผู้จัดทำรายงาน / แคชเชียร์ผู้รับผิดชอบ
                </p>
                <p className="text-[10px] text-slate-400 print:text-slate-600 mt-1">
                  วันที่ ..... / ..... / .........
                </p>
              </div>
            </div>

            <div className="text-center space-y-8">
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                  (...................................................)
                </p>
                <p className="text-[11px] text-slate-400 print:text-slate-600">
                  ผู้จัดการร้าน / ผู้ตรวจสอบบัญชี (Store Manager / Auditor)
                </p>
                <p className="text-[10px] text-slate-400 print:text-slate-600 mt-1">
                  วันที่ ..... / ..... / .........
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (hidden on print) */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 print:hidden text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            รายงานนี้ถูกรับรองตามมาตรฐานการเงินร้านอาหารสากล (F&B Operations Framework)
          </span>

          <div className="flex items-center gap-2">
            <a
              href={printBlobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!printBlobUrl) {
                  e.preventDefault();
                  handlePrint();
                }
              }}
              onMouseEnter={() => {
                if (!printBlobUrl && printAreaRef.current?.innerHTML) {
                  const html = buildPrintableHtml(printAreaRef.current.innerHTML);
                  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                  setPrintBlobUrl(URL.createObjectURL(blob));
                }
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 no-underline select-none"
              title="สั่งพิมพ์รายงานออกเครื่องปริ้นที่เชื่อมต่อกับคอมพิวเตอร์ทันที"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ออกเครื่องปริ้น (Print)</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
