import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { ZoneManagementModal } from '../tables/ZoneManagementModal';
import { Settings, Plus } from 'lucide-react';

interface ZoneBarProps {
  className?: string;
  showManageButton?: boolean;
}

export const ZoneBar: React.FC<ZoneBarProps> = ({ className = '', showManageButton = true }) => {
  const { selectedZone, setSelectedZone, tables, zones } = usePOS();
  const { t, language } = useLanguage();
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);

  return (
    <>
      <div
        className={`flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth ${className}`}
      >
        {/* All Zones Button */}
        <button
          type="button"
          onClick={() => setSelectedZone('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer select-none shrink-0 ${
            selectedZone === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {t('zone_all')} ({tables.length})
        </button>

        {/* Dynamic User-Configured Zones */}
        {zones.map((zone) => {
          const count = tables.filter((tItem) => tItem.zone === zone.id).length;
          const isSelected = selectedZone === zone.id;
          const displayName = language === 'en' && zone.nameEn ? zone.nameEn : zone.name;

          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => setSelectedZone(zone.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer select-none shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: isSelected ? '#020617' : zone.color || '#f59e0b' }}
              />
              <span>{displayName}</span>
              <span className="text-[11px] opacity-80 font-mono">({count})</span>
            </button>
          );
        })}

        {/* Manage Zones Button */}
        {showManageButton && (
          <button
            type="button"
            onClick={() => setIsZoneModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer select-none shrink-0 flex items-center gap-1.5 border border-dashed border-amber-400/80 hover:border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
            title="แก้ไขชื่อโซน, เพิ่มโซนใหม่, หรือลบโซน"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>จัดการโซน</span>
          </button>
        )}
      </div>

      {/* Modal */}
      <ZoneManagementModal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
      />
    </>
  );
};
