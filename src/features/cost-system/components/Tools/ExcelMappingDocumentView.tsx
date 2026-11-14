import React from 'react';
import { BookOpen, Database, Code, CheckCircle, ArrowRight, Layers, Cpu } from 'lucide-react';

interface ExcelMappingDocumentViewProps {
  activeLanguage: 'th' | 'en';
}

export const ExcelMappingDocumentView: React.FC<ExcelMappingDocumentViewProps> = ({
  activeLanguage,
}) => {
  const mappings = [
    {
      excelSheet: '1. INGREDIENTS (วัตถุดิบ)',
      columns: 'Item Code, Name TH/EN, Category, Purchase Price, Unit, Yield %, Supplier',
      domainModel: 'Ingredient Entity (id, thaiName, purchasePrice, purchaseUnit, yieldPercent, costPerBaseUnit)',
      engineLogic: 'calculateEffectiveYieldCost() & convertToBaseUnit()',
      improvements: 'เพิ่ม Base Unit (g, ml) อัตโนมัติ, เก็บประวัติราคาซื้อย้อนหลัง (Price History Log)',
    },
    {
      excelSheet: '2. YIELD_TESTS (แลบทดสอบ Yield)',
      columns: 'Raw Weight (g), Usable Trimmed Weight (g), Waste %, Yield %',
      domainModel: 'YieldTestRecord (asPurchasedWeight, ediblePortionWeight, yieldPercent, testDate)',
      engineLogic: 'calculateYieldFromTrim() & calculateCookingAbsorptionYield()',
      improvements: 'รองรับ Absorption Yield > 100% (ข้าวหุงสุก, เส้นต้ม, เห็ดหอมแห้งแช่น้ำ) ได้ถูกต้อง',
    },
    {
      excelSheet: '3. SAUCE_BATCH (ซอส & น้ำซุปกลาง)',
      columns: 'Recipe Name, Yield Volume, Ingredients List, Cost Sum, Cost/ml',
      domainModel: 'SubRecipe Entity (batchYieldQuantity, batchYieldUnit, items[], costPerUnit)',
      engineLogic: 'calculateSubRecipeUnitCost()',
      improvements: 'คำนวณต้นทุนต่อมิลลิลิตร (฿/ml) แบบ Recursive สามารถนำไปเป็นส่วนผสมในซอสซ้อนซอสได้',
    },
    {
      excelSheet: '4. MENU_PORTIONS (เมนูและสูตร)',
      columns: 'Menu Name, Portions (S/M/L), Raw Items, Sauce Usage, Packaging Cost',
      domainModel: 'MenuItem & RecipePortion (portions[], items[], subRecipes[], packagingItems[])',
      engineLogic: 'calculateRecipeCost() & calculateEffectiveFoodCostPercent()',
      improvements: 'แยกสูตรอาหารออกจากขนาดเสิร์ฟอย่างสมบูรณ์ คำนวณต้นทุนกล่องแยกตามโหมด Takeaway/Dine-In',
    },
    {
      excelSheet: '5. PRICING_STRATEGY (ตั้งราคา)',
      columns: 'Cost, Target Food Cost %, Target Margin %, Selling Price, VAT 7%',
      domainModel: 'Portion Pricing (sellingPrice, foodCostPercent, contributionProfit)',
      engineLogic: 'calculateTargetSellingPrice() & calculateEffectiveFoodCostPercent()',
      improvements: 'คำนวณต้นทุนอาหารจากราคาหลังหักส่วนลดร้าน (Never calculate Food Cost on phantom revenue)',
    },
    {
      excelSheet: '6. PLATFORM_GP (แอปเดลิเวอรี)',
      columns: 'Platform, Order Value, GP %, Net Payout',
      domainModel: 'SalesChannel (commissionPercent, taxOnCommissionPercent, paymentFeePercent)',
      engineLogic: 'calculateChannelNetRevenue()',
      improvements: 'คำนวณ VAT 7% บนค่าคอมมิชชั่น GP ตามระบบสรรพากรไทยจริง 100%',
    },
    {
      excelSheet: '7. MONTHLY_PNL (งบกำไรขาดทุน)',
      columns: 'Sales, COGS, Kitchen Staff, Rent, Utilities, Profit',
      domainModel: 'ProfitAndLossSummary (grossSales, netSales, totalCogs, primeCost, opex, netProfit)',
      engineLogic: 'calculateProfitAndLoss() & calculateBreakEven()',
      improvements: 'แยก Prime Cost (COGS + Kitchen Labor) ชัดเจน แสดงจุดคุ้มทุนทั้งยอดขายและจำนวนจานต่อวัน',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00B1FF] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00B1FF]">
              System Architecture & Schema Mapping
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#00B1FF]" />
            <span>{activeLanguage === 'th' ? 'เอกสารแมปปิ้งโครงสร้างสเปรดชีต (Excel Architecture & Data Dictionary)' : 'Excel Architecture & Data Dictionary'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'คำอธิบายการแปลงโครงสร้างชีต Excel แบบเดิม สู่ระบบฐานข้อมูลแบบ Normalized และ Pure Calculation Engine'
              : 'Technical architecture map translating interconnected Excel sheets into normalized schemas and pure engines.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {mappings.map((m, idx) => (
          <div key={idx} className="rounded-xl border border-white/5 bg-[#151518] p-5 text-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-2.5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="p-1 rounded bg-[#00B1FF]/10 text-[#00B1FF] text-xs font-mono border border-[#00B1FF]/20">
                  {m.excelSheet.split(' ')[0]}
                </span>
                <span>{m.excelSheet}</span>
              </h2>
              <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20">
                Normalized & Tested
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-[#0F0F11] p-3 rounded-lg border border-white/5">
                <div className="font-semibold text-white/60 flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-white/40" />
                  <span>Domain Model Entity:</span>
                </div>
                <div className="text-white/80 font-mono text-[11px]">{m.domainModel}</div>
              </div>

              <div className="space-y-1.5 bg-[#0F0F11] p-3 rounded-lg border border-white/5">
                <div className="font-semibold text-[#00B1FF] flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[#00B1FF]" />
                  <span>Calculation Engine:</span>
                </div>
                <div className="text-white/80 font-mono text-[11px]">{m.engineLogic}</div>
              </div>
            </div>

            <div className="pt-1 text-xs text-white/60 flex items-start gap-2">
              <span className="font-semibold text-white whitespace-nowrap">สิ่งที่ยกระดับจาก Excel:</span>
              <span className="text-white/70">{m.improvements}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
