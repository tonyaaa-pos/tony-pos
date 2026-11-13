import React, { useState, useEffect } from 'react';
import {
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Upload,
  RefreshCw,
  Sparkles,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  Bike,
  Package,
  Store,
  Users,
  Building,
  Zap,
  Cloud,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { usePOS } from '../../context/POSContext';
import {
  parseCostAndProfitPayload,
  applyCostDataToPOS,
  TONYS_KITCHEN_SAMPLE_DATA,
  getCachedCostBundle,
  COST_BUNDLE_UPDATED_EVENT,
  fetchRemoteCostManagementStatus,
  saveCostBundleToFirestore,
  subscribeCostManagementData,
  calculateFixedMonthlyOpEx,
  type TonysKitchenPayload,
  type CostSyncSummary,
} from '../../services/costSyncService';
import { isFirebaseConfigured, getFriendlyAuthErrorMessage } from '../../services/firebase';
import { formatBaht } from '../../utils/formatters';
import { soundService } from '../../utils/audio';

interface CostProfitSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: (summary: CostSyncSummary) => void;
}

export const CostProfitSyncModal: React.FC<CostProfitSyncModalProps> = ({
  isOpen,
  onClose,
  onApplied,
}) => {
  const { menuItems, updateMenuItem, updateSettings, cloudUser, loginCloudWithGoogle } = usePOS();

  const [activeTab, setActiveTab] = useState<'overview' | 'sync' | 'recipes' | 'expenses'>('overview');
  const [payload, setPayload] = useState<TonysKitchenPayload>(() => getCachedCostBundle() || TONYS_KITCHEN_SAMPLE_DATA);
  const [jsonInput, setJsonInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [syncResult, setSyncResult] = useState<CostSyncSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cloudNotice, setCloudNotice] = useState<{
    type: 'needs_auth' | 'not_found' | 'cloud_saved';
    message: string;
    docPath?: string;
  } | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [autoSyncCloud, setAutoSyncCloud] = useState(true);

  // Calculated OpEx from current payload
  const currentOpEx = calculateFixedMonthlyOpEx(payload);
  const settings = payload.payload?.settings || {};
  const menus = payload.payload?.menus || [];
  const employees = payload.payload?.employees || [];

  // Keep payload synced with latest cache & COST_BUNDLE_UPDATED_EVENT when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setPayload(getCachedCostBundle());
    const handleUpdate = () => setPayload(getCachedCostBundle());
    window.addEventListener(COST_BUNDLE_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(COST_BUNDLE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isOpen]);

  // Listen to remote Firestore cost document when authenticated and live sync is enabled
  useEffect(() => {
    if (!isOpen || !autoSyncCloud || !isFirebaseConfigured() || !cloudUser) return;

    const unsub = subscribeCostManagementData(
      (remoteData) => {
        if (remoteData) {
          setPayload(remoteData);
          setCloudNotice(null);
        }
      },
      (err) => {
        setErrorMsg('เกิดข้อผิดพลาดในการซิงค์ Real-time: ' + err.message);
      }
    );

    return () => {
      if (unsub) unsub();
    };
  }, [isOpen, autoSyncCloud, cloudUser]);

  const handleApplyData = async (dataToApply: TonysKitchenPayload) => {
    setIsApplying(true);
    setErrorMsg(null);
    setCloudNotice(null);
    try {
      const summary = await applyCostDataToPOS(
        dataToApply,
        menuItems,
        updateMenuItem,
        updateSettings
      );
      setSyncResult(summary);
      soundService.playSuccessTap();
      if (onApplied) onApplied(summary);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล');
    } finally {
      setIsApplying(false);
    }
  };

  const handleParseAndApplyJson = () => {
    if (!jsonInput.trim()) {
      setErrorMsg('กรุณาวางข้อมูล JSON หรือเลือกโหลดข้อมูลตัวอย่าง');
      return;
    }
    try {
      const parsed = parseCostAndProfitPayload(jsonInput.trim());
      setPayload(parsed);
      handleApplyData(parsed);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'รูปแบบ JSON ไม่ถูกต้อง');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCostAndProfitPayload(text);
        setPayload(parsed);
        setJsonInput(text);
        setErrorMsg(null);
        setCloudNotice(null);
      } catch (err: unknown) {
        setErrorMsg('ไม่สามารถอ่านไฟล์ JSON ได้: ' + (err instanceof Error ? err.message : ''));
      }
    };
    reader.readAsText(file);
  };

  const handleSignInGoogle = async () => {
    setIsSigningInGoogle(true);
    setErrorMsg(null);
    setCloudNotice(null);
    try {
      await loginCloudWithGoogle();
      soundService.playSuccessTap();
    } catch (err: unknown) {
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleUploadToFirestore = async (dataToUpload: TonysKitchenPayload = payload) => {
    setRemoteLoading(true);
    setErrorMsg(null);
    setCloudNotice(null);
    try {
      const res = await saveCostBundleToFirestore(dataToUpload);
      if (!res.savedToCloud) {
        if (res.reason === 'not_signed_in') {
          setCloudNotice({
            type: 'needs_auth',
            message: 'กรุณาเข้าสู่ระบบด้วย Google ก่อนบันทึกข้อมูลขึ้น Cloud Firestore',
          });
        } else {
          setErrorMsg('ระบบ Firebase Firestore ยังไม่ได้ตั้งค่าในโปรเจกต์');
        }
        return;
      }
      await handleApplyData(dataToUpload);
      setCloudNotice({
        type: 'cloud_saved',
        message: `บันทึกข้อมูลต้นทุนขึ้น Cloud Firestore และปรับใช้กับ POS เรียบร้อยแล้ว`,
        docPath: res.docPath,
      });
    } catch (err: unknown) {
      setErrorMsg('เกิดข้อผิดพลาดในการบันทึกข้อมูลขึ้น Cloud Firestore: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleFetchFromFirestore = async () => {
    setRemoteLoading(true);
    setErrorMsg(null);
    setCloudNotice(null);
    try {
      const result = await fetchRemoteCostManagementStatus();
      if (result.status === 'not_configured') {
        setErrorMsg('ระบบ Firebase Firestore ยังไม่ได้ตั้งค่าในไฟล์ firebase-applet-config.json');
        return;
      }
      if (result.status === 'not_signed_in') {
        setCloudNotice({
          type: 'needs_auth',
          message: 'ยังไม่ได้เข้าสู่ระบบด้วย Google จึงไม่สามารถอ่านข้อมูลส่วนตัวจาก Firestore ได้ (กฎความปลอดภัยอนุญาตเฉพาะเจ้าของบัญชี)',
        });
        return;
      }
      if (result.status === 'not_found' || !result.data) {
        setCloudNotice({
          type: 'not_found',
          message: `เชื่อมต่อบัญชี Google สำเร็จแล้ว แต่ยังไม่มีเอกสารต้นทุนใน Cloud Firestore ที่เส้นทางนี้ (อาจเป็นเพราะยังไม่ได้กดส่งข้อมูลขึ้น Cloud จากแอป Cost & Profit หรือยังไม่เคยบันทึกจาก POS)`,
          docPath: result.docPath,
        });
        return;
      }

      setPayload(result.data);
      await handleApplyData(result.data);
    } catch (err: unknown) {
      setErrorMsg('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud Firestore: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setRemoteLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="เชื่อมต่อระบบคำนวณต้นทุน & กำไร (Cost & Profit Integration)" maxWidth="max-w-4xl">
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-emerald-500/15 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-xs">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  เชื่อมต่อ Tony's Kitchen Cost Management
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  v1.1.0 JSON & Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                นำต้นทุนสูตรอาหาร (COGS), ค่า GP เดลิเวอรี (37%), ค่ากล่อง (8฿) และต้นทุนคงที่ (80,760฿/ด.) มาคำนวณกำไรสุทธิแท้จริงใน POS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleApplyData(TONYS_KITCHEN_SAMPLE_DATA)}
            disabled={isApplying}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black transition shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isApplying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 fill-current" />
            )}
            <span>กดซิงค์ข้อมูล Tony's Kitchen ทันที</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold overflow-x-auto">
          {[
            { id: 'overview', label: '📌 ภาพรวม & แผนผังการเชื่อมต่อ', icon: Layers },
            { id: 'sync', label: '⚡ นำเข้า & ซิงค์ข้อมูล', icon: RefreshCw },
            { id: 'recipes', label: `🍲 สูตรอาหาร & ต้นทุน (${menus.length} เมนู)`, icon: Calculator },
            { id: 'expenses', label: `🏢 ต้นทุนดำเนินงาน (${formatBaht(currentOpEx.total)}/ด.)`, icon: Building },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id as typeof activeTab);
                soundService.playTap();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Notification / Feedback Alerts */}
        {syncResult && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>ซิงค์ข้อมูลต้นทุนและค่าใช้จ่ายดำเนินงานสำเร็จ!</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              ร้าน: <strong>{syncResult.restaurantName}</strong> | จับคู่ต้นทุนอาหาร {syncResult.matchedDishesCount} เมนู ({syncResult.updatedVariantsCount} ตัวเลือก) | GP เดลิเวอรี Grab/LINE MAN: {syncResult.deliveryGpRates.grab}% | ค่าใช้จ่ายคงที่รายเดือน: {formatBaht(syncResult.monthlyFixedOpEx.total)}/เดือน
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              {syncResult.savedToCloud
                ? `☁️ อัปเดตขึ้น Cloud Firestore แล้ว (${syncResult.cloudPath})`
                : '💾 บันทึกลงเครื่องเรียบร้อยแล้ว (หากต้องการซิงค์ขึ้น Cloud ให้เข้าสู่ระบบด้วย Google)'}
            </p>
          </div>
        )}

        {cloudNotice && cloudNotice.type === 'needs_auth' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">ยังไม่ได้เข้าสู่ระบบบัญชี Google / Cloud</div>
                <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  {cloudNotice.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSignInGoogle}
                disabled={isSigningInGoogle}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSigningInGoogle ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google ทันที'}</span>
              </button>
            </div>
          </div>
        )}

        {cloudNotice && cloudNotice.type === 'not_found' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">ยังไม่มีข้อมูลต้นทุนบน Cloud Firestore ในบัญชีนี้</div>
                <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  {cloudNotice.message}
                </p>
                {cloudNotice.docPath && (
                  <div className="font-mono text-[11px] bg-amber-500/10 px-2.5 py-1 rounded-lg inline-block">
                    เส้นทาง: {cloudNotice.docPath}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleUploadToFirestore(payload)}
                disabled={remoteLoading || isApplying}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>อัปโหลดข้อมูล Tony&apos;s Kitchen ขึ้น Firestore ทันที</span>
              </button>
            </div>
          </div>
        )}

        {cloudNotice && cloudNotice.type === 'cloud_saved' && (
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
            <Cloud className="w-4 h-4 shrink-0" />
            <span>
              {cloudNotice.message} {cloudNotice.docPath ? `(${cloudNotice.docPath})` : ''}
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW & ARCHITECTURE */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                  <Calculator className="w-4 h-4" />
                  <span>1. ต้นทุนอาหารรายจาน (COGS)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  นำค่า <code>recipeCost</code> จากสูตรอาหารและวัตถุดิบ (เช่น กะเพราหมูหมัก 34.20฿, กะเพราไก่ 28.50฿, ข้าวผัดกุ้ง 39.90฿) ไปผูกกับเมนูใน POS เพื่อคำนวณต้นทุนอาหารแท้จริงในแดชบอร์ด
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                  <Bike className="w-4 h-4" />
                  <span>2. ค่า GP เดลิเวอรี & กล่อง</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  นำค่า GP GrabFood ({settings.grabFoodCommissionPercent ?? 37}%), LINE MAN ({settings.lineManCommissionPercent ?? 37}%) และค่ากล่องบรรจุภัณฑ์ ({settings.deliveryPackagingCost ?? 8}฿) ไปหักออกจากยอดขายเดลิเวอรีโดยตรง
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
                  <Building className="w-4 h-4" />
                  <span>3. ต้นทุนคงที่ & จุดคุ้มทุน</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  รวมค่าเช่าร้าน ({formatBaht(currentOpEx.rent)}), ค่าแรงพนักงาน 3 คน ({formatBaht(currentOpEx.salaries)}), ค่าน้ำไฟแก๊ส ({formatBaht(currentOpEx.utilities)}) รวม <strong>{formatBaht(currentOpEx.total)}/ด.</strong> เพื่อคำนวณจุดคุ้มทุน (Break-Even)
                </p>
              </div>
            </div>

            {/* Architecture Flow Diagram */}
            <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-400" />
                  <span>แผนผังเชื่อมต่อข้อมูลผ่าน Cloud Firestore & Local-First</span>
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  Real-time Synchronized
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                  <div className="font-black text-amber-400 flex items-center gap-1.5">
                    <span>แอป Cost & Profit</span>
                    <span className="text-[10px] text-slate-400 font-normal">(คำนวณต้นทุน)</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    บันทึกวัตถุดิบ 41 ตัว, ซอส, ค่าเช่า, เงินเดือน และสูตรอาหารต่อจาน
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-1.5 rounded-lg">
                    users/{'{uid}'}/costManagement/tonys_kitchen
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="font-black text-emerald-400 flex items-center gap-1.5">
                      <span>Cloud Firestore</span>
                      <span className="text-[10px] text-slate-400 font-normal">(ตัวกลาง)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1">
                      เป็นฐานข้อมูลกลาง อัปเดตทันทีแบบสองทิศทาง รองรับออฟไลน์แคช
                    </p>
                  </div>
                  <div className="text-center text-amber-400 font-bold text-xs py-1">
                    ↔ ซิงค์อัตโนมัติ
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                  <div className="font-black text-blue-400 flex items-center gap-1.5">
                    <span>แอป KinD POS</span>
                    <span className="text-[10px] text-slate-400 font-normal">(ขายหน้าร้าน)</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    ดึงต้นทุนมาคำนวณกำไรทุกบิล, สรุปกะ, วิเคราะห์จุดคุ้มทุน, และรายงานงบ P&L
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono bg-slate-950 p-1.5 rounded-lg">
                    DashboardView & menuItems[].cost
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                พร้อมใช้งานทันที: ข้อมูลของ Tony's Kitchen ถูกโหลดไว้ในระบบแล้ว
              </div>
              <button
                type="button"
                onClick={() => handleApplyData(payload)}
                disabled={isApplying}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition cursor-pointer flex items-center gap-2"
              >
                <span>ปรับใช้ข้อมูลต้นทุนเข้าระบบ POS</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IMPORT & SYNC */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            {/* Quick Apply Card */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>ใช้ข้อมูลต้นทุนล่าสุดของ Tony's Kitchen ทันที</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    นำโครงสร้างที่ท่านส่งมา (12 พ.ย. 2026) ปรับใช้เข้าสู่เมนูใน POS และ OpEx อัตโนมัติ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyData(TONYS_KITCHEN_SAMPLE_DATA)}
                  disabled={isApplying}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>โหลดและปรับใช้เดี๋ยวนี้</span>
                </button>
              </div>
            </div>

            {/* Firestore Cloud Sync */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${cloudUser ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>การเชื่อมต่อ Cloud Firestore</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          cloudUser
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {cloudUser ? `เชื่อมต่อแล้ว (${cloudUser.email || cloudUser.uid.slice(0, 8)})` : 'ยังไม่เข้าสู่ระบบ Google'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {cloudUser
                        ? `เส้นทางข้อมูล: users/${cloudUser.uid}/costManagement/tonys_kitchen`
                        : 'เข้าสู่ระบบด้วย Google เพื่อดึงและซิงค์ข้อมูลต้นทุนบน Cloud Firestore ของคุณ'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!cloudUser ? (
                    <button
                      type="button"
                      onClick={handleSignInGoogle}
                      disabled={isSigningInGoogle}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>{isSigningInGoogle ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ Google'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUploadToFirestore(payload)}
                        disabled={remoteLoading || isApplying}
                        className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>อัปโหลดขึ้น Firestore</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFetchFromFirestore}
                        disabled={remoteLoading}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${remoteLoading ? 'animate-spin' : ''}`} />
                        <span>ดึงจาก Firestore</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">ซิงค์แบบ Real-time เมื่อมีการอัปเดตบน Cloud:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!cloudUser) {
                      setCloudNotice({
                        type: 'needs_auth',
                        message: 'กรุณาเข้าสู่ระบบด้วย Google ก่อนเปิดการซิงค์แบบ Real-time',
                      });
                      return;
                    }
                    setAutoSyncCloud(!autoSyncCloud);
                  }}
                  className={`px-3 py-1 rounded-full font-bold transition cursor-pointer ${
                    autoSyncCloud && cloudUser
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {autoSyncCloud && cloudUser ? 'เปิดใช้งาน (Live)' : 'ปิดอยู่'}
                </button>
              </div>
            </div>

            {/* Upload File or Paste JSON */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-500" />
                  <span>นำเข้าไฟล์ JSON หรือวางข้อมูลใหม่</span>
                </h4>

                <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>อัปโหลดไฟล์ .json</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="วางโค้ด JSON จากการส่งออกของแอป Cost & Profit ที่นี่..."
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseAndApplyJson}
                  disabled={isApplying || !jsonInput.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>ตรวจสอบและปรับใช้ JSON</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RECIPES & DISH COSTS TABLE */}
        {activeTab === 'recipes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>รายการเมนูและต้นทุนต่อจานที่ได้จากแอป Cost & Profit:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                เป้าหมาย Food Cost: {settings.targetFoodCostPercent ?? 40}%
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">ชื่อเมนู / ตัวเลือก</th>
                      <th className="py-3 px-3 font-bold text-right">ราคาขาย</th>
                      <th className="py-3 px-3 font-bold text-right">ต้นทุนสูตร (COGS)</th>
                      <th className="py-3 px-3 font-bold text-right">กำไรขั้นต้น/จาน</th>
                      <th className="py-3 px-3 font-bold text-right">Food Cost %</th>
                      <th className="py-3 px-3 font-bold text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {menus.flatMap((menu) =>
                      (menu.variants && menu.variants.length > 0 ? menu.variants : [{
                        id: menu.id,
                        name: menu.name,
                        sellingPrice: menu.sellingPrice || 0,
                        recipeCost: menu.recipeCost || 0,
                      }]).map((variant, idx) => {
                        const sell = variant.sellingPrice || variant.price || 0;
                        const cost = variant.recipeCost || variant.foodCostPerUnit || variant.calculatedCost || variant.cost || 0;
                        const profit = sell - cost;
                        const fcPct = sell > 0 ? (cost / sell) * 100 : 0;
                        const target = settings.targetFoodCostPercent || 40;

                        return (
                          <tr key={`${menu.id}_${variant.id || idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {variant.name || menu.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                หมวด: {menu.name} ({menu.categoryName || 'อาหารจานเดียว'})
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {formatBaht(sell)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              {formatBaht(cost)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatBaht(profit)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              <span className={fcPct <= target ? 'text-emerald-600' : 'text-amber-600'}>
                                {fcPct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  fcPct <= target
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                }`}
                              >
                                {fcPct <= target ? 'ผ่านเกณฑ์' : 'เฝ้าระวัง'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FIXED EXPENSES & OPERATING BUDGET */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            {/* OpEx Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">ค่าเช่าร้าน</span>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {formatBaht(currentOpEx.rent)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">ประจำเดือน</div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">ค่าแรงพนักงาน</span>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {formatBaht(currentOpEx.salaries)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">พนักงาน 3 ตำแหน่ง</div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">ค่าน้ำ/ค่าไฟ/แก๊ส</span>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  {formatBaht(currentOpEx.utilities)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">ไฟ 7,800 + แก๊ส 960</div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">รวมค่าใช้จ่ายคงที่</span>
                <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-300 mt-1">
                  {formatBaht(currentOpEx.total)}
                </div>
                <div className="text-[10px] text-amber-600/80 mt-1">ต่อเดือน (Fixed OpEx)</div>
              </div>
            </div>

            {/* Employee Breakdown */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>รายชื่อพนักงาน & เงินเดือน (Labor Roster)</span>
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map((emp) => (
                  <div key={emp.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{emp.name}</div>
                      <div className="text-[11px] text-slate-400">{emp.role}</div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatBaht(emp.salary)} /เดือน
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Channel Commissions */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-emerald-500" />
                <span>ค่าธรรมเนียมแพลตฟอร์มเดลิเวอรี & บรรจุภัณฑ์ (Delivery Commissions)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">GrabFood</div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                    คอมมิชชัน: <strong>{settings.grabFoodCommissionPercent ?? 37}%</strong> | ค่ากล่อง: <strong>{settings.deliveryPackagingCost ?? 8} บาท</strong>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">LINE MAN</div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                    คอมมิชชัน: <strong>{settings.lineManCommissionPercent ?? 37}%</strong> | ค่ากล่อง: <strong>{settings.deliveryPackagingCost ?? 8} บาท</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>

          <button
            type="button"
            onClick={() => handleApplyData(payload)}
            disabled={isApplying}
            className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-xs"
          >
            {isApplying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>ปรับใช้ข้อมูลทั้งหมดเข้าระบบ POS</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
