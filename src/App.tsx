import React, { useState } from 'react';
import { POSProvider, usePOS } from './context/POSContext';
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

const MainLayout: React.FC = () => {
  const { currentUser, activeNav } = usePOS();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        return <DashboardView />;
      case 'reports':
        return <ReportsView />;
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
      <main className="flex-1 overflow-y-auto relative no-scrollbar pb-16">
        {renderActiveView()}
      </main>

      {/* Bottom Bar: Permanent 'Bill' Card + Food Categories */}
      <BottomBar />
    </div>
  );
};

export default function App() {
  return (
    <POSProvider>
      <MainLayout />
    </POSProvider>
  );
}
