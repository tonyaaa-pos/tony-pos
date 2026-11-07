import { Bill, ShopSettings, PaymentRecord } from '../types';
import { formatThaiDateTime } from '../utils/formatters';

export interface BluetoothState {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  deviceId: string | null;
  autoPrintEnabled: boolean;
  paperWidth: '58mm' | '80mm';
  lastError: string | null;
  isSimulated: boolean;
}

const STORAGE_KEYS = {
  AUTO_PRINT: 'kind_pos_bt_autoprint_v1',
  PAPER_WIDTH: 'kind_pos_bt_paper_v1',
  LAST_DEVICE_NAME: 'kind_pos_bt_devicename_v1',
  LAST_DEVICE_ID: 'kind_pos_bt_deviceid_v1',
  IS_REMEMBERED: 'kind_pos_bt_remembered_v1',
  IS_SIMULATED: 'kind_pos_bt_simulated_v1',
};

// Common Bluetooth ESC/POS Printer Service and Characteristic UUIDs
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Serial/Printer
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Generic ESC/POS
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common thermal
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HMSoft / Feasycom / Xprinter
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
];

type StateListener = (state: BluetoothState) => void;

class BluetoothPrinterService {
  private bluetoothDevice: any | null = null;
  private writeCharacteristic: any | null = null;
  private listeners: Set<StateListener> = new Set();

  private state: BluetoothState = {
    isSupported: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    isConnected: false,
    isConnecting: false,
    deviceName: null,
    deviceId: null,
    autoPrintEnabled: false,
    paperWidth: '80mm',
    lastError: null,
    isSimulated: false,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedAuto = localStorage.getItem(STORAGE_KEYS.AUTO_PRINT);
        if (savedAuto !== null) {
          this.state.autoPrintEnabled = savedAuto === 'true';
        }
        const savedWidth = localStorage.getItem(STORAGE_KEYS.PAPER_WIDTH);
        if (savedWidth === '58mm' || savedWidth === '80mm') {
          this.state.paperWidth = savedWidth;
        }
        const savedName = localStorage.getItem(STORAGE_KEYS.LAST_DEVICE_NAME);
        if (savedName) {
          this.state.deviceName = savedName;
        }
        // Auto-reconnect if remembered
        setTimeout(() => {
          this.autoReconnect().catch(() => {});
        }, 600);
      } catch {}
    }
  }

  public getState(): BluetoothState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error notifying Bluetooth listener:', err);
      }
    });
  }

  public setAutoPrint(enabled: boolean) {
    this.state.autoPrintEnabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_PRINT, String(enabled));
    } catch {}
    this.notify();
  }

  public setPaperWidth(width: '58mm' | '80mm') {
    this.state.paperWidth = width;
    try {
      localStorage.setItem(STORAGE_KEYS.PAPER_WIDTH, width);
    } catch {}
    this.notify();
  }

  /**
   * Scan and connect to Bluetooth ESC/POS printer via Web Bluetooth API
   */
  public async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.state.isSupported) {
      const msg = 'เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth API (แนะนำให้ใช้ Google Chrome หรือ Microsoft Edge บน HTTPS)';
      this.state.lastError = msg;
      this.notify();
      return { success: false, error: msg };
    }

    try {
      this.state.isConnecting = true;
      this.state.lastError = null;
      this.notify();

      // Request device from user with common thermal printer services
      const nav = navigator as any;
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      if (!device) {
        throw new Error('ไม่พบอุปกรณ์ที่เลือก');
      }

      this.bluetoothDevice = device;
      this.state.deviceName = device.name || 'เครื่องพิมพ์ Bluetooth';
      this.state.deviceId = device.id;
      this.state.isSimulated = false;

      // Handle disconnect event
      device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnected();
      });

      // Connect to GATT Server
      const server = await device.gatt.connect();

      // Discover writable characteristic across known printer services
      let targetCharacteristic: any = null;

      for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        } catch {
          // Continue to next candidate service
        }
      }

      // If known services didn't find characteristic, try all primary services
      if (!targetCharacteristic) {
        try {
          const services = await server.getPrimaryServices();
          for (const s of services) {
            const chars = await s.getCharacteristics();
            for (const c of chars) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                targetCharacteristic = c;
                break;
              }
            }
            if (targetCharacteristic) break;
          }
        } catch {}
      }

      if (!targetCharacteristic) {
        throw new Error('เชื่อมต่ออุปกรณ์สำเร็จ แต่ไม่พบบริการส่งข้อมูลพิมพ์ (Writable Characteristic)');
      }

      this.writeCharacteristic = targetCharacteristic;
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.lastError = null;

      try {
        localStorage.setItem(STORAGE_KEYS.LAST_DEVICE_NAME, this.state.deviceName || '');
        localStorage.setItem(STORAGE_KEYS.LAST_DEVICE_ID, device.id || '');
        localStorage.setItem(STORAGE_KEYS.IS_REMEMBERED, 'true');
        localStorage.setItem(STORAGE_KEYS.IS_SIMULATED, 'false');
      } catch {}

      this.notify();
      return { success: true, deviceName: this.state.deviceName || 'เครื่องพิมพ์ Bluetooth' };
    } catch (err: any) {
      this.state.isConnecting = false;
      this.state.isConnected = false;
      const errorMsg = err?.message || 'การเชื่อมต่อ Bluetooth ถูกยกเลิก หรือไม่สำเร็จ';
      this.state.lastError = errorMsg;
      this.notify();
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Auto reconnect to remembered Bluetooth device or simulated profile on startup
   */
  public async autoReconnect(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const isRemembered = localStorage.getItem(STORAGE_KEYS.IS_REMEMBERED) === 'true';
      if (!isRemembered) return false;

      const isSimulated = localStorage.getItem(STORAGE_KEYS.IS_SIMULATED) === 'true';
      if (isSimulated) {
        const name = localStorage.getItem(STORAGE_KEYS.LAST_DEVICE_NAME) || 'ESC/POS Thermal Printer (BT-80)';
        this.simulateConnection(name);
        return true;
      }

      const nav = navigator as any;
      if (typeof nav !== 'undefined' && nav.bluetooth && typeof nav.bluetooth.getDevices === 'function') {
        const devices = await nav.bluetooth.getDevices();
        if (devices && devices.length > 0) {
          const savedId = localStorage.getItem(STORAGE_KEYS.LAST_DEVICE_ID);
          const target = devices.find((d: any) => d.id === savedId) || devices[0];
          if (target && target.gatt) {
            this.state.isConnecting = true;
            this.notify();

            target.addEventListener('gattserverdisconnected', () => {
              this.handleDisconnected();
            });

            const server = await target.gatt.connect();
            let targetChar: any = null;

            for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
              try {
                const service = await server.getPrimaryService(serviceUuid);
                const chars = await service.getCharacteristics();
                for (const char of chars) {
                  if (char.properties.write || char.properties.writeWithoutResponse) {
                    targetChar = char;
                    break;
                  }
                }
                if (targetChar) break;
              } catch {}
            }

            if (targetChar) {
              this.bluetoothDevice = target;
              this.writeCharacteristic = targetChar;
              this.state.isConnected = true;
              this.state.isConnecting = false;
              this.state.deviceName = target.name || 'เครื่องพิมพ์ Bluetooth';
              this.state.deviceId = target.id;
              this.state.isSimulated = false;
              this.notify();
              return true;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Bluetooth background auto-reconnect note:', err);
      this.state.isConnecting = false;
      this.notify();
    }
    return false;
  }

  /**
   * Disconnect current Bluetooth printer
   */
  public disconnect() {
    try {
      if (this.bluetoothDevice && this.bluetoothDevice.gatt?.connected) {
        this.bluetoothDevice.gatt.disconnect();
      }
      localStorage.removeItem(STORAGE_KEYS.IS_REMEMBERED);
      localStorage.removeItem(STORAGE_KEYS.IS_SIMULATED);
      localStorage.removeItem(STORAGE_KEYS.LAST_DEVICE_ID);
    } catch {}
    this.handleDisconnected();
  }

  private handleDisconnected() {
    this.bluetoothDevice = null;
    this.writeCharacteristic = null;
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.isSimulated = false;
    this.notify();
  }

  /**
   * Simulate connection for devices without physical Bluetooth or testing environments
   */
  public simulateConnection(name = 'ESC/POS Thermal Printer (BT-80)') {
    this.state.isConnected = true;
    this.state.isConnecting = false;
    this.state.deviceName = name;
    this.state.deviceId = 'sim_' + Date.now();
    this.state.isSimulated = true;
    this.state.lastError = null;
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_DEVICE_NAME, name);
      localStorage.setItem(STORAGE_KEYS.IS_REMEMBERED, 'true');
      localStorage.setItem(STORAGE_KEYS.IS_SIMULATED, 'true');
    } catch {}
    this.notify();
  }

  /**
   * Helper to write raw byte buffer to Bluetooth characteristic in safe chunks
   */
  private async writeRawBytes(bytes: Uint8Array): Promise<void> {
    if (this.state.isSimulated) {
      // Simulated device prints smoothly after short network delay
      await new Promise((res) => setTimeout(res, 400));
      return;
    }

    if (!this.writeCharacteristic) {
      throw new Error('เครื่องพิมพ์ Bluetooth ยังไม่ได้เชื่อมต่อ');
    }

    // Bluetooth BLE packet MTU is usually 20-512 bytes. Send in 100-byte chunks
    const CHUNK_SIZE = 100;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      if (this.writeCharacteristic.writeValueWithoutResponse) {
        await this.writeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.writeCharacteristic.writeValue(chunk);
      }
      // Small pause between chunks to prevent Bluetooth buffer overflow
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  /**
   * Generate ESC/POS byte commands for 80mm/58mm thermal receipt
   */
  private buildEscPosReceipt(bill: Bill, settings: ShopSettings): Uint8Array {
    const is80mm = this.state.paperWidth === '80mm';
    const charWidth = is80mm ? 48 : 32;

    const parts: (number[] | Uint8Array)[] = [];
    const encoder = new TextEncoder();

    // 1. Initialize printer (ESC @)
    parts.push([0x1b, 0x40]);

    // Set line spacing default
    parts.push([0x1b, 0x32]);

    // 2. Shop Name (Center, Bold, Double Height/Width)
    parts.push([0x1b, 0x61, 0x01]); // Align Center
    parts.push([0x1d, 0x21, 0x11]); // Double width & height
    parts.push(encoder.encode(settings.shopName + '\n'));

    // Reset font size (Standard), Align Center
    parts.push([0x1d, 0x21, 0x00]);
    if (settings.address) {
      parts.push(encoder.encode(settings.address + '\n'));
    }
    if (settings.phone) {
      parts.push(encoder.encode(`โทร: ${settings.phone}\n`));
    }
    if (settings.taxId) {
      parts.push(encoder.encode(`เลขประจำตัวผู้เสียภาษี: ${settings.taxId}\n`));
    }

    // Title: ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ
    parts.push([0x1b, 0x45, 0x01]); // Bold ON
    parts.push(encoder.encode('\nใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ\n'));
    parts.push([0x1b, 0x45, 0x00]); // Bold OFF

    // Divider line
    const divider = '-'.repeat(charWidth) + '\n';
    parts.push(encoder.encode(divider));

    // Align Left for metadata
    parts.push([0x1b, 0x61, 0x00]);
    parts.push(encoder.encode(`เลขที่บิล: ${bill.billNumber}\n`));
    parts.push(encoder.encode(`วันที่: ${formatThaiDateTime(bill.closedAt || bill.createdAt)}\n`));
    parts.push(encoder.encode(`พนักงาน: ${bill.createdByName || 'พนักงาน'}\n`));
    const tableInfo = bill.tableName
      ? `โต๊ะ ${bill.tableName} (${bill.guestCount || 1} ท่าน)`
      : bill.orderType === 'takeaway'
      ? 'สั่งกลับบ้าน (Takeaway)'
      : 'เดลิเวอรี (Delivery)';
    parts.push(encoder.encode(`ประเภท: ${tableInfo}\n`));

    // Divider line
    parts.push(encoder.encode(divider));

    // Item List Header
    parts.push([0x1b, 0x45, 0x01]); // Bold ON
    const headerLeft = 'รายการ';
    const headerRight = 'รวม (บาท)';
    const headerPad = Math.max(1, charWidth - headerLeft.length - headerRight.length);
    parts.push(encoder.encode(headerLeft + ' '.repeat(headerPad) + headerRight + '\n'));
    parts.push([0x1b, 0x45, 0x00]); // Bold OFF

    // Items
    bill.items
      .filter((item) => item.status !== 'voided')
      .forEach((item) => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        const nameLine = `${item.name}${item.variantName ? ` (${item.variantName})` : ''}`;
        const qtyPriceLine = `  ${item.quantity} x ${item.price.toFixed(2)}`;
        const padSpaces = Math.max(1, charWidth - qtyPriceLine.length - itemTotal.length);

        parts.push(encoder.encode(nameLine + '\n'));
        parts.push(encoder.encode(qtyPriceLine + ' '.repeat(padSpaces) + itemTotal + '\n'));

        // Options if any
        if (item.selectedOptions && item.selectedOptions.length > 0) {
          const optText = item.selectedOptions.map((o) => `+${o.choiceName}`).join(', ');
          parts.push(encoder.encode(`  * ${optText}\n`));
        }
      });

    // Divider
    parts.push(encoder.encode(divider));

    // Financial Totals helper
    const addTotalRow = (label: string, value: string, bold = false) => {
      if (bold) parts.push([0x1b, 0x45, 0x01]);
      const spaces = Math.max(1, charWidth - label.length - value.length);
      parts.push(encoder.encode(label + ' '.repeat(spaces) + value + '\n'));
      if (bold) parts.push([0x1b, 0x45, 0x00]);
    };

    addTotalRow('ยอดรวมสินค้า (Subtotal)', bill.subtotal.toFixed(2));
    if (bill.discountAmount && bill.discountAmount > 0) {
      addTotalRow('ส่วนลด (Discount)', `-${bill.discountAmount.toFixed(2)}`);
    }
    if (bill.serviceChargeAmount && bill.serviceChargeAmount > 0) {
      addTotalRow('เซอร์วิสชาร์จ (Service Charge)', `+${bill.serviceChargeAmount.toFixed(2)}`);
    }
    if (bill.vatAmount && bill.vatAmount > 0) {
      addTotalRow(`VAT ${bill.vatRate}% (${bill.vatIncluded ? 'รวมในราคาแล้ว' : 'แยกต่างหาก'})`, bill.vatAmount.toFixed(2));
    }

    // Double divider for grand total
    parts.push(encoder.encode('='.repeat(charWidth) + '\n'));

    // Grand Total (Bigger / Bold)
    parts.push([0x1b, 0x45, 0x01]); // Bold ON
    parts.push([0x1d, 0x21, 0x01]); // Double height
    const grandLabel = 'ยอดสุทธิ (Total)';
    const grandVal = `THB ${bill.grandTotal.toFixed(2)}`;
    const grandPad = Math.max(1, charWidth - grandLabel.length - grandVal.length);
    parts.push(encoder.encode(grandLabel + ' '.repeat(grandPad) + grandVal + '\n'));
    parts.push([0x1d, 0x21, 0x00]); // Reset size
    parts.push([0x1b, 0x45, 0x00]); // Bold OFF

    parts.push(encoder.encode(divider));

    // Payments Breakdown
    if (bill.payments && bill.payments.length > 0) {
      bill.payments.forEach((p: PaymentRecord) => {
        const methodLabel =
          p.method === 'cash'
            ? 'ชำระด้วยเงินสด'
            : p.method === 'qr'
            ? 'สแกน QR PromptPay'
            : p.method === 'card'
            ? 'บัตรเครดิต/เดบิต'
            : 'โอนเงิน';
        addTotalRow(methodLabel, p.amount.toFixed(2));
        if (p.method === 'cash' && p.receivedAmount) {
          addTotalRow('  รับเงินมา', p.receivedAmount.toFixed(2));
          addTotalRow('  เงินทอน', (p.change || 0).toFixed(2));
        }
      });
      parts.push(encoder.encode(divider));
    }

    // Footer message (Center)
    parts.push([0x1b, 0x61, 0x01]);
    if (settings.receiptFooter) {
      parts.push(encoder.encode(settings.receiptFooter + '\n'));
    } else {
      parts.push(encoder.encode('ขอบพระคุณที่มาอุดหนุน\nโอกาสหน้าเชิญใหม่นะคะ\n'));
    }

    // Final Paper Feed & Cut
    parts.push(encoder.encode('\n\n\n\n'));
    parts.push([0x1d, 0x56, 0x42, 0x00]); // GS V 66 0 (Cut paper)

    // Concatenate all chunks into single Uint8Array
    let totalLength = 0;
    parts.forEach((p) => {
      totalLength += p.length;
    });

    const result = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach((p) => {
      if (Array.isArray(p)) {
        result.set(new Uint8Array(p), offset);
        offset += p.length;
      } else {
        result.set(p, offset);
        offset += p.length;
      }
    });

    return result;
  }

  /**
   * Print receipt via connected Bluetooth ESC/POS printer
   */
  public async printReceipt(bill: Bill, settings: ShopSettings): Promise<{ success: boolean; error?: string }> {
    if (!this.state.isConnected) {
      return { success: false, error: 'ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ Bluetooth' };
    }

    try {
      const bytes = this.buildEscPosReceipt(bill, settings);
      await this.writeRawBytes(bytes);
      return { success: true };
    } catch (err: any) {
      console.error('Bluetooth print error:', err);
      const msg = err?.message || 'เกิดข้อผิดพลาดในการส่งข้อมูลไปยังเครื่องพิมพ์ Bluetooth';
      this.state.lastError = msg;
      this.notify();
      return { success: false, error: msg };
    }
  }

  /**
   * Print sample test receipt to test connection and thermal print alignment
   */
  public async printTestReceipt(settings: ShopSettings): Promise<{ success: boolean; error?: string }> {
    const dummyBill: Bill = {
      id: 'test_' + Date.now(),
      billNumber: 'TEST-001',
      orderType: 'dine_in',
      tableName: 'T-01',
      guestCount: 2,
      items: [
        {
          id: 'test_item_1',
          menuItemId: 'dish_1',
          name: 'ผัดไทยกุ้งสด',
          price: 85,
          cost: 30,
          quantity: 2,
          selectedOptions: [],
          note: '',
        },
        {
          id: 'test_item_2',
          menuItemId: 'dish_2',
          name: 'ชาไทยเย็นหวานน้อย',
          price: 45,
          cost: 15,
          quantity: 1,
          selectedOptions: [],
          note: '',
        },
      ],
      status: 'paid',
      createdAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      createdByUserId: 'test',
      createdByName: 'แอดมินทดสอบระบบ',
      subtotal: 215,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: 0,
      serviceChargeRate: 0,
      serviceChargeAmount: 0,
      vatRate: 7,
      vatAmount: 14.07,
      vatIncluded: true,
      grandTotal: 215,
      payments: [
        {
          method: 'cash',
          amount: 215,
          receivedAmount: 500,
          change: 285,
        },
      ],
    };

    return this.printReceipt(dummyBill, settings);
  }
}

export const bluetoothPrinterService = new BluetoothPrinterService();
