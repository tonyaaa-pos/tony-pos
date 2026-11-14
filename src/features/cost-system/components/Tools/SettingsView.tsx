import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Building2, Percent, Check } from 'lucide-react';
import { BusinessSettings } from '../../types/domain';

interface SettingsViewProps {
  settings: BusinessSettings;
  onSaveSettings: (settings: BusinessSettings) => void;
  onResetToDefaults: () => void;
  activeLanguage: 'th' | 'en';
  onLanguageChange: (lang: 'th' | 'en') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetToDefaults,
  activeLanguage,
  onLanguageChange,
}) => {
  const [formData, setFormData] = useState<BusinessSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF6321] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF6321]">
              System Configuration & Targets
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#FF6321]" />
            <span>{activeLanguage === 'th' ? 'ตั้งค่าระบบและเป้าหมายทางการเงิน (System Settings)' : 'System Settings & Targets'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'กำหนดเป้าหมาย % Food Cost, Prime Cost, อัตราภาษี และภาษาหลักของระบบ'
              : 'Configure restaurant baseline targets, tax rates, operating days, and localization.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Restaurant Profile */}
        <div className="rounded-xl border border-white/5 bg-[#151518] p-6 text-white space-y-4">
          <h2 className="text-sm font-semibold text-white border-b border-white/5 pb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#FF6321]" />
            <span>ข้อมูลกิจการร้านอาหาร (Restaurant Profile)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">ชื่อร้านอาหาร *</label>
              <input
                type="text"
                required
                value={formData.restaurantName}
                onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">สกุลเงินที่แสดง</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Cost & Profit Targets */}
        <div className="rounded-xl border border-white/5 bg-[#151518] p-6 text-white space-y-4">
          <h2 className="text-sm font-semibold text-white border-b border-white/5 pb-3 flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#00B1FF]" />
            <span>เป้าหมายอัตราส่วนต้นทุน & ภาษี (Financial Targets & Ratios)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">
                เป้าหมาย Food Cost (%)
              </label>
              <input
                type="number"
                step="any"
                min="5"
                max="80"
                value={formData.targetFoodCostPercent}
                onChange={(e) => setFormData({ ...formData, targetFoodCostPercent: parseFloat(e.target.value) || 30 })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
              <p className="text-[10px] text-white/30 mt-1">ค่ามาตรฐานร้านอาหาร 28% - 35%</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">
                เป้าหมาย Prime Cost (%)
              </label>
              <input
                type="number"
                step="any"
                min="20"
                max="85"
                value={formData.primeCostTargetPercent}
                onChange={(e) => setFormData({ ...formData, primeCostTargetPercent: parseFloat(e.target.value) || 55 })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-mono font-bold text-[#FF6321] focus:border-[#FF6321] focus:outline-none"
              />
              <p className="text-[10px] text-white/30 mt-1">COGS + ค่าแรงครัว (เป้าหมาย &lt; 55-60%)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">
                จำนวนวันทำการต่อเดือน (วัน)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.operatingDaysPerMonth}
                onChange={(e) => setFormData({ ...formData, operatingDaysPerMonth: parseInt(e.target.value) || 26 })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
              />
              <p className="text-[10px] text-white/30 mt-1">ใช้คำนวณจุดคุ้มทุนรายวัน</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">
                อัตรา VAT (%)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max="20"
                value={formData.vatRatePercent ?? 7}
                onChange={(e) => setFormData({ ...formData, vatRatePercent: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
              />
              <p className="text-[10px] text-white/30 mt-1">ใช้คำนวณราคาขายสุทธิ (ex-VAT) และค่า GP</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">
                อัตราภาษีเงินได้ (ประมาณการ) (%)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max="50"
                value={formData.incomeTaxRatePercent ?? 20}
                onChange={(e) => setFormData({ ...formData, incomeTaxRatePercent: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
              />
              <p className="text-[10px] text-white/30 mt-1">
                ตัวเลขนี้เป็นการประมาณการเพื่อดูภาพรวม ไม่ใช่ตัวเลขสำหรับยื่นภาษี กรุณาปรึกษานักบัญชี
              </p>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-white/60 mb-1">ภาษาหลักของระบบ (Language)</label>
            <select
              value={activeLanguage}
              onChange={(e) => onLanguageChange(e.target.value as 'th' | 'en')}
              className="w-full sm:w-1/2 rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs font-medium text-white focus:border-[#FF6321] focus:outline-none"
            >
              <option value="th">ภาษาไทย (Thai - Primary)</option>
              <option value="en">English (Secondary)</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onResetToDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น (Reset Sample Data)</span>
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-lg border border-[#10B981]/20">
                <Check className="h-3.5 w-3.5" /> บันทึกการตั้งค่าสำเร็จ
              </span>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-6 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
