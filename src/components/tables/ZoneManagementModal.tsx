import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TableZoneConfig } from '../../types';
import { Plus, Edit2, Trash2, Check, X, Layers, AlertCircle } from 'lucide-react';

interface ZoneManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZoneManagementModal: React.FC<ZoneManagementModalProps> = ({ isOpen, onClose }) => {
  const { zones, addZone, updateZone, deleteZone, tables } = usePOS();
  const { t, language } = useLanguage();

  // New Zone Form State
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneNameEn, setNewZoneNameEn] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#f59e0b');

  // Editing Zone State
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');

  // Delete Confirmation State
  const [zoneToDelete, setZoneToDelete] = useState<TableZoneConfig | null>(null);
  const [reassignZoneId, setReassignZoneId] = useState<string>('');

  const quickColors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#64748b'];

  const handleStartEdit = (z: TableZoneConfig) => {
    setEditingZoneId(z.id);
    setEditName(z.name);
    setEditNameEn(z.nameEn || '');
  };

  const handleSaveEdit = (z: TableZoneConfig) => {
    if (!editName.trim()) return;
    updateZone(z.id, editName.trim(), editNameEn.trim(), z.color);
    setEditingZoneId(null);
  };

  const handleCancelEdit = () => {
    setEditingZoneId(null);
  };

  const handleAddZoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    addZone(newZoneName.trim(), newZoneNameEn.trim(), newZoneColor);
    setNewZoneName('');
    setNewZoneNameEn('');
  };

  const handlePromptDelete = (z: TableZoneConfig) => {
    if (zones.length <= 1) {
      alert('ไม่สามารถลบได้ เนื่องจากต้องมีโซนโต๊ะอย่างน้อย 1 โซนในระบบ');
      return;
    }
    const remaining = zones.filter((item) => item.id !== z.id);
    setReassignZoneId(remaining[0]?.id || '');
    setZoneToDelete(z);
  };

  const handleConfirmDelete = () => {
    if (!zoneToDelete) return;
    deleteZone(zoneToDelete.id, reassignZoneId);
    setZoneToDelete(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="จัดการโซนโต๊ะ (Table Zones Management)" maxWidth="max-w-2xl">
        <div className="space-y-6">
          {/* Add New Zone Card */}
          <form
            onSubmit={handleAddZoneSubmit}
            className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>เพิ่มโซนใหม่ (Add New Zone)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อโซน (ภาษาไทย) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="เช่น โซนริมสวน, ชั้น 2, ระเบียง"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อโซนภาษาอังกฤษ (Optional)
                </label>
                <input
                  type="text"
                  value={newZoneNameEn}
                  onChange={(e) => setNewZoneNameEn(e.target.value)}
                  placeholder="e.g. Garden Terrace, 2nd Floor"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {/* Color Selection */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">สีประจำโซน:</span>
                <div className="flex items-center gap-1">
                  {quickColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewZoneColor(c)}
                      className={`w-6 h-6 rounded-full transition cursor-pointer border-2 ${
                        newZoneColor === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!newZoneName.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มโซน</span>
              </button>
            </div>
          </form>

          {/* Zones List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>รายการโซนทั้งหมด ({zones.length} โซน)</span>
              <span>จำนวนโต๊ะในโซน</span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {zones.map((zone) => {
                const isEditing = editingZoneId === zone.id;
                const tableCount = tables.filter((t) => t.zone === zone.id).length;

                return (
                  <div
                    key={zone.id}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    {isEditing ? (
                      /* Inline Edit Form */
                      <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="ชื่อภาษาไทย"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-amber-400 bg-amber-50/30 dark:bg-slate-800 text-xs font-semibold"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editNameEn}
                          onChange={(e) => setEditNameEn(e.target.value)}
                          placeholder="English name"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(zone)}
                            className="p-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-600 transition cursor-pointer"
                            title="บันทึก"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer"
                            title="ยกเลิก"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Zone Info */
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: zone.color || '#f59e0b' }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {zone.name}
                            </div>
                            {zone.nameEn && (
                              <div className="text-[11px] text-slate-400 truncate">{zone.nameEn}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono">
                            {tableCount} โต๊ะ
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(zone)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/40 text-slate-600 dark:text-slate-300 hover:text-amber-600 transition cursor-pointer"
                              title="แก้ไขชื่อโซน"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={zones.length <= 1}
                              onClick={() => handlePromptDelete(zone)}
                              className={`p-2 rounded-xl transition ${
                                zones.length <= 1
                                  ? 'opacity-30 cursor-not-allowed text-slate-400'
                                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 cursor-pointer'
                              }`}
                              title={zones.length <= 1 ? 'ต้องมีอย่างน้อย 1 โซน' : 'ลบโซน'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer close button */}
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal with Table Reassignment */}
      {zoneToDelete && (
        <Modal
          isOpen={Boolean(zoneToDelete)}
          onClose={() => setZoneToDelete(null)}
          title="ยืนยันการลบโซนโต๊ะ"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-rose-900 dark:text-rose-200">
                <span className="font-bold">คุณต้องการลบโซน "{zoneToDelete.name}" ใช่หรือไม่?</span>
                {tables.filter((t) => t.zone === zoneToDelete.id).length > 0 && (
                  <p className="text-slate-600 dark:text-slate-300">
                    มีโต๊ะอยู่ในโซนนี้จำนวน{' '}
                    <strong>{tables.filter((t) => t.zone === zoneToDelete.id).length} โต๊ะ</strong>{' '}
                    โต๊ะทั้งหมดจะถูกย้ายไปยังโซนปลายทางด้านล่างโดยอัตโนมัติ (โต๊ะและประวัติบิลจะไม่สูญหาย)
                  </p>
                )}
              </div>
            </div>

            {tables.filter((t) => t.zone === zoneToDelete.id).length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เลือกโซนปลายทางที่จะย้ายโต๊ะไป:
                </label>
                <select
                  value={reassignZoneId}
                  onChange={(e) => setReassignZoneId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                >
                  {zones
                    .filter((z) => z.id !== zoneToDelete.id)
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setZoneToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                ยืนยันการลบโซน
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
