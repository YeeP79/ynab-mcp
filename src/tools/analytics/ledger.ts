/**
 * Ledger lines for reporting tools.
 *
 * Turns YNAB transactions into one line per categorized amount, classified so
 * every report agrees on what counts as income and spending:
 *
 * - Split transactions become one line per subtransaction.
 * - Transfers between accounts are `transfer` (they move money, they don't earn
 *   or spend it).
 * - Inflows to "Ready to Assign" are `income`.
 * - Everything else with a category is `spending`, signed so that refunds and
 *   reimbursements categorized back to the category reduce it.
 * - Lines without a category are `uncategorized`, and opening balances
 *   ("Starting Balance") are `starting_balance`; both are kept out of income and
 *   spending and reported separately.
 */

import type * as ynab from 'ynab';

export type LineKind = 'income' | 'spending' | 'transfer' | 'uncategorized' | 'starting_balance';

export interface LedgerLine {
  transaction_id: string;
  date: string;
  month: string;
  amount: number; // milliunits, signed as in YNAB (outflow negative)
  kind: LineKind;
  account_id: string;
  account_name: string;
  transfer_account_id: string | null;
  payee_id: string | null;
  payee_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_group_name: string | null;
  memo: string | null;
  import_payee_name_original: string | null;
  tags: string[];
}

const STARTING_BALANCE_PAYEE = 'Starting Balance';
const INTERNAL_GROUP = 'Internal Master Category';

/** Memo tags like "#moonpatrol" or "#vegas-2026", lower-cased. */
export function extractTags(memo: string | null | undefined): string[] {
  if (!memo) return [];
  const tags = memo.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return [...new Set(tags.map((tag) => tag.toLowerCase()))];
}

export interface CategoryInfo {
  name: string;
  group: string;
  isIncome: boolean;
  isUncategorized: boolean;
}

export function buildCategoryIndex(groups: ynab.CategoryGroupWithCategories[]): Map<string, CategoryInfo> {
  const index = new Map<string, CategoryInfo>();
  for (const group of groups) {
    for (const category of group.categories) {
      const internal = group.name === INTERNAL_GROUP;
      index.set(category.id, {
        name: category.name,
        group: group.name,
        isIncome: internal && category.name.startsWith('Inflow'),
        isUncategorized: internal && !category.name.startsWith('Inflow'),
      });
    }
  }
  return index;
}

function classify(
  payeeName: string | null | undefined,
  categoryId: string | null | undefined,
  transferAccountId: string | null | undefined,
  categories: Map<string, CategoryInfo>
): LineKind {
  if (transferAccountId) return 'transfer';
  if (payeeName === STARTING_BALANCE_PAYEE) return 'starting_balance';
  const info = categoryId ? categories.get(categoryId) : undefined;
  if (!info || info.isUncategorized) return 'uncategorized';
  if (info.isIncome) return 'income';
  return 'spending';
}

/**
 * Expands transactions into ledger lines. Deleted transactions and
 * subtransactions are dropped.
 */
export function toLedgerLines(
  transactions: ynab.TransactionDetail[],
  categories: Map<string, CategoryInfo>
): LedgerLine[] {
  const lines: LedgerLine[] = [];
  for (const txn of transactions) {
    if (txn.deleted) continue;
    const base = {
      transaction_id: txn.id,
      date: txn.date,
      month: txn.date.substring(0, 7),
      account_id: txn.account_id,
      account_name: txn.account_name,
      import_payee_name_original: txn.import_payee_name_original ?? null,
    };
    const subs = (txn.subtransactions ?? []).filter((sub) => !sub.deleted);
    const parts =
      subs.length > 0
        ? subs.map((sub) => ({
            amount: sub.amount,
            payee_id: sub.payee_id ?? txn.payee_id ?? null,
            payee_name: sub.payee_name ?? txn.payee_name ?? null,
            category_id: sub.category_id ?? null,
            memo: sub.memo ?? txn.memo ?? null,
            transfer_account_id: sub.transfer_account_id ?? null,
          }))
        : [
            {
              amount: txn.amount,
              payee_id: txn.payee_id ?? null,
              payee_name: txn.payee_name ?? null,
              category_id: txn.category_id ?? null,
              memo: txn.memo ?? null,
              transfer_account_id: txn.transfer_account_id ?? null,
            },
          ];
    for (const part of parts) {
      const info = part.category_id ? categories.get(part.category_id) : undefined;
      lines.push({
        ...base,
        amount: part.amount,
        kind: classify(part.payee_name, part.category_id, part.transfer_account_id, categories),
        transfer_account_id: part.transfer_account_id,
        payee_id: part.payee_id,
        payee_name: part.payee_name,
        category_id: part.category_id,
        category_name: info?.name ?? null,
        category_group_name: info?.group ?? null,
        memo: part.memo,
        tags: extractTags(part.memo),
      });
    }
  }
  return lines;
}

/** Months from `start` to `end` inclusive, as YYYY-MM. */
export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let [year, month] = start.substring(0, 7).split('-').map(Number) as [number, number];
  const last = end.substring(0, 7);
  for (let guard = 0; guard < 1200; guard++) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > last) break;
    months.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** First day of the month `monthsBack` months before today's month (UTC). */
export function monthStartMonthsAgo(monthsBack: number, today = new Date()): string {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1));
  return date.toISOString().substring(0, 10);
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayIso(today = new Date()): string {
  return today.toISOString().substring(0, 10);
}
