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
  Cloud,
  CloudOff,
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { formatBaht } from '../../utils/formatters';
import { bluetoothPrinterService, BluetoothState } from '../../services/bluetoothPrinterService';
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
    cloudUser,
    cloudConnected,
  } = usePOS();

  const { t, language, toggleLanguage, getName } = useLanguage();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [btState, setBtState] = useState<BluetoothState>(bluetoothPrinterService.getState());
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
          {/* Dual-Screen Customer Display Button - Automatic 1-Click Connection */}
          <button
            type="button"
            onClick={handleOpenCustomerWindow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer select-none shadow-2xs"
            title="ระบบ 2 หน้าจอเชื่อมต่ออัตโนมัติ (คลิกเพื่อเปิด/สลับไปที่หน้าต่างจอลูกค้าทันที)"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Monitor className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">2 จออัตโนมัติ</span>
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

          {/* Cloud Status Indicator */}
          <button
            type="button"
            onClick={() => setActiveNav('settings')}
            className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
              cloudConnected
                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                : cloudUser
                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={
              cloudConnected
                ? `Cloud Firestore: เชื่อมต่อแล้ว (${cloudUser?.email || 'ออนไลน์'})`
                : cloudUser
                ? 'Cloud Firestore: ออฟไลน์ (บันทึกในเครื่องแล้ว จะซิงค์เมื่อต่อเน็ต)'
                : 'Cloud Firestore: ยังไม่ได้เชื่อมต่อบัญชีร้าน (ใช้งานแบบ Local)'
            }
            aria-label="Cloud Status"
          >
            {cloudConnected ? (
              <div className="relative">
                <Cloud className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
            ) : cloudUser ? (
              <div className="relative">
                <CloudOff className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
            ) : (
              <div className="relative opacity-60">
                <Cloud className="w-4 h-4" />
              </div>
            )}
          </button>

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

