import React, { useState, useMemo } from 'react';
import {
  Plus,
  X,
  Calendar,
  Receipt,
  ArrowRightLeft,
} from 'lucide-react';
import { ExpenseRecord, ExpenseCategory } from '../types';
import { NumericInput } from './common/NumericInput';

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  onSaveExpense: (expense: ExpenseRecord) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, onSaveExpense }) => {
  // Available months extracted from records (formatted YYYY-MM)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    // Ensure current month is always present
    const current = '2026-09';
    set.add(current);
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New expense form
  const [category, setCategory] = useState<string>('ค่าแก๊ส');
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<number>(500);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CREDIT'>('TRANSFER');
  const [notes, setNotes] = useState<string>('');

  // Standard + dynamically discovered categories
  const allCategories = useMemo(() => {
    const base = [
      'ค่าเช่าที่',
      'ค่าไฟ',
      'ค่าน้ำ',
      'ค่าแก๊ส',
      'ค่าจ้างพนักงาน',
      'บรรจุภัณฑ์',
      'การตลาด',
      'ซ่อมบำรุง',
      'ค่าขนส่ง',
      'ค่าธรรมเนียม',
      'ค่าโทรศัพท์ / Internet',
      'ค่าอุปกรณ์',
      'ค่าใช้จ่ายสำนักงาน',
      'ค่าวัตถุดิบ',
      'เบ็ดเตล็ด',
      'ค่าใช้จ่ายพิเศษ',
    ];
    const set = new Set(base);
    expenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [expenses]);

  // Filter expenses strictly by selected month
  const monthlyExpenses = useMemo(() => {
    if (selectedMonth === 'ALL') return expenses;
    return expenses.filter((e) => e.date && e.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  // Then filter by category
  const filteredExpenses = useMemo(() => {
    if (selectedCategory === 'ALL') return monthlyExpenses;
    return monthlyExpenses.filter((e) => e.category === selectedCategory);
  }, [monthlyExpenses, selectedCategory]);

  const totalSelectedMonthExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Historical Comparison: calculate previous month
  const previousMonthStr = useMemo(() => {
    if (selectedMonth === 'ALL') return '';
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  }, [selectedMonth]);

  const prevMonthExpenses = useMemo(() => {
    if (!previousMonthStr) return [];
    return expenses.filter((e) => e.date && e.date.startsWith(previousMonthStr));
  }, [expenses, previousMonthStr]);

  const totalPrevMonthExpenses = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const monthDifference = totalSelectedMonthExpenses - totalPrevMonthExpenses;
  const percentChange =
    totalPrevMonthExpenses > 0
      ? ((totalSelectedMonthExpenses - totalPrevMonthExpenses) / totalPrevMonthExpenses) * 100
      : 0;

  // Breakdown by category for selected month
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthlyExpenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return map;
  }, [monthlyExpenses]);

  // Breakdown for previous month (for comparison table)
  const prevCategoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    prevMonthExpenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return map;
  }, [prevMonthExpenses]);

  // Categorize into major operational groups
  const rentAndUtilities =
    (categoryTotals.get('ค่าเช่าที่') || 0) +
    (categoryTotals.get('ค่าไฟ') || 0) +
    (categoryTotals.get('ค่าน้ำ') || 0) +
    (categoryTotals.get('ค่าแก๊ส') || 0);
  const laborTotal = categoryTotals.get('ค่าจ้างพนักงาน') || 0;

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = (isCustomCategory ? customCategoryInput.trim() : category) || 'เบ็ดเตล็ด';
    if (amount <= 0 || !description.trim()) return;

    const newExpense: ExpenseRecord = {
      id: `exp_${Date.now()}`,
      date,
      category: finalCategory as ExpenseCategory,
      name: description.trim(),
      description: description.trim(),
      amount,
      paymentMethod,
      notes,
      createdAt: new Date().toISOString(),
    };

    onSaveExpense(newExpense);
    setDescription('');
    setNotes('');
    setCustomCategoryInput('');
    setIsCustomCategory(false);
    setIsModalOpen(false);
  };

  const formatMonthLabel = (m: string) => {
    if (m === 'ALL') return 'ทุกเดือน (All Months)';
    const [year, month] = m.split('-');
    const thaiMonths = [
      'ม.ค.',
      'ก.พ.',
      'มี.ค.',
      'เม.ย.',
      'พ.ค.',
      'มิ.ย.',
      'ก.ค.',
      'ส.ค.',
      'ก.ย.',
      'ต.ค.',
      'พ.ย.',
      'ธ.ค.',
    ];
    const monthName = thaiMonths[parseInt(month, 10) - 1] || month;
    return `${monthName} ${year}`;
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Header & Monthly Selector */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#F27D26]" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Expense Overview (จัดการค่าใช้จ่ายร้าน)
            </h1>
          </div>
          <p className="text-xs text-white/60 mt-0.5">
            สรุปค่าใช้จ่ายดำเนินงาน แยกตามรอบเดือน พร้อมระบบเปรียบเทียบประวัติย้อนหลัง และหมวดหมู่กำหนดเอง
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Monthly Selector Dropdown */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/15 px-3 py-2 rounded-2xl">
            <Calendar className="w-4 h-4 text-[#FFC107]" />
            <span className="text-xs text-white/60 font-semibold">รอบเดือน:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCategory('ALL');
              }}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m} className="bg-[#1a1a1a] text-white">
                  {formatMonthLabel(m)}
                </option>
              ))}
              <option value="ALL" className="bg-[#1a1a1a] text-white">
                ทั้งหมด (ทุกเดือน)
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#d96817] text-black font-bold rounded-xl text-xs shadow-lg shadow-[#F27D26]/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ บันทึกค่าใช้จ่าย</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Month Expenses */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl">
          <span className="text-xs font-bold text-white/50 uppercase block">
            ค่าใช้จ่ายรวม ({formatMonthLabel(selectedMonth)})
          </span>
          <div className="text-2xl font-bold text-[#FFC107] mt-1 font-mono">
            ฿{totalSelectedMonthExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-white/40 mt-1 block">
            {monthlyExpenses.length} รายการในรอบเดือนนี้
          </span>
        </div>

        {/* Rent & Utilities */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl">
          <span className="text-xs font-bold text-white/50 uppercase block">
            ค่าเช่าและสาธารณูปโภค
          </span>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            ฿{rentAndUtilities.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-white/40 mt-1 block">
            เช่า, ไฟ, น้ำ, แก๊ส ({totalSelectedMonthExpenses > 0 ? ((rentAndUtilities / totalSelectedMonthExpenses) * 100).toFixed(1) : 0}%)
          </span>
        </div>

        {/* Labor Costs */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl">
          <span className="text-xs font-bold text-white/50 uppercase block">
            ค่าจ้างพนักงาน (Labor)
          </span>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            ฿{laborTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-white/40 mt-1 block">
            เงินเดือนและเบี้ยเลี้ยง ({totalSelectedMonthExpenses > 0 ? ((laborTotal / totalSelectedMonthExpenses) * 100).toFixed(1) : 0}%)
          </span>
        </div>

        {/* Historical Comparison Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase block">
              เปรียบเทียบเดือนก่อนหน้า
            </span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-white/40" />
          </div>
          <div className="text-xl font-bold text-white mt-1 font-mono flex items-center gap-2">
            {totalPrevMonthExpenses > 0 ? (
              <>
                <span className={percentChange > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {percentChange > 0 ? `+${percentChange.toFixed(1)}%` : `${percentChange.toFixed(1)}%`}
                </span>
                <span className="text-xs font-normal text-white/40">
                  ({percentChange > 0 ? 'เพิ่มขึ้น' : 'ลดลง'})
                </span>
              </>
            ) : (
              <span className="text-xs text-white/40">ไม่มีข้อมูลเดือนก่อน</span>
            )}
          </div>
          <span className="text-xs text-white/40 mt-1 block">
            เดือนก่อนหน้า ({formatMonthLabel(previousMonthStr)}): ฿{totalPrevMonthExpenses.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Historical Comparison Detail Drawer / Box */}
      {previousMonthStr && totalPrevMonthExpenses > 0 && (
        <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/80">
              📊 Historical Comparison: {formatMonthLabel(selectedMonth)} เทียบกับ {formatMonthLabel(previousMonthStr)}
            </span>
            <span className="text-xs font-mono text-white/60">
              ส่วนต่างสุทธิ: {monthDifference >= 0 ? `+฿${monthDifference.toLocaleString()}` : `-฿${Math.abs(monthDifference).toLocaleString()}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Array.from(categoryTotals.entries()).map(([cat, currentVal]) => {
              const prevVal = prevCategoryTotals.get(cat) || 0;
              const diff = currentVal - prevVal;
              return (
                <div
                  key={cat}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2"
                >
                  <span className="font-semibold text-white/70">{cat}:</span>
                  <span className="font-mono text-white font-bold">฿{currentVal.toLocaleString()}</span>
                  {prevVal > 0 && (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        diff > 0 ? 'text-rose-400' : diff < 0 ? 'text-emerald-400' : 'text-white/40'
                      }`}
                    >
                      ({diff > 0 ? `+฿${diff.toLocaleString()}` : diff < 0 ? `-฿${Math.abs(diff).toLocaleString()}` : '0'})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Summary — all categories visible on one page */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">สรุปค่าใช้จ่ายแยกตามหมวดหมู่</h2>
            <p className="text-[10px] text-white/40 mt-0.5">แสดงยอดของทุกหมวดในรอบเดือนที่เลือก โดยไม่ต้องกดเปิดทีละหัวข้อ</p>
          </div>
          <span className="text-xs font-mono font-bold text-[#FFC107]">รวม ฿{totalSelectedMonthExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/45 text-[10px] uppercase">
                <th className="py-2.5 px-4">หมวดหมู่</th>
                <th className="py-2.5 px-3 text-right">จำนวนรายการ</th>
                <th className="py-2.5 px-4 text-right">ยอดค่าใช้จ่าย</th>
                <th className="py-2.5 px-4 text-right">% ของทั้งหมด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                const count = monthlyExpenses.filter((e) => e.category === cat).length;
                const pct = totalSelectedMonthExpenses > 0 ? (total / totalSelectedMonthExpenses) * 100 : 0;
                return (
                  <tr key={cat} className="hover:bg-white/5">
                    <td className="py-2.5 px-4 font-semibold text-white">{cat}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-white/60">{count}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#FFC107]">฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-white/70">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {categoryTotals.size === 0 && (
                <tr><td colSpan={4} className="py-7 text-center text-white/35">ยังไม่มีข้อมูลค่าใช้จ่ายในรอบเดือนนี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-[#F27D26] text-black shadow-md shadow-[#F27D26]/20'
              : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
          }`}
        >
          ทั้งหมด ({monthlyExpenses.length})
        </button>
        {allCategories.map((c) => {
          const count = monthlyExpenses.filter((e) => e.category === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === c
                  ? 'bg-[#F27D26] text-black shadow-md shadow-[#F27D26]/20'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {c} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Expense Table */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <span>รายการค่าใช้จ่ายประจำเดือน ({formatMonthLabel(selectedMonth)})</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
              {filteredExpenses.length} รายการ
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[#FFC107]">
            รวม: ฿{filteredExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white/50 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">วันที่</th>
                <th className="py-3 px-3">หมวดหมู่</th>
                <th className="py-3 px-3">ชื่อ / รายละเอียดค่าใช้จ่าย</th>
                <th className="py-3 px-3">วิธีชำระ</th>
                <th className="py-3 px-4 text-right">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/40 text-xs font-sans">
                    ไม่มีรายการค่าใช้จ่ายในเดือนหรือหมวดหมู่นี้
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-sans text-white/60 font-medium whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3.5 px-3 font-sans">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/10 text-white/80 border border-white/10 whitespace-nowrap">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-sans font-bold text-white">
                      {exp.name || exp.description}
                      {exp.notes && (
                        <span className="block font-normal text-[11px] text-white/40 mt-0.5">
                          {exp.notes}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-sans text-white/60 text-[11px]">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#FFC107] text-sm">
                      ฿{exp.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPENSE MODAL (Supports Custom Categories & Free-text Name) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#1a1a1a]/95 backdrop-blur-2xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/20 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">บันทึกค่าใช้จ่ายดำเนินงาน</h3>
                <p className="text-[11px] text-white/50">
                  รองรับหมวดหมู่มาตรฐานและกำหนดหมวดหมู่ใหม่เอง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 mt-4 text-xs">
              {/* Date */}
              <div>
                <label className="block text-white/70 mb-1 font-semibold">วันที่จ่าย</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl font-mono text-white focus:outline-none focus:border-[#F27D26]"
                />
              </div>

              {/* Category selector + Custom option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-white/70 font-semibold">หมวดหมู่ค่าใช้จ่าย</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-[10px] text-[#F27D26] hover:underline font-bold"
                  >
                    {isCustomCategory ? '← เลือกจากรายการเดิม' : '+ สร้างหมวดหมู่ใหม่เอง'}
                  </button>
                </div>

                {!isCustomCategory ? (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM_NEW') {
                        setIsCustomCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#F27D26]"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c} className="bg-[#1a1a1a]">
                        {c}
                      </option>
                    ))}
                    <option value="CUSTOM_NEW" className="bg-[#1a1a1a] text-[#F27D26]">
                      + หมวดหมู่กำหนดเอง (Custom Category)...
                    </option>
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="เช่น ค่าใช้จ่ายพิเศษ, อุปกรณ์ครัว, ค่าสอบเทียบ"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="w-full p-2.5 bg-black/40 border border-[#F27D26] rounded-xl text-white focus:outline-none"
                  />
                )}
              </div>

              {/* Expense Name / Description (Free-text) */}
              <div>
                <label className="block text-white/70 mb-1 font-semibold">
                  ชื่อ / รายละเอียดค่าใช้จ่าย
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ซ่อมเครื่องดูดควัน, ค่าไฟ ก.ย., ถุงหิ้วใส 10 แพ็ค"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#F27D26]"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-white/70 mb-1 font-semibold">จำนวนเงิน (บาท)</label>
                <div className="relative">
                  <NumericInput
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl font-mono font-bold text-[#FFC107] focus:outline-none focus:border-[#F27D26]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                    บาท
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-white/70 mb-1 font-semibold">วิธีชำระเงิน</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['TRANSFER', 'CASH', 'CREDIT'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-[#F27D26] text-black border-[#F27D26]'
                          : 'bg-black/40 border-white/15 text-white/60 hover:text-white'
                      }`}
                    >
                      {method === 'TRANSFER'
                        ? 'โอนเงิน'
                        : method === 'CASH'
                        ? 'เงินสด'
                        : 'บัตรเครดิต'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-white/70 mb-1 font-semibold">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น เลขที่ใบเสร็จ, ผู้รับเงิน"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-[#F27D26]"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-white font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F27D26] hover:bg-[#d96817] text-black font-bold rounded-xl shadow-lg shadow-[#F27D26]/20 cursor-pointer"
                >
                  บันทึกค่าใช้จ่าย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
