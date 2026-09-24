import React from 'react';
import { Modal } from '../common/Modal';
import { AlertCircle, AlertTriangle, ArrowRight, Table as TableIcon } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PayBlockReason } from '../../utils/orderRules';

interface UnsavedItemsPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reason: PayBlockReason;
  onSaveAndGoToFloorPlan?: () => void;
  onSelectTable?: () => void;
  isDineInWithoutTable?: boolean;
}

export const UnsavedItemsPaymentDialog: React.FC<UnsavedItemsPaymentDialogProps> = ({
  isOpen,
  onClose,
  reason,
  onSaveAndGoToFloorPlan,
  onSelectTable,
  isDineInWithoutTable = false,
}) => {
  const { t } = useLanguage();

  const isUnsaved = reason === 'unsaved_items';
  const isEmpty = reason === 'empty';
  const isNoTable = reason === 'no_table' || (isUnsaved && isDineInWithoutTable);

  const title = isNoTable
    ? t('pay_blocked_no_table_title')
    : isUnsaved
    ? t('pay_blocked_unsaved_title')
    : t('pay_blocked_empty_title');

  const message = isNoTable
    ? t('pay_blocked_no_table_msg')
    : isUnsaved
    ? t('pay_blocked_unsaved_msg')
    : t('pay_blocked_empty_msg');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 shrink-0">
            {isEmpty ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            {t('cancel')}
          </button>

          {isNoTable && onSelectTable && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTable();
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <TableIcon className="w-4 h-4" />
              <span>{t('btn_select_table')}</span>
            </button>
          )}

          {isUnsaved && !isNoTable && onSaveAndGoToFloorPlan && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSaveAndGoToFloorPlan();
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{t('btn_save_and_go_floor_plan')}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
