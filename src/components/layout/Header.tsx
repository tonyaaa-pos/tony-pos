import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  Store,
  Menu as MenuIcon,
  Globe,
  Bluetooth,
  Monitor,
  ExternalLink,
  Eye,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { formatBaht } from '../../utils/formatters';
import { bluetoothPrinterService, BluetoothState } from '../../services/bluetoothPrinterService';
import { Modal } from '../common/Modal';
import { CustomerDisplayView } from '../customer/CustomerDisplayView';

interface HeaderProps {
  onOpenMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMenu }) => {
  const {
    currentUser,
    logout,
    theme,
    toggleTheme,
    notifications,
    activeNav,
    currentShift,
    setActiveNav,
  } = usePOS();

  const { t, language, toggleLanguage, getName } = useLanguage();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [btState, setBtState] = useState<BluetoothState>(bluetoothPrinterService.getState());
  const [showDualScreenModal, setShowDualScreenModal] = useState(false);
  const [showCfdPreview, setShowCfdPreview] = useState(false);

  React.useEffect(() => {
    return bluetoothPrinterService.subscribe((state) => {
      setBtState(state);
    });
  }, []);

  const handleOpenCustomerWindow = () => {
    const url = `${window.location.origin}${window.location.pathname}?view=customer#customer`;
    const win = window.open(
      url,
      'kind_pos_customer_display',
      'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
    );
    if (win) {
      try {
        win.focus();
      } catch {}
    }
  };


  const unreadCount = notifications.filter((n) => !n.read).length;

  const navTitles: Record<string, { title: string; subtitle: string }> = {
    tables: {
      title: t('header_title_tables'),
      subtitle: t('header_sub_tables'),
    },
    pos: {
      title: t('header_title_pos'),
      subtitle: t('header_sub_pos'),
    },
    bills: {
      title: t('header_title_bills'),
      subtitle: t('header_sub_bills'),
    },
    menu: {
      title: t('header_title_menu'),
      subtitle: t('header_sub_menu'),
    },
    dashboard: {
      title: t('header_title_dashboard'),
      subtitle: t('header_sub_dashboard'),
    },
    reports: {
      title: t('header_title_reports'),
      subtitle: t('header_sub_reports'),
    },
    settings: {
      title: t('header_title_settings'),
      subtitle: t('header_sub_settings'),
    },
  };

  const currentNavInfo = navTitles[activeNav] || {
    title: 'KinD POS',
    subtitle: 'ระบบจัดการร้านอาหาร',
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner':
        return t('role_owner');
      case 'cashier':
        return t('role_cashier');
      case 'waiter':
        return t('role_waiter');
      default:
        return role;
    }
  };

  return (
    <>
      <header className="h-16 px-3 sm:px-4 md:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-30 transition-colors shrink-0">
        {/* Zone 1: Hamburger menu button + Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition cursor-pointer font-semibold text-xs shadow-2xs"
            aria-label="Open Navigation Menu"
            title="เปิดเมนูหลัก"
          >
            <MenuIcon className="w-5 h-5 text-amber-500" />
            <span className="hidden sm:inline">{t('header_menu_btn')}</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
              <span>{currentNavInfo.title}</span>
              <span className="hidden lg:inline text-xs font-normal text-slate-400 dark:text-slate-500">
                · {currentNavInfo.subtitle}
              </span>
            </h1>
          </div>
        </div>

        {/* Zone 2: Shift status */}
        <div className="hidden md:flex items-center gap-2">
          {currentShift && currentShift.status === 'open' && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
              <Store className="w-3.5 h-3.5" />
              <span>
                {t('header_shift_open')} (
                <span className="tabular-nums font-semibold">
                  {formatBaht(currentShift.startingCash, false)}
                </span>
                )
              </span>
            </div>
          )}
        </div>

        {/* Zone 3: Language Toggle, Notifications, Theme, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Dual-Screen Customer Display Button */}
          <button
            type="button"
            onClick={() => setShowDualScreenModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer select-none shadow-2xs"
            title="ระบบ 2 หน้าจอ POS (จอหลังแคชเชียร์ + จอลองลูกค้า)"
          >
            <Monitor className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">จอลูกค้า (2 จอ)</span>
          </button>

          {/* Bluetooth Thermal Printer Indicator */}
          {btState.isConnected && (
            <button
              type="button"
              onClick={() => setActiveNav('settings')}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition cursor-pointer select-none"
              title={`เครื่องพิมพ์ Bluetooth: ${btState.deviceName} (คลิกเพื่อไปที่การตั้งค่า)`}
            >
              <Bluetooth className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span className="max-w-[100px] truncate">{btState.deviceName}</span>
            </button>
          )}

          {/* Language Switcher Button (TH | EN) */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer select-none"
            title="Switch Language / เปลี่ยนภาษา"
          >
            <Globe className="w-3.5 h-3.5 text-amber-500" />
            <span
              className={
                language === 'th'
                  ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 font-medium'
              }
            >
              TH
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span
              className={
                language === 'en'
                  ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 font-medium'
              }
            >
              EN
            </span>
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsNotifOpen(true)}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {getName(currentUser)}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {getRoleDisplayName(currentUser.role)}
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                title={t('logout_confirm')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Notifications Drawer */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Dual Screen Setup & Control Modal */}
      <Modal
        isOpen={showDualScreenModal}
        onClose={() => setShowDualScreenModal(false)}
        title="🖥️ ระบบเครื่อง POS 2 หน้าจอ (Dual-Screen Display)"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
            <Monitor className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                รองรับเครื่อง POS แบบ 2 หน้าจอ (เช่น Sunmi D2s Plus, Windows Dual Monitor)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ระบบเชื่อมต่อ 2 หน้าจอแบบ Real-time: จอหลักสำหรับแคชเชียร์เลือกเมนู และจอลองหันหน้าหาลูกค้าเพื่อแสดงรายการอาหาร ยอดรวมสุทธิ และ QR พร้อมเพย์สำหรับสแกนจ่ายเงินทันที
              </p>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Action 1: Open 2nd Window for Secondary Monitor */}
            <button
              type="button"
              onClick={() => {
                handleOpenCustomerWindow();
                setShowDualScreenModal(false);
              }}
              className="p-4 rounded-2xl border-2 border-amber-500 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-left transition flex flex-col justify-between group cursor-pointer shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold">
                  <ExternalLink className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  แนะนำสำหรับใช้งานจริง
                </span>
              </div>
              <div>
                <h5 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 transition">
                  เปิดจอลูกค้า (จอที่ 2 / CFD)
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  เปิดหน้าต่างใหม่สำหรับลากไปวางที่จอที่ 2 (ฝั่งลูกค้า) แล้วกดปุ่มขยายเต็มจอ
                </p>
              </div>
            </button>

            {/* Action 2: In-App Preview Modal */}
            <button
              type="button"
              onClick={() => {
                setShowDualScreenModal(false);
                setShowCfdPreview(true);
              }}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 text-left transition flex flex-col justify-between group cursor-pointer shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  <Eye className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  ทดสอบบนหน้าจอนี้
                </span>
              </div>
              <div>
                <h5 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 transition">
                  จำลองดูหน้าจอลูกค้า (Preview)
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ดูตัวอย่างมุมมองลูกค้าบนหน้าต่างจำลองทันทีโดยไม่ต้องต่อจอที่ 2
                </p>
              </div>
            </button>

            {/* Action 3: Convert this screen to Customer Display */}
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('kind_pos_screen_role', 'customer');
                window.location.hash = '#customer';
                window.dispatchEvent(new Event('kind_pos_screen_role_change'));
                setShowDualScreenModal(false);
              }}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 text-left transition flex flex-col justify-between group cursor-pointer shadow-xs sm:col-span-2"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-500 font-bold">
                  <Monitor className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  สำหรับตั้งค่าจอที่ 2
                </span>
              </div>
              <div>
                <h5 className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 transition">
                  สลับหน้าจอนี้เป็น &quot;จอลูกค้า (Customer Display)&quot; ทันที
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  หากเปิดหน้าเว็บนี้บนจอหลังของเครื่อง POS ให้กดปุ่มนี้เพื่อเปลี่ยนเป็นจอลูกค้าถาวร (มีปุ่มสลับกลับได้ตลอดเวลา)
                </p>
              </div>
            </button>
          </div>

          {/* Feature Highlights */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h5 className="font-bold text-xs text-slate-900 dark:text-white">จุดเด่นของจอลูกค้า:</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>ซิงค์รายการอาหารเรียลไทม์ขณะแคชเชียร์กดจิ้ม</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>แสดง QR พร้อมเพย์ขนาดใหญ่ สแกนจ่ายได้ทันที</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>สไลด์โชว์รูปเมนูแนะนำอัตโนมัติขณะไม่มีออเดอร์</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>แสดงยอดเงินรับ ยอดเงินทอน และข้อความขอบคุณ</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* In-App Full Preview Modal */}
      {showCfdPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[85vh] max-h-[750px] bg-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col">
            <CustomerDisplayView isPreview onClosePreview={() => setShowCfdPreview(false)} />
          </div>
        </div>
      )}
    </>
  );
};

