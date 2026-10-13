/**
 * Ledger Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildCategoryIndex,
  extractTags,
  monthStartMonthsAgo,
  monthsBetween,
  toLedgerLines,
  todayIso,
} from '../../../../src/tools/analytics/ledger.js';
import {
  ACCT_SAVINGS,
  CAT_DINING,
  CAT_RTA,
  CAT_UNCATEGORIZED,
  categoryGroups,
  txn,
} from './ledger-fixtures.js';

const index = buildCategoryIndex(categoryGroups as never);
const lines = (t: unknown[]) => toLedgerLines(t as never, index);

describe('extractTags', () => {
  it('finds lower-cased, de-duplicated hashtags', () => {
    expect(extractTags('parts #MoonPatrol and #moonpatrol #vegas-2026')).toEqual([
      '#moonpatrol',
      '#vegas-2026',
    ]);
  });

  it('returns nothing for empty memos', () => {
    expect(extractTags(null)).toEqual([]);
    expect(extractTags(undefined)).toEqual([]);
    expect(extractTags('no tags here')).toEqual([]);
  });
});

describe('buildCategoryIndex', () => {
  it('marks Ready to Assign as income and Uncategorized as uncategorized', () => {
    expect(index.get(CAT_RTA)).toMatchObject({ isIncome: true, isUncategorized: false });
    expect(index.get(CAT_UNCATEGORIZED)).toMatchObject({ isIncome: false, isUncategorized: true });
    expect(index.get(CAT_DINING)).toMatchObject({ name: 'Eating Out', group: 'Everyday', isIncome: false });
  });
});

describe('toLedgerLines', () => {
  it('classifies income, spending, refunds, transfers, starting balances and uncategorized', () => {
    const result = lines([
      txn('2026-01-01', 100000, { category: CAT_RTA, payee: 'Starting Balance' }),
      txn('2026-01-02', 500000, { category: CAT_RTA, payee: 'Employer' }),
      txn('2026-01-03', -40000, { category: CAT_DINING }),
      txn('2026-01-04', 10000, { category: CAT_DINING }),
      txn('2026-01-05', -20000, { category: null, transfer: ACCT_SAVINGS }),
      txn('2026-01-06', -7000, { category: null }),
      txn('2026-01-07', -8000, { category: CAT_UNCATEGORIZED }),
      txn('2026-01-08', -9000, { category: 'unknown-category' }),
    ]);
    expect(result.map((l) => l.kind)).toEqual([
      'starting_balance',
      'income',
      'spending',
      'spending',
      'transfer',
      'uncategorized',
      'uncategorized',
      'uncategorized',
    ]);
    expect(result[2]).toMatchObject({ month: '2026-01', category_name: 'Eating Out', category_group_name: 'Everyday' });
  });

  it('expands splits into one line per subtransaction and skips deleted ones', () => {
    const result = lines([
      txn('2026-02-01', -60000, {
        memo: 'parent #trip',
        subs: [
          { amount: -50000 },
          { amount: -10000, category: CAT_DINING, memo: 'dinner' },
          { amount: -1, deleted: true },
        ],
      }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ amount: -50000, category_name: 'Groceries', memo: 'parent #trip', tags: ['#trip'] });
    expect(result[1]).toMatchObject({ amount: -10000, category_name: 'Eating Out', memo: 'dinner', tags: [] });
  });

  it('classifies a split line that is a transfer as a transfer', () => {
    const result = lines([
      txn('2026-02-01', -30000, { subs: [{ amount: -20000 }, { amount: -10000, category: null, transfer: ACCT_SAVINGS }] }),
    ]);
    expect(result.map((l) => [l.kind, l.transfer_account_id])).toEqual([
      ['spending', null],
      ['transfer', ACCT_SAVINGS],
    ]);
  });

  it('drops deleted transactions and keeps the bank description', () => {
    const result = lines([
      txn('2026-03-01', -1000, { deleted: true }),
      txn('2026-03-02', -2000, { original: 'POS 1234 STORE' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.import_payee_name_original).toBe('POS 1234 STORE');
  });
});

describe('date helpers', () => {
  it('lists months inclusively across a year boundary', () => {
    expect(monthsBetween('2025-11-15', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-03-01', '2026-03-31')).toEqual(['2026-03']);
    expect(monthsBetween('2026-04-01', '2026-03-31')).toEqual([]);
  });

  it('computes the first of the month N months back, in UTC', () => {
    const today = new Date(Date.UTC(2026, 0, 31));
    expect(monthStartMonthsAgo(12, today)).toBe('2025-01-01');
    expect(monthStartMonthsAgo(1, today)).toBe('2025-12-01');
    expect(todayIso(today)).toBe('2026-01-31');
  });
});
