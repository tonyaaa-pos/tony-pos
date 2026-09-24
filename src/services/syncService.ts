/**
 * Multi-Tab Real-Time Sync Service using BroadcastChannel with Storage Event fallback.
 */

export type SyncEventType = 
  | 'DATA_RELOAD'
  | 'NEW_ORDER_ALERT'
  | 'KITCHEN_READY_ALERT'
  | 'TABLE_UPDATED'
  | 'NOTIFICATION_ADDED';

export interface SyncMessage {
  type: SyncEventType;
  payload?: unknown;
  senderId: string;
  timestamp: number;
}

type SyncCallback = (msg: SyncMessage) => void;

class SyncService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncCallback> = new Set();
  private senderId = Math.random().toString(36).substring(2, 9);

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('kind_pos_sync_channel');
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch {
        this.channel = null;
      }
    }

    // Fallback: storage event
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'kind_pos_sync_event' && e.newValue) {
          try {
            const data: SyncMessage = JSON.parse(e.newValue);
            if (data.senderId !== this.senderId) {
              this.notifyListeners(data);
            }
          } catch {
            // Ignore parse errors
          }
        }
      });
    }
  }

  public subscribe(cb: SyncCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners(msg: SyncMessage) {
    if (msg.senderId === this.senderId) return; // Don't echo to self
    this.listeners.forEach((cb) => {
      try {
        cb(msg);
      } catch {
        // Safe handle
      }
    });
  }

  public broadcast(type: SyncEventType, payload?: unknown) {
    const msg: SyncMessage = {
      type,
      payload,
      senderId: this.senderId,
      timestamp: Date.now(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // BroadcastChannel failed
      }
    }

    // Also write to localStorage for fallback
    try {
      localStorage.setItem('kind_pos_sync_event', JSON.stringify(msg));
    } catch {
      // Storage might be restricted
    }
  }
}

export const syncService = new SyncService();
