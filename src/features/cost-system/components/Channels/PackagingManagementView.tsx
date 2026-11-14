import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Package, Search } from 'lucide-react';
import { PackagingItem } from '../../types/domain';
import { NumericInput } from '../common/NumericInput';

interface PackagingManagementViewProps {
  packaging: PackagingItem[];
  onSavePackaging: (item: PackagingItem) => void;
  onDeletePackaging: (id: string) => void;
  activeLanguage: 'th' | 'en';
}

export const PackagingManagementView: React.FC<PackagingManagementViewProps> = ({
  packaging,
  onSavePackaging,
  onDeletePackaging,
  activeLanguage,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagingItem | null>(null);

  const [formData, setFormData] = useState<{
    code: string;
    thaiName: string;
    englishName: string;
    category: 'Box' | 'Bag' | 'Cup & Lid' | 'Cutlery & Napkin' | 'Sauce Container' | 'Other';
    unitCost: number;
    supplier: string;
    stockQuantity: number;
  }>({
    code: `PKG-${String(packaging.length + 1).padStart(3, '0')}`,
    thaiName: '',
    englishName: '',
    category: 'Box',
    unitCost: 3.5,
    supplier: '',
    stockQuantity: 100,
  });

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      code: `PKG-${String(packaging.length + 1).padStart(3, '0')}`,
      thaiName: '',
      englishName: '',
      category: 'Box',
      unitCost: 3.5,
      supplier: '',
      stockQuantity: 100,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pkg: PackagingItem) => {
    setEditingItem(pkg);
    setFormData({
      code: pkg.code,
      thaiName: pkg.thaiName,
      englishName: pkg.englishName || '',
      category: pkg.category || 'Box',
      unitCost: pkg.unitCost,
      supplier: pkg.supplier || '',
      stockQuantity: pkg.stockQuantity,
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.thaiName.trim()) return;

    const newItem: PackagingItem = {
      id: editingItem ? editingItem.id : `pkg-${Date.now()}`,
      code: formData.code,
      thaiName: formData.thaiName,
      englishName: formData.englishName || formData.thaiName,
      category: formData.category,
      unitCost: formData.unitCost,
      supplier: formData.supplier,
      stockQuantity: formData.stockQuantity,
      active: true,
    };

    onSavePackaging(newItem);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>{activeLanguage === 'th' ? 'บรรจุภัณฑ์ & กล่องอาหาร (Packaging Items)' : 'Packaging & Takeaway Supplies'}</span>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {packaging.length} {activeLanguage === 'th' ? 'รายการ' : 'items'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeLanguage === 'th'
              ? 'จัดการต้นทุนกล่อง ช้อนส้อม ถ้วยซอส และถุงหิ้ว เพื่อนำไปคำนวณในต้นทุนอาหารทางตรงของเมนูสั่งกลับบ้าน'
              : 'Track packaging costs per piece for takeaway and delivery orders.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>{activeLanguage === 'th' ? 'เพิ่มบรรจุภัณฑ์ใหม่' : 'Add Packaging'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packaging.map((pkg) => (
          <div
            key={pkg.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-slate-400">{pkg.code}</div>
                    <div className="font-bold text-slate-900 text-sm">{pkg.thaiName}</div>
                    {pkg.englishName && <div className="text-[11px] text-slate-400">{pkg.englishName}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(pkg)}
                    className="p-1 text-slate-400 hover:text-emerald-700 rounded"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePackaging(pkg.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[11px] font-sans">คงเหลือ:</span>{' '}
                <span className="font-semibold text-slate-700">{pkg.stockQuantity} ชิ้น</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px] font-sans">ต้นทุน:</span>{' '}
                <span className="font-bold text-emerald-700 text-sm">฿{pkg.unitCost.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 font-sans"> /ชิ้น</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingItem ? 'แก้ไขบรรจุภัณฑ์' : 'เพิ่มบรรจุภัณฑ์ใหม่'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัส</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อบรรจุภัณฑ์ (ไทย) *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น กล่องกระดาษคราฟท์ 750ml"
                  value={formData.thaiName}
                  onChange={(e) => setFormData({ ...formData, thaiName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อบรรจุภัณฑ์ (อังกฤษ)</label>
                <input
                  type="text"
                  placeholder="Kraft Paper Bowl 750ml"
                  value={formData.englishName}
                  onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ต้นทุนต่อชิ้น (฿) *</label>
                  <NumericInput
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนคงเหลือ</label>
                  <NumericInput
                    type="number"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ซัพพลายเออร์</label>
                <input
                  type="text"
                  placeholder="เช่น บจก. บรรจุภัณฑ์ไทย"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
