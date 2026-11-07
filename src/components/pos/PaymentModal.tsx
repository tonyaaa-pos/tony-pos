import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Bill, PaymentMethod, PaymentRecord } from '../../types';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Banknote,
  QrCode,
  CreditCard,
  Building,
  Wallet,
  CheckCircle2,
  Users,
  Split,
  Plus,
  Minus,
  Trash2,
  Printer,
  Bluetooth,
  Usb,
  Check,
} from 'lucide-react';
import { ReceiptPrint } from './ReceiptPrint';
import { soundService } from '../../utils/audio';
import { bluetoothPrinterService, BluetoothState } from '../../services/bluetoothPrinterService';
import { usbPrinterService, USBPrinterState } from '../../services/usbPrinterService';
import { customerDisplayService } from '../../services/customerDisplayService';

const formatAmount = (amount: number, showDecimals = true): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return showDecimals ? '0.00' : '0';
  }
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, bill }) => {
  const {
    settings,
    qrImages,
    completeBillPayment,
    canPay,
    splitBill,
    bills,
    setActiveNav,
    setActiveCategory,
  } = usePOS();
  const { getName } = useLanguage();

  const [finalizeError, setFinalizeError] = useState<string>('');

  // Active bill tracking (supporting split bills for the same table)
  const [activeBillId, setActiveBillId] = useState<string>(bill.id);
  const activeBill = bills.find((b) => b.id === activeBillId) || bill;

  // Sync activeBillId if prop bill changes
  useEffect(() => {
    setActiveBillId(bill.id);
    setPayments([]);
    setCashReceived('');
    setCardRef('');
    setTransferRef('');
    setItemSplits({});
    setSplitMode('single');
  }, [bill.id]);

  // Payments list (supporting mixed payments!)
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>('cash');

  // Input fields for current method
  const [cashReceived, setCashReceived] = useState<string>('');
  const [cardRef, setCardRef] = useState<string>('');
  const [transferRef, setTransferRef] = useState<string>('');
  const [selectedQrId, setSelectedQrId] = useState<string>(() => {
    const def = qrImages.find((q) => q.isDefault);
    return def ? def.id : qrImages[0]?.id || '';
  });

  // Split mode: 'single' | 'equal' | 'items'
  const [splitMode, setSplitMode] = useState<'single' | 'equal' | 'items'>('single');
  const [splitPersons, setSplitPersons] = useState<number>(2);
  const [itemSplits, setItemSplits] = useState<Record<string, number>>({});

  // Printable bill state for window.print()
  const [printableBill, setPrintableBill] = useState<Bill | null>(null);

  // Thermal printer states (Bluetooth & USB)
  const [btState, setBtState] = useState<BluetoothState>(bluetoothPrinterService.getState());
  const [btPrinting, setBtPrinting] = useState<boolean>(false);
  const [usbState, setUsbState] = useState<USBPrinterState>(usbPrinterService.getState());
  const [usbPrinting, setUsbPrinting] = useState<boolean>(false);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);

  useEffect(() => {
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

  // Calculate live amount due
  const totalPaidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingDue = Math.max(0, Math.round((activeBill.grandTotal - totalPaidSoFar) * 100) / 100);

  // Related open bills for this table
  const tableOpenBills = bills.filter(
    (b) => b.tableId && b.tableId === activeBill.tableId && b.status === 'open'
  );

  // Active valid items in this bill
  const validItems = activeBill.items.filter((i) => i.status !== 'voided');

  const totalItemsCount = validItems.reduce((sum, i) => sum + i.quantity, 0);

  const splitSelectedCount = Object.values(itemSplits).reduce((sum, q) => sum + q, 0);

  const splitSelectedTotal = validItems.reduce(
    (sum, item) => sum + item.price * (itemSplits[item.id] || 0),
    0
  );

  // Add partial payment to list
  const handleAddPayment = () => {
    soundService.playTap();

    if (activeMethod === 'cash') {
      const received = parseFloat(cashReceived) || remainingDue;
      const amountToPay = Math.min(remainingDue, received);
      const change = Math.max(0, received - amountToPay);

      const record: PaymentRecord = {
        method: 'cash',
        amount: amountToPay,
        receivedAmount: received,
        change,
      };

      setPayments((prev) => [...prev, record]);
      setCashReceived('');
    } else if (activeMethod === 'qr') {
      const record: PaymentRecord = {
        method: 'qr',
        amount: remainingDue,
        qrImageId: selectedQrId,
        ref: 'QR-CONFIRMED',
      };
      setPayments((prev) => [...prev, record]);
    } else if (activeMethod === 'card') {
      const record: PaymentRecord = {
        method: 'card',
        amount: remainingDue,
        ref: cardRef || 'CARD',
      };
      setPayments((prev) => [...prev, record]);
      setCardRef('');
    } else if (activeMethod === 'transfer') {
      const record: PaymentRecord = {
        method: 'transfer',
        amount: remainingDue,
        ref: transferRef || 'TRANSFER',
      };
      setPayments((prev) => [...prev, record]);
      setTransferRef('');
    } else if (activeMethod === 'ewallet') {
      const record: PaymentRecord = {
        method: 'ewallet',
        amount: remainingDue,
        ref: transferRef || 'E-WALLET',
      };
      setPayments((prev) => [...prev, record]);
      setTransferRef('');
    }
  };

  // Complete entire bill without receipt preview: finish task, record payment, and return to Tables floor plan directly
  const handleFinalize = () => {
    const check = canPay(activeBill);
    if (!check.allowed) {
      setFinalizeError(
        check.reason === 'empty'
          ? 'บิลนี้ยังไม่มีรายการอาหาร'
          : 'คุณมีรายการที่ยังไม่ได้บันทึกลงโต๊ะ กรุณากดบันทึกออเดอร์ลงโต๊ะก่อนชำระเงิน'
      );
      return;
    }
    setFinalizeError('');
    soundService.playReadyChime();
    const finalPayments = payments.length > 0 ? payments : [
      {
        method: activeMethod,
        amount: activeBill.grandTotal,
        receivedAmount: activeMethod === 'cash' ? (parseFloat(cashReceived) || activeBill.grandTotal) : undefined,
        change: activeMethod === 'cash' ? Math.max(0, (parseFloat(cashReceived) || activeBill.grandTotal) - activeBill.grandTotal) : 0,
        ref: activeMethod === 'card' ? cardRef : activeMethod === 'qr' ? 'QR-PAID' : undefined,
        qrImageId: activeMethod === 'qr' ? selectedQrId : undefined,
      } as PaymentRecord
    ];

    const result = completeBillPayment(activeBill.id, finalPayments);
    if (result.success) {
      // Notify customer-facing display of payment completion
      customerDisplayService.setCompleted(result.bill);

      // Auto-print to USB printer if enabled
      if (usbState.isConnected && usbState.autoPrintEnabled) {
        usbPrinterService.printReceipt(result.bill, settings).catch(() => {});
      }
      // Auto-print to Bluetooth printer if enabled
      if (btState.isConnected && btState.autoPrintEnabled) {
        bluetoothPrinterService.printReceipt(result.bill, settings).catch(() => {});
      }
      setActiveCategory(null);
      setActiveNav('tables');
      onClose();
    }
  };


  // Print receipt only: prints 80mm/58mm thermal receipt via USB / Bluetooth ESC/POS or window.print(), does NOT record payment, and stays on payment screen
  const handlePrintReceipt = async () => {
    soundService.playTap();
    const previewPayments: PaymentRecord[] = payments.length > 0 ? payments : [
      {
        method: activeMethod,
        amount: activeBill.grandTotal,
        receivedAmount: activeMethod === 'cash' ? (parseFloat(cashReceived) || activeBill.grandTotal) : undefined,
        change: activeMethod === 'cash' ? Math.max(0, (parseFloat(cashReceived) || activeBill.grandTotal) - activeBill.grandTotal) : 0,
        ref: activeMethod === 'card' ? cardRef : activeMethod === 'qr' ? 'QR-PAID' : undefined,
        qrImageId: activeMethod === 'qr' ? selectedQrId : undefined,
      } as PaymentRecord
    ];

    const billToPrint: Bill = {
      ...activeBill,
      payments: previewPayments,
    };

    // Priority 1: USB Thermal ESC/POS Printer
    if (usbState.isConnected) {
      try {
        setUsbPrinting(true);
        const res = await usbPrinterService.printReceipt(billToPrint, settings);
        setUsbPrinting(false);
        if (res.success) {
          setPrintSuccess(true);
          soundService.playSuccessTap();
          setTimeout(() => setPrintSuccess(false), 2500);
          return;
        }
      } catch {
        setUsbPrinting(false);
      }
    }

    // Priority 2: Bluetooth Thermal ESC/POS Printer
    if (btState.isConnected) {
      try {
        setBtPrinting(true);
        const res = await bluetoothPrinterService.printReceipt(billToPrint, settings);
        setBtPrinting(false);
        if (res.success) {
          setPrintSuccess(true);
          soundService.playSuccessTap();
          setTimeout(() => setPrintSuccess(false), 2500);
          return;
        }
      } catch {
        setBtPrinting(false);
      }
    }

    // Priority 3: Fallback standard browser print dialog
    setPrintableBill(billToPrint);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Handle Calculator Numpad key press
  const handleNumpadPress = (key: string) => {
    soundService.playTap();
    if (key === 'C') {
      setCashReceived('');
    } else if (key === 'backspace') {
      setCashReceived((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
    } else if (key === 'exact') {
      setCashReceived(String(remainingDue));
    } else if (key === '+100') {
      const current = parseFloat(cashReceived) || 0;
      setCashReceived(String(current + 100));
    } else if (key === '+500') {
      const current = parseFloat(cashReceived) || 0;
      setCashReceived(String(current + 500));
    } else if (key === '+1000') {
      const current = parseFloat(cashReceived) || 0;
      setCashReceived(String(current + 1000));
    } else if (key === '.') {
      if (!cashReceived) {
        setCashReceived('0.');
      } else if (!cashReceived.includes('.')) {
        setCashReceived((prev) => prev + '.');
      }
    } else {
      // Numbers: 0-9, 00
      if (cashReceived === '0' && key !== '.') {
        setCashReceived(key);
      } else {
        setCashReceived((prev) => prev + key);
      }
    }
  };

  // Handle Item Split Quantity Stepper
  const handleItemSplitChange = (itemId: string, maxQty: number, delta: number) => {
    soundService.playTap();
    setItemSplits((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  // Set all of an item to split
  const handleItemSplitAll = (itemId: string, maxQty: number) => {
    soundService.playTap();
    setItemSplits((prev) => {
      if (prev[itemId] === maxQty) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: maxQty };
    });
  };

  // Execute Split Bill into a new Bill
  const handleConfirmSplitBill = () => {
    if (splitSelectedCount === 0) return;
    if (splitSelectedCount >= totalItemsCount) {
      alert('ไม่สามารถแยกรายการทั้งหมดได้ (กรุณาใช้ปุ่ม "จ่ายรวม" สำหรับการชำระทั้งบิล)');
      return;
    }

    const payload = Object.entries(itemSplits)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    const res = splitBill(activeBill.id, payload);
    if (res) {
      soundService.playReadyChime();
      setItemSplits({});
      setSplitMode('single');
      // Automatically switch to the newly created bill to pay!
      setActiveBillId(res.newBill.id);
      setPayments([]);
      setCashReceived('');
    }
  };

  // Selected QR image object
  const activeQrImage = qrImages.find((q) => q.id === selectedQrId) || qrImages[0];

  // Synchronize payment details (QR code, cash, change, method) with customer display in real time
  useEffect(() => {
    if (isOpen && activeBill) {
      const cashVal = parseFloat(cashReceived) || undefined;
      const changeVal =
        cashVal !== undefined && cashVal >= remainingDue
          ? Math.max(0, cashVal - remainingDue)
          : undefined;

      customerDisplayService.setPayment(
        activeBill,
        activeMethod,
        activeMethod === 'qr' && activeQrImage ? { imageData: activeQrImage.imageData, label: activeQrImage.label } : undefined,
        cashVal,
        changeVal
      );
    }
    return () => {
      // Revert to ordering when closing without paying
      if (isOpen && activeBill) {
        customerDisplayService.setOrdering(activeBill);
      }
    };
  }, [
    isOpen,
    activeBill,
    activeMethod,
    activeQrImage,
    cashReceived,
    remainingDue,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`ชำระเงินบิล: ${activeBill.billNumber} (${
        activeBill.tableName ? `โต๊ะ ${activeBill.tableName}` : 'ออเดอร์'
      })`}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
          {/* Multi-bill switcher tabs if multiple open bills exist for this table */}
          {tableOpenBills.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                บิลแยกในโต๊ะนี้ ({tableOpenBills.length}):
              </span>
              {tableOpenBills.map((b, index) => {
                const isActive = b.id === activeBill.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setActiveBillId(b.id);
                      setPayments([]);
                      setCashReceived('');
                      setItemSplits({});
                      setSplitMode('single');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    บิล {index + 1}: {b.billNumber} ({formatAmount(b.grandTotal)})
                  </button>
                );
              })}
            </div>
          )}

          {/* Widescreen 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Bill Summary, Split Controls & Recorded Payments */}
            <div className="lg:col-span-5 flex flex-col gap-3.5">
              {/* Grand Total Card */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">ยอดที่ต้องชำระทั้งหมด</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold">
                    {activeBill.tableName ? `โต๊ะ ${activeBill.tableName}` : 'ออเดอร์'} · {totalItemsCount} รายการ
                  </span>
                </div>
                <div className="text-3xl font-black font-mono tabular-nums text-amber-400">
                  ฿{formatAmount(activeBill.grandTotal)}
                </div>

                {remainingDue > 0 && remainingDue < activeBill.grandTotal && (
                  <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs font-mono text-rose-300 flex items-center justify-between">
                    <span>ยอดคงเหลือที่ต้องจ่าย:</span>
                    <span className="font-bold text-sm text-rose-200">฿{formatAmount(remainingDue)}</span>
                  </div>
                )}

                {/* Split options: จ่ายรวม, หารเท่ากัน, จ่ายแยก */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 font-medium">รูปแบบการจ่าย:</span>
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setSplitMode('single')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        splitMode === 'single' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      จ่ายรวม
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode('equal')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                        splitMode === 'equal' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>หารเท่ากัน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode('items')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                        splitMode === 'items' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Split className="w-3.5 h-3.5" />
                      <span>จ่ายแยก</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. Equal split helper */}
              {splitMode === 'equal' && (
                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-900 dark:text-blue-300">
                      จำนวนคนหาร:
                    </span>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={splitPersons}
                      onChange={(e) => setSplitPersons(Math.max(2, Number(e.target.value)))}
                      className="w-16 px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-center font-bold font-mono"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">คนละ: </span>
                    <span className="text-base font-bold font-mono text-blue-700 dark:text-blue-400">
                      ฿{formatAmount(Math.ceil(activeBill.grandTotal / splitPersons))}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. Items split interface (แยกรายการออกเป็นบิลใหม่) */}
              {splitMode === 'items' && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Split className="w-4 h-4 text-amber-600" />
                        <span>เลือกรายการอาหารเพื่อแยกบิล</span>
                      </h5>
                    </div>
                    {splitSelectedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setItemSplits({})}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        ล้างที่เลือก
                      </button>
                    )}
                  </div>

                  {/* Items List to Split */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                    {validItems.map((item) => {
                      const splitQty = itemSplits[item.id] || 0;
                      const isSelected = splitQty > 0;
                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded-xl border transition flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-600 shadow-xs'
                              : 'bg-white/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                                {getName(item)}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                (x{item.quantity})
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              ฿{formatAmount(item.price)}
                            </div>
                          </div>

                          {/* Stepper Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleItemSplitChange(item.id, item.quantity, -1)}
                              disabled={splitQty <= 0}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-30 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-slate-200"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-mono font-bold text-xs">
                              {splitQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleItemSplitChange(item.id, item.quantity, 1)}
                              disabled={splitQty >= item.quantity}
                              className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-30 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-slate-200"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleItemSplitAll(item.id, item.quantity)}
                              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                splitQty === item.quantity
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                              }`}
                            >
                              หมด
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Split Summary & Confirmation CTA */}
                  <div className="p-2.5 bg-amber-100/70 dark:bg-amber-950/40 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        เลือก: <strong className="font-mono text-slate-900 dark:text-white">{splitSelectedCount}</strong> รายการ
                      </span>
                      <div className="text-xs font-black font-mono text-amber-700 dark:text-amber-400">
                        ยอดแยก: ฿{formatAmount(splitSelectedTotal)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmSplitBill}
                      disabled={splitSelectedCount === 0 || splitSelectedCount >= totalItemsCount}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ยืนยันแยกบิล</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mixed Payments List if any recorded */}
              {payments.length > 0 && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    รายการชำระแล้วในบิลนี้ ({payments.length}):
                  </div>
                  {payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50 dark:border-slate-700/50 last:border-none">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {p.method.toUpperCase()} ({p.ref || 'ชำระแล้ว'})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          ฿{formatAmount(p.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                          title="ลบรายการชำระนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Payment Method Tabs, Inputs & Action Buttons */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-3.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800">
              {/* Payment Method Selector Tabs */}
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  เลือกวิธีชำระเงิน
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'cash', label: 'เงินสด', icon: Banknote },
                    { id: 'qr', label: 'สแกน QR', icon: QrCode },
                    { id: 'card', label: 'บัตรเครดิต', icon: CreditCard },
                    { id: 'transfer', label: 'โอนเงิน', icon: Building },
                    { id: 'ewallet', label: 'E-Wallet', icon: Wallet },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = activeMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveMethod(m.id as PaymentMethod)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] whitespace-nowrap">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Method Details Input Area */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80">
                {/* 1. Cash Method with Numpad & Quick Buttons */}
                {activeMethod === 'cash' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        ยอดเงินสดที่รับมา:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold font-mono text-slate-400">฿</span>
                        <input
                          type="text"
                          readOnly
                          value={cashReceived}
                          placeholder={String(remainingDue)}
                          className="w-44 px-3 py-1.5 text-right rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xl font-black font-mono text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Cash Buttons */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('exact')}
                        className="flex-1 py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-900 dark:text-amber-300 transition cursor-pointer text-center whitespace-nowrap"
                      >
                        พอดี ({formatAmount(remainingDue, false)})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('+100')}
                        className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono text-slate-700 dark:text-slate-300 transition cursor-pointer"
                      >
                        +100
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('+500')}
                        className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono text-slate-700 dark:text-slate-300 transition cursor-pointer"
                      >
                        +500
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('+1000')}
                        className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono text-slate-700 dark:text-slate-300 transition cursor-pointer"
                      >
                        +1,000
                      </button>
                    </div>

                    {/* Compact Calculator Numpad */}
                    <div className="grid grid-cols-4 gap-1.5 max-w-sm mx-auto">
                      {['7', '8', '9'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleNumpadPress(num)}
                          className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer shadow-2xs"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('C')}
                        className="py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-base font-bold font-mono text-rose-600 dark:text-rose-400 hover:bg-rose-100 active:scale-95 transition cursor-pointer"
                      >
                        C
                      </button>

                      {['4', '5', '6'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleNumpadPress(num)}
                          className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer shadow-2xs"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('backspace')}
                        className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center"
                        title="ลบตัวเลข"
                      >
                        ⌫
                      </button>

                      {['1', '2', '3'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleNumpadPress(num)}
                          className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer shadow-2xs"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('exact')}
                        className="py-1.5 px-1 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-900 dark:text-amber-300 hover:bg-amber-500/30 active:scale-95 transition cursor-pointer flex flex-col items-center justify-center leading-tight"
                      >
                        <span>พอดี</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNumpadPress('0')}
                        className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 active:scale-95 transition cursor-pointer shadow-2xs"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('00')}
                        className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 active:scale-95 transition cursor-pointer shadow-2xs"
                      >
                        00
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('.')}
                        className="py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold font-mono text-slate-800 dark:text-slate-100 hover:bg-slate-100 active:scale-95 transition cursor-pointer shadow-2xs"
                      >
                        .
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNumpadPress('+100')}
                        className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                      >
                        +100
                      </button>
                    </div>

                    {/* Change calculation */}
                    {parseFloat(cashReceived) > remainingDue && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          เงินทอน (Change):
                        </span>
                        <span className="text-lg font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                          ฿{formatAmount(parseFloat(cashReceived) - remainingDue)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. QR Payment */}
                {activeMethod === 'qr' && (
                  <div className="space-y-3 flex flex-col items-center text-center">
                    {qrImages.length > 1 && (
                      <div className="w-full max-w-xs">
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          เลือกบัญชี QR ชำระเงิน:
                        </label>
                        <select
                          value={selectedQrId}
                          onChange={(e) => setSelectedQrId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                        >
                          {qrImages.map((qr) => (
                            <option key={qr.id} value={qr.id}>
                              {qr.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-slate-500">ยอดเงินที่ต้องสแกนจ่าย</div>
                      <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                        ฿{formatAmount(remainingDue)}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                        {activeQrImage?.label}
                      </div>
                    </div>

                    {/* The QR Image */}
                    {activeQrImage ? (
                      <div className="p-2 bg-white rounded-xl shadow-md border border-slate-200 dark:border-slate-700 max-w-[200px]">
                        <img
                          src={activeQrImage.imageData}
                          alt={activeQrImage.label}
                          className="w-40 h-40 object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="p-4 text-center text-rose-500 text-xs">
                        ยังไม่มีรูป QR ชำระเงิน (สามารถอัปโหลดได้ในเมนูตั้งค่าระบบ)
                      </div>
                    )}

                    <div className="text-xs text-slate-500 max-w-xs">
                      ให้ลูกค้าสแกน QR ด้านบน เมื่อได้รับเงินโอนแล้วให้กด &quot;ยืนยันรับเงินแล้ว (ปิดบิล)&quot;
                    </div>
                  </div>
                )}

                {/* 3. Card Method */}
                {activeMethod === 'card' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">ยอดชำระผ่านบัตร:</span>
                      <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        ฿{formatAmount(remainingDue)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        เลขอ้างอิงสลิปบัตร หรือ เลข 4 หลักท้าย (ไม่บังคับ):
                      </label>
                      <input
                        type="text"
                        value={cardRef}
                        onChange={(e) => setCardRef(e.target.value)}
                        placeholder="เช่น 4421 หรือ EDC-8899"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Bank Transfer / E-Wallet */}
                {(activeMethod === 'transfer' || activeMethod === 'ewallet') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">ยอดที่ต้องบันทึก:</span>
                      <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        ฿{formatAmount(remainingDue)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        หมายเหตุเลขอ้างอิงการโอน / E-Wallet (ไม่บังคับ):
                      </label>
                      <input
                        type="text"
                        value={transferRef}
                        onChange={(e) => setTransferRef(e.target.value)}
                        placeholder="เช่น สลิปโอนกสิกรไทย / TrueMoney"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {finalizeError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold">
                  {finalizeError}
                </div>
              )}

              {/* Action CTAs */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>

                <div className="flex items-center gap-2">
                  {/* Optional: Add partial payment */}
                  {remainingDue > 0 && payments.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddPayment}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มยอดวิธีนี้</span>
                    </button>
                  )}

                  {/* Print Receipt Button (supports USB / Bluetooth / System Printer) */}
                  <button
                    type="button"
                    disabled={btPrinting || usbPrinting}
                    onClick={handlePrintReceipt}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-2 ${
                      usbState.isConnected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                        : btState.isConnected
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 text-sky-800 dark:text-sky-300 hover:bg-sky-100'
                        : 'border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                    }`}
                    title={
                      usbState.isConnected
                        ? `พิมพ์ใบเสร็จผ่าน USB (${usbState.deviceName})`
                        : btState.isConnected
                        ? `พิมพ์ใบเสร็จผ่าน Bluetooth (${btState.deviceName})`
                        : 'พิมพ์ใบเสร็จ 80 มม. ออกเครื่องพิมพ์ POS ทันที'
                    }
                  >
                    {usbState.isConnected ? (
                      <Usb className={`w-4 h-4 text-emerald-500 ${usbPrinting ? 'animate-bounce' : ''}`} />
                    ) : btState.isConnected ? (
                      <Bluetooth className={`w-4 h-4 text-sky-500 ${btPrinting ? 'animate-bounce' : ''}`} />
                    ) : (
                      <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>
                      {usbPrinting
                        ? 'กำลังพิมพ์ USB...'
                        : btPrinting
                        ? 'กำลังพิมพ์ BT...'
                        : printSuccess
                        ? 'พิมพ์สำเร็จ ✓'
                        : usbState.isConnected
                        ? 'พิมพ์ใบเสร็จ (USB)'
                        : btState.isConnected
                        ? 'พิมพ์ใบเสร็จ (BT)'
                        : 'พิมพ์ใบเสร็จ'}
                    </span>
                  </button>

                  {/* Complete Payment Button: Confirms payment, saves automatically, and returns to tables */}
                  <button
                    type="button"
                    onClick={handleFinalize}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition cursor-pointer flex items-center gap-2"
                    title="ยืนยันการชำระเงิน บันทึกข้อมูลและกลับสู่หน้าผังโต๊ะ"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันการชำระเงิน</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Hidden print container for thermal receipt: only rendered during window.print() */}
      <div className="hidden print:block">
        <ReceiptPrint bill={printableBill || activeBill} settings={settings} />
      </div>
    </Modal>
  );
};
