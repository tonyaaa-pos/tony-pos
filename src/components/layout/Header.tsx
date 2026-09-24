import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  UserCheck,
  Receipt,
  Store,
  Menu as MenuIcon,
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

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showTableSelectModal, setShowTableSelectModal] = useState<'waiter' | 'bill' | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navTitles: Record<string, { title: string; subtitle: string }> = {
    tables: { title: 'ผังโต๊ะอาหาร', subtitle: 'จัดวางโต๊ะ สถานะออเดอร์ ย้ายโต๊ะ และการจอง' },
    pos: { title: 'จุดขายและสั่งอาหาร', subtitle: 'เลือกเมนู รับออเดอร์ และยืนยันบิล' },
    bills: { title: 'บิลและประวัติการขาย', subtitle: 'ค้นหา ตรวจสอบ พิมพ์ซ้ำ และยกเลิกบิล' },
    menu: { title: 'จัดการเมนูอาหาร', subtitle: 'เพิ่ม ลบ แก้ไขราคา ท็อปปิ้ง และสถานะขายหมด' },
    dashboard: { title: 'แดชบอร์ดภาพรวม', subtitle: 'สรุปภาพรวมยอดขายและสถานะร้านวันนี้' },
    reports: { title: 'รายงานยอดขายและกะ', subtitle: 'กราฟวิเคราะห์ยอดขาย กำไร และกะการทำงาน' },
    settings: { title: 'ตั้งค่าระบบ', subtitle: 'ข้อมูลร้าน ภาษี เครื่องพิมพ์ QR ชำระเงิน และผังโต๊ะ' },
  };

  const currentNavInfo = navTitles[activeNav] || { title: 'KinD POS', subtitle: 'ระบบจัดการร้านอาหาร' };

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
            <span className="hidden sm:inline">เมนู</span>
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
              <span>กะเปิดอยู่ (เงินทอน: <span className="tabular-nums font-semibold">{formatBaht(currentShift.startingCash, false)}</span>)</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowTableSelectModal('waiter')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 rounded-xl transition cursor-pointer"
            title="จำลองลูกค้ากดเรียกพนักงานบริการ"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">จำลองเรียกพนักงาน</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTableSelectModal('bill')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/60 rounded-xl transition cursor-pointer"
            title="จำลองลูกค้ากดขอเช็คบิล"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">จำลองขอเช็คบิล</span>
          </button>
        </div>

        {/* Zone 3: Notifications, Theme, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
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
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentUser.role === 'owner'
                    ? 'เจ้าของร้าน'
                    : currentUser.role === 'cashier'
                    ? 'แคชเชียร์'
                    : 'พนักงานบริการ'}
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                title="ล็อคหน้าจอ / ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Notification Drawer */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Quick Call Waiter / Bill Modal */}
      {showTableSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {showTableSelectModal === 'waiter' ? 'จำลองกดเรียกพนักงานบริการ' : 'จำลองกดขอเช็คบิล'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              เลือกโต๊ะที่ต้องการให้ส่งสัญญาณแจ้งเตือน
            </p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (showTableSelectModal === 'waiter') {
                      callWaiterAlert(t.number);
                    } else {
                      requestBillAlert(t.number);
                    }
                    setShowTableSelectModal(null);
                  }}
                  className={`p-2.5 rounded-xl font-bold text-xs border transition hover:scale-105 active:scale-95 cursor-pointer ${
                    t.status === 'occupied'
                      ? 'bg-amber-500 text-white border-amber-600'
                      : t.status === 'payment_pending'
                      ? 'bg-rose-500 text-white border-rose-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {t.number}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowTableSelectModal(null)}
              className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </>
  );
};
