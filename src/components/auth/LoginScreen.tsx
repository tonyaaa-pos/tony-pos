import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Lock,
  Delete,
  Shield,
  User as UserIcon,
  ChefHat,
  Store,
  UtensilsCrossed,
  Globe,
} from 'lucide-react';
import { soundService } from '../../utils/audio';

export const LoginScreen: React.FC = () => {
  const { loginWithPin, users, switchUser } = usePOS();
  const { t, language, toggleLanguage, getName } = useLanguage();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleKeyPress = (num: string) => {
    soundService.playTap();
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === 4) {
        const res = loginWithPin(nextPin);
        if (!res.success) {
          setErrorMsg(res.message || t('login_pin_error'));
          setPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    soundService.playTap();
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    soundService.playTap();
    setPin('');
    setErrorMsg('');
  };

  const roleIcons: Record<string, React.ReactNode> = {
    owner: <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
    cashier: <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    waiter: <UtensilsCrossed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
  };

  const roleColors: Record<string, string> = {
    owner:
      'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200',
    cashier:
      'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-200',
    waiter:
      'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 relative">
      {/* Top right language switch */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-xs transition cursor-pointer select-none"
          title="Switch Language / เปลี่ยนภาษา"
        >
          <Globe className="w-4 h-4 text-amber-500" />
          <span
            className={
              language === 'th'
                ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                : 'text-slate-400 font-medium'
            }
          >
            TH
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span
            className={
              language === 'en'
                ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                : 'text-slate-400 font-medium'
            }
          >
            EN
          </span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-8 flex flex-col items-center">
        {/* Brand / Logo */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center mb-3">
          <UtensilsCrossed className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          KinD Restaurant POS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6 text-center">
          {t('login_subtitle')}
        </p>

        {/* PIN Dots Display */}
        <div className="flex items-center gap-4 mb-4 h-12">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-amber-600 dark:bg-amber-400 scale-125 shadow-sm shadow-amber-500/50'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg ? (
          <p className="text-sm text-rose-500 dark:text-rose-400 font-medium mb-4 text-center animate-shake">
            {errorMsg}
          </p>
        ) : (
          <div className="h-5 mb-4" />
        )}

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(String(num))}
              className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-2xl font-semibold text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 active:scale-95 transition cursor-pointer select-none"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60 active:scale-95 transition cursor-pointer select-none"
          >
            {t('login_clear')}
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-2xl font-semibold text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 active:scale-95 transition cursor-pointer select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 active:scale-95 transition cursor-pointer select-none"
            aria-label="Delete"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Demo Fast Login Buttons */}
        <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 text-center">
            {t('login_fast_title')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  soundService.playTap();
                  switchUser(u.id);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition hover:opacity-90 active:scale-98 cursor-pointer ${
                  roleColors[u.role] || 'bg-slate-100 border-slate-200'
                }`}
              >
                {roleIcons[u.role] || <UserIcon className="w-4 h-4" />}
                <div className="truncate">
                  <div className="text-xs font-bold truncate leading-tight">
                    {getName(u)}
                  </div>
                  <div className="text-[11px] opacity-75 font-mono">PIN: {u.pin}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
