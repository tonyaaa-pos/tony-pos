import { Bill, ShopSettings } from '../types';

export interface CustomerDisplayState {
  bill: Bill | null;
  mode: 'idle' | 'ordering' | 'payment' | 'completed';
  activeMethod?: string;
  qrImageData?: string;
  qrLabel?: string;
  cashReceived?: number;
  change?: number;
  lastUpdated: number;
}

const STORAGE_KEY = 'kind_pos_customer_display_v1';
const CHANNEL_NAME = 'kind_pos_customer_display_channel';

type CustomerDisplayListener = (state: CustomerDisplayState) => void;

class CustomerDisplayService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<CustomerDisplayListener> = new Set();
  private state: CustomerDisplayState = {
    bill: null,
    mode: 'idle',
    lastUpdated: Date.now(),
  };

  constructor() {
    // Load last state from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.state = parsed;
        }
      } catch {}

      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (event) => {
            if (event.data) {
              this.state = event.data;
              this.notify();
            }
          };
        } catch {
          this.channel = null;
        }
      }

      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.state = JSON.parse(e.newValue);
            this.notify();
          } catch {}
        }
      });
    }
  }

  public getState(): CustomerDisplayState {
    return { ...this.state };
  }

  public subscribe(listener: CustomerDisplayListener): () => void {
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
        console.error('Customer display notify error:', err);
      }
    });
  }

  public updateDisplay(partial: Partial<CustomerDisplayState>) {
    this.state = {
      ...this.state,
      ...partial,
      lastUpdated: Date.now(),
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {}
    }

    if (this.channel) {
      try {
        this.channel.postMessage(this.state);
      } catch {}
    }

    this.notify();
  }

  public setOrdering(bill: Bill | null) {
    if (!bill || bill.items.length === 0) {
      this.updateDisplay({
        bill: null,
        mode: 'idle',
      });
    } else {
      this.updateDisplay({
        bill,
        mode: 'ordering',
        activeMethod: undefined,
        qrImageData: undefined,
      });
    }
  }

  public setPayment(
    bill: Bill,
    method: string,
    qrImage?: { imageData: string; label: string },
    cashReceived?: number,
    change?: number
  ) {
    this.updateDisplay({
      bill,
      mode: 'payment',
      activeMethod: method,
      qrImageData: qrImage?.imageData,
      qrLabel: qrImage?.label,
      cashReceived,
      change,
    });
  }

  public setCompleted(bill: Bill) {
    this.updateDisplay({
      bill,
      mode: 'completed',
    });

    // Auto-return to idle after 8 seconds of showing completed thank-you message
    setTimeout(() => {
      if (this.state.mode === 'completed') {
        this.setIdle();
      }
    }, 8000);
  }

  public setIdle() {
    this.updateDisplay({
      bill: null,
      mode: 'idle',
      activeMethod: undefined,
      qrImageData: undefined,
      cashReceived: undefined,
      change: undefined,
    });
  }
}

export const customerDisplayService = new CustomerDisplayService();
