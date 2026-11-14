import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Smartphone, DollarSign, Percent, Check, X } from 'lucide-react';
import { SalesChannel } from '../../types/domain';
import { calculateChannelNetRevenue } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface SalesChannelsViewProps {
  channels: SalesChannel[];
  onSaveChannel: (channel: SalesChannel) => void;
  onDeleteChannel: (id: string) => void;
  activeLanguage: 'th' | 'en';
}

export const SalesChannelsView: React.FC<SalesChannelsViewProps> = ({
  channels,
  onSaveChannel,
  onDeleteChannel,
  activeLanguage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null);
  const [testOrderAmount, setTestOrderAmount] = useState<number>(300);

  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    commissionPercent: number;
    taxOnCommissionPercent: number;
    paymentFeePercent: number;
    fixedFeePerOrder: number;
    notes: string;
  }>({
    code: `CH-${String(channels.length + 1).padStart(2, '0')}`,
    name: '',
    commissionPercent: 30,
    taxOnCommissionPercent: 7,
    paymentFeePercent: 0,
    fixedFeePerOrder: 0,
    notes: '',
  });

  const handleOpenAdd = () => {
    setEditingChannel(null);
    setFormData({
      code: `CH-${String(channels.length + 1).padStart(2, '0')}`,
      name: '',
      commissionPercent: 30,
      taxOnCommissionPercent: 7,
      paymentFeePercent: 0,
      fixedFeePerOrder: 0,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ch: SalesChannel) => {
    setEditingChannel(ch);
    setFormData({
      code: ch.code,
      name: ch.name,
      commissionPercent: ch.commissionPercent,
      taxOnCommissionPercent: ch.taxOnCommissionPercent,
      paymentFeePercent: ch.paymentFeePercent,
      fixedFeePerOrder: ch.fixedFeePerOrder,
      notes: ch.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newChannel: SalesChannel = {
      id: editingChannel ? editingChannel.id : `ch-${Date.now()}`,
      code: formData.code,
      name: formData.name,
      commissionPercent: formData.commissionPercent,
      taxOnCommissionPercent: formData.taxOnCommissionPercent,
      paymentFeePercent: formData.paymentFeePercent,
      fixedFeePerOrder: formData.fixedFeePerOrder,
      packagingFeeSurcharge: 0,
      active: true,
      notes: formData.notes,
    };

    onSaveChannel(newChannel);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00B1FF] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00B1FF]">
              Delivery GP & Channel Economics
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'ช่องทางขาย & ค่าธรรมเนียม GP (Sales Channels & GP)' : 'Sales Channels & Platform GP'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'ตั้งค่าเปอร์เซ็นต์ GP, VAT บน GP และค่าธรรมเนียมของแต่ละแอป เพื่อคำนวณรายรับสุทธิที่แท้จริง'
              : 'Configure platform commission GP, 7% VAT on GP, and payment fees for accurate payout calculation.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{activeLanguage === 'th' ? 'เพิ่มช่องทางขาย' : 'Add Channel'}</span>
        </button>
      </div>

      {/* Interactive Simulation Sandbox */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#10B981]" />
            <span>จำลองการหักค่า GP และเงินโอนเข้าบัญชีร้าน (Payout Simulation)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/60">ยอดขายทดสอบต่อออเดอร์:</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">฿</span>
              <NumericInput
                type="number"
                min="10"
                value={testOrderAmount}
                onChange={(e) => setTestOrderAmount(parseFloat(e.target.value) || 0)}
                className="w-24 rounded-lg border border-white/10 bg-[#0F0F11] px-2 py-1 text-xs font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Channels Simulation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map((ch) => {
            const payout = calculateChannelNetRevenue(
              testOrderAmount,
              ch.commissionPercent,
              ch.taxOnCommissionPercent,
              ch.paymentFeePercent,
              ch.fixedFeePerOrder
            );

            return (
              <div
                key={ch.id}
                className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2.5 flex flex-col justify-between hover:border-white/15 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{ch.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ch)}
                        className="p-1 text-white/40 hover:text-white rounded cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteChannel(ch.id)}
                        className="p-1 text-white/30 hover:text-[#EF4444] rounded cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-white/40 mt-1">
                    GP {ch.commissionPercent}% (VAT {ch.taxOnCommissionPercent}%)
                    {ch.paymentFeePercent > 0 && ` + Pay ${ch.paymentFeePercent}%`}
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-white/10 text-xs font-mono">
                  <div className="flex justify-between text-white/50 text-[11px]">
                    <span>หัก GP + VAT:</span>
                    <span className="text-[#EF4444] font-bold">-฿{payout.commissionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold pt-1 border-t border-white/10">
                    <span className="font-sans text-xs">เงินสุทธิเข้าบัญชี:</span>
                    <span className="text-[#10B981] text-sm">฿{payout.netPayout.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-white/30 text-right font-sans">
                    ({payout.effectiveDeductionPercent.toFixed(1)}% ถูกหัก)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-[#151518] p-6 border border-white/10 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-white">
                {editingChannel ? 'แก้ไขช่องทางขาย' : 'เพิ่มช่องทางขายใหม่'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs text-white/60 mb-1">ชื่อช่องทางขาย *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น GrabFood, LINE MAN, หน้าร้าน"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-[#FF6321] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ค่าคอมมิชชั่น GP (%)</label>
                  <NumericInput
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">VAT บน GP (%)</label>
                  <NumericInput
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={formData.taxOnCommissionPercent}
                    onChange={(e) => setFormData({ ...formData, taxOnCommissionPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">ค่าชำระเงิน (%)</label>
                  <NumericInput
                    type="number"
                    step="any"
                    min="0"
                    value={formData.paymentFeePercent}
                    onChange={(e) => setFormData({ ...formData, paymentFeePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">ค่าธรรมเนียมคงที่ (฿/order)</label>
                  <NumericInput
                    type="number"
                    step="any"
                    min="0"
                    value={formData.fixedFeePerOrder}
                    onChange={(e) => setFormData({ ...formData, fixedFeePerOrder: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FF6321] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 px-5 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  บันทึกช่องทาง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
