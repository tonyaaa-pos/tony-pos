import React, { useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';

interface ZoneBarProps {
  className?: string;
}

export const ZoneBar: React.FC<ZoneBarProps> = ({ className = '' }) => {
  const { selectedZone, setSelectedZone, tables } = usePOS();
  const { t, language } = useLanguage();

  // Combine standard zones + any custom zones from tables
  const zoneList = useMemo(() => {
    const predefined = [
      { id: 'all', label: t('zone_all') },
      { id: 'indoor', label: language === 'en' ? 'Indoor' : 'ในห้องแอร์ (Indoor)' },
      { id: 'outdoor', label: language === 'en' ? 'Outdoor' : 'รับลมด้านนอก (Outdoor)' },
      { id: 'vip', label: language === 'en' ? 'VIP Room' : 'ห้องพิเศษ (VIP)' },
    ];

    // Find custom zones if any table uses a non-standard zone id
    const knownIds = new Set(predefined.map((z) => z.id));
    const customZones: { id: string; label: string }[] = [];

    tables.forEach((tItem) => {
      if (tItem.zone && !knownIds.has(tItem.zone)) {
        knownIds.add(tItem.zone);
        customZones.push({
          id: tItem.zone,
          label: tItem.zone,
        });
      }
    });

    return [...predefined, ...customZones];
  }, [tables, t, language]);

  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth ${className}`}
    >
      {zoneList.map((zone) => {
        const count =
          zone.id === 'all'
            ? tables.length
            : tables.filter((tItem) => tItem.zone === zone.id).length;

        const isSelected = selectedZone === zone.id;

        return (
          <button
            key={zone.id}
            type="button"
            onClick={() => setSelectedZone(zone.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer select-none ${
              isSelected
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {zone.label} ({count})
          </button>
        );
      })}
    </div>
  );
};
