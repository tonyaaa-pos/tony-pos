import React from 'react';
import { usePOS } from '../../context/POSContext';
import { Bell, CheckCheck, Trash2, Utensils, AlertTriangle, Clock, Receipt, UserCheck } from 'lucide-react';
import { formatThaiDateTime } from '../../utils/formatters';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, clearAllNotifications, setActiveNav } = usePOS();

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'call_waiter':
        return <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'request_bill':
        return <Receipt className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-100" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white">
              การแจ้งเตือน
            </h3>
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold">
                {notifications.filter((n) => !n.read).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                className="p-1.5 text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                title="ลบการแจ้งเตือนทั้งหมด"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              ปิด
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {notifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <CheckCheck className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">ไม่มีการแจ้งเตือนใหม่</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  markNotificationAsRead(notif.id);
                  if (notif.type === 'call_waiter' || notif.type === 'request_bill') {
                    setActiveNav('tables');
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl transition cursor-pointer flex items-start gap-3 ${
                  notif.read
                    ? 'opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    : 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-medium'
                }`}
              >
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {notif.title}
                    </p>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                      {formatThaiDateTime(notif.createdAt).split(' ')[3]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
