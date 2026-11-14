import React, { useState } from 'react';
import { DollarSign, Percent, ArrowRight, Sparkles, Scale, Smartphone, ShoppingBag } from 'lucide-react';
import { SalesChannel, MenuItem } from '../../types/domain';
import { calculateDeliveryGrossPrice, calculateTargetPriceFromCost } from '../../engine/calculations';
import { NumericInput } from '../common/NumericInput';

interface PricingEngineViewProps {
  channels: SalesChannel[];
  menuItems: MenuItem[];
  activeLanguage: 'th' | 'en';
}

export const PricingEngineView: React.FC<PricingEngineViewProps> = ({
  channels,
  menuItems,
  activeLanguage,
}) => {
  const [costInput, setCostInput] = useState<number>(38.5);
  const [targetFoodCost, setTargetFoodCost] = useState<number>(30);
  const [targetMargin, setTargetMargin] = useState<number>(70);
  const [dineInPrice, setDineInPrice] = useState<number>(120);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[2]?.id || channels[0]?.id || '');

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];

  // Strategy 1: Food Cost Target Method
  const priceByFoodCost = calculateTargetPriceFromCost(costInput, targetFoodCost);
  const marginByFoodCost = priceByFoodCost > 0 ? ((priceByFoodCost - costInput) / priceByFoodCost) * 100 : 0;
  const profitByFoodCost = priceByFoodCost - costInput;

  // Strategy 2: Gross Margin Target Method
  const priceByMargin = targetMargin < 100 ? costInput / (1 - targetMargin / 100) : 0;
  const foodCostByMargin = priceByMargin > 0 ? (costInput / priceByMargin) * 100 : 0;
  const profitByMargin = priceByMargin - costInput;

  // Strategy 3: Delivery Channel Markup (To retain exact same Dine-in net profit)
  const deliveryCommissionPercent = selectedChannel?.commissionPercent || 30;
  const vatOnCommission = selectedChannel?.taxOnCommissionPercent || 7;
  const effectiveGPRate = (deliveryCommissionPercent / 100) * (1 + vatOnCommission / 100);

  // Exact formula to keep dine-in profit: Delivery Price = (Dine-in Price) / (1 - Effective GP Rate)
  const suggestedDeliveryPrice = effectiveGPRate < 1 ? dineInPrice / (1 - effectiveGPRate) : dineInPrice * 1.45;
  const deliveryPlatformDeduction = suggestedDeliveryPrice * effectiveGPRate;
  const netReceivedFromDelivery = suggestedDeliveryPrice - deliveryPlatformDeduction;
  const netProfitOnDelivery = netReceivedFromDelivery - costInput;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-[#151518] border border-white/10 p-6 text-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
              Pricing & Margin Optimizer
            </span>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'เครื่องคำนวณและวางกลยุทธ์ราคาขาย (Pricing Strategy Engine)' : 'Pricing Strategy Engine'}</span>
          </h1>
          <p className="mt-1 text-xs text-white/40">
            {activeLanguage === 'th'
              ? 'เปรียบเทียบกลยุทธ์ตั้งราคาขายหน้าร้าน และคำนวณราคาขายเดลิเวอรี่เพื่อรักษากำไรสุทธิไม่ให้ถูก GP กลืน'
              : 'Compare target food cost vs margin methods, and compute exact delivery markup to protect bottom-line profits.'}
          </p>
        </div>
      </div>

      {/* Top Cost Input Sandbox */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white/70">
            {activeLanguage === 'th' ? 'ต้นทุนอาหารทางตรง + บรรจุภัณฑ์ (Direct Cost ฿):' : 'Direct Food + Packaging Cost:'}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white/40">฿</span>
            <NumericInput
              type="number"
              step="any"
              min="1"
              value={costInput}
              onChange={(e) => setCostInput(parseFloat(e.target.value) || 0)}
              className="w-36 rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-1.5 text-lg font-bold font-mono text-white focus:border-[#FF6321] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">หรือเลือกจากเมนูในร้าน:</span>
          <select
            onChange={(e) => {
              const menu = menuItems.find((m) => m.id === e.target.value);
              if (menu && menu.portions[0]) {
                setCostInput(menu.portions[0].totalDirectCost);
                setDineInPrice(menu.portions[0].sellingPrice);
              }
            }}
            className="rounded-lg border border-white/10 py-1.5 px-3 text-xs bg-[#0F0F11] text-white focus:border-[#FF6321] focus:outline-none"
          >
            <option value="">-- เลือกเมนู --</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.thaiName} (ต้นทุน ฿{m.portions[0]?.totalDirectCost.toFixed(2)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2 Core Dine-In Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Strategy 1: Target Food Cost % */}
        <div className="rounded-xl border border-white/5 bg-[#151518] p-5 space-y-4 text-white">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <Percent className="h-4 w-4 text-[#10B981]" />
              <span>กลยุทธ์ 1: กำหนดจาก % Food Cost</span>
            </div>
            <span className="text-xs font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded">
              Cost-Plus Target
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                เป้าหมาย % Food Cost ที่ต้องการ (%)
              </label>
              <NumericInput
                type="number"
                step="any"
                min="1"
                max="99"
                value={targetFoodCost}
                onChange={(e) => setTargetFoodCost(parseFloat(e.target.value) || 30)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
              <div className="text-xs text-white/40">ราคาขายหน้าร้านที่แนะนำ:</div>
              <div className="text-3xl font-light text-[#10B981] font-mono">
                ฿{Math.round(priceByFoodCost)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-white/10">
                <div>
                  <span className="text-white/40 font-sans">Gross Margin:</span>{' '}
                  <span className="font-bold text-white">{marginByFoodCost.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-white/40 font-sans">กำไรต่อจาน:</span>{' '}
                  <span className="font-bold text-[#10B981]">฿{profitByFoodCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Strategy 2: Target Gross Margin % */}
        <div className="rounded-xl border border-white/5 bg-[#151518] p-5 space-y-4 text-white">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#00B1FF]" />
              <span>กลยุทธ์ 2: กำหนดจาก % Gross Margin</span>
            </div>
            <span className="text-xs font-semibold text-[#00B1FF] bg-[#00B1FF]/10 border border-[#00B1FF]/20 px-2 py-0.5 rounded">
              Margin Target
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                เป้าหมาย % Gross Margin ที่ต้องการ (%)
              </label>
              <NumericInput
                type="number"
                step="any"
                min="1"
                max="99"
                value={targetMargin}
                onChange={(e) => setTargetMargin(parseFloat(e.target.value) || 70)}
                className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
              <div className="text-xs text-white/40">ราคาขายหน้าร้านที่แนะนำ:</div>
              <div className="text-3xl font-light text-[#00B1FF] font-mono">
                ฿{Math.round(priceByMargin)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-white/10">
                <div>
                  <span className="text-white/40 font-sans">% Food Cost:</span>{' '}
                  <span className="font-bold text-white">{foodCostByMargin.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-white/40 font-sans">กำไรต่อจาน:</span>{' '}
                  <span className="font-bold text-[#00B1FF]">฿{profitByMargin.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Markup Protection Calculator */}
      <div className="rounded-xl border border-white/5 bg-[#151518] p-6 space-y-4 text-white">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[#FF6321]" />
            <span>เครื่องคิดเลขบวกราคาขายบนแอปเดลิเวอรี่ (Delivery GP Markup Protection)</span>
          </div>
          <span className="text-xs text-white/40 font-mono">
            Price / (1 - GP Rate with VAT)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">ราคาขายหน้าร้าน (Dine-in Price ฿)</label>
            <NumericInput
              type="number"
              step="any"
              min="1"
              value={dineInPrice}
              onChange={(e) => setDineInPrice(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-sm font-mono font-bold text-white focus:border-[#FF6321] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">เลือกช่องทางเดลิเวอรี่</label>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0F0F11] px-3 py-2 text-xs text-white focus:border-[#FF6321] focus:outline-none font-medium"
            >
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} (GP {ch.commissionPercent}% + VAT {ch.taxOnCommissionPercent}%)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
            <div className="text-[11px] text-white/60 font-semibold">ราคาที่ต้องตั้งบนแอปเดลิเวอรี่:</div>
            <div className="text-2xl font-light text-[#10B981] font-mono mt-0.5">
              ฿{Math.ceil(suggestedDeliveryPrice)}
            </div>
            <div className="text-[11px] text-white/40 mt-1">
              หัก GP แล้วร้านจะได้รับสุทธิ ฿{netReceivedFromDelivery.toFixed(2)} (กำไร ฿{netProfitOnDelivery.toFixed(2)})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
