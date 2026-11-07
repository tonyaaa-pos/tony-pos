import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RotateCcw, Edit2, Check, Languages } from 'lucide-react';
import { translateThaiToEnglish, translateThaiToEnglishFast } from '../../utils/thaiToEnglishTranslator';

interface BilingualNameInputProps {
  labelTh?: string;
  labelEn?: string;
  placeholderTh?: string;
  placeholderEn?: string;
  valueTh: string;
  valueEn: string;
  onChangeTh: (val: string) => void;
  onChangeEn: (val: string) => void;
  required?: boolean;
  compact?: boolean;
  size?: 'sm' | 'md';
}

export const BilingualNameInput: React.FC<BilingualNameInputProps> = ({
  labelTh = 'ชื่อภาษาไทย',
  labelEn = 'ชื่อภาษาอังกฤษ (Auto)',
  placeholderTh = 'เช่น ผัดกะเพราโบราณ',
  placeholderEn = 'e.g. Traditional Basil Stir-fry',
  valueTh,
  valueEn,
  onChangeTh,
  onChangeEn,
  required = false,
  compact = false,
  size = 'md',
}) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCustomEdited, setIsCustomEdited] = useState(false);
  const lastAutoTranslationRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced Auto-translate when Thai text changes (never blocks Thai typing)
  const handleThaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newThai = e.target.value;
    onChangeTh(newThai);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!newThai.trim()) {
      if (!isCustomEdited || !valueEn) {
        onChangeEn('');
        lastAutoTranslationRef.current = '';
      }
      return;
    }

    // Debounce translation so user can type freely without keystroke drops or stutter
    debounceTimerRef.current = setTimeout(async () => {
      if (!isCustomEdited || valueEn === lastAutoTranslationRef.current || !valueEn) {
        setIsTranslating(true);
        try {
          // Try local fast dictionary first
          const fast = translateThaiToEnglishFast(newThai);
          if (fast && !/[\u0E00-\u0E7F]/.test(fast)) {
            onChangeEn(fast);
            lastAutoTranslationRef.current = fast;
          } else {
            const refined = await translateThaiToEnglish(newThai);
            if (refined && !/[\u0E00-\u0E7F]/.test(refined)) {
              onChangeEn(refined);
              lastAutoTranslationRef.current = refined;
            }
          }
        } catch {
          // ignore
        } finally {
          setIsTranslating(false);
        }
      }
    }, 500);
  };

  // Immediate translation check on blur when user finishes typing Thai
  const handleThaiBlur = async () => {
    if (!valueTh || !valueTh.trim()) return;
    if (!isCustomEdited || !valueEn || valueEn === lastAutoTranslationRef.current) {
      setIsTranslating(true);
      try {
        const refined = await translateThaiToEnglish(valueTh);
        if (refined && !/[\u0E00-\u0E7F]/.test(refined)) {
          onChangeEn(refined);
          lastAutoTranslationRef.current = refined;
        }
      } catch {
        // ignore
      } finally {
        setIsTranslating(false);
      }
    }
  };

  // Re-translate button handler
  const handleForceTranslate = async () => {
    if (!valueTh || !valueTh.trim()) return;
    setIsTranslating(true);
    setIsCustomEdited(false);
    try {
      const result = await translateThaiToEnglish(valueTh);
      if (result && !/[\u0E00-\u0E7F]/.test(result)) {
        onChangeEn(result);
        lastAutoTranslationRef.current = result;
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleEnglishChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustomEdited(true);
    onChangeEn(e.target.value);
  };

  if (compact) {
    return (
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="text"
            required={required}
            placeholder={placeholderTh}
            value={valueTh ?? ''}
            onChange={handleThaiChange}
            onBlur={handleThaiBlur}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="relative flex items-center">
          <input
            type="text"
            placeholder={placeholderEn}
            value={valueEn ?? ''}
            onChange={handleEnglishChange}
            className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleForceTranslate}
            title="แปลจากภาษาไทยใหม่อัตโนมัติ"
            className="absolute right-1.5 p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded transition cursor-pointer"
          >
            <RotateCcw className={`w-3 h-3 ${isTranslating ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Thai Input (Primary) */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
          <span>
            {labelTh} {required && <span className="text-rose-500">*</span>}
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            (ข้อมูลหลัก)
          </span>
        </label>
        <div className="relative">
          <input
            type="text"
            required={required}
            value={valueTh ?? ''}
            onChange={handleThaiChange}
            onBlur={handleThaiBlur}
            placeholder={placeholderTh}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* English Input (Auto-translated & fully editable) */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <span>{labelEn}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              <span>แปลอัตโนมัติ</span>
            </span>
          </span>
          <button
            type="button"
            onClick={handleForceTranslate}
            title="คลิกเพื่อแปลจากภาษาไทยใหม่อีกครั้ง"
            className="text-[10px] text-slate-400 hover:text-amber-500 flex items-center gap-1 cursor-pointer transition"
          >
            <RotateCcw className={`w-2.5 h-2.5 ${isTranslating ? 'animate-spin text-amber-500' : ''}`} />
            <span>แปลใหม่</span>
          </button>
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            value={valueEn ?? ''}
            onChange={handleEnglishChange}
            placeholder={placeholderEn}
            className="w-full pl-3.5 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleForceTranslate}
            title="แปลจากชื่อภาษาไทยอัตโนมัติ (หรือพิมพ์แก้ไขได้โดยตรง)"
            className="absolute right-2 p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-lg transition cursor-pointer"
          >
            <Languages className={`w-3.5 h-3.5 ${isTranslating ? 'animate-pulse text-amber-500' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
