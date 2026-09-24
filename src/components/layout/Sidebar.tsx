import React from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
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
  const { t, getName } = useLanguage();

  // Active open bills count
  const openBillsCount = bills.filter((b) => b.status === 'open').length;

  const allNavItems = [
    {
      id: 'tables',
      label: t('nav_tables'),
      subtitle: t('nav_tables_sub'),
      icon: Grid3X3,
      roles: ['owner', 'cashier', 'waiter'],
    },
    {
      id: 'pos',
      label: t('nav_pos'),
      subtitle: t('nav_pos_sub'),
      icon: ShoppingBag,
      roles: ['owner', 'cashier', 'waiter'],
    },
    {
      id: 'bills',
      label: t('nav_bills'),
      subtitle: t('nav_bills_sub'),
      icon: Receipt,
      roles: ['owner', 'cashier'],
      badge: openBillsCount > 0 ? `${openBillsCount}` : undefined,
    },
    {
      id: 'menu',
      label: t('nav_menu'),
      subtitle: t('nav_menu_sub'),
      icon: UtensilsCrossed,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'dashboard',
      label: t('nav_dashboard'),
      subtitle: t('nav_dashboard_sub'),
      icon: LayoutDashboard,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'reports',
      label: t('nav_reports'),
      subtitle: t('nav_reports_sub'),
      icon: BarChart3,
      roles: ['owner', 'cashier'],
    },
    {
      id: 'settings',
      label: t('nav_settings'),
      subtitle: t('nav_settings_sub'),
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
                {t('drawer_brand_sub')}
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
                {getName(currentUser).slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {getName(currentUser)}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentUser.role === 'owner'
                    ? `${t('role_owner')} (Owner)`
                    : currentUser.role === 'cashier'
                    ? `${t('role_cashier')} (Cashier)`
                    : `${t('role_waiter')} (Waiter)`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  if (item.id !== 'pos') {
                    setActiveCategory(null);
                  }
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition cursor-pointer text-left ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isActive
                        ? 'bg-slate-950/10 text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate leading-tight">{item.label}</div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isActive
                          ? 'text-slate-900/80 font-medium'
                          : 'text-slate-400 dark:text-slate-500 font-normal'
                      }`}
                    >
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-amber-500 text-slate-950 shadow-2xs'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400 dark:text-slate-500">
          KinD POS v2.1 · POS System
        </div>
      </div>
    </div>
  );
};
