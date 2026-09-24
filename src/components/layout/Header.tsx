import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  UserCheck,
  Receipt,
  Store,
  Menu as MenuIcon,
  Globe,
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { formatBaht } from '../../utils/formatters';

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
    callWaiterAlert,
    requestBillAlert,
    tables,
  } = usePOS();

  const { t, language, toggleLanguage, getName } = useLanguage();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showTableSelectModal, setShowTableSelectModal] = useState<'waiter' | 'bill' | null>(null);

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

        {/* Zone 2: Shift status + Fast Table Simulation triggers */}
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

          <button
            type="button"
            onClick={() => setShowTableSelectModal('waiter')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 rounded-xl transition cursor-pointer"
            title="จำลองลูกค้ากดเรียกพนักงานบริการ"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{t('header_sim_waiter')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTableSelectModal('bill')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/60 rounded-xl transition cursor-pointer"
            title="จำลองลูกค้ากดขอเช็คบิล"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{t('header_sim_bill')}</span>
          </button>
        </div>

        {/* Zone 3: Language Toggle, Notifications, Theme, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
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

      {/* Fast Table Simulation Selector Modal */}
      {showTableSelectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {showTableSelectModal === 'waiter'
                  ? t('header_sim_waiter')
                  : t('header_sim_bill')}
              </h3>
              <p className="text-xs text-slate-400 mt-1">เลือกโต๊ะที่ต้องการจำลองการแจ้งเตือน</p>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
              {tables.map((tbl) => (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => {
                    if (showTableSelectModal === 'waiter') {
                      callWaiterAlert(tbl.number);
                    } else {
                      requestBillAlert(tbl.number);
                    }
                    setShowTableSelectModal(null);
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:text-slate-950 dark:hover:bg-amber-500 dark:hover:text-slate-950 transition cursor-pointer"
                >
                  โต๊ะ {tbl.number}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowTableSelectModal(null)}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 transition cursor-pointer"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
