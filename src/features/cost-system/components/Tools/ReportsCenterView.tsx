import React, { useState } from 'react';
import { FileText, Download, Printer, Table, Filter, Sparkles } from 'lucide-react';
import { Ingredient, MenuItem, DailySalesRecord, ExpenseRecord, BusinessSettings } from '../../types/domain';
import { exportMasterIngredientsToCSV, exportMenuEngineeringToCSV, exportFinancialSummaryToCSV } from '../../data/excelMapper';

interface ReportsCenterViewProps {
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  sales: DailySalesRecord[];
  expenses: ExpenseRecord[];
  settings: BusinessSettings;
  activeLanguage: 'th' | 'en';
}

export const ReportsCenterView: React.FC<ReportsCenterViewProps> = ({
  ingredients,
  menuItems,
  sales,
  expenses,
  settings,
  activeLanguage,
}) => {
  const [selectedReport, setSelectedReport] = useState<'ingredients' | 'recipes' | 'financials' | 'pnl'>('ingredients');

  const handleDownloadCSV = (reportType: string) => {
    let csvContent = '';
    let filename = 'report.csv';

    if (reportType === 'ingredients') {
      csvContent = exportMasterIngredientsToCSV(ingredients);
      filename = `ingredients_costing_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (reportType === 'financials' || reportType === 'pnl') {
      csvContent = exportFinancialSummaryToCSV(sales, expenses, settings);
      filename = `financial_pnl_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      // Menu report
      const allPortions = menuItems.flatMap((m) =>
        m.portions.map((p) => ({
          id: p.code,
          name: `${m.thaiName} (${p.name})`,
          quantitySold: 100,
          sellingPrice: p.sellingPrice,
          costPerPortion: p.totalDirectCost,
          contributionMargin: p.contributionProfit,
        }))
      );
      csvContent = exportMenuEngineeringToCSV(allPortions);
      filename = `menu_costing_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00B1FF] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00B1FF]">
              Export Center & Data Archiving
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#00B1FF]" />
            <span>{activeLanguage === 'th' ? 'ศูนย์รายงาน & ส่งออกข้อมูล (Reports & Data Export)' : 'Reports & Data Export'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'ดาวน์โหลดรายงานสรุปต้นทุน เมนู และงบการเงิน เพื่อนำไปพิมพ์หรือใช้งานต่อใน Excel / Google Sheets'
              : 'Export full cost breakdowns, recipe portion cards, and financial summaries to CSV or print.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์รายงาน (Print)</span>
          </button>
        </div>
      </div>

      {/* Report Types Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setSelectedReport('ingredients')}
          className={`cursor-pointer rounded-xl border p-5 transition-all ${
            selectedReport === 'ingredients'
              ? 'border-[#FF6321] bg-[#FF6321]/10 text-white'
              : 'border-white/5 bg-[#151518] text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">1. รายงานต้นทุนวัตถุดิบ</div>
            <Download className="h-4 w-4 text-white/40" />
          </div>
          <p className="text-xs text-white/40 mt-1">
            รายการวัตถุดิบทั้งหมด ราคาซื้อ Yield % และต้นทุนเนื้อสุทธิ (Effective Cost)
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadCSV('ingredients');
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>ดาวน์โหลด CSV ({ingredients.length} รายการ)</span>
          </button>
        </div>

        <div
          onClick={() => setSelectedReport('recipes')}
          className={`cursor-pointer rounded-xl border p-5 transition-all ${
            selectedReport === 'recipes'
              ? 'border-[#FF6321] bg-[#FF6321]/10 text-white'
              : 'border-white/5 bg-[#151518] text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">2. รายงานต้นทุนเมนูอาหาร</div>
            <Download className="h-4 w-4 text-white/40" />
          </div>
          <p className="text-xs text-white/40 mt-1">
            ต้นทุนอาหารต่อจาน ราคาขาย % Food Cost และกำไรส่วนเกิน (Contribution Margin)
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadCSV('recipes');
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>ดาวน์โหลด CSV ({menuItems.length} เมนู)</span>
          </button>
        </div>

        <div
          onClick={() => setSelectedReport('financials')}
          className={`cursor-pointer rounded-xl border p-5 transition-all ${
            selectedReport === 'financials'
              ? 'border-[#FF6321] bg-[#FF6321]/10 text-white'
              : 'border-white/5 bg-[#151518] text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">3. สรุปงบการเงิน & P&L</div>
            <Download className="h-4 w-4 text-white/40" />
          </div>
          <p className="text-xs text-white/40 mt-1">
            ยอดขายสุทธิ ค่าใช้จ่ายดำเนินงาน Prime Cost กำไรดำเนินงาน และกำไรสุทธิ
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadCSV('financials');
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>ดาวน์โหลด CSV รายงานการเงิน</span>
          </button>
        </div>
      </div>
    </div>
  );
};
