import React from 'react';
import { usePOS } from '../../context/POSContext';
import {
  LayoutDashboard,
  Grid3X3,
  ShoppingBag,
  Receipt,
  UtensilsCrossed,
  BarChart3,
  Settings,
  X,
  Store,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeNav, setActiveNav, currentUser, bills, setActiveCategory } = usePOS();

  // Active open bills count
  const openBillsCount = bills.filter((b) => b.status === 'open').length;

  const allNavItems = [
    {
      id: 'tables',
      label: 'ผังโต๊ะอาหาร',
      subtitle: 'ผังร้าน ย้าย/รวมโต๊ะ และการจอง',
      icon: Grid3X3,
      roles: ['owner', 'cashier', 'waiter'],
    },
    {
      id: 'pos',
      label: 'จุดขาย & สั่งอาหาร (POS)',
      subtitle: 'เลือกเมนู รับออเดอร์',
      icon: ShoppingBag,
      roles: ['owner', 'cashier', 'waiter'],
    },
    {
      id: 'bills',
      label: 'บิลและประวัติการขาย',
      subtitle: 'ดูบิล พิมพ์ซ้ำ ยกเลิกบิล',
      icon: Receipt,
      roles: ['owner', 'cashier'],
      badge: openBillsCount > 0 ? `${openBillsCount}` : undefined,
    },
    {
      id: 'menu',
      label: 'จัดการเมนูอาหาร',
      subtitle: 'เพิ่ม/แก้ไขราคา ท็อปปิ้ง',
      icon: UtensilsCrossed,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'dashboard',
      label: 'แดชบอร์ดภาพรวม',
      subtitle: 'สรุปยอดขายประจำวัน',
      icon: LayoutDashboard,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'reports',
      label: 'รายงานยอดขายและกะ',
      subtitle: 'สถิติ กำไร และเปิด/ปิดกะ',
      icon: BarChart3,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'settings',
      label: 'ตั้งค่าระบบ',
      subtitle: 'ข้อมูลร้าน โต๊ะ QR ภาษี',
      icon: Settings,
      roles: ['owner'],
    },
  ];

  // Filter items by current user's role
  const userRole = currentUser?.role || 'waiter';
  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(userRole));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative z-50 w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-250">
        {/* Header inside drawer */}
        <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-base text-slate-900 dark:text-white leading-none">
                KinD POS
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                ระบบจัดการร้านอาหาร
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Badge inside drawer */}
        {currentUser && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs">
                {currentUser.name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentUser.role === 'owner'
                    ? 'เจ้าของร้าน (Owner)'
                    : currentUser.role === 'cashier'
                    ? 'แคชเชียร์ (Cashier)'
                    : 'พนักงานบริการ (Waiter)'}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
              {currentUser.role.toUpperCase()}
            </span>
          </div>
        )}

        {/* Navigation Items List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'tables') {
                    setActiveCategory(null);
                  }
                  setActiveNav(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left transition group cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl transition ${
                    isSelected
                      ? 'bg-slate-950/10 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-amber-500'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate leading-tight">{item.label}</div>
                  <div
                    className={`text-[11px] truncate leading-tight mt-0.5 ${
                      isSelected ? 'text-slate-900/80' : 'text-slate-400'
                    }`}
                  >
                    {item.subtitle}
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isSelected
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-rose-500 text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info inside drawer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="text-[11px] text-slate-400">
            KinD POS v2.0 · ระบบหน้าร้าน
          </div>
        </div>
      </div>
    </div>
  );
};
