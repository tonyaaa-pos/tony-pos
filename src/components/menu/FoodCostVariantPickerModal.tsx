import React, { useState, useEffect } from 'react';
import { Calculator, Check, Plus, RefreshCw, AlertCircle, Link2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  getCachedCostBundle,
  fetchRemoteCostManagementStatus,
  getVariantRecipeCost,
  getVariantSellingPrice,
  type TonysKitchenMenu,
  type TonysKitchenVariant,
  type TonysKitchenPayload,
} from '../../services/costSyncService';
import { ItemVariantOption } from '../../types';
import { formatBaht } from '../../utils/formatters';
import { translateThaiToEnglishFast } from '../../utils/thaiToEnglishTranslator';
import { soundService } from '../../utils/audio';

interface FoodCostVariantPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCostMenuId?: string;
  onSelectCostMenuId?: (costMenuId: string, costMenuName: string, costMenu?: TonysKitchenMenu) => void;
  existingVariants: ItemVariantOption[];
  onPickVariant: (variant: ItemVariantOption) => void;
  onPickAllVariants?: (menu: TonysKitchenMenu) => void;
  onAddCustomVariant: () => void;
}

export const FoodCostVariantPickerModal: React.FC<FoodCostVariantPickerModalProps> = ({
  isOpen,
  onClose,
  selectedCostMenuId,
  onSelectCostMenuId,
  existingVariants,
  onPickVariant,
  onPickAllVariants,
  onAddCustomVariant,
}) => {
  const [costBundle, setCostBundle] = useState<TonysKitchenPayload>(() => getCachedCostBundle());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const costMenus: TonysKitchenMenu[] = costBundle?.payload?.menus || [];
  const targetFoodCostPct = costBundle?.payload?.settings?.targetFoodCostPercent ?? 35;

  const activeCostMenu =
    costMenus.find((m) => m.id === selectedCostMenuId) || undefined;

  useEffect(() => {
    if (!isOpen) return;
    setCostBundle(getCachedCostBundle());
    setRefreshMessage(null);

    // Refresh silently from Firestore if user is signed in
    let active = true;
    (async () => {
      try {
        const res = await fetchRemoteCostManagementStatus();
        if (active && res.status === 'found' && res.data) {
          setCostBundle(res.data);
        }
      } catch {
        // Keep cached data silently
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleRefreshCloud = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetchRemoteCostManagementStatus();
      if (res.status === 'found' && res.data) {
        setCostBundle(res.data);
        setRefreshMessage('ดึงข้อมูลต้นทุนล่าสุดจาก Cloud Firestore เรียบร้อยแล้ว');
      } else if (res.status === 'not_signed_in') {
        setRefreshMessage('ใช้ข้อมูลต้นทุนในเครื่อง (เข้าสู่ระบบ Google เพื่อดึงข้อมูลล่าสุดจาก Cloud)');
      } else {
        setRefreshMessage('ใช้ข้อมูลต้นทุนล่าสุดที่บันทึกไว้ในระบบแล้ว');
      }
      soundService.playTap();
    } catch (err: unknown) {
      setRefreshMessage(err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลจาก Cloud ได้');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectCostVariant = (menu: TonysKitchenMenu, costVar: TonysKitchenVariant) => {
    const varName = (costVar.name || costVar.variantName || menu.name || '').trim();
    const translatedEn = translateThaiToEnglishFast(varName);
    const nameEn = translatedEn && !/[\u0E00-\u0E7F]/.test(translatedEn) ? translatedEn : '';
    const recipeCost = getVariantRecipeCost(costVar);
    const bundleSellingPrice = getVariantSellingPrice(costVar);
    const existingMatch = existingVariants.find(
      (ev) =>
        ev.costVariantId === costVar.id ||
        ev.name.trim().toLowerCase() === varName.toLowerCase()
    );
    const sellingPrice =
      existingMatch && existingMatch.price > 0
        ? existingMatch.price
        : bundleSellingPrice > 0
        ? bundleSellingPrice
        : existingVariants[0]?.price || 80;

    const newVariant: ItemVariantOption = {
      id: existingMatch?.id || 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: varName,
      nameEn: existingMatch?.nameEn || nameEn,
      price: sellingPrice,
      cost: recipeCost,
      isAvailable: existingMatch ? existingMatch.isAvailable : true,
      isSoldOut: existingMatch?.isSoldOut || false,
      costMenuId: menu.id,
      costVariantId: costVar.id,
      costVariantName: varName,
      priceUpdatedAt: existingMatch?.priceUpdatedAt,
    };

    soundService.playSuccessTap();
    onPickVariant(newVariant);
    onClose();
  };

  if (!isOpen) return null;

  const variantsForSelectedMenu = activeCostMenu?.variants || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Food Cost System (หลักสากล) — เลือกตัวเลือกเนื้อสัตว์"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onAddCustomVariant();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มตัวเลือกกำหนดเอง (ไม่ผูกสูตร)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Connected Food Cost Header */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                เชื่อมข้อมูลต้นทุนอัตโนมัติ (Food Cost System)
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {activeCostMenu
                  ? `แสดงเฉพาะตัวเลือกของเมนู: ${activeCostMenu.name}`
                  : 'กรุณาเลือกรายการเมนูอาหารเพื่อกรองเฉพาะตัวเลือกของเมนูนั้น'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshCloud}
            disabled={isRefreshing}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-amber-400 transition flex items-center gap-1 shrink-0 cursor-pointer"
            title="อัปเดตข้อมูลล่าสุดจาก Cloud Firestore"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>ซิงค์ล่าสุด</span>
          </button>
        </div>

        {refreshMessage && (
          <div className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {refreshMessage}
          </div>
        )}

        {/* Menu Filter Dropdown (synced with parent form) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            รายการเมนูอาหารที่เชื่อมโยง
          </label>
          <select
            value={activeCostMenu?.id || ''}
            onChange={(e) => {
              const chosen = costMenus.find((m) => m.id === e.target.value);
              if (onSelectCostMenuId) {
                onSelectCostMenuId(chosen?.id || '', chosen?.name || '', chosen);
              }
              soundService.playTap();
            }}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="">-- เลือกรายการเมนูอาหาร (จากแอปคำนวณต้นทุน) --</option>
            {costMenus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.variants?.length || 0} ตัวเลือก)
              </option>
            ))}
          </select>
          {activeCostMenu && variantsForSelectedMenu.length > 0 && onPickAllVariants && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onPickAllVariants(activeCostMenu);
                  soundService.playSuccessTap();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่ม/ซิงค์ทุกตัวเลือกของเมนูนี้ ({variantsForSelectedMenu.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Strictly filtered list of variants for THIS menu only (NO ingredients card per requirement #3) */}
        {!activeCostMenu ? (
          <div className="p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
            <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              กรุณาเลือกรายการเมนูอาหารด้านบนก่อน
            </p>
            <p className="text-[11px] text-slate-400">
              ระบบจะแสดงเฉพาะตัวเลือกเนื้อสัตว์ที่สร้างไว้ในเมนูนั้น พร้อมดึงราคาและต้นทุนวัตถุดิบให้อัตโนมัติ
            </p>
          </div>
        ) : variantsForSelectedMenu.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              เมนู &ldquo;{activeCostMenu.name}&rdquo; ยังไม่มีตัวเลือกย่อยในแอปคำนวณต้นทุน
            </p>
            <p className="text-[11px] text-slate-400">
              สามารถกดปุ่ม &ldquo;เพิ่มตัวเลือกกำหนดเอง&rdquo; ด้านล่างได้ทันที
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {variantsForSelectedMenu.map((cv) => {
              const varName = (cv.name || cv.variantName || activeCostMenu.name).trim();
              const existingMatch = existingVariants.find(
                (ev) =>
                  ev.costVariantId === cv.id ||
                  ev.name.trim().toLowerCase() === varName.toLowerCase()
              );
              const sellPrice =
                existingMatch && existingMatch.price > 0
                  ? existingMatch.price
                  : getVariantSellingPrice(cv);
              const recipeCost = getVariantRecipeCost(cv);
              const profit = sellPrice - recipeCost;
              const fcPct = sellPrice > 0 ? (recipeCost / sellPrice) * 100 : 0;
              const isAlreadyAdded = Boolean(existingMatch);

              return (
                <button
                  key={cv.id}
                  type="button"
                  onClick={() => handleSelectCostVariant(activeCostMenu, cv)}
                  className={`w-full text-left p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    isAlreadyAdded
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/30 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {varName}
                      </span>
                      {isAlreadyAdded && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          <Check className="w-2.5 h-2.5" />
                          <span>เพิ่มแล้ว</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>
                        ต้นทุน: <strong className="text-rose-500">{formatBaht(recipeCost)}</strong>
                      </span>
                      <span>
                        กำไร/จาน:{' '}
                        <strong className={profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                          {profit >= 0 ? '+' : ''}
                          {formatBaht(profit)}
                        </strong>
                      </span>
                      <span className={fcPct <= targetFoodCostPct ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                        FC {fcPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                        {formatBaht(sellPrice)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-end gap-0.5">
                        <Link2 className="w-2.5 h-2.5" />
                        <span>ใช้ข้อมูลนี้</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
