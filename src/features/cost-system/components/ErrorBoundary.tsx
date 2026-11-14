import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  confirmingReset: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      confirmingReset: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Cost System module:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleConfirmResetData = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('tonys_'))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state?.hasError) {
      return (
        <div className="min-h-[420px] bg-[#FAF8F5] text-stone-900 flex items-center justify-center p-4 font-sans rounded-2xl">
          <div className="max-w-md w-full bg-white border border-stone-300 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-stone-900 tracking-tight">
                เกิดข้อผิดพลาดในการโหลดระบบคำนวณต้นทุน
              </h2>
              <p className="text-xs text-stone-600">
                ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองรีโหลดหน้าเว็บ หรือล้างแคชข้อมูลระบบต้นทุน
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl text-left text-[11px] font-mono text-rose-700 overflow-x-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            {this.state.confirmingReset ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-800">
                <p className="font-bold">ยืนยันการล้างข้อมูลแคชระบบต้นทุนในเบราว์เซอร์?</p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={this.handleConfirmResetData}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                  >
                    ยืนยันล้างแคช
                  </button>
                  <button
                    type="button"
                    onClick={() => this.setState({ confirmingReset: false })}
                    className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 py-2.5 px-4 bg-[#F27D26] hover:bg-[#d96817] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>รีโหลดหน้าเว็บ (Reload)</span>
                </button>
                <button
                  type="button"
                  onClick={() => this.setState({ confirmingReset: true })}
                  className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="ล้างข้อมูลแคชระบบต้นทุนแล้วโหลดใหม่"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>ล้างแคชต้นทุน</span>
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
