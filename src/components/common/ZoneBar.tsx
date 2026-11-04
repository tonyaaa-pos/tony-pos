import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { ZoneManagementModal } from '../tables/ZoneManagementModal';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { soundService } from '../../utils/audio';

interface ZoneBarProps {
  className?: string;
  showManageButton?: boolean;
}

export const ZoneBar: React.FC<ZoneBarProps> = ({ className = '', showManageButton = true }) => {
  const { selectedZone, setSelectedZone, tables, zones, reorderZones } = usePOS();
  const { t, language } = useLanguage();
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [draggedZoneIndex, setDraggedZoneIndex] = useState<number | null>(null);
  const [dragOverZoneIndex, setDragOverZoneIndex] = useState<number | null>(null);

  const handleMoveZone = (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= zones.length) return;
    reorderZones(idx, targetIdx);
    soundService.playTap();
  };

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

        {/* Dynamic User-Configured Zones (Movable with Drag-and-Drop & Arrow Buttons) */}
        {zones.map((zone, index) => {
          const count = tables.filter((tItem) => tItem.zone === zone.id).length;
          const isSelected = selectedZone === zone.id;
          const displayName = language === 'en' && zone.nameEn ? zone.nameEn : zone.name;
          const isDragging = draggedZoneIndex === index;
          const isDragOver = dragOverZoneIndex === index;

          return (
            <div
              key={zone.id}
              draggable
              onDragStart={(e) => {
                setDraggedZoneIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverZoneIndex !== index) {
                  setDragOverZoneIndex(index);
                }
              }}
              onDragLeave={() => {
                if (dragOverZoneIndex === index) {
                  setDragOverZoneIndex(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedZoneIndex !== null && draggedZoneIndex !== index) {
                  reorderZones(draggedZoneIndex, index);
                  soundService.playTap();
                }
                setDraggedZoneIndex(null);
                setDragOverZoneIndex(null);
              }}
              onDragEnd={() => {
                setDraggedZoneIndex(null);
                setDragOverZoneIndex(null);
              }}
              title="กดเม้าส์ค้างไว้แล้วลากวาง หรือกดลูกศร ◀ ▶ เพื่อย้ายตำแหน่งโซน"
              className={`relative shrink-0 flex items-center rounded-xl border transition-all shadow-2xs ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/50 font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
              } ${isDragging ? 'opacity-40 scale-95 border-dashed border-2 border-amber-500' : ''} ${
                isDragOver ? 'ring-2 ring-amber-500 scale-105 shadow-md' : ''
              }`}
            >
              {/* Left Arrow Button */}
              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveZone(index, 'left');
                }}
                className={`h-full px-1.5 py-1.5 flex items-center justify-center transition rounded-l-xl ${
                  index === 0
                    ? 'opacity-20 cursor-not-allowed text-slate-400'
                    : isSelected
                    ? 'hover:bg-slate-950/20 text-slate-950 cursor-pointer'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer'
                }`}
                title="ย้ายตำแหน่งโซนไปทางซ้าย (◀)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Main Zone Button */}
              <button
                type="button"
                onClick={() => setSelectedZone(zone.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold whitespace-nowrap cursor-grab active:cursor-grabbing select-none"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? '#020617' : zone.color || '#f59e0b' }}
                />
                <span>{displayName}</span>
                <span className="text-[11px] opacity-80 font-mono">({count})</span>
              </button>

              {/* Right Arrow Button */}
              <button
                type="button"
                disabled={index === zones.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveZone(index, 'right');
                }}
                className={`h-full px-1.5 py-1.5 flex items-center justify-center transition rounded-r-xl ${
                  index === zones.length - 1
                    ? 'opacity-20 cursor-not-allowed text-slate-400'
                    : isSelected
                    ? 'hover:bg-slate-950/20 text-slate-950 cursor-pointer'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer'
                }`}
                title="ย้ายตำแหน่งโซนไปทางขวา (▶)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
