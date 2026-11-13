import { Bill, Table } from '../types';

export type PayBlockReason = 'empty' | 'unsaved_items' | 'no_table';

export interface CanPayResult {
  allowed: boolean;
  reason?: PayBlockReason;
}

/**
 * Rule: A bill can be paid ONLY when it has at least one saved item
 * and there are NO unsaved draft items for that order/table.
 */
export const canPay = (
  target: Bill | Table | null | undefined,
  billsList?: Bill[]
): CanPayResult => {
  if (!target) {
    return { allowed: false, reason: 'empty' };
  }

  let bill: Bill | undefined | null = null;
  if ('currentBillId' in target) {
    // Target is a Table
    if (!target.currentBillId || !billsList) {
      return { allowed: false, reason: 'empty' };
    }
    bill = billsList.find((b) => b.id === target.currentBillId && b.status === 'open');
  } else if ('items' in target) {
    // Target is a Bill
    bill = target as Bill;
  }

  if (!bill) {
    return { allowed: false, reason: 'empty' };
  }

  const activeItems = (bill.items || []).filter((i) => i.status !== 'voided');
  if (activeItems.length === 0) {
    return { allowed: false, reason: 'empty' };
  }

  const hasUnsavedDraft = activeItems.some((i) => i.isNewUnsent);
  if (hasUnsavedDraft) {
    return { allowed: false, reason: 'unsaved_items' };
  }

  return { allowed: true };
};

/**
 * A table counts as "with customers" (occupied) ONLY when it has at least one active (non-voided)
 * ordered food item on an open bill. Opening a table without ordering keeps it available.
 */
export const isTableWithCustomers = (table: Table, billsList: Bill[]): boolean => {
  if (table.status === 'reserved') return false;

  const tableOpenBills = billsList.filter(
    (b) =>
      b.status === 'open' &&
      (b.tableId === table.id || (table.currentBillId && b.id === table.currentBillId))
  );

  return tableOpenBills.some((b) =>
    (b.items || []).some((item) => item.status !== 'voided')
  );
};
