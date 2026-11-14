import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react';
import { parseIngredientsFromCSV } from '../../data/excelMapper';
import { Ingredient } from '../../types/domain';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportIngredients: (imported: Partial<Ingredient>[]) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportIngredients,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Partial<Ingredient>[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseIngredientsFromCSV(text);
        if (result.length === 0) {
          setErrorMsg('ไม่พบข้อมูลที่ถูกต้องในไฟล์ กรุณาตรวจสอบหัวตาราง (Header)');
        } else {
          setParsedRows(result);
          setStep('preview');
        }
      } catch (err: any) {
        setErrorMsg(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    onImportIngredients(parsedRows);
    setStep('success');
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-xl bg-[#151518] shadow-2xl border border-white/10 overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 bg-[#0F0F11]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FF6321] text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                นำเข้าข้อมูลจาก Excel / CSV (Import Excel)
              </h2>
              <p className="text-xs text-white/40">
                อัปโหลดไฟล์สเปรดชีตวัตถุดิบเดิมของคุณเพื่อนำเข้าสู่ระบบอัตโนมัติ
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

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border border-dashed border-white/15 hover:border-[#FF6321] rounded-xl p-8 text-center transition-all bg-[#0F0F11]">
                <Upload className="h-8 w-8 text-white/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">
                  ลากไฟล์ .csv หรือคลิกเพื่อเลือกไฟล์
                </p>
                <p className="text-xs text-white/40 mt-1">
                  รองรับไฟล์ CSV / Excel จากตารางเดิม (คอลัมน์: รหัส, ชื่อ, ราคาซื้อ, หน่วย, Yield%)
                </p>

                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="mt-4 block w-full text-xs text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#FF6321] file:text-white hover:file:bg-[#FF6321]/90 cursor-pointer"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-xs flex items-center gap-2 border border-[#EF4444]/20">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  ตรวจสอบข้อมูลตัวอย่าง ({parsedRows.length} รายการที่พบจากไฟล์ {fileName})
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-white/40 hover:text-white underline cursor-pointer"
                >
                  เลือกไฟล์ใหม่
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/10 text-white/60 font-medium sticky top-0">
                    <tr>
                      <th className="p-2.5">รหัส</th>
                      <th className="p-2.5">ชื่อวัตถุดิบ</th>
                      <th className="p-2.5 text-right">ราคาซื้อ (฿)</th>
                      <th className="p-2.5">หน่วย</th>
                      <th className="p-2.5 text-right">Yield %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-white/70">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-2.5 text-white/40">{r.code || '-'}</td>
                        <td className="p-2.5 font-sans font-medium text-white">{r.thaiName}</td>
                        <td className="p-2.5 text-right text-white">฿{r.purchasePrice}</td>
                        <td className="p-2.5 font-sans text-white/60">{r.purchaseUnit}</td>
                        <td className="p-2.5 text-right text-[#10B981] font-bold">{r.yieldPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>ยืนยันการนำเข้าข้อมูล</span>
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6 space-y-3">
              <div className="inline-flex p-3 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-white">
                นำเข้าข้อมูลสำเร็จเรียบร้อย!
              </h3>
              <p className="text-xs text-white/40">
                ข้อมูลวัตถุดิบจำนวน {parsedRows.length} รายการถูกเพิ่มเข้าสู่ระบบและคำนวณต้นทุนใหม่อัตโนมัติแล้ว
              </p>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-6 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  เสร็จสิ้นและกลับสู่หน้าหลัก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
