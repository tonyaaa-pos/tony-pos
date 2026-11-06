import React, { useState } from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { LanguageProvider } from './context/LanguageContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { BottomBar } from './components/layout/BottomBar';

// Views
import { TablesView } from './components/tables/TablesView';
import { POSView } from './components/pos/POSView';
import { BillsView } from './components/bills/BillsView';
import { MenuManagementView } from './components/menu/MenuManagementView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';

import { CustomerDisplayView } from './components/customer/CustomerDisplayView';

export const checkIsCustomerWindow = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const storedRole = localStorage.getItem('kind_pos_screen_role');

    if (
      storedRole === 'customer' ||
      search.includes('view=customer') ||
      search.includes('screen=customer') ||
      search.includes('view=cfd') ||
      hash.includes('customer') ||
      hash.includes('cfd') ||
      pathname.includes('/customer')
    ) {
      return true;
    }
  } catch {}
  return false;
};

const MainLayout: React.FC = () => {
  const { currentUser, activeNav } = usePOS();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCustomerScreen, setIsCustomerScreen] = useState<boolean>(() => checkIsCustomerWindow());

  React.useEffect(() => {
    const syncScreenRole = () => {
      setIsCustomerScreen(checkIsCustomerWindow());
    };

    window.addEventListener('hashchange', syncScreenRole);
    window.addEventListener('popstate', syncScreenRole);
    window.addEventListener('storage', syncScreenRole);
    window.addEventListener('kind_pos_screen_role_change', syncScreenRole);

    return () => {
      window.removeEventListener('hashchange', syncScreenRole);
      window.removeEventListener('popstate', syncScreenRole);
      window.removeEventListener('storage', syncScreenRole);
      window.removeEventListener('kind_pos_screen_role_change', syncScreenRole);
    };
  }, []);

  const handleSwitchToCashier = () => {
    try {
      localStorage.removeItem('kind_pos_screen_role');
      if (window.location.hash.includes('customer') || window.location.hash.includes('cfd')) {
        window.location.hash = '';
      }
      if (window.location.search.includes('customer') || window.location.search.includes('cfd')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        url.searchParams.delete('screen');
        window.history.replaceState({}, '', url.pathname);
      }
      window.dispatchEvent(new Event('kind_pos_screen_role_change'));
    } catch {}
    setIsCustomerScreen(false);
  };

  // Dedicated Customer Display (CFD on second monitor): ONLY renders customer bill & payment QR, NEVER staff layout!
  if (isCustomerScreen) {
    return <CustomerDisplayView onSwitchToCashier={handleSwitchToCashier} />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  // Render view based on active navigation (defaults to Tables)
  const renderActiveView = () => {
    switch (activeNav) {
      case 'tables':
        return <TablesView />;
      case 'pos':
        return <POSView />;
      case 'bills':
        return <BillsView />;
      case 'menu':
        return <MenuManagementView />;
      case 'dashboard':
      case 'reports':
        return <DashboardView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <TablesView />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
      {/* Slide-out Navigation Drawer */}
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* Top Header Bar with Hamburger Button */}
      <Header onOpenMenu={() => setIsMenuOpen(true)} />

      {/* Main Full-Width Content View */}
      <main className="flex-1 min-h-0 overflow-y-auto relative no-scrollbar pb-16">
        {renderActiveView()}
      </main>

      {/* Bottom Bar: Permanent 'Bill' Card + Food Categories */}
      <BottomBar />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <POSProvider>
        <MainLayout />
      </POSProvider>
    </LanguageProvider>
  );
}

