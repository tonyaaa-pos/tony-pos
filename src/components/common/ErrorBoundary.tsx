import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[KinD POS ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReset = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
      // Clear corrupt transient session data while keeping user credentials safe
      sessionStorage.clear();
      localStorage.removeItem('kind_pos_active_cart');
      localStorage.removeItem('kind_pos_screen_role');
    } catch (e) {
      console.warn('Error clearing storage:', e);
    }
    window.location.href = window.location.pathname;
  };

  private handleGoHome = () => {
    window.location.hash = '';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">พบข้อผิดพลาดในการแสดงผล</h3>
                <p className="text-xs text-slate-400">KinD POS ป้องกันปัญหาหน้าขาวเพื่อความต่อเนื่องในการใช้งาน</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-rose-400 max-h-36 overflow-y-auto break-words">
              {this.state.error?.message || 'Unknown runtime error occurred.'}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              อาจเกิดจากข้อผิดพลาดของ WebView หรือข้อมูลแคชค้างบนเครื่อง POS สามารถกดโหลดใหม่ หรือล้างแคชเพื่อเริ่มระบบใหม่ได้ทันที
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>โหลดหน้าใหม่</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Home className="w-4 h-4" />
                <span>หน้าหลัก</span>
              </button>
            </div>

            <button
              type="button"
              onClick={this.handleHardReset}
              className="w-full py-2 px-3 rounded-xl border border-rose-900/50 hover:bg-rose-950/30 text-rose-400 text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างแคชและเริ่มระบบใหม่ (Reset Cache)</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
