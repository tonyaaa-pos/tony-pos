import React, { useState } from 'react';
import { Compass, Star, Trophy, HelpCircle, AlertOctagon, TrendingUp, Sparkles, Filter } from 'lucide-react';
import { MenuItem, DailySalesRecord } from '../../types/domain';
import { calculateMenuEngineering, MenuEngineeringItem, MenuEngineeringCategory } from '../../engine/calculations';

interface MenuEngineeringViewProps {
  menuItems: MenuItem[];
  sales: DailySalesRecord[];
  activeLanguage: 'th' | 'en';
}

export const MenuEngineeringView: React.FC<MenuEngineeringViewProps> = ({
  menuItems,
  sales,
  activeLanguage,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Build simulated monthly items sold from daily records or default realistic distribution
  const allPortions = menuItems.flatMap((m) =>
    m.portions.map((p) => ({
      menuId: m.id,
      id: `${m.code}-${p.id}`,
      name: `${m.thaiName} (${p.name})`,
      cost: p.totalDirectCost,
      price: p.sellingPrice,
      margin: p.contributionProfit,
    }))
  );

  // Approximate monthly volume per portion
  const itemsForMatrix = allPortions.map((p, idx) => {
    let salesVolume = 80;
    if (p.id.includes('PAD-THAI') || p.id.includes('KAPRAO')) salesVolume = 420;
    else if (p.id.includes('TOM-YUM') || p.id.includes('KHAO-SOI')) salesVolume = 310;
    else if (p.id.includes('GREEN-CURRY')) salesVolume = 230;
    else if (p.id.includes('PORK-NECK')) salesVolume = 95;
    else salesVolume = 70 + (idx % 3) * 40;

    return {
      id: p.id,
      name: p.name,
      salesVolume,
      sellingPrice: p.price,
      totalDirectCost: p.cost,
    };
  });

  const matrixResult = calculateMenuEngineering(itemsForMatrix);
  const { classifiedItems, averageMargin, averageVolume, totalVolume, totalProfit } = matrixResult;

  const stars = classifiedItems.filter((i) => i.category === 'STAR');
  const plowhorses = classifiedItems.filter((i) => i.category === 'PLOWHORSE');
  const puzzles = classifiedItems.filter((i) => i.category === 'PUZZLE');
  const dogs = classifiedItems.filter((i) => i.category === 'DOG');

  const filteredItems = selectedCategory === 'ALL'
    ? classifiedItems
    : classifiedItems.filter((i) => i.category === selectedCategory);


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00B1FF] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00B1FF]">
              Portfolio Optimization
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#FF6321]" />
            <span>{activeLanguage === 'th' ? 'เมทริกซ์วิเคราะห์เมนู (Menu Engineering Matrix)' : 'Menu Engineering Matrix'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'จัดกลุ่มเมนูอาหารตามความสามารถในการทำกำไร (Margin) และความนิยมในการสั่ง (Popularity Volume) เพื่อวางกลยุทธ์เมนู'
              : 'Classify dishes into Stars, Plowhorses, Puzzles, and Dogs to optimize menu mix and profitability.'}
          </p>
        </div>
      </div>

      {/* 4 Quadrant Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STARS */}
        <div
          onClick={() => setSelectedCategory(selectedCategory === 'STAR' ? 'ALL' : 'STAR')}
          className={`cursor-pointer rounded-xl border p-4 transition-all bg-[#151518] ${
            selectedCategory === 'STAR'
              ? 'border-amber-400 ring-1 ring-amber-400/50'
              : 'border-white/5 hover:border-amber-400/30'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 font-bold text-xs uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>🌟 STARS</span>
            </span>
            <span className="text-xl font-light font-mono text-white">{stars.length}</span>
          </div>
          <p className="text-xs text-amber-950 mt-3 font-semibold">กำไรสูง + ขายดีมาก</p>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            กลยุทธ์: รักษาคุณภาพและความสม่ำเสมอ จัดวางในตำแหน่งที่เห็นชัดเจนที่สุด
          </p>
        </div>

        {/* PLOWHORSES */}
        <div
          onClick={() => setSelectedCategory(selectedCategory === 'PLOWHORSE' ? 'ALL' : 'PLOWHORSE')}
          className={`cursor-pointer rounded-xl border p-4 transition-all bg-[#151518] ${
            selectedCategory === 'PLOWHORSE'
              ? 'border-blue-400 ring-1 ring-blue-400/50'
              : 'border-white/5 hover:border-blue-400/30'
          }`}
        >
          <div className="flex items-center justify-between text-blue-400 font-bold text-xs uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-blue-400" />
              <span>🐎 PLOWHORSES</span>
            </span>
            <span className="text-xl font-light font-mono text-white">{plowhorses.length}</span>
          </div>
          <p className="text-xs text-blue-950 mt-3 font-semibold">กำไรน้อย + ขายดีมาก</p>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            กลยุทธ์: ปรับขึ้นราคา 5-10 บาท ลดต้นทุนสูตร หรือขายพ่วงกับเครื่องดื่มกำไรสูง
          </p>
        </div>

        {/* PUZZLES */}
        <div
          onClick={() => setSelectedCategory(selectedCategory === 'PUZZLE' ? 'ALL' : 'PUZZLE')}
          className={`cursor-pointer rounded-xl border p-4 transition-all bg-[#151518] ${
            selectedCategory === 'PUZZLE'
              ? 'border-purple-400 ring-1 ring-purple-400/50'
              : 'border-white/5 hover:border-purple-400/30'
          }`}
        >
          <div className="flex items-center justify-between text-purple-400 font-bold text-xs uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-purple-400" />
              <span>🧩 PUZZLES</span>
            </span>
            <span className="text-xl font-light font-mono text-white">{puzzles.length}</span>
          </div>
          <p className="text-xs text-purple-300 mt-3 font-semibold">กำไรสูง + ขายได้น้อย</p>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            กลยุทธ์: ให้พนักงานแนะนำลูกค้า จัดโปรโมชั่นทดลองชิม หรือเปลี่ยนชื่อให้น่าทาน
          </p>
        </div>

        {/* DOGS */}
        <div
          onClick={() => setSelectedCategory(selectedCategory === 'DOG' ? 'ALL' : 'DOG')}
          className={`cursor-pointer rounded-xl border p-4 transition-all bg-[#151518] ${
            selectedCategory === 'DOG'
              ? 'border-[#EF4444] ring-1 ring-[#EF4444]/50'
              : 'border-white/5 hover:border-[#EF4444]/30'
          }`}
        >
          <div className="flex items-center justify-between text-[#EF4444] font-bold text-xs uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <AlertOctagon className="h-4 w-4 text-[#EF4444]" />
              <span>🐶 DOGS</span>
            </span>
            <span className="text-xl font-light font-mono text-white">{dogs.length}</span>
          </div>
          <p className="text-xs text-[#EF4444] mt-3 font-semibold">กำไรน้อย + ขายไม่ออก</p>
          <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
            กลยุทธ์: ตัดออกจากเมนูทันทีเพื่อลดสต็อกของสด หรือปรับปรุงสูตรใหม่ทั้งหมด
          </p>
        </div>
      </div>

      {/* Threshold Reference Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#151518] p-4 rounded-xl border border-white/5 text-xs text-white/70">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-white/40 text-[11px] uppercase tracking-wider">เกณฑ์กำไรเฉลี่ย (Avg Margin):</span>{' '}
            <span className="font-mono font-bold text-white ml-1.5">฿{averageMargin.toFixed(2)}/จาน</span>
          </div>
          <div>
            <span className="text-white/40 text-[11px] uppercase tracking-wider">เกณฑ์ยอดขายเฉลี่ย (Avg Volume):</span>{' '}
            <span className="font-mono font-bold text-white ml-1.5">{Math.round(averageVolume)} จาน / เดือน</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-white/40" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs bg-[#0F0F11] text-white font-medium focus:outline-none focus:border-[#FF6321]"
          >
            <option value="ALL">แสดงทุกกลุ่ม (All Quadrants)</option>
            <option value="STAR">🌟 STARS เท่านั้น</option>
            <option value="PLOWHORSE">🐎 PLOWHORSES เท่านั้น</option>
            <option value="PUZZLE">🧩 PUZZLES เท่านั้น</option>
            <option value="DOG">🐶 DOGS เท่านั้น</option>
          </select>
        </div>
      </div>

      {/* Engineering Table */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/30 uppercase tracking-tighter text-xs font-normal">
                <th className="py-2.5 px-3">ชื่อเมนูอาหาร</th>
                <th className="py-2.5 px-3 text-center">กลุ่ม (Quadrant)</th>
                <th className="py-2.5 px-3 text-right">จำนวนที่ขาย (จาน)</th>
                <th className="py-2.5 px-3 text-right">ราคาขาย (฿)</th>
                <th className="py-2.5 px-3 text-right">ต้นทุนทางตรง (฿)</th>
                <th className="py-2.5 px-3 text-right">กำไรส่วนเกิน (฿)</th>
                <th className="py-2.5 px-3 text-right">กำไรรวมทั้งหมด (฿)</th>
                <th className="py-2.5 px-3">คำแนะนำในการดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-white/80">
              {filteredItems.map((item) => {
                const isStar = item.category === 'STAR';
                const isPlowhorse = item.category === 'PLOWHORSE';
                const isPuzzle = item.category === 'PUZZLE';
                const isDog = item.category === 'DOG';

                return (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-semibold text-white font-sans">{item.name}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          isStar
                            ? 'bg-amber-400/10 text-amber-950 border border-amber-400/30'
                            : isPlowhorse
                            ? 'bg-blue-400/10 text-blue-950 border border-blue-400/30'
                            : isPuzzle
                            ? 'bg-purple-400/10 text-purple-950 border border-purple-400/30'
                            : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20'
                        }`}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {item.salesVolume.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white/90">฿{item.sellingPrice}</td>
                    <td className="py-3 px-3 text-right font-mono text-white/40">
                      ฿{item.totalDirectCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#10B981]">
                      ฿{item.contributionMargin.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ฿{Math.round(item.contributionMargin * item.salesVolume).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-xs font-sans">
                      <span className="text-white font-medium">{item.actionTh}</span>
                      <p className="text-[11px] text-white/40 mt-0.5">{item.recommendationTh}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
