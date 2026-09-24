import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Store,
  Receipt,
  QrCode,
  Users,
  Grid3X3,
  Sparkles,
  Database,
  Upload,
  Trash2,
  Plus,
  Check,
  Edit,
  Save,
  RotateCcw,
  Download,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompressor';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Table, User, TableShape, ChairStyle } from '../../types';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    qrImages,
    addQrImage,
    deleteQrImage,
    updateQrImage,
    tables,
    addTable,
    updateTable,
    deleteTable,
    users,
    addStaff,
    updateStaff,
    deleteStaff,
    members,
    resetDemoData,
    exportDataJson,
    importDataJson,
  } = usePOS();

  const [activeTab, setActiveTab] = useState<
    'shop' | 'qr' | 'tables' | 'staff' | 'membership' | 'backup'
  >('shop');

  // Form states for Shop info
  const [shopName, setShopName] = useState(settings.shopName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [taxId, setTaxId] = useState(settings.taxId);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [vatEnabled, setVatEnabled] = useState(settings.vatEnabled);
  const [vatRate, setVatRate] = useState(settings.vatRate);
  const [vatInclusive, setVatInclusive] = useState(settings.vatInclusive);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(settings.serviceChargeEnabled);
  const [serviceChargeRate, setServiceChargeRate] = useState(settings.serviceChargeRate);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // QR Upload
  const [newQrLabel, setNewQrLabel] = useState('พร้อมเพย์ (PromptPay)');
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [qrUploadError, setQrUploadError] = useState('');

  // Table Add/Edit Modal
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableCapacity, setTableCapacity] = useState(4);
  const [tableZone, setTableZone] = useState<string>('indoor');
  const [tableShape, setTableShape] = useState<TableShape>('square');
  const [tableChairStyle, setTableChairStyle] = useState<ChairStyle>('standard');
  const [tableWidth, setTableWidth] = useState(112);
  const [tableHeight, setTableHeight] = useState(112);
  const [tableChairSize, setTableChairSize] = useState(20);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  // Staff Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [staffRole, setStaffRole] = useState<User['role']>('waiter');
  const [staffToDelete, setStaffToDelete] = useState<User | null>(null);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Save Shop Settings
  const handleSaveShopSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      shopName,
      address,
      phone,
      taxId,
      receiptFooter,
      vatEnabled,
      vatRate: Number(vatRate),
      vatInclusive,
      serviceChargeEnabled,
      serviceChargeRate: Number(serviceChargeRate),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // QR Upload Handler (Compressed base64 storage)
  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingQr(true);
      setQrUploadError('');
      const compressedBase64 = await compressImageFile(file, 600, 0.85);
      addQrImage(newQrLabel.trim() || 'QR ชำระเงิน', compressedBase64, qrImages.length === 0);
      setNewQrLabel('');
    } catch {
      setQrUploadError('ไม่สามารถอ่านไฟล์รูปภาพได้');
    } finally {
      setIsUploadingQr(false);
    }
  };

  // Table Save
  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) return;

    if (editingTable) {
      updateTable(editingTable.id, {
        number: tableNumber.trim(),
        capacity: Number(tableCapacity),
        zone: tableZone,
        shape: tableShape,
        chairStyle: tableChairStyle,
        width: tableWidth,
        height: tableHeight,
        chairSize: tableChairSize,
        isStandaloneChair: tableShape === 'standalone_chair',
      });
    } else {
      addTable({
        number: tableNumber.trim(),
        capacity: Number(tableCapacity),
        zone: tableZone,
        shape: tableShape,
        chairStyle: tableChairStyle,
        width: tableWidth,
        height: tableHeight,
        chairSize: tableChairSize,
        isStandaloneChair: tableShape === 'standalone_chair',
        x: 60 + (tables.length % 4) * 180,
        y: 60 + Math.floor(tables.length / 4) * 150,
        rotation: 0,
      });
    }
    setShowTableModal(false);
    setEditingTable(null);
  };

  // Staff Save
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || staffPin.length !== 4) return;

    if (editingStaff) {
      updateStaff(editingStaff.id, {
        name: staffName.trim(),
        pin: staffPin.trim(),
        role: staffRole,
      });
    } else {
      addStaff({
        name: staffName.trim(),
        pin: staffPin.trim(),
        role: staffRole,
      });
    }
    setShowStaffModal(false);
    setEditingStaff(null);
  };

  // JSON Import
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = importDataJson(content);
        if (ok) {
          alert('นำเข้าข้อมูลสำเร็จ');
        } else {
          alert('ไฟล์สำรองไม่ถูกต้อง');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          การตั้งค่าระบบร้าน (Settings)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ตั้งค่าข้อมูลร้าน ภาษี เครื่องพิมพ์ QR ชำระเงิน โต๊ะ พนักงาน และสำรองข้อมูล
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto pb-1">
        {[
          { id: 'shop', label: 'ข้อมูลร้าน & ภาษี', icon: Store },
          { id: 'qr', label: 'QR ชำระเงิน', icon: QrCode },
          { id: 'tables', label: 'จัดการโต๊ะ & โซน', icon: Grid3X3 },
          { id: 'staff', label: 'พนักงาน & PIN', icon: Users },
          { id: 'membership', label: 'ระบบสมาชิก & แต้ม', icon: Sparkles },
          { id: 'backup', label: 'สำรองข้อมูล & รีเซ็ต', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Shop Information & Tax */}
      {activeTab === 'shop' && (
        <form onSubmit={handleSaveShopSettings} className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              ข้อมูลร้านและใบเสร็จรับเงิน
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อร้านค้า
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เบอร์โทรศัพท์ร้าน
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ที่อยู่ร้านค้า (แสดงบนใบเสร็จ)
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เลขประจำตัวผู้เสียภาษี (Tax ID)
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ข้อความท้ายใบเสร็จรับเงิน (Receipt Footer Message)
              </label>
              <textarea
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Tax & Service Charge Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              ภาษีและค่าบริการ (VAT & Service Charge)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VAT */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vatEnabled}
                    onChange={(e) => setVatEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    เปิดใช้ภาษีมูลค่าเพิ่ม (VAT)
                  </span>
                </label>

                {vatEnabled && (
                  <div className="space-y-3 pl-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">อัตราภาษี (%):</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={vatRate}
                        onChange={(e) => setVatRate(Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatType"
                          checked={vatInclusive}
                          onChange={() => setVatInclusive(true)}
                          className="text-amber-500"
                        />
                        <span>ราคารวม VAT แล้ว (Inclusive)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatType"
                          checked={!vatInclusive}
                          onChange={() => setVatInclusive(false)}
                          className="text-amber-500"
                        />
                        <span>คิด VAT เพิ่มเติม (Exclusive)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Charge */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceChargeEnabled}
                    onChange={(e) => setServiceChargeEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    เปิดใช้ค่าบริการ (Service Charge)
                  </span>
                </label>

                {serviceChargeEnabled && (
                  <div className="pl-6 flex items-center gap-2">
                    <span className="text-xs text-slate-500">อัตราค่าบริการ (%):</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={serviceChargeRate}
                      onChange={(e) => setServiceChargeRate(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>บันทึกการตั้งค่าเรียบร้อยแล้ว</span>
              </span>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Payment QR Management */}
      {activeTab === 'qr' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              อัปโหลดรูปภาพ QR รับชำระเงิน (PromptPay / บัญชีธนาคาร)
            </h3>
            <p className="text-xs text-slate-500">
              อัปโหลดรูปภาพ QR โค้ดรับเงินจริงของคุณ ระบบจะแสดงรูป QR นี้ขนาดใหญ่และชัดเจนบนหน้าจอรับชำระเงินของแคชเชียร์
            </p>

            {/* Upload Area */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ชื่อกำกับ QR (เช่น พร้อมเพย์ กสิกรไทย, QR ธ.กรุงเทพ):
                </label>
                <input
                  type="text"
                  value={newQrLabel}
                  onChange={(e) => setNewQrLabel(e.target.value)}
                  placeholder="เช่น พร้อมเพย์ 081-xxx-xxxx"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs w-64"
                />
              </div>

              <label className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition">
                <Upload className="w-4 h-4" />
                <span>{isUploadingQr ? 'กำลังอัปโหลด...' : 'เลือกรูป QR เพื่ออัปโหลด'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrFileChange}
                  disabled={isUploadingQr}
                  className="hidden"
                />
              </label>
            </div>

            {qrUploadError && (
              <p className="text-xs text-rose-500 font-semibold">{qrUploadError}</p>
            )}

            {/* List of uploaded QR codes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-3">
              {qrImages.map((qr) => (
                <div
                  key={qr.id}
                  className={`p-4 rounded-2xl border transition flex flex-col items-center text-center space-y-3 ${
                    qr.isDefault
                      ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <img
                    src={qr.imageData}
                    alt={qr.label}
                    className="w-36 h-36 object-contain rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white"
                  />
                  <div className="w-full">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {qr.label}
                    </div>
                    {qr.isDefault && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        ★ บัญชีเริ่มต้น
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full pt-2 border-t border-slate-100 dark:border-slate-800">
                    {!qr.isDefault && (
                      <button
                        type="button"
                        onClick={() => updateQrImage(qr.id, { isDefault: true })}
                        className="flex-1 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
                      >
                        ตั้งเป็นค่าเริ่มต้น
                      </button>
                    )}
                    {qrImages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteQrImage(qr.id)}
                        className="p-1 text-rose-500 hover:text-rose-700"
                        title="ลบ QR นี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Tables & Zones */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              รายการโต๊ะทั้งหมด ({tables.length} โต๊ะ)
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingTable(null);
                setTableNumber(`T${tables.length + 1}`);
                setTableCapacity(4);
                setTableZone('indoor');
                setTableShape('square');
                setTableChairStyle('standard');
                setTableWidth(112);
                setTableHeight(112);
                setTableChairSize(20);
                setShowTableModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มโต๊ะ</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tables.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="font-extrabold text-base text-slate-900 dark:text-white">
                    โต๊ะ {t.number}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t.capacity} ที่นั่ง · {t.zone} · {t.shape === 'round' ? 'กลม' : t.shape === 'rectangle' ? 'ยาว' : t.shape === 'counter' ? 'บาร์' : t.shape === 'standalone_chair' ? 'เก้าอี้เดี่ยว' : 'สี่เหลี่ยม'}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTable(t);
                      setTableNumber(t.number);
                      setTableCapacity(t.capacity);
                      setTableZone(t.zone);
                      setTableShape(t.shape || 'square');
                      setTableChairStyle(t.chairStyle || 'standard');
                      setTableWidth(t.width || (t.shape === 'counter' ? 220 : t.shape === 'rectangle' ? 180 : t.shape === 'standalone_chair' ? 56 : 112));
                      setTableHeight(t.height || (t.shape === 'counter' ? 80 : t.shape === 'standalone_chair' ? 56 : 112));
                      setTableChairSize(t.chairSize || 20);
                      setShowTableModal(true);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableToDelete(t)}
                    className="p-1 text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Staff & PIN Roles */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              จัดการพนักงานและรหัสผ่าน PIN 4 หลัก
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingStaff(null);
                setStaffName('');
                setStaffPin('1234');
                setStaffRole('waiter');
                setShowStaffModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มพนักงาน</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</div>
                  <div className="text-xs text-slate-400 capitalize">
                    {u.role === 'owner'
                      ? 'เจ้าของร้าน (Owner)'
                      : u.role === 'cashier'
                      ? 'แคชเชียร์ (Cashier)'
                      : u.role === 'waiter'
                      ? 'พนักงานเสิร์ฟ (Waiter)'
                      : 'ห้องครัว (Kitchen)'}
                  </div>
                  <div className="text-xs font-mono font-bold text-amber-500 mt-1">
                    รหัส PIN: {u.pin}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStaff(u);
                      setStaffName(u.name);
                      setStaffPin(u.pin);
                      setStaffRole(u.role);
                      setShowStaffModal(true);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  {users.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setStaffToDelete(u)}
                      className="p-1 text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Membership & Points */}
      {activeTab === 'membership' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              อัตราการสะสมแต้มและแลกส่วนลด
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ยอดใช้จ่ายที่ได้รับ 1 แต้ม (บาท)
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.pointsEarnRate}
                  onChange={(e) => updateSettings({ pointsEarnRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  มูลค่าส่วนลดต่อ 1 แต้ม (บาท)
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={settings.pointsRedeemRate}
                  onChange={(e) => updateSettings({ pointsRedeemRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-900 dark:text-white">
              รายชื่อสมาชิกร้าน ({members.length} ท่าน)
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500">
                <tr>
                  <th className="p-3">ชื่อสมาชิก</th>
                  <th className="p-3">เบอร์โทรศัพท์</th>
                  <th className="p-3 text-right">แต้มสะสมคงเหลือ</th>
                  <th className="p-3 text-right">ยอดซื้อสะสม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{m.name}</td>
                    <td className="p-3 font-mono">{m.phone}</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-500">
                      {m.points} แต้ม
                    </td>
                    <td className="p-3 text-right font-mono">{formatBaht(m.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Backup & Reset */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              สำรองและกู้คืนข้อมูล (Export / Import Backup)
            </h3>
            <p className="text-xs text-slate-500">
              ดาวน์โหลดไฟล์สำรองข้อมูล JSON ทั้งหมดของร้านอาหาร (รวมถึงเมนู, โต๊ะ, ยอดขาย, สต็อก) หรือกู้คืนจากไฟล์ที่เคยบันทึกไว้
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Export Button */}
              <button
                type="button"
                onClick={() => {
                  const data = exportDataJson();
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `kind_pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ส่งออกข้อมูลสำรอง (Export JSON)</span>
              </button>

              {/* Import Button */}
              <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer shadow-xs">
                <Upload className="w-4 h-4" />
                <span>นำเข้าไฟล์สำรอง (Import JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Reset Demo Data Card */}
          <div className="p-6 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-rose-700 dark:text-rose-400">
              รีเซ็ตข้อมูลตัวอย่างเริ่มต้น (Reset Demo Data)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              คืนค่าเมนูอาหาร 25 รายการ, โต๊ะ 12 ตัว, สต็อกวัตถุดิบ และผู้ใช้งานเริ่มต้นทั้งหมด
            </p>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>รีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้น</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Add/Edit Modal */}
      {showTableModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowTableModal(false)}
          title={editingTable ? `แก้ไขโต๊ะ ${editingTable.number}` : 'เพิ่มโต๊ะใหม่'}
          maxWidth="max-w-sm"
        >
          <form onSubmit={handleSaveTable} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">หมายเลขโต๊ะ (เช่น T13, VIP2)</label>
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">ความจุ (ที่นั่ง)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={tableCapacity}
                onChange={(e) => setTableCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">รูปทรงโต๊ะ</label>
              <select
                value={tableShape}
                onChange={(e) => setTableShape(e.target.value as TableShape)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="square">สี่เหลี่ยม (Square)</option>
                <option value="round">ทรงกลม (Round)</option>
                <option value="rectangle">สี่เหลี่ยมยาว (Rectangle)</option>
                <option value="counter">เคาน์เตอร์บาร์ (Bar / Counter)</option>
                <option value="standalone_chair">เก้าอี้/สตูลเดี่ยว (Standalone Chair)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">รูปแบบเก้าอี้</label>
              <select
                value={tableChairStyle}
                onChange={(e) => setTableChairStyle(e.target.value as ChairStyle)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="standard">เก้าอี้มาตรฐาน (Standard)</option>
                <option value="stool">เก้าอี้สตูลกลม (Stool)</option>
                <option value="sofa">โซฟา / เบาะยาว (Sofa / Bench)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">โซนที่ตั้ง</label>
              <select
                value={tableZone}
                onChange={(e) => setTableZone(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <option value="indoor">ในห้องแอร์ (Indoor)</option>
                <option value="outdoor">รับลมด้านนอก (Outdoor)</option>
                <option value="vip">ห้องพิเศษ (VIP)</option>
              </select>
            </div>

            {/* Table dimensions & chair size */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>ขนาดโต๊ะ</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">{tableWidth} x {tableHeight} px</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">กว้าง (Width)</span>
                  <input
                    type="range"
                    min="64"
                    max="340"
                    step="4"
                    value={tableWidth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTableWidth(val);
                      if (tableShape === 'square' || tableShape === 'round') {
                        setTableHeight(val);
                      }
                    }}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">ยาว (Height)</span>
                  <input
                    type="range"
                    min="50"
                    max="280"
                    step="4"
                    disabled={tableShape === 'square' || tableShape === 'round'}
                    value={tableHeight}
                    onChange={(e) => setTableHeight(Number(e.target.value))}
                    className="w-full accent-amber-500 disabled:opacity-40"
                  />
                </div>
              </div>

              {tableShape !== 'standalone_chair' && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <span>ขนาดเก้าอี้</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">{tableChairSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="38"
                    step="1"
                    value={tableChairSize}
                    onChange={(e) => setTableChairSize(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="px-4 py-2 text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950"
              >
                บันทึกโต๊ะ
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Staff Add/Edit Modal */}
      {showStaffModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowStaffModal(false)}
          title={editingStaff ? `แก้ไขพนักงาน: ${editingStaff.name}` : 'เพิ่มพนักงานใหม่'}
          maxWidth="max-w-sm"
        >
          <form onSubmit={handleSaveStaff} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">ชื่อพนักงาน</label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">รหัส PIN (ตัวเลข 4 หลัก)</label>
              <input
                type="text"
                maxLength={4}
                required
                value={staffPin}
                onChange={(e) => setStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-center tracking-widest text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">บทบาทหน้าที่ (Role)</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <option value="owner">เจ้าของร้าน (Owner - เข้าได้ทุกเมนู)</option>
                <option value="cashier">แคชเชียร์ (Cashier - รับชำระ, สั่งอาหาร, คลัง, รายงาน)</option>
                <option value="waiter">พนักงานบริการ (Waiter - ผังโต๊ะ และสั่งอาหาร)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="px-4 py-2 text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950"
              >
                บันทึกพนักงาน
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={() => {
            resetDemoData();
            setShowResetConfirm(false);
          }}
          title="ยืนยันการคืนค่าข้อมูลเริ่มต้น"
          message="ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยข้อมูลตัวอย่างเริ่มต้นของร้านอาหาร คุณแน่ใจหรือไม่?"
        />
      )}

      {/* Delete Table Confirm */}
      {tableToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setTableToDelete(null)}
          onConfirm={() => {
            deleteTable(tableToDelete.id);
            setTableToDelete(null);
          }}
          title="ยืนยันการลบโต๊ะ"
          message={`คุณต้องการลบโต๊ะ "${tableToDelete.number}" หรือไม่?`}
        />
      )}

      {/* Delete Staff Confirm */}
      {staffToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setStaffToDelete(null)}
          onConfirm={() => {
            deleteStaff(staffToDelete.id);
            setStaffToDelete(null);
          }}
          title="ยืนยันการลบพนักงาน"
          message={`คุณต้องการลบพนักงาน "${staffToDelete.name}" ออกจากระบบหรือไม่?`}
        />
      )}
    </div>
  );
};
