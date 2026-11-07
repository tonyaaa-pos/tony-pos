import { Bill, ShopSettings, PaymentRecord } from '../types';
import { formatThaiDateTime } from '../utils/formatters';

export interface USBPrinterState {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  vendorId: number | null;
  productId: number | null;
  autoPrintEnabled: boolean;
  paperWidth: '58mm' | '80mm';
  lastError: string | null;
  isSimulated: boolean;
}

const STORAGE_KEYS = {
  AUTO_PRINT: 'kind_pos_usb_autoprint_v1',
  PAPER_WIDTH: 'kind_pos_usb_paper_v1',
  IS_REMEMBERED: 'kind_pos_usb_remembered_v1',
  LAST_DEVICE_NAME: 'kind_pos_usb_devicename_v1',
  LAST_VENDOR_ID: 'kind_pos_usb_vendor_id_v1',
  LAST_PRODUCT_ID: 'kind_pos_usb_product_id_v1',
  IS_SIMULATED: 'kind_pos_usb_is_simulated_v1',
};

type USBStateListener = (state: USBPrinterState) => void;

class USBPrinterService {
  private usbDevice: any | null = null;
  private outEndpointNumber: number = 1;
  private listeners: Set<USBStateListener> = new Set();

  private state: USBPrinterState = {
    isSupported: typeof navigator !== 'undefined' && 'usb' in navigator,
    isConnected: false,
    isConnecting: false,
    deviceName: null,
    vendorId: null,
    productId: null,
    autoPrintEnabled: true,
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
        const savedVendor = localStorage.getItem(STORAGE_KEYS.LAST_VENDOR_ID);
        if (savedVendor) {
          this.state.vendorId = Number(savedVendor);
        }
        const savedProduct = localStorage.getItem(STORAGE_KEYS.LAST_PRODUCT_ID);
        if (savedProduct) {
          this.state.productId = Number(savedProduct);
        }
      } catch {}

      // Attempt auto-reconnection on service creation
      setTimeout(() => {
        this.autoReconnect().catch(() => {});
      }, 500);

      // Listen for USB device plug/unplug events
      const nav = navigator as any;
      if (typeof nav !== 'undefined' && 'usb' in nav && nav.usb) {
        try {
          nav.usb.addEventListener('connect', (e: any) => {
            if (this.isRemembered() && !this.state.isConnected) {
              this.connectToDevice(e.device).catch(() => {});
            }
          });
          nav.usb.addEventListener('disconnect', (e: any) => {
            if (this.usbDevice && this.usbDevice === e.device) {
              this.handleDisconnected();
            }
          });
        } catch {}
      }
    }
  }

  public getState(): USBPrinterState {
    return { ...this.state };
  }

  public subscribe(listener: USBStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(s);
      } catch (err) {
        console.error('USB printer notify error:', err);
      }
    });
  }

  public isRemembered(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.IS_REMEMBERED) === 'true';
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
   * Auto-reconnect to remembered USB printer on startup without showing picker
   */
  public async autoReconnect(): Promise<boolean> {
    if (!this.isRemembered()) return false;

    // Check if it was a simulated connection
    const wasSimulated = localStorage.getItem(STORAGE_KEYS.IS_SIMULATED) === 'true';
    if (wasSimulated) {
      const savedName = localStorage.getItem(STORAGE_KEYS.LAST_DEVICE_NAME) || 'USB Thermal Printer (POS-80)';
      this.simulateConnection(savedName);
      return true;
    }

    if (!this.state.isSupported) return false;

    try {
      const devices = await (navigator as any).usb.getDevices();
      if (devices && devices.length > 0) {
        const lastVendor = Number(localStorage.getItem(STORAGE_KEYS.LAST_VENDOR_ID));
        const lastProduct = Number(localStorage.getItem(STORAGE_KEYS.LAST_PRODUCT_ID));
        const matched = devices.find((d: any) => d.vendorId === lastVendor && d.productId === lastProduct) || devices[0];
        if (matched) {
          const res = await this.connectToDevice(matched);
          return res.success;
        }
      }
    } catch {}
    return false;
  }

  /**
   * Request user to pick a USB thermal printer
   */
  public async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.state.isSupported) {
      const msg = 'เบราว์เซอร์นี้ไม่รองรับ WebUSB API (แนะนำให้ใช้ Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์/Android)';
      this.state.lastError = msg;
      this.notify();
      return { success: false, error: msg };
    }

    try {
      this.state.isConnecting = true;
      this.state.lastError = null;
      this.notify();

      // Request USB device from user. We query both printer class (0x07) and allow generic vendor devices
      const nav = navigator as any;
      const device = await nav.usb.requestDevice({
        filters: [
          { classCode: 7 }, // USB Printer Class
          { classCode: 0xff }, // Vendor-Specific Class
          { classCode: 0 }, // Interface-defined
        ],
      });

      if (!device) {
        throw new Error('ไม่พบอุปกรณ์ USB ที่เลือก');
      }

      return await this.connectToDevice(device);
    } catch (err: any) {
      this.state.isConnecting = false;
      this.state.isConnected = false;
      const errorMsg = err?.message || 'การเชื่อมต่อ USB ถูกยกเลิก หรือไม่สำเร็จ';
      this.state.lastError = errorMsg;
      this.notify();
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Connect to a specific USB Device instance
   */
  private async connectToDevice(device: any): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    try {
      this.state.isConnecting = true;
      this.notify();

      await device.open();

      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Find printer interface (Interface Class 7 or first interface)
      let interfaceNumber = 0;
      let outEndpoint = 1;

      if (device.configuration && device.configuration.interfaces) {
        for (const iface of device.configuration.interfaces) {
          const alt = iface.alternates?.[0];
          if (alt) {
            // Find OUT endpoint for writing print bytes
            const outEp = alt.endpoints?.find((ep: any) => ep.direction === 'out');
            if (outEp) {
              interfaceNumber = iface.interfaceNumber;
              outEndpoint = outEp.endpointNumber;
              break;
            }
          }
        }
      }

      await device.claimInterface(interfaceNumber);

      this.usbDevice = device;
      this.outEndpointNumber = outEndpoint;

      const devName = device.productName || `USB Printer (VID: ${device.vendorId.toString(16).toUpperCase()})`;
      this.state.deviceName = devName;
      this.state.vendorId = device.vendorId;
      this.state.productId = device.productId;
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.isSimulated = false;
      this.state.lastError = null;

      // Remember device in localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.IS_REMEMBERED, 'true');
        localStorage.setItem(STORAGE_KEYS.LAST_DEVICE_NAME, devName);
        localStorage.setItem(STORAGE_KEYS.LAST_VENDOR_ID, String(device.vendorId));
        localStorage.setItem(STORAGE_KEYS.LAST_PRODUCT_ID, String(device.productId));
        localStorage.removeItem(STORAGE_KEYS.IS_SIMULATED);
      } catch {}

      this.notify();
      return { success: true, deviceName: devName };
    } catch (err: any) {
      this.state.isConnecting = false;
      this.state.isConnected = false;
      const errorMsg = err?.message || 'ไม่สามารถเปิดการเชื่อมต่อพอร์ต USB ได้';
      this.state.lastError = errorMsg;
      this.notify();
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Disconnect USB printer and clear remembered status
   */
  public async disconnect() {
    try {
      if (this.usbDevice && this.usbDevice.opened) {
        await this.usbDevice.close();
      }
    } catch {}

    try {
      localStorage.removeItem(STORAGE_KEYS.IS_REMEMBERED);
      localStorage.removeItem(STORAGE_KEYS.IS_SIMULATED);
    } catch {}

    this.handleDisconnected();
  }

  private handleDisconnected() {
    this.usbDevice = null;
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.isSimulated = false;
    this.notify();
  }

  /**
   * Simulate USB printer connection for testing or environments without hardware
   */
  public simulateConnection(name = 'USB ESC/POS Thermal Printer (80mm)') {
    this.state.isConnected = true;
    this.state.isConnecting = false;
    this.state.deviceName = name;
    this.state.vendorId = 0x0416; // Generic Winbond/POS VID
    this.state.productId = 0x5011;
    this.state.isSimulated = true;
    this.state.lastError = null;

    try {
      localStorage.setItem(STORAGE_KEYS.IS_REMEMBERED, 'true');
      localStorage.setItem(STORAGE_KEYS.LAST_DEVICE_NAME, name);
      localStorage.setItem(STORAGE_KEYS.IS_SIMULATED, 'true');
    } catch {}

    this.notify();
  }

  /**
   * Send raw binary buffer to USB printer
   */
  public async sendRaw(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.state.isConnected) {
      return { success: false, error: 'เครื่องพิมพ์ USB ยังไม่ได้เชื่อมต่อ' };
    }

    if (this.state.isSimulated) {
      await new Promise((r) => setTimeout(r, 600));
      return { success: true };
    }

    if (!this.usbDevice || !this.usbDevice.opened) {
      this.handleDisconnected();
      return { success: false, error: 'การเชื่อมต่อ USB หลุด กรุณาเชื่อมต่อใหม่' };
    }

    try {
      // Chunk transfer into 64-byte packets for maximum USB controller compatibility
      const CHUNK_SIZE = 64;
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        await this.usbDevice.transferOut(this.outEndpointNumber, chunk);
      }
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'ส่งข้อมูลไปยังเครื่องพิมพ์ USB ไม่สำเร็จ';
      this.state.lastError = msg;
      this.notify();
      return { success: false, error: msg };
    }
  }

  /**
   * Print a bill receipt directly through USB Thermal Printer
   */
  public async printReceipt(bill: Bill, settings: ShopSettings): Promise<{ success: boolean; error?: string }> {
    const bytes = this.generateEscPosReceipt(bill, settings);
    return await this.sendRaw(bytes);
  }

  /**
   * Print a quick self-test receipt
   */
  public async printTestReceipt(_settings?: ShopSettings): Promise<{ success: boolean; error?: string }> {
    const bytes = this.generateTestReceipt();
    return await this.sendRaw(bytes);
  }

  /**
   * Build binary ESC/POS commands
   */
  private generateEscPosReceipt(bill: Bill, settings: ShopSettings): Uint8Array {
    const buffer: number[] = [];
    const is58 = this.state.paperWidth === '58mm';
    const cols = is58 ? 32 : 42;

    const ESC = 0x1b;
    const GS = 0x1d;

    const write = (...bytes: number[]) => buffer.push(...bytes);

    // Thai / UTF-8 text encoder
    const textEncoder = new TextEncoder();
    const writeText = (text: string) => {
      const encoded = textEncoder.encode(text);
      for (let i = 0; i < encoded.length; i++) {
        buffer.push(encoded[i]);
      }
    };

    const writeLine = (text: string) => {
      writeText(text);
      write(0x0a);
    };

    const alignLeft = () => write(ESC, 0x61, 0x00);
    const alignCenter = () => write(ESC, 0x61, 0x01);
    const alignRight = () => write(ESC, 0x61, 0x02);
    const boldOn = () => write(ESC, 0x45, 0x01);
    const boldOff = () => write(ESC, 0x45, 0x00);
    const doubleHeightOn = () => write(ESC, 0x21, 0x10);
    const doubleSizeOn = () => write(ESC, 0x21, 0x30);
    const normalSize = () => write(ESC, 0x21, 0x00);

    const padRow = (left: string, right: string, maxLen = cols): string => {
      const spaceCount = Math.max(1, maxLen - left.length - right.length);
      return left + ' '.repeat(spaceCount) + right;
    };

    const hr = () => writeLine('-'.repeat(cols));

    // Initialize Printer
    write(ESC, 0x40);

    // Shop Header
    alignCenter();
    boldOn();
    doubleSizeOn();
    writeLine(settings.shopName || 'KinD Restaurant & Cafe');
    normalSize();
    boldOff();

    if (settings.address) {
      writeLine(settings.address);
    }
    if (settings.phone) {
      writeLine(`โทร: ${settings.phone}`);
    }
    if (settings.taxId) {
      writeLine(`เลขประจำตัวผู้เสียภาษี: ${settings.taxId}`);
    }

    hr();

    // Bill Info
    alignLeft();
    boldOn();
    writeLine(`ใบเสร็จรับเงิน (USB)`);
    boldOff();
    writeLine(`เลขที่: ${bill.billNumber}`);
    writeLine(`วันที่: ${formatThaiDateTime(bill.createdAt)}`);
    writeLine(bill.tableName ? `โต๊ะ: ${bill.tableName}` : `ประเภท: ${bill.orderType}`);

    hr();

    // Items list
    alignLeft();
    const validItems = bill.items.filter((i) => i.status !== 'voided');

    validItems.forEach((item) => {
      const lineTotal = (item.price * item.quantity).toFixed(2);
      const itemTitle = `${item.name}${item.variantName ? ` (${item.variantName})` : ''}`;
      writeLine(itemTitle);

      const qtyPrice = `  ${item.quantity} x ${item.price.toFixed(2)}`;
      writeLine(padRow(qtyPrice, lineTotal));

      if (item.selectedOptions && item.selectedOptions.length > 0) {
        const optNames = item.selectedOptions.map((o) => `+${o.choiceName}`).join(', ');
        writeLine(`  [${optNames}]`);
      }
    });

    hr();

    // Totals
    alignRight();
    writeLine(padRow('ยอดรวม:', bill.subtotal.toFixed(2)));

    if (bill.discountAmount > 0) {
      writeLine(padRow('ส่วนลด:', `-${bill.discountAmount.toFixed(2)}`));
    }
    if (bill.serviceChargeAmount > 0) {
      writeLine(padRow(`เซอร์วิสชาร์จ (${bill.serviceChargeRate}%):`, `+${bill.serviceChargeAmount.toFixed(2)}`));
    }
    if (bill.vatAmount > 0) {
      const vatLabel = `VAT (${bill.vatRate}% ${bill.vatIncluded ? 'รวมในราคา' : 'แยกต่างหาก'}):`;
      writeLine(padRow(vatLabel, bill.vatAmount.toFixed(2)));
    }

    boldOn();
    doubleHeightOn();
    writeLine(padRow('ยอดสุทธิ:', `฿${bill.grandTotal.toFixed(2)}`));
    normalSize();
    boldOff();

    // Payment details
    if (bill.payments && bill.payments.length > 0) {
      hr();
      alignLeft();
      boldOn();
      writeLine('การชำระเงิน:');
      boldOff();
      bill.payments.forEach((p) => {
        const methodNames: Record<string, string> = {
          cash: 'เงินสด',
          qr: 'สแกน QR พร้อมเพย์',
          card: 'บัตรเครดิต',
          transfer: 'โอนเงิน',
          ewallet: 'E-Wallet',
        };
        const pName = methodNames[p.method] || p.method;
        writeLine(padRow(`  ${pName}:`, `${p.amount.toFixed(2)} บาท`));
        if (p.receivedAmount !== undefined && p.receivedAmount > p.amount) {
          writeLine(padRow('  รับเงินสด:', `${p.receivedAmount.toFixed(2)} บาท`));
          writeLine(padRow('  เงินทอน:', `${(p.change || 0).toFixed(2)} บาท`));
        }
      });
    }

    // Footer
    hr();
    alignCenter();
    if (settings.receiptFooter) {
      writeLine(settings.receiptFooter);
    } else {
      writeLine('ขอบพระคุณที่มาอุดหนุน');
      writeLine('โอกาสหน้าเชิญใหม่นะคะ');
    }
    writeLine('*** USB Thermal POS System ***');

    // Feed and Cut Paper
    write(0x0a, 0x0a, 0x0a, 0x0a);
    write(GS, 0x56, 0x41, 0x03); // Full paper cut

    return new Uint8Array(buffer);
  }

  private generateTestReceipt(): Uint8Array {
    const buffer: number[] = [];
    const cols = this.state.paperWidth === '58mm' ? 32 : 42;

    const ESC = 0x1b;
    const GS = 0x1d;

    const write = (...bytes: number[]) => buffer.push(...bytes);
    const textEncoder = new TextEncoder();
    const writeLine = (text: string) => {
      const encoded = textEncoder.encode(text);
      for (let i = 0; i < encoded.length; i++) buffer.push(encoded[i]);
      write(0x0a);
    };

    // Initialize
    write(ESC, 0x40);

    // Center header
    write(ESC, 0x61, 0x01);
    write(ESC, 0x21, 0x30); // Double size
    writeLine('KinD POS');
    write(ESC, 0x21, 0x00); // Normal
    writeLine('ทดสอบเครื่องพิมพ์ USB (ESC/POS)');
    writeLine('-'.repeat(cols));

    write(ESC, 0x61, 0x00); // Left
    writeLine(`อุปกรณ์: ${this.state.deviceName || 'USB Thermal Printer'}`);
    writeLine(`ขนาดกระดาษ: ${this.state.paperWidth}`);
    writeLine(`สถานะ: เชื่อมต่อสำเร็จ ✓`);
    writeLine(`วันเวลา: ${new Date().toLocaleString('th-TH')}`);
    writeLine('-'.repeat(cols));

    write(ESC, 0x61, 0x01); // Center
    writeLine('พิมพ์ภาษาไทยและตัวเลขได้ถูกต้อง');
    writeLine('1234567890 ฿ !@#$%^&*()');
    writeLine('ระบบบันทึกการเชื่อมต่ออัตโนมัติเรียบร้อย');
    writeLine('-'.repeat(cols));

    // Feed & Cut
    write(0x0a, 0x0a, 0x0a, 0x0a);
    write(GS, 0x56, 0x41, 0x03);

    return new Uint8Array(buffer);
  }
}

export const usbPrinterService = new USBPrinterService();
