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
  AlertCircle,
  CheckCircle2,
  FileText,
  X,
  ShieldCheck,
  Package,
  Layers,
  Info,
  Bluetooth,
  Printer,
  RefreshCw,
  Monitor,
  ExternalLink,
  Eye,
  Usb,
  Cloud,
  CloudOff,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import { formatBaht } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompressor';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Table, User, TableShape, ChairStyle, PaymentMethod, ShopSettings } from '../../types';
import { soundService } from '../../utils/audio';
import { bluetoothPrinterService, BluetoothState } from '../../services/bluetoothPrinterService';
import { usbPrinterService, USBPrinterState } from '../../services/usbPrinterService';
import { CustomerDisplayView } from '../customer/CustomerDisplayView';
import { isFirebaseConfigured } from '../../firebaseConfig';

interface SaveButtonProps {
  status: 'idle' | 'saving' | 'saved' | 'pending' | 'error';
  errorMessage: string | null;
  onRetry?: () => void;
  className?: string;
}

const SaveButton: React.FC<SaveButtonProps> = ({ status, errorMessage, onRetry, className = '' }) => {
  return (
    <div className={`flex flex-col sm:flex-row items-end sm:items-center gap-2.5 ${className}`}>
      {/* Accessible Status Message */}
      <div aria-live="polite" className="text-xs font-semibold">
        {status === 'saved' && (
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-500" />
            <span>บันทึกแล้ว (ในเครื่อง + Cloud)</span>
          </span>
        )}
        {status === 'pending' && (
          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-in fade-in">
            <CloudOff className="w-4 h-4 text-amber-500" />
            <span>บันทึกในเครื่องแล้ว กำลังรอส่งขึ้น Cloud</span>
          </span>
        )}
        {status === 'error' && (
          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="max-w-xs truncate">{errorMessage || 'เกิดข้อผิดพลาดในการบันทึก'}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer"
          >
            ลองอีกครั้ง
          </button>
        )}

        <button
          type="submit"
          disabled={status === 'saving'}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer ${
            status === 'saving'
              ? 'bg-amber-400 text-slate-800 opacity-80 cursor-not-allowed'
              : status === 'saved'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : status === 'pending'
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-600'
              : status === 'error'
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
          }`}
        >
          {status === 'saving' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังบันทึก...</span>
            </>
          ) : status === 'saved' ? (
            <>
              <Check className="w-4 h-4" />
              <span>บันทึกข้อมูลร้าน & สื่อ</span>
            </>
          ) : status === 'pending' ? (
            <>
              <CloudOff className="w-4 h-4" />
              <span>บันทึกข้อมูลร้าน & สื่อ</span>
            </>
          ) : status === 'error' ? (
            <>
              <AlertTriangle className="w-4 h-4" />
              <span>บันทึกข้อมูลร้าน & สื่อ</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>บันทึกข้อมูลร้าน & สื่อ</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

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
    categories,
    menuItems,
    bills,
    optionPresets,
    resetDemoData,
    exportDataJson,
    importDataJson,

    // Cloud Sync (Phase 1)
    saveShopData,
    cloudUser,
    cloudSyncStatus,
    cloudConnected,
    cloudErrorMessage,
    loginCloud,
    logoutCloud,
    initialSyncPrompt,
    resolveInitialSync,
    cancelInitialSync,
    hasExternalCloudUpdate,
    applyExternalCloudUpdate,
    dismissExternalCloudUpdate,
    isFormEditingShop,
    setIsFormEditingShop,
  } = usePOS();

  const [activeTab, setActiveTab] = useState<
    'shop' | 'bluetooth' | 'dualscreen' | 'qr' | 'tables' | 'staff' | 'membership' | 'backup'
  >('shop');
  const [showSettingsCfdPreview, setShowSettingsCfdPreview] = useState(false);

  // Bluetooth Printer states
  const [btState, setBtState] = useState<BluetoothState>(bluetoothPrinterService.getState());
  const [btConnecting, setBtConnecting] = useState(false);
  const [btTestPrinting, setBtTestPrinting] = useState(false);
  const [btMessage, setBtMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // USB Printer states
  const [usbState, setUsbState] = useState<USBPrinterState>(usbPrinterService.getState());
  const [usbConnecting, setUsbConnecting] = useState(false);
  const [usbTestPrinting, setUsbTestPrinting] = useState(false);
  const [usbMessage, setUsbMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  React.useEffect(() => {
    const unsubBt = bluetoothPrinterService.subscribe((state) => {
      setBtState(state);
    });
    const unsubUsb = usbPrinterService.subscribe((state) => {
      setUsbState(state);
    });
    return () => {
      unsubBt();
      unsubUsb();
    };
  }, []);

  // Form states for Shop info & media (covering ALL ShopSettings fields)
  const [shopName, setShopName] = useState(settings.shopName || '');
  const [address, setAddress] = useState(settings.address || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [taxId, setTaxId] = useState(settings.taxId || '');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader || '');
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter || '');
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<'80mm' | '58mm'>(settings.receiptPaperWidth || '80mm');
  const [vatEnabled, setVatEnabled] = useState(Boolean(settings.vatEnabled));
  const [vatRate, setVatRate] = useState(settings.vatRate ?? 7);
  const [vatInclusive, setVatInclusive] = useState(Boolean(settings.vatInclusive));
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(Boolean(settings.serviceChargeEnabled));
  const [serviceChargeRate, setServiceChargeRate] = useState(settings.serviceChargeRate ?? 0);
  const [pointsEarnRate, setPointsEarnRate] = useState(settings.pointsEarnRate ?? 50);
  const [pointsRedeemRate, setPointsRedeemRate] = useState(settings.pointsRedeemRate ?? 1);
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<PaymentMethod[]>(
    settings.allowedPaymentMethods || ['cash', 'transfer']
  );
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');

  // Cloud Auth form states
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudAuthError, setCloudAuthError] = useState<string | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);

  // Sync external changes into form if user is not currently editing
  React.useEffect(() => {
    if (!isFormEditingShop) {
      setShopName(settings.shopName || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setTaxId(settings.taxId || '');
      setLogoUrl(settings.logoUrl || '');
      setReceiptHeader(settings.receiptHeader || '');
      setReceiptFooter(settings.receiptFooter || '');
      setReceiptPaperWidth(settings.receiptPaperWidth || '80mm');
      setVatEnabled(Boolean(settings.vatEnabled));
      setVatRate(settings.vatRate ?? 7);
      setVatInclusive(Boolean(settings.vatInclusive));
      setServiceChargeEnabled(Boolean(settings.serviceChargeEnabled));
      setServiceChargeRate(settings.serviceChargeRate ?? 0);
      setPointsEarnRate(settings.pointsEarnRate ?? 50);
      setPointsRedeemRate(settings.pointsRedeemRate ?? 1);
      setAllowedPaymentMethods(settings.allowedPaymentMethods || ['cash', 'transfer']);
    }
  }, [settings, isFormEditingShop]);

  const handleFieldChange = () => {
    if (!isFormEditingShop) {
      setIsFormEditingShop(true);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingLogo(true);
      setLogoUploadError('');
      handleFieldChange();
      const compressed = await compressImageFile(file, 600, 0.8);
      setLogoUrl(compressed);
    } catch {
      setLogoUploadError('ไม่สามารถอ่านหรือบีบอัดไฟล์รูปภาพได้');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save Shop Settings & Media (Single unified handler for both SaveButtons)
  const handleSaveShopSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsFormEditingShop(false);
    dismissExternalCloudUpdate();

    const updatedSettings: ShopSettings = {
      ...settings,
      shopName: shopName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      taxId: taxId.trim(),
      logoUrl: logoUrl,
      receiptHeader: receiptHeader.trim(),
      receiptFooter: receiptFooter.trim(),
      receiptPaperWidth,
      vatEnabled,
      vatRate: Number(vatRate),
      vatInclusive,
      serviceChargeEnabled,
      serviceChargeRate: Number(serviceChargeRate),
      pointsEarnRate: Number(pointsEarnRate),
      pointsRedeemRate: Number(pointsRedeemRate),
      allowedPaymentMethods,
    };

    updateSettings(updatedSettings);

    await saveShopData({
      settings: updatedSettings,
      qrImages,
      logo: logoUrl,
    });
  };

  const handleConnectCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEmail || !cloudPassword) {
      setCloudAuthError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setCloudAuthError(null);
    setIsConnectingCloud(true);
    try {
      await loginCloud(cloudEmail, cloudPassword);
      setCloudPassword('');
    } catch (err: any) {
      console.warn('Cloud login error:', err);
      let msg = 'ไม่สามารถเข้าสู่ระบบ Cloud ได้ กรุณาตรวจสอบอีเมลหรือรหัสผ่าน';
      if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/user-not-found'
      ) {
        msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      } else if (err?.code === 'auth/too-many-requests') {
        msg = 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
      } else if (err?.message) {
        msg = err.message;
      }
      setCloudAuthError(msg);
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const handleDisconnectCloud = async () => {
    try {
      await logoutCloud();
      setCloudAuthError(null);
    } catch (err) {
      console.warn('Cloud logout error:', err);
    }
  };


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

  // Restore & Backup states
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [pendingRestoreRaw, setPendingRestoreRaw] = useState<string>('');
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);


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

  // Export full backup with all data: images, prices, variants, option presets, tables, bills, settings
  const handleExportFullBackup = () => {
    soundService.playTap();
    const data = exportDataJson();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nowStr = new Date().toISOString().slice(0, 10);
    const fileName = `kind_pos_full_backup_${nowStr}.json`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    soundService.playReadyChime();
    setExportSuccessMessage(`สำรองข้อมูลทั้งหมดสำเร็จ! ดาวน์โหลดไฟล์ "${fileName}" เรียบร้อยแล้ว`);
    setTimeout(() => setExportSuccessMessage(null), 6000);
  };

  // Select and validate JSON backup file for restore
  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setRestoreSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error('ไฟล์ว่างเปล่า');

        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง');

        const hasValidData = Boolean(
          (parsed.menuItems && Array.isArray(parsed.menuItems)) ||
          (parsed.tables && Array.isArray(parsed.tables)) ||
          (parsed.categories && Array.isArray(parsed.categories)) ||
          (parsed.settings && typeof parsed.settings === 'object')
        );

        if (!hasValidData) {
          setRestoreError('ไฟล์ที่เลือกไม่ใช่ไฟล์สำรองข้อมูลของระบบ KinD POS กรุณาตรวจสอบและเลือกไฟล์ .json ที่ถูกต้อง');
          return;
        }

        soundService.playTap();
        setPendingRestoreData(parsed);
        setPendingRestoreRaw(content);
        setPendingFileName(file.name);
        setShowRestoreModal(true);
      } catch (err: any) {
        setRestoreError('ไม่สามารถอ่านไฟล์สำรองได้: ' + (err?.message || 'ไฟล์เสียหายหรือรูปแบบไม่ถูกต้อง'));
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input to allow re-selection
  };

  // Confirm and execute complete system restore
  const handleConfirmRestore = () => {
    if (!pendingRestoreRaw) return;

    const ok = importDataJson(pendingRestoreRaw);
    if (ok) {
      soundService.playReadyChime();
      setRestoreSuccess(
        'กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว! รายการอาหาร รูปภาพ ราคา ตัวเลือกย่อย ผังโต๊ะ และข้อมูลระบบทั้งหมดได้รับการกู้คืนอย่างสมบูรณ์'
      );
      setShowRestoreModal(false);
      setPendingRestoreData(null);
      setPendingRestoreRaw('');
      setPendingFileName('');
      setTimeout(() => setRestoreSuccess(null), 8000);
    } else {
      setRestoreError('เกิดข้อผิดพลาดในการกู้คืนข้อมูล กรุณาตรวจสอบไฟล์สำรองอีกครั้ง');
      setShowRestoreModal(false);
    }
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
          { id: 'bluetooth', label: 'เครื่องพิมพ์ (USB & BT)', icon: Printer },
          { id: 'dualscreen', label: 'จอลูกค้า (2 จอ)', icon: Monitor },
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

      {/* Tab 1: Shop Information & Media & Cloud Sync */}
      {activeTab === 'shop' && (
        <form onSubmit={handleSaveShopSettings} className="space-y-6">
          {/* Sticky Top Header with Title and SaveButton (Requirement D.1, D.2) */}
          <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 -mt-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  ข้อมูลร้าน & สื่อ (Shop Profile & Cloud Sync)
                </h3>
                <p className="text-[11px] text-slate-500">
                  ซิงค์แบบ Local-first บันทึกลงเครื่องทันทีและส่งขึ้น Cloud
                </p>
              </div>
            </div>

            <SaveButton
              status={cloudSyncStatus}
              errorMessage={cloudErrorMessage}
              onRetry={handleSaveShopSettings}
            />
          </div>

          {/* Conflict Notice: Update arrived from another device while editing (Requirement B.6) */}
          {hasExternalCloudUpdate && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    มีการอัปเดตข้อมูลร้านจากเครื่องอื่น
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    มีข้อมูลอัปเดตใหม่ล่าสุดจาก Cloud ระบบจะไม่เขียนทับช่องที่คุณกำลังพิมพ์อยู่
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyExternalCloudUpdate}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>โหลดค่าใหม่ (Reload)</span>
                </button>
                <button
                  type="button"
                  onClick={dismissExternalCloudUpdate}
                  className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs transition cursor-pointer"
                >
                  คงค่าที่กำลังพิมพ์
                </button>
              </div>
            </div>
          )}

          {/* Section: Cloud Firestore & Auth Connection (Requirement A.4) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    cloudConnected
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : cloudUser
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {cloudConnected ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    เชื่อมต่อ Cloud (Cloud Firestore & Auth)
                  </h3>
                  <p className="text-xs text-slate-500">
                    เข้าสู่ระบบบัญชีเจ้าของร้านเพื่อซิงค์ข้อมูลร้านและการตั้งค่าข้ามเครื่อง
                  </p>
                </div>
              </div>

              <div>
                {cloudConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    เชื่อมต่อแล้ว (Online)
                  </span>
                ) : cloudUser ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    ออฟไลน์ (Offline)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-medium">
                    ยังไม่เชื่อมต่อ (Local Mode)
                  </span>
                )}
              </div>
            </div>

            {!isFirebaseConfigured() ? (
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 text-xs text-sky-800 dark:text-sky-300 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-500 shrink-0" />
                  <span>ยังไม่ได้กำหนดค่า Firebase ในไฟล์ src/firebaseConfig.ts</span>
                </p>
                <p className="text-[11px] leading-relaxed text-sky-700 dark:text-sky-400">
                  ระบบกำลังทำงานในโหมด Local-first โดยจัดเก็บข้อมูลลงใน LocalStorage บนเครื่องนี้อย่างสมบูรณ์
                  เมื่อต้องการซิงค์ Cloud ให้นำค่า Firebase Web App Config มาใส่ใน <code className="px-1 py-0.5 rounded bg-sky-100 dark:bg-sky-900 font-mono">src/firebaseConfig.ts</code>
                </p>
              </div>
            ) : cloudUser ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-slate-500">บัญชีเจ้าของร้านที่เข้าสู่ระบบ:</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>{cloudUser.email}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    เข้าสู่ระบบแล้ว 1 บัญชีต่อเครื่อง ข้อมูลจะซิงค์กับ Cloud Firestore แบบ Local-first อัตโนมัติ
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectCloud}
                  className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition cursor-pointer shrink-0"
                >
                  ตัดการเชื่อมต่อ Cloud
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  กรอกอีเมลและรหัสผ่านของเจ้าของร้าน (ทำครั้งเดียวต่อเครื่อง) เพื่อเชื่อมต่อฐานข้อมูล Cloud
                </p>

                {cloudAuthError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{cloudAuthError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      อีเมลเจ้าของร้าน
                    </label>
                    <input
                      type="email"
                      placeholder="owner@myrestaurant.com"
                      value={cloudEmail}
                      onChange={(e) => setCloudEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      รหัสผ่าน
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={cloudPassword}
                      onChange={(e) => setCloudPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-sans"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleConnectCloud}
                    disabled={isConnectingCloud}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isConnectingCloud ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังเชื่อมต่อ...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5" />
                        <span>เชื่อมต่อ Cloud</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Shop Logo & Media */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-500" />
              <span>โลโก้และรูปสื่อของร้าน (Shop Logo & Media)</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <Store className="w-8 h-8 mx-auto mb-1 opacity-50" />
                    <span className="text-[10px]">ยังไม่มีโลโก้</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoUrl ? 'เปลี่ยนรูปโลโก้' : 'อัปโหลดโลโก้'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        handleFieldChange();
                      }}
                      className="px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบโลโก้</span>
                    </button>
                  )}
                </div>

                {logoUploadError && (
                  <p className="text-xs text-rose-500 font-semibold">{logoUploadError}</p>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  รองรับไฟล์ภาพ PNG, JPG หรือ SVG ระบบบีบอัดให้อัตโนมัติไม่เกิน 700 KB เพื่อความรวดเร็วในการซิงค์ขึ้น Cloud
                </p>
              </div>
            </div>
          </div>

          {/* Section: Shop Information & Receipt details */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              ข้อมูลร้านและข้อความใบเสร็จรับเงิน
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อร้านค้า <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => {
                    setShopName(e.target.value);
                    handleFieldChange();
                  }}
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
                  onChange={(e) => {
                    setPhone(e.target.value);
                    handleFieldChange();
                  }}
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
                  onChange={(e) => {
                    setAddress(e.target.value);
                    handleFieldChange();
                  }}
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
                  onChange={(e) => {
                    setTaxId(e.target.value);
                    handleFieldChange();
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ข้อความหัวใบเสร็จรับเงิน (Receipt Header)
                </label>
                <textarea
                  rows={2}
                  value={receiptHeader}
                  onChange={(e) => {
                    setReceiptHeader(e.target.value);
                    handleFieldChange();
                  }}
                  placeholder="เช่น ยินดีต้อนรับสู่ร้าน KinD อาหารไทยรสชาติต้นตำรับ"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ข้อความท้ายใบเสร็จรับเงิน (Receipt Footer Message)
                </label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => {
                    setReceiptFooter(e.target.value);
                    handleFieldChange();
                  }}
                  placeholder="เช่น ขอบคุณที่ใช้บริการ / Thank you"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ขนาดกระดาษใบเสร็จมาตรฐาน
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="paperWidth"
                    checked={receiptPaperWidth === '80mm'}
                    onChange={() => {
                      setReceiptPaperWidth('80mm');
                      handleFieldChange();
                    }}
                    className="text-amber-500"
                  />
                  <span>80 มม. (มาตรฐานเครื่อง POS)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="paperWidth"
                    checked={receiptPaperWidth === '58mm'}
                    onChange={() => {
                      setReceiptPaperWidth('58mm');
                      handleFieldChange();
                    }}
                    className="text-amber-500"
                  />
                  <span>58 มม. (เครื่องพิมพ์พกพาขนาดเล็ก)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section: Tax & Service Charge Card */}
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
                    onChange={(e) => {
                      setVatEnabled(e.target.checked);
                      handleFieldChange();
                    }}
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
                        onChange={(e) => {
                          setVatRate(Number(e.target.value));
                          handleFieldChange();
                        }}
                        className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatType"
                          checked={vatInclusive}
                          onChange={() => {
                            setVatInclusive(true);
                            handleFieldChange();
                          }}
                          className="text-amber-500"
                        />
                        <span>ราคารวม VAT แล้ว (Inclusive)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatType"
                          checked={!vatInclusive}
                          onChange={() => {
                            setVatInclusive(false);
                            handleFieldChange();
                          }}
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
                    onChange={(e) => {
                      setServiceChargeEnabled(e.target.checked);
                      handleFieldChange();
                    }}
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
                      onChange={(e) => {
                        setServiceChargeRate(Number(e.target.value));
                        handleFieldChange();
                      }}
                      className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Points & Membership Settings */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>อัตราสะสมและใช้แต้มสมาชิก (Points & Loyalty)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ยอดซื้อที่ได้รับ 1 แต้ม (บาท)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={pointsEarnRate}
                    onChange={(e) => {
                      setPointsEarnRate(Number(e.target.value));
                      handleFieldChange();
                    }}
                    className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                  />
                  <span className="text-xs text-slate-500">บาท = 1 แต้ม</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  มูลค่าส่วนลดต่อ 1 แต้ม (บาท)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={pointsRedeemRate}
                    onChange={(e) => {
                      setPointsRedeemRate(Number(e.target.value));
                      handleFieldChange();
                    }}
                    className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                  />
                  <span className="text-xs text-slate-500">1 แต้ม = บาทส่วนลด</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: QR Payment Summary */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  รูป QR ชำระเงิน ({qrImages.length} บัญชี)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className="text-xs text-amber-500 hover:text-amber-600 font-bold transition cursor-pointer"
              >
                จัดการบัญชี QR ทั้งหมด &rarr;
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {qrImages.map((qr) => (
                <div
                  key={qr.id}
                  className="flex items-center gap-2.5 p-2 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                >
                  <img
                    src={qr.imageData}
                    alt={qr.label}
                    className="w-10 h-10 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{qr.label}</span>
                      {qr.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold">
                          หลัก
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {qrImages.length === 0 && (
                <span className="text-xs text-slate-400">ยังไม่มีรูป QR ชำระเงิน</span>
              )}
            </div>
          </div>

          {/* Bottom Save Button (Identical handler and status to sticky header) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              ทุกครั้งที่กดบันทึก ข้อมูลร้านและรูปภาพจะถูกบันทึกในเครื่องทันที และส่งขึ้น Cloud
            </span>
            <SaveButton
              status={cloudSyncStatus}
              errorMessage={cloudErrorMessage}
              onRetry={handleSaveShopSettings}
            />
          </div>
        </form>
      )}

      {/* Tab: Thermal Printer Management (USB & Bluetooth) */}
      {activeTab === 'bluetooth' && (
        <div className="space-y-6">
          {/* Card 1: USB Thermal Printer Management */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Usb className="w-5 h-5 text-emerald-500" />
                  <span>จัดการเครื่องพิมพ์พอร์ต USB (WebUSB ESC/POS Thermal Printer)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  เชื่อมต่อเครื่องพิมพ์ใบเสร็จความร้อนผ่านสาย USB โดยตรง รองรับการจดจำอุปกรณ์และเชื่อมต่อให้อัตโนมัติทุกครั้งที่เปิดแอป
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 flex items-center gap-2">
                {usbState.isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>เชื่อมต่อ USB แล้ว: {usbState.deviceName}</span>
                    {usbState.isSimulated && <span className="opacity-75 text-[10px]">(จำลอง)</span>}
                  </span>
                ) : usbConnecting ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>กำลังค้นหา USB...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>ยังไม่ได้เชื่อมต่อ USB</span>
                  </span>
                )}
              </div>
            </div>

            {/* Notification Banner */}
            {usbMessage && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
                  usbMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : usbMessage.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                <span>{usbMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setUsbMessage(null)}
                  className="p-1 hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {!usbState.isConnected ? (
                <>
                  <button
                    type="button"
                    disabled={usbConnecting}
                    onClick={async () => {
                      setUsbConnecting(true);
                      setUsbMessage(null);
                      soundService.playTap();
                      const res = await usbPrinterService.connect();
                      setUsbConnecting(false);
                      if (res.success) {
                        soundService.playReadyChime();
                        setUsbMessage({
                          type: 'success',
                          text: `เชื่อมต่อกับ "${res.deviceName}" ผ่านพอร์ต USB สำเร็จ พร้อมสั่งพิมพ์ใบเสร็จและจดจำอุปกรณ์อัตโนมัติ`,
                        });
                      } else {
                        setUsbMessage({
                          type: 'error',
                          text: res.error || 'ไม่สามารถเชื่อมต่ออุปกรณ์ USB ได้',
                        });
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Usb className="w-4 h-4" />
                    <span>{usbConnecting ? 'กำลังค้นหา USB...' : 'ค้นหา & เชื่อมต่อเครื่องพิมพ์ USB'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playReadyChime();
                      usbPrinterService.simulateConnection();
                      setUsbMessage({
                        type: 'success',
                        text: 'เปิดใช้งานโหมดจำลองเครื่องพิมพ์ USB (Demo Simulator) สำเร็จแล้ว สามารถทดสอบพิมพ์ได้ทันที',
                      });
                    }}
                    className="px-4 py-2.5 rounded-xl border border-dashed border-emerald-400/80 hover:border-emerald-500 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    title="ทดสอบระบบจำลอง USB สำหรับอุปกรณ์ที่ไม่มีเครื่องพิมพ์ USB เสียบอยู่จริง"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>จำลองเชื่อมต่อ USB (Demo)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={usbTestPrinting}
                    onClick={async () => {
                      setUsbTestPrinting(true);
                      setUsbMessage(null);
                      soundService.playTap();
                      const res = await usbPrinterService.printTestReceipt(settings);
                      setUsbTestPrinting(false);
                      if (res.success) {
                        soundService.playSuccessTap();
                        setUsbMessage({
                          type: 'success',
                          text: 'ส่งคำสั่งพิมพ์ใบเสร็จทดสอบไปยังเครื่องพิมพ์ USB เรียบร้อยแล้ว',
                        });
                      } else {
                        setUsbMessage({
                          type: 'error',
                          text: res.error || 'เกิดข้อผิดพลาดในการพิมพ์ทดสอบผ่าน USB',
                        });
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{usbTestPrinting ? 'กำลังพิมพ์ USB...' : 'พิมพ์ใบเสร็จทดสอบผ่าน USB (Test Print)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playTap();
                      usbPrinterService.disconnect();
                      setUsbMessage({ type: 'info', text: 'ตัดการเชื่อมต่อเครื่องพิมพ์ USB แล้ว' });
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ตัดการเชื่อมต่อ USB</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Bluetooth Thermal Printer Management */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Bluetooth className="w-5 h-5 text-sky-500" />
                  <span>จัดการเครื่องพิมพ์ & อุปกรณ์ Bluetooth (Thermal Printer)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  เชื่อมต่อเครื่องพิมพ์ใบเสร็จความร้อนบลูทูธ (ESC/POS 80mm / 58mm) ผ่าน Web Bluetooth โดยตรง ไม่ต้องลงไดรเวอร์เพิ่มเติม
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 flex items-center gap-2">
                {btState.isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>เชื่อมต่อแล้ว: {btState.deviceName}</span>
                    {btState.isSimulated && <span className="opacity-75 text-[10px]">(จำลอง)</span>}
                  </span>
                ) : btConnecting ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>กำลังค้นหาอุปกรณ์...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>ยังไม่ได้เชื่อมต่อ</span>
                  </span>
                )}
              </div>
            </div>

            {/* Notification / Feedback Banner */}
            {btMessage && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
                  btMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : btMessage.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                }`}
              >
                <span>{btMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setBtMessage(null)}
                  className="p-1 hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Connection Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {!btState.isConnected ? (
                <>
                  <button
                    type="button"
                    disabled={btConnecting}
                    onClick={async () => {
                      setBtConnecting(true);
                      setBtMessage(null);
                      soundService.playTap();
                      const res = await bluetoothPrinterService.connect();
                      setBtConnecting(false);
                      if (res.success) {
                        soundService.playReadyChime();
                        setBtMessage({
                          type: 'success',
                          text: `เชื่อมต่อกับ "${res.deviceName}" เรียบร้อยแล้ว พร้อมสั่งพิมพ์ใบเสร็จผ่าน Bluetooth`,
                        });
                      } else {
                        setBtMessage({
                          type: 'error',
                          text: res.error || 'ไม่สามารถเชื่อมต่ออุปกรณ์ Bluetooth ได้',
                        });
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>{btConnecting ? 'กำลังค้นหา Bluetooth...' : 'ค้นหา & เชื่อมต่อเครื่องพิมพ์ Bluetooth'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playReadyChime();
                      bluetoothPrinterService.simulateConnection();
                      setBtMessage({
                        type: 'success',
                        text: 'เปิดใช้งานโหมดจำลองเครื่องพิมพ์ Bluetooth (Demo) สำเร็จแล้ว สามารถทดสอบพิมพ์ได้ทันที',
                      });
                    }}
                    className="px-4 py-2.5 rounded-xl border border-dashed border-sky-400/80 hover:border-sky-500 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    title="ทดสอบระบบจำลอง Bluetooth สำหรับอุปกรณ์ที่ไม่มีฮาร์ดแวร์บลูทูธจริง"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>จำลองเชื่อมต่อ (Demo Simulator)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={btTestPrinting}
                    onClick={async () => {
                      setBtTestPrinting(true);
                      setBtMessage(null);
                      soundService.playTap();
                      const res = await bluetoothPrinterService.printTestReceipt(settings);
                      setBtTestPrinting(false);
                      if (res.success) {
                        soundService.playSuccessTap();
                        setBtMessage({
                          type: 'success',
                          text: 'ส่งคำสั่งพิมพ์ใบเสร็จทดสอบไปยังเครื่องพิมพ์ Bluetooth เรียบร้อยแล้ว',
                        });
                      } else {
                        setBtMessage({
                          type: 'error',
                          text: res.error || 'เกิดข้อผิดพลาดในการพิมพ์ทดสอบ',
                        });
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{btTestPrinting ? 'กำลังพิมพ์ทดสอบ...' : 'พิมพ์ใบเสร็จทดสอบ (Test Print)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playTap();
                      bluetoothPrinterService.disconnect();
                      setBtMessage({ type: 'info', text: 'ตัดการเชื่อมต่ออุปกรณ์ Bluetooth แล้ว' });
                    }}
                    className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ตัดการเชื่อมต่อ</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Configuration Options Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Printer className="w-4 h-4 text-amber-500" />
              <span>การตั้งค่าการพิมพ์ใบเสร็จความร้อน (Thermal ESC/POS Config - USB & Bluetooth)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Paper Width Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ขนาดหน้ากว้างกระดาษใบเสร็จ (Paper Width):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      bluetoothPrinterService.setPaperWidth('80mm');
                      usbPrinterService.setPaperWidth('80mm');
                      soundService.playTap();
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      btState.paperWidth === '80mm' || usbState.paperWidth === '80mm'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 ring-2 ring-amber-400/40'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">80 มม. (มาตรฐานร้านอาหาร)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      ความกว้าง 48 ตัวอักษร/บรรทัด พิมพ์รายละเอียดครบถ้วน
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      bluetoothPrinterService.setPaperWidth('58mm');
                      usbPrinterService.setPaperWidth('58mm');
                      soundService.playTap();
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      btState.paperWidth === '58mm' && usbState.paperWidth === '58mm'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 ring-2 ring-amber-400/40'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">58 มม. (ขนาดพกพา / มินิ)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      ความกว้าง 32 ตัวอักษร/บรรทัด กะทัดรัด ประหยัดกระดาษ
                    </div>
                  </button>
                </div>
              </div>

              {/* Auto Print Toggle */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  การพิมพ์ใบเสร็จอัตโนมัติ:
                </label>
                <div
                  onClick={() => {
                    const nextVal = !(btState.autoPrintEnabled || usbState.autoPrintEnabled);
                    bluetoothPrinterService.setAutoPrint(nextVal);
                    usbPrinterService.setAutoPrint(nextVal);
                    soundService.playTap();
                  }}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition select-none ${
                    btState.autoPrintEnabled || usbState.autoPrintEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">พิมพ์ใบเสร็จอัตโนมัติเมื่อกดชำระเงิน</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      ส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์ USB / Bluetooth ทันทีเมื่อกดยืนยันการชำระเงิน
                    </div>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                      btState.autoPrintEnabled || usbState.autoPrintEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        btState.autoPrintEnabled || usbState.autoPrintEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compatibility & Instructions Card */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-500" />
              <span>คำแนะนำการเชื่อมต่อและรุ่นเครื่องพิมพ์ที่รองรับ</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  รุ่นเครื่องพิมพ์บลูทูธที่รองรับ:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Xprinter (XP-58, XP-80, XP-N160II BT ฯลฯ)</li>
                  <li>GOOJPRT, PeriPage, Paperang, Sunmi POS</li>
                  <li>Epson TM-T20 / TM-T88 Bluetooth</li>
                  <li>เครื่องพิมพ์ใบเสร็จความร้อน ESC/POS ไร้สายทุกยี่ห้อ</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  ข้อกำหนดของอุปกรณ์และเบราว์เซอร์:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>เปิด Bluetooth บนคอมพิวเตอร์ แท็บเล็ต หรือสมาร์ทโฟน</li>
                  <li>ใช้งานผ่าน Google Chrome หรือ Microsoft Edge (HTTPS)</li>
                  <li>กดปุ่ม &quot;ค้นหา & เชื่อมต่อ&quot; แล้วเลือกชื่อเครื่องพิมพ์จากหน้าต่างป๊อปอัป</li>
                  <li>หากไม่มีเครื่องพิมพ์จริง สามารถใช้ปุ่ม &quot;จำลองเชื่อมต่อ (Demo)&quot; เพื่อทดสอบระบบได้</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Dual-Screen Customer Display (CFD) */}
      {activeTab === 'dualscreen' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-amber-500" />
                  <span>ระบบเครื่อง POS 2 หน้าจอ (Dual-Screen Customer Facing Display)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  สำหรับเครื่อง POS ที่มี 2 หน้าจอ (เช่น Sunmi D2s Plus, เครื่อง POS Windows/Android จอหน้า-จอหลัง) จอหลังหันหน้าหาลูกค้าเพื่อแสดงบิลและสแกนจ่ายเงิน
                </p>
              </div>
            </div>

            {/* Launch Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    หน้าจอที่ 2 จริง (Second Monitor)
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    เปิดหน้าจอลูกค้าในหน้าต่างใหม่
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    ระบบจะเปิดหน้าต่าง Customer Display (URL: <code>/?view=customer</code>) นำหน้าต่างนี้ลากไปแสดงที่จอหลังของเครื่อง POS และกดขยายเต็มจอ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?view=customer#customer`;
                    const win = window.open(url, 'kind_pos_customer_display', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
                    if (win) {
                      try { win.focus(); } catch {}
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>เปิดหน้าจอลูกค้า (New Window)</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                    <Eye className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    ทดสอบจำลองมุมมองลูกค้า
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    ดูตัวอย่างหน้าจอลูกค้า (Live Preview)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    จำลองหน้าจอลูกค้าขนาดเต็มบนหน้าจอหลักนี้ทันที เพื่อตรวจสอบหน้าตาบิล สไลด์เมนูแนะนำ และ QR พร้อมเพย์
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsCfdPreview(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>ดูตัวอย่างหน้าจอ (Preview)</span>
                </button>
              </div>

              {/* Set this device as customer display */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    สำหรับตั้งค่าจอที่ 2 ของ Sunmi
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    สลับหน้าจอนี้เป็น &quot;จอลูกค้า (Customer Display จอที่ 2)&quot; ทันที
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    หากเปิดระบบนี้บนหน้าจอหลังของเครื่อง POS ให้กดปุ่มนี้เพื่อล็อคให้อุปกรณ์หรือหน้าจอนี้แสดงผลเฉพาะบิลออเดอร์และหน้าจอชำระเงินสำหรับลูกค้าเท่านั้น (สามารถสลับกลับเป็นจอพนักงานได้ตลอดเวลา)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('kind_pos_screen_role', 'customer');
                    window.location.hash = '#customer';
                    window.dispatchEvent(new Event('kind_pos_screen_role_change'));
                  }}
                  className="py-2.5 px-4 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-900 dark:text-amber-300 font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Monitor className="w-4 h-4" />
                  <span>ตั้งค่าหน้านี้เป็นหน้าจอลูกค้า (Customer Display)</span>
                </button>
              </div>
            </div>

            {/* Feature Highlights Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>คุณสมบัติการทำงานของระบบ 2 หน้าจอ KinD POS</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">⚡ ซิงค์ข้อมูล Real-time</span>
                  <span>เชื่อมต่ออัตโนมัติความเร็วระดับมิลลิวินาทีระหว่างจอแคชเชียร์และจอลูกค้าโดยไม่ต้องติดตั้งเซิร์ฟเวอร์แยก</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">📱 QR พร้อมเพย์คมชัด</span>
                  <span>เมื่อแคชเชียร์เปิดหน้าชำระเงิน จะแสดงรูปภาพ QR Code พร้อมยอดเงินรวมสุทธิให้ลูกค้าสแกนจ่ายได้ทันที</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">🥗 สไลด์แนะนำเมนูอาหาร (Digital Signage)</span>
                  <span>ขณะที่ยังไม่มีการสั่งอาหาร จอลูกค้าจะเปลี่ยนเป็นสไลด์โชว์โปรโมชันและเมนูแนะนำยอดนิยมของทางร้านโดยอัตโนมัติ</span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">🎉 หน้าจอแสดงความขอบคุณ & เงินทอน</span>
                  <span>เมื่อยืนยันชำระเงิน จอจะแสดงยอดเงินรับ ยอดเงินทอน และข้อความขอบคุณลูกค้าอย่างสวยงาม</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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

      {/* Tab 6: Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Success Banner */}
          {restoreSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-start justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    กู้คืนข้อมูลสำเร็จเรียบร้อย
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {restoreSuccess}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreSuccess(null)}
                className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {exportSuccessMessage && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    สำรองข้อมูลสำเร็จ
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    {exportSuccessMessage}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportSuccessMessage(null)}
                className="text-amber-500 hover:text-amber-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Banner */}
          {restoreError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    เกิดข้อผิดพลาด
                  </div>
                  <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    {restoreError}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreError(null)}
                className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Card 1: Full System Backup */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    สำรองข้อมูลทั้งหมดของร้าน (Full Backup)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    บันทึกข้อมูลทุกอย่างเป็นไฟล์ JSON เพื่อป้องกันข้อมูลสูญหาย
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              การสำรองข้อมูลนี้จะรวม<strong>ข้อมูลทุกอย่างในระบบแบบสมบูรณ์</strong> ทั้งรูปภาพรายการอาหาร (Food Photos), ราคาและต้นทุน, ตัวเลือกย่อยและหมวด set เมนูย่อย, ผังโต๊ะและเก้าอี้, บิลและประวัติการขาย, บัญชี QR ชำระเงิน, ข้อมูลร้าน และระบบสมาชิกสะสมแต้ม
            </p>

            {/* Current System Data Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">รายการอาหาร</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 block">
                  {menuItems.length} รายการ
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">รูปภาพ+ตัวเลือกย่อยครบ</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">หมวดหมู่ & Set ย่อย</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 block">
                  {categories.length} หมวด / {optionPresets.length} set
                </span>
                <span className="text-[10px] text-slate-400">โครงสร้างเมนูครบ</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">ผังโต๊ะ & เก้าอี้</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 block">
                  {tables.length} ตัว
                </span>
                <span className="text-[10px] text-slate-400">พิกัดและขนาดเก้าอี้</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">บิล & สมาชิก & QR</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 block">
                  {bills.length} บิล / {members.length} สมาชิก
                </span>
                <span className="text-[10px] text-slate-400">{qrImages.length} บัญชี QR ชำระเงิน</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleExportFullBackup}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-extrabold text-xs shadow-md transition cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>ดาวน์โหลดไฟล์สำรองข้อมูลทั้งหมด (.json)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Restore Data from Backup */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    กู้คืนข้อมูลระบบ (Restore from Backup)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    นำไฟล์สำรองที่เคยบันทึกไว้กลับมาติดตั้งใหม่ในระบบ เพื่อป้องกันข้อมูลสูญหาย
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              เมื่อเลือกไฟล์สำรอง (.json) ระบบจะตรวจสอบความถูกต้องของไฟล์ และแสดงรายละเอียดข้อมูลที่จะถูกกู้คืน (รวมถึงรายการอาหาร รูปภาพ ราคา ตัวเลือกย่อย และผังโต๊ะ) ให้ตรวจสอบก่อนกดยืนยันกู้คืน
            </p>

            <label className="flex flex-col sm:flex-row items-center justify-between p-4.5 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700/80 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/40 transition cursor-pointer gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    เลือกไฟล์สำรองข้อมูล (.json) เพื่อกู้คืน
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    คลิกเพื่อเปิดหาไฟล์ backup (.json) ที่ดาวน์โหลดไว้จากเครื่องของคุณ
                  </div>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs shrink-0 flex items-center gap-1.5 pointer-events-none">
                <Upload className="w-3.5 h-3.5" />
                <span>เลือกไฟล์สำรอง</span>
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleSelectRestoreFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Card 3: Reset Demo Data */}
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

      {/* Restore Confirmation Modal */}
      {showRestoreModal && pendingRestoreData && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowRestoreModal(false);
            setPendingRestoreData(null);
            setPendingRestoreRaw('');
            setPendingFileName('');
          }}
          title="ยืนยันการกู้คืนข้อมูลร้าน (Restore Confirmation)"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-amber-900 dark:text-amber-200">
                  ตรวจพบไฟล์สำรองข้อมูล: {pendingFileName}
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  สำรองเมื่อ:{' '}
                  {pendingRestoreData.exportedAt
                    ? new Date(pendingRestoreData.exportedAt).toLocaleString('th-TH')
                    : 'ไม่ระบุวันเวลา'}
                </p>
              </div>
            </div>

            {/* Summary of Data in the Backup */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                ข้อมูลที่จะได้รับการกู้คืนเข้าสู่ระบบทั้งหมด:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">ชื่อร้านค้า:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">
                    {pendingRestoreData.settings?.shopName || 'ไม่ระบุ'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">รายการอาหาร:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.menuItems?.length || 0} รายการ (รูปภาพ & ตัวเลือกย่อยครบ)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">หมวดหมู่อาหาร:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.categories?.length || 0} หมวดหมู่
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">หมวด set เมนูย่อย:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.optionPresets?.length || 0} ชุด
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">ผังโต๊ะ & เก้าอี้:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.tables?.length || 0} ตัว
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">ประวัติบิลออเดอร์:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.bills?.length || 0} บิล
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">QR ชำระเงิน:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.qrImages?.length || 0} บัญชี
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">สมาชิกสะสมแต้ม:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pendingRestoreData.members?.length || 0} คน
                  </span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>คำเตือน:</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed">
                การกู้คืนข้อมูลจะนำข้อมูลจากไฟล์สำรองนี้มาเขียนทับข้อมูลปัจจุบันของระบบทั้งหมด กรุณาตรวจสอบให้แน่ใจก่อนกดยืนยัน
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setPendingRestoreData(null);
                  setPendingRestoreRaw('');
                  setPendingFileName('');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-98"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>ยืนยันกู้คืนข้อมูลทั้งหมด</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Initial Sync Conflict / Cloud Empty Modal (Requirement B.7) */}
      {initialSyncPrompt && (
        <Modal
          isOpen={true}
          onClose={cancelInitialSync}
          title={
            initialSyncPrompt.type === 'cloud_empty'
              ? 'ซิงค์ข้อมูลร้านค้ากับ Cloud'
              : 'พบข้อมูลร้านค้าบน Cloud ที่แตกต่างกัน'
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-4 p-1">
            {initialSyncPrompt.type === 'cloud_empty' ? (
              <>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                  <p className="font-bold mb-1">ตรวจพบว่าบน Cloud ยังไม่มีข้อมูลร้านค้า</p>
                  <p>
                    ต้องการอัปโหลดข้อมูลร้านค้า การตั้งค่าภาษี/ใบเสร็จ และ QR ชำระเงิน จากเครื่องนี้ขึ้นไปบันทึกบน Cloud หรือไม่?
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={cancelInitialSync}
                    className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    ข้ามก่อน
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveInitialSync('use_local')}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>อัปโหลดขึ้น Cloud ทันที</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
                  <p className="font-bold mb-1">ข้อมูลบน Cloud แตกต่างจากข้อมูลในเครื่องนี้</p>
                  <p>
                    กรุณาเลือกว่าต้องการนำข้อมูลจาก Cloud มาใช้งานในเครื่องนี้ หรือจะอัปโหลดข้อมูลจากเครื่องนี้ทับขึ้นไปบน Cloud:
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-sky-500" />
                      <span>ข้อมูลบน Cloud</span>
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div>ชื่อร้าน: <span className="font-semibold text-slate-700 dark:text-slate-300">{initialSyncPrompt.cloudData?.settings.shopName || '-'}</span></div>
                      <div>เบอร์โทร: <span className="font-semibold text-slate-700 dark:text-slate-300">{initialSyncPrompt.cloudData?.settings.phone || '-'}</span></div>
                      <div>QR: <span className="font-semibold text-slate-700 dark:text-slate-300">{initialSyncPrompt.cloudData?.qrImages.length || 0} รายการ</span></div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-amber-500" />
                      <span>ข้อมูลในเครื่องนี้</span>
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <div>ชื่อร้าน: <span className="font-semibold text-slate-700 dark:text-slate-300">{settings.shopName || '-'}</span></div>
                      <div>เบอร์โทร: <span className="font-semibold text-slate-700 dark:text-slate-300">{settings.phone || '-'}</span></div>
                      <div>QR: <span className="font-semibold text-slate-700 dark:text-slate-300">{qrImages.length || 0} รายการ</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => resolveInitialSync('use_local')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                  >
                    ใช้ของเครื่องนี้ (อัปโหลดทับ Cloud)
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveInitialSync('use_cloud')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ใช้ข้อมูลของ Cloud</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* In-App Customer Display Preview Modal */}
      {showSettingsCfdPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[85vh] max-h-[750px] bg-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col">
            <CustomerDisplayView isPreview onClosePreview={() => setShowSettingsCfdPreview(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

