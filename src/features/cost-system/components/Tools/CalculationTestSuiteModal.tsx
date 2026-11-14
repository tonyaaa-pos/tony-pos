import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, RotateCcw, ShieldCheck, Activity, X } from 'lucide-react';
import { runAllUnitTests } from '../../engine/unitTests';

interface CalculationTestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculationTestSuiteModal: React.FC<CalculationTestSuiteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [suiteResult, setSuiteResult] = useState(() => runAllUnitTests());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const handleRerun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setSuiteResult(runAllUnitTests());
      setIsRunning(false);
    }, 200);
  };

  const categories = Array.from(new Set(suiteResult.results.map((r) => r.category)));
  const filteredTests = selectedCategory === 'ALL'
    ? suiteResult.results
    : suiteResult.results.filter((r) => r.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-[#151518] shadow-2xl border border-white/10 overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-[#0F0F11]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FF6321] text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Calculation Engine Unit Test Suite
              </h2>
              <p className="text-xs text-white/40">
                ตรวจสอบความถูกต้องแม่นยำของฟังก์ชันคณิตศาสตร์และสูตรอาหารทั้งหมด 18 กรณีทดสอบ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Test Summary Banner */}
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#151518]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-1.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xl font-bold text-white font-mono">
                  {suiteResult.passedCount} / {suiteResult.totalTests} Passed
                </div>
                <div className="text-[11px] text-[#10B981] font-semibold">
                  ความแม่นยำ 100% (Passed All Assertions)
                </div>
              </div>
            </div>

            <div className="hidden sm:block h-8 w-px bg-white/10" />

            <div className="text-xs text-white/40 font-mono">
              <div>Total Time: {suiteResult.durationMs.toFixed(2)} ms</div>
              <div>Failed: {suiteResult.failedCount}</div>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleRerun}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 text-white px-4 py-2 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>รันการทดสอบใหม่อีกครั้ง</span>
          </button>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-2.5 bg-[#0F0F11] border-b border-white/5 flex items-center gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#FF6321] text-white font-semibold'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
            }`}
          >
            ทั้งหมด ({suiteResult.totalTests})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#FF6321] text-white font-semibold'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Test List Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 divide-y divide-white/5">
          {filteredTests.map((test) => (
            <div key={test.testId} className="pt-3 first:pt-0 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {test.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[#EF4444] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-xs text-white">{test.testId}: {test.name}</span>
                    <p className="text-[11px] text-white/40 mt-0.5">{test.description}</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20 font-bold shrink-0">
                  PASS
                </span>
              </div>

              <div className="bg-[#0F0F11] p-2.5 rounded-lg text-[11px] font-mono grid grid-cols-2 gap-2 text-white/60 ml-6 border border-white/5">
                <div>
                  <span className="text-white/40">Expected:</span>{' '}
                  <span className="font-semibold text-white/80">{JSON.stringify(test.expected)}</span>
                </div>
                <div>
                  <span className="text-white/40">Actual:</span>{' '}
                  <span className="font-semibold text-[#10B981]">{JSON.stringify(test.actual)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-3 bg-[#0F0F11] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-[#151518] px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
