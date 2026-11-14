import React, { useState } from 'react';
import { Smartphone, Share, PlusSquare, Check, Image as ImageIcon, X, Copy, ExternalLink, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../../utils/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenIconModal?: () => void;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenIconModal,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [, setJustInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  // If already running standalone, display a subtle "App Installed" or icon customize option
  if (isInstalled) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold ${className}`}>
        <Check className="w-3.5 h-3.5 text-emerald-600" />
        <span>ติดตั้งในอุปกรณ์แล้ว</span>
        {onOpenIconModal && (
          <button
            type="button"
            onClick={onOpenIconModal}
            className="ml-1 text-[11px] underline text-emerald-700 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
            title="ปรับแต่งไอคอนแอป"
          >
            <ImageIcon className="w-3 h-3" />
            เปลี่ยนไอคอน
          </button>
        )}
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      try {
        const ok = await install();
        if (ok) {
          setJustInstalled(true);
          setTimeout(() => setJustInstalled(false), 5000);
        } else {
          setShowIOSModal(true);
        }
      } catch {
        setShowIOSModal(true);
      }
    } else {
      setShowIOSModal(true);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#F27D26] to-[#EA580C] text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md hover:from-[#EA580C] hover:to-[#D97706] active:scale-95 transition-all cursor-pointer ${className}`}
          title="ติดตั้งสมาชิกลงบนมือถือหรือแท็บเล็ต"
        >
          <Smartphone className="w-4 h-4 shrink-0 animate-bounce" />
          <span className="hidden sm:inline">โหลดลงมือถือ / แท็บเล็ต</span>
          <span className="sm:hidden">ติดตั้งแอป</span>
        </button>

        {onOpenIconModal && (
          <button
            type="button"
            onClick={onOpenIconModal}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-[#EAE4D9] text-xs font-semibold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
            title="เปลี่ยนรูปไอคอนแอปตามต้องการ"
          >
            <ImageIcon className="w-3.5 h-3.5 text-[#F27D26]" />
            <span className="hidden md:inline">เปลี่ยนไอคอน</span>
          </button>
        )}
      </div>

      {/* Guided Modal for Android / iOS / Troubleshooting */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F27D26] text-white flex items-center justify-center font-bold shadow-xs">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base leading-tight">
                    วิธีติดตั้งแอปบนหน้าจอมือถือ & แท็บเล็ต
                  </h3>
                  <p className="text-xs text-stone-500">เปิดใช้งานได้แบบแอปจริง เต็มหน้าจอ ไม่ต้องพิมพ์ URL</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Troubleshooting alert for "ติดตั้งแอปนี้ไม่ได้" */}
            <div className="mt-4 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>หากพบข้อความ "ติดตั้งแอปนี้ไม่ได้":</span>
              </div>
              <p className="text-stone-700 leading-relaxed pl-5">
                มักเกิดจากการเปิดผ่านหน้าต่าง <strong>Preview ใน AI Studio</strong>, แอปแชท (LINE/Facebook), หรือ Google Play บนอุปกรณ์กำลังตรวจสอบ ให้ใช้วิธีลัดด้านล่างนี้ ซึ่งสามารถนำแอปขึ้นหน้าจอโฮมได้ทันที 100%:
              </p>
            </div>

            <div className="mt-4 space-y-3 text-xs sm:text-sm text-stone-700">
              {/* Option A: Android Chrome */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EA580C] text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  A
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-stone-900">สำหรับ Android & แท็บเล็ต (Chrome)</p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    1. เปิดในแอป <strong>Chrome</strong> (เปิดเบราว์เซอร์ปกติ ไม่ใช่ใน iFrame หรือหน้าต่างพรีวิว)<br />
                    2. แตะที่เมนู <strong>จุด 3 จุด (⋮)</strong> มุมบนขวา<br />
                    3. แตะเลือก <strong>"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)</strong> หรือ <strong>"ติดตั้งแอป" (Install app)</strong>
                  </p>
                </div>
              </div>

              {/* Option B: iOS Safari */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  B
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-stone-900">สำหรับ iPhone & iPad (Safari)</p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    1. เปิดเว็บนี้ด้วย <strong>Safari</strong><br />
                    2. แตะปุ่ม <strong className="inline-flex items-center gap-0.5 font-semibold text-stone-900 bg-white px-1 py-0.5 rounded border border-stone-300"><Share className="w-3 h-3 text-blue-600 inline" /> แชร์ (Share)</strong> ด้านล่างหรือด้านบน<br />
                    3. เลื่อนลงแล้วแตะ <strong className="inline-flex items-center gap-0.5 font-semibold text-stone-900 bg-white px-1 py-0.5 rounded border border-stone-300"><PlusSquare className="w-3 h-3 text-emerald-600 inline" /> เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick URL Copy Bar */}
            <div className="mt-4 p-3 bg-stone-100 rounded-xl flex items-center justify-between gap-2">
              <div className="truncate text-xs font-mono text-stone-600">
                {window.location.href}
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}</span>
              </button>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
              {onOpenIconModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowIOSModal(false);
                    onOpenIconModal();
                  }}
                  className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#F27D26]" />
                  <span>เปลี่ยนรูปไอคอนแอป</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="ml-auto px-4 py-2 bg-[#F27D26] hover:bg-[#EA580C] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
