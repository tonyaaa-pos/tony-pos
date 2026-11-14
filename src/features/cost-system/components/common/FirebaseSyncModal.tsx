import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  Users,
  FileDown,
  FileUp,
  Database,
  ArrowRight,
} from 'lucide-react';
import { auth, firebaseConfig, loginWithGoogle, logoutUser, subscribeAuthState, testConnection } from '../../services/firebase';
import { FirebaseSyncService } from '../../services/firebaseSyncService';
import type { User as FirebaseUser } from 'firebase/auth';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataSynced?: () => void;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({
  isOpen,
  onClose,
  onDataSynced,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth?.currentUser ?? null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cloudCounts, setCloudCounts] = useState<{
    menus: number;
    ingredients: number;
    sauces: number;
    expenses: number;
    dailySales: number;
    total: number;
    settingsSaved: boolean;
  } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCounts = async (uid: string) => {
    try {
      setIsLoadingCounts(true);
      const counts = await FirebaseSyncService.getUserCloudCounts(uid);
      setCloudCounts(counts);
    } catch (err) {
      console.warn('Error loading cloud counts:', err);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setCurrentUser(user);
      if (user) {
        loadCounts(user.uid);
      } else {
        setCloudCounts(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
      testConnection().catch(() => {});
      if (currentUser) {
        loadCounts(currentUser.uid);
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    try {
      setIsConnecting(true);
      setStatusMessage({ text: 'กำลังเข้าสู่ระบบ Google...', type: 'info' });
      const user = await loginWithGoogle();
      setStatusMessage({ text: `เข้าสู่ระบบสำเร็จ: ${user.displayName || user.email}`, type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `เข้าสู่ระบบไม่สำเร็จ: ${err.message}`, type: 'error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setStatusMessage({ text: 'ออกจากระบบเรียบร้อยแล้ว', type: 'info' });
    } catch (err: any) {
      setStatusMessage({ text: `ออกจากระบบไม่สำเร็จ: ${err.message}`, type: 'error' });
    }
  };

  const handleMigrateLocalToUser = async () => {
    if (!currentUser) {
      setStatusMessage({ text: 'กรุณาเข้าสู่ระบบด้วย Google ก่อนโอนย้ายข้อมูล', type: 'error' });
      return;
    }
    try {
      setIsMigrating(true);
      setStatusMessage({ text: 'กำลังโอนย้ายข้อมูลเดิมในเครื่องขึ้นบัญชี Firestore Cloud ของคุณ...', type: 'info' });
      const res = await FirebaseSyncService.migrateLocalDataToUser(currentUser.uid);
      if (res.success) {
        setStatusMessage({ text: `โอนย้ายข้อมูลขึ้น Cloud สำเร็จแล้ว (${res.count} รายการ) ระบบเชื่อมต่อเรียลไทม์แล้ว`, type: 'success' });
        await loadCounts(currentUser.uid);
        if (onDataSynced) onDataSynced();
      } else {
        setStatusMessage({ text: `เกิดข้อผิดพลาดในการโอนย้าย: ${res.error}`, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: `โอนย้ายไม่สำเร็จ: ${err.message}`, type: 'error' });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleExportJSON = async () => {
    if (!currentUser) {
      setStatusMessage({ text: 'กรุณาเข้าสู่ระบบก่อนส่งออกไฟล์ข้อมูล', type: 'error' });
      return;
    }
    try {
      setIsExporting(true);
      setStatusMessage({ text: 'กำลังสร้างไฟล์ส่งออก JSON จาก Cloud...', type: 'info' });
      const json = await FirebaseSyncService.exportUserDataJSON(currentUser.uid);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `food_cost_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ text: 'ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว', type: 'success' });
    } catch (err: any) {
      setStatusMessage({ text: `ส่งออกไฟล์ไม่สำเร็จ: ${err.message}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerFileInput = () => {
    if (!currentUser) {
      setStatusMessage({ text: 'กรุณาเข้าสู่ระบบก่อนนำเข้าไฟล์ข้อมูล', type: 'error' });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    try {
      setIsImporting(true);
      setStatusMessage({ text: `กำลังอ่านและนำเข้าไฟล์ ${file.name}...`, type: 'info' });
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const res = await FirebaseSyncService.importUserDataJSON(currentUser.uid, content);
          if (res.success) {
            setStatusMessage({ text: `นำเข้าข้อมูลเข้า Firestore Cloud สำเร็จ (${res.count} รายการ)`, type: 'success' });
            await loadCounts(currentUser.uid);
            if (onDataSynced) onDataSynced();
          } else {
            setStatusMessage({ text: `นำเข้าไม่สำเร็จ: ${res.error}`, type: 'error' });
          }
        } catch (innerErr: any) {
          setStatusMessage({ text: `ไฟล์ JSON ไม่ถูกต้อง: ${innerErr.message}`, type: 'error' });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setStatusMessage({ text: `เกิดข้อผิดพลาด: ${err.message}`, type: 'error' });
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#1C1917] text-white w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F27D26]/20 border border-[#F27D26]/40 flex items-center justify-center text-[#F27D26]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Cloud Firestore & ซิงค์ข้อมูลเรียลไทม์</h2>
              <p className="text-xs text-white/50">จัดเก็บข้อมูลแยกบัญชีผู้ใช้ (users/{'{uid}'}) ข้ามทุกอุปกรณ์</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              ) : (
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-sky-400" />
              )}
              <span className="leading-snug">{statusMessage.text}</span>
            </div>
          )}

          {/* User Auth Card */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white/80 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#F27D26]" /> บัญชีเข้าสู่ระบบ (Google Authentication):
              </span>
              {currentUser && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  เข้าสู่ระบบแล้ว
                </span>
              )}
            </div>

            {currentUser ? (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || ''}
                      className="w-8 h-8 rounded-full border border-white/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">{currentUser.displayName || 'ผู้ใช้งาน'}</div>
                    <div className="text-white/50 text-[11px] font-mono">{currentUser.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออก</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-white/60 text-[11px]">
                  เข้าสู่ระบบด้วย Google เพื่อเปิดใช้งานระบบคลาวด์ ข้อมูลจะถูกจัดเก็บและซิงค์แบบเรียลไทม์ข้ามมือถือ แท็บเล็ต และคอมพิวเตอร์
                </p>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isConnecting}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isConnecting ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Live Cloud Data Inspector - ยืนยันว่าข้อมูลถูกบันทึกจริง */}
          {currentUser && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ข้อมูลจริงบน Cloud Firestore:
                </span>
                <button
                  type="button"
                  onClick={() => currentUser && loadCounts(currentUser.uid)}
                  disabled={isLoadingCounts}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingCounts ? 'animate-spin' : ''}`} />
                  <span>ตรวจสอบสด</span>
                </button>
              </div>

              {isLoadingCounts && !cloudCounts ? (
                <div className="text-[11px] text-emerald-300/70 flex items-center gap-2 py-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> กำลังนับเอกสารจริงจาก Firestore Instance...
                </div>
              ) : cloudCounts ? (
                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between border-b border-emerald-500/20 pb-1.5">
                    <span className="text-[11px] text-emerald-200 font-medium">รวมเอกสารที่บันทึกบน Cloud:</span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">
                      {cloudCounts.total} เอกสาร
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-white/70">เมนูอาหาร:</span>
                      <span className="font-mono font-bold text-white">{cloudCounts.menus} รายการ</span>
                    </div>
                    <div className="flex justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-white/70">วัตถุดิบ (AP/EP):</span>
                      <span className="font-mono font-bold text-white">{cloudCounts.ingredients} รายการ</span>
                    </div>
                    <div className="flex justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-white/70">สูตรซอส:</span>
                      <span className="font-mono font-bold text-white">{cloudCounts.sauces} รายการ</span>
                    </div>
                    <div className="flex justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-white/70">ค่าใช้จ่าย/โสหุ้ย:</span>
                      <span className="font-mono font-bold text-white">{cloudCounts.expenses} รายการ</span>
                    </div>
                    <div className="flex justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-white/70">ยอดขายรายวัน:</span>
                      <span className="font-mono font-bold text-white">{cloudCounts.dailySales} วัน</span>
                    </div>
                    <div className="flex justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="text-white/70">การตั้งค่าร้าน:</span>
                      <span className="font-bold text-emerald-400">
                        {cloudCounts.settingsSaved ? '✓ บันทึกแล้ว' : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-300/80 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>ข้อมูลเหล่านี้ถูกบันทึกและซิงค์เรียลไทม์บน Cloud Firestore จริง</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-amber-300/90 py-1">
                  ยังไม่มีข้อมูลบน Cloud ในบัญชีนี้ สามารถกดปุ่ม "โอนย้ายขึ้น Cloud" ด้านล่างเพื่อบันทึกทันที
                </div>
              )}
            </div>
          )}

          {/* Migration Note Card (Requirement 5) */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
            <div className="font-semibold flex items-center gap-1.5 text-amber-300">
              <Database className="w-4 h-4 text-amber-400" />
              คำแนะนำการโอนย้ายข้อมูล (Migration Note):
            </div>
            <p className="text-[11px] leading-relaxed text-amber-100/90">
              ข้อมูลทั้งหมดจะถูกจัดเก็บลงใน <strong>Cloud Firestore</strong> ภายใต้พาธส่วนตัวของคุณ <code>users/{currentUser ? currentUser.uid.substring(0, 8) + '...' : '{uid}'}</code> ทุกเอกสารมีรหัส <code>id</code>, <code>createdAt</code>, และ <code>updatedAt</code> กำกับ หากคุณมีข้อมูลเดิมในเครื่อง ให้กดปุ่ม <strong>"โอนย้ายข้อมูลเดิมขึ้น Cloud"</strong> เพื่อบันทึกข้อมูลเข้าบัญชีทันที
            </p>
          </div>

          {/* Cloud Actions */}
          <div className="space-y-2 pt-1">
            <div className="font-semibold text-white/80">การจัดการข้อมูลบน Cloud:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Migrate Local to Cloud */}
              <button
                type="button"
                onClick={handleMigrateLocalToUser}
                disabled={!currentUser || isMigrating}
                className="p-3 rounded-xl bg-[#F27D26] hover:bg-[#E06D1A] text-white font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-md disabled:opacity-40 text-center"
              >
                <CloudUpload className={`w-4 h-4 ${isMigrating ? 'animate-bounce' : ''}`} />
                <span className="text-xs">{isMigrating ? 'กำลังโอนย้าย...' : 'โอนย้ายขึ้น Cloud'}</span>
                <span className="text-[10px] text-white/70 font-normal">คัดลอกข้อมูลในเครื่องขึ้นบัญชี</span>
              </button>

              {/* 2. Export JSON */}
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={!currentUser || isExporting}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-40 text-center"
              >
                <FileDown className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                <span className="text-xs">{isExporting ? 'กำลังส่งออก...' : 'ส่งออกไฟล์ JSON'}</span>
                <span className="text-[10px] text-white/60 font-normal">สำรองข้อมูลลงเครื่อง</span>
              </button>

              {/* 3. Import JSON */}
              <button
                type="button"
                onClick={handleTriggerFileInput}
                disabled={!currentUser || isImporting}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-40 text-center"
              >
                <FileUp className={`w-4 h-4 ${isImporting ? 'animate-spin' : ''}`} />
                <span className="text-xs">{isImporting ? 'กำลังนำเข้า...' : 'นำเข้าไฟล์ JSON'}</span>
                <span className="text-[10px] text-white/60 font-normal">กู้คืนข้อมูลขึ้น Cloud</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFileSelected}
              accept=".json"
              className="hidden"
            />
          </div>

          {/* Database Details */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] space-y-1 text-white/60">
            <div className="flex justify-between">
              <span>Database Instance:</span>
              <span className="font-mono text-white/80 text-[10px] truncate max-w-[200px]">{firebaseConfig.firestoreDatabaseId}</span>
            </div>
            <div className="flex justify-between">
              <span>Security Rule:</span>
              <span className="text-emerald-400 font-semibold">users/{'{uid}'} Zero-Trust (Restricted)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> ข้อมูลปลอดภัยด้วย Firebase Firestore & Auth
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
