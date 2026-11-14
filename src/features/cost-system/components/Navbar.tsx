import React from 'react';
import {
  Menu as MenuIcon,
  Calculator,
  UtensilsCrossed,
  Soup,
  BookOpen,
  FlaskConical,
  Beef,
  Sparkles,
  Settings,
  HelpCircle,
  Cloud,
} from 'lucide-react';
import { RestaurantSettings } from '../types';
import { PWAInstallButton } from './common/PWAInstallButton';

interface NavbarProps {
  settings: RestaurantSettings;
  currentTab: string;
  onUpdateRole: (role: 'OWNER' | 'MANAGER' | 'STAFF') => void;
  reviewItemsCount: number;
  lowStockCount: number;
  onOpenMobileNav: () => void;
  onNavigateToTab: (tabId: string) => void;
  onOpenIconModal?: () => void;
  onOpenFirebaseSync?: () => void;
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  isCloudLoading?: boolean;
}

interface MainNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  currentTab,
  reviewItemsCount,
  onOpenMobileNav,
  onNavigateToTab,
  onOpenIconModal,
  onOpenFirebaseSync,
  currentUser,
  isCloudLoading,
}) => {
  const navigate = (tabId: string) => onNavigateToTab(tabId);

  const getCurrentTabInfo = () => {
    switch (currentTab) {
      case 'executive_dashboard':
        return { label: '📊 แดชบอร์ดบริหาร', icon: Calculator };
      case 'pnl':
        return { label: '📈 งบกำไรขาดทุน (P&L)', icon: Calculator };
      case 'overhead_breakeven':
        return { label: '⚖️ โสหุ้ย & จุดคุ้มทุน', icon: Calculator };
      case 'food_cost':
      case 'dashboard':
      case 'menus':
      case 'menu_costing':
        return { label: '🍚 ต้นทุน ราดข้าว', icon: UtensilsCrossed };
      case 'food_cost_alacarte':
        return { label: '🍲 ต้นทุน กับข้าว', icon: Soup };
      case 'quick_calculator':
        return { label: '✨ เครื่องคิดเลขด่วน', icon: Sparkles };
      case 'recipes':
        return { label: '📖 คลังสูตรอาหารกลาง', icon: BookOpen };
      case 'sauces':
        return { label: '🧪 ซอส & น้ำซุปสูตรกลาง (Batch)', icon: FlaskConical };
      case 'sales_entry':
        return { label: '📝 บันทึกยอดขายประจำวัน', icon: Calculator };
      case 'expenses':
        return { label: '🧾 บันทึกค่าใช้จ่าย & โสหุ้ย', icon: Calculator };
      case 'labor':
        return { label: '👥 จัดการค่าแรง & พนักงาน', icon: Calculator };
      case 'purchases':
        return { label: '🛒 บันทึกการจัดซื้อ & ประวัติราคา', icon: Calculator };
      case 'ingredients':
        return { label: '🥩 วัตถุดิบ & Yield Lab', icon: Beef };
      case 'reports':
        return { label: '📑 รายงาน & Excel', icon: Calculator };
      case 'settings':
        return { label: '⚙️ เกณฑ์ต้นทุน & ตั้งค่า', icon: Settings };
      default:
        return { label: 'ระบบจัดการต้นทุนอาหาร', icon: Calculator };
    }
  };

  const currentTabInfo = getCurrentTabInfo();
  const CurrentIcon = currentTabInfo.icon;

  return (
    <header className="sticky top-0 z-30 text-stone-900">
      {/* Primary navigation bar */}
      <div className="border-b border-[#EAE4D9] bg-[#FAF8F5]/95 backdrop-blur-xl shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3 justify-between">
          {/* Brand & Hamburger Menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-[#EAE4D9] transition-all focus:outline-none cursor-pointer shadow-2xs group"
              aria-label="Open menu"
              title="เปิดเมนูนำทาง (Hamburger Menu)"
            >
              <MenuIcon className="w-5 h-5 text-[#F27D26] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-stone-800">เมนู</span>
              {reviewItemsCount > 0 && (
                <span className="inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white">
                  {reviewItemsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('food_cost')}
              className="flex items-center gap-2.5 cursor-pointer group text-left"
            >
              <div className="w-9 h-9 bg-[#F27D26] rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-md shadow-[#F27D26]/20 group-hover:scale-105 transition-transform">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-none tracking-tight text-stone-900">Tony's Kitchen</h1>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#B45309] font-bold mt-1">Food Cost System (หลักสากล)</p>
              </div>
            </button>
          </div>

          {/* Current Active Page Indicator in center */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-bold text-stone-400">
              หน้าปัจจุบัน:
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#EAE4D9] rounded-xl text-xs font-bold text-stone-800 shadow-2xs">
              <CurrentIcon className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>{currentTabInfo.label}</span>
            </div>
          </div>

          {/* Target Food Cost Indicator Pill & Settings & PWA Install & Firebase Cloud */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Firebase Cloud Sync Button */}
            {onOpenFirebaseSync && (
              <button
                type="button"
                onClick={onOpenFirebaseSync}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0 ${
                  currentUser
                    ? 'border-emerald-300/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/20'
                    : 'border-amber-300/80 bg-amber-50 hover:bg-amber-100 text-amber-900 ring-1 ring-amber-400/20'
                }`}
                title={
                  currentUser
                    ? `เชื่อมต่อ Cloud Firestore แล้ว: ${currentUser.email || currentUser.displayName} (คลิกเพื่อจัดการ/สำรองข้อมูล)`
                    : 'คลิกเพื่อเข้าสู่ระบบด้วย Google และเชื่อมต่อ Cloud Firestore'
                }
              >
                <Cloud className={`w-3.5 h-3.5 shrink-0 ${currentUser ? 'text-emerald-600' : 'text-amber-600'} ${isCloudLoading ? 'animate-bounce' : ''}`} />
                <span className="font-bold text-xs whitespace-nowrap">
                  {currentUser ? (currentUser.displayName?.split(' ')[0] || 'Tony') : 'เชื่อมต่อ Firebase'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    currentUser ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
              </button>
            )}

            {/* PWA Mobile & Tablet Install Button */}
            <PWAInstallButton onOpenIconModal={onOpenIconModal} />

            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#FFFDF9] border border-[#EAE4D9] rounded-xl text-xs shadow-xs">
              <span className="text-[10px] uppercase font-bold text-stone-500">Target FC%:</span>
              <span className="font-mono font-bold text-[#F27D26] text-xs">
                ≤ {settings.targetFoodCostPercent || 32}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate('settings')}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-[#F27D26] text-white border-[#F27D26]'
                  : 'bg-white hover:bg-stone-50 border-[#EAE4D9] text-stone-600 hover:text-stone-900 shadow-xs'
              }`}
              title="ตั้งค่าเกณฑ์ต้นทุนอาหาร"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

