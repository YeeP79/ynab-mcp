/**
 * Query Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleQuery } from '../../../../src/tools/analytics/query.js';
import { createMockClient } from '../fixtures/index.js';
import type { MockClient } from '../fixtures/index.js';
import {
  ACCT_SAVINGS,
  CAT_DINING,
  CAT_GROCERIES,
  CAT_RENT,
  CAT_RTA,
  categoriesResponse,
  transactionsResponse,
  txn,
} from './ledger-fixtures.js';

const PERIOD = { since_date: '2026-01-01', until_date: '2026-03-31' };

function sample() {
  return [
    txn('2026-01-01', 500000, { category: CAT_RTA, payee: 'Employer' }),
    txn('2026-01-05', -100000, { category: CAT_GROCERIES, payee: 'Market' }),
    txn('2026-01-09', -40000, { category: CAT_DINING, payee: 'Cafe', memo: 'lunch #trip' }),
    txn('2026-02-03', -60000, { category: CAT_GROCERIES, payee: 'Market', original: 'POS MKT 0042' }),
    txn('2026-02-04', 10000, { category: CAT_GROCERIES, payee: 'Market', memo: 'refund' }),
    txn('2026-02-10', -120000, { category: CAT_RENT, payee: 'Landlord' }),
    txn('2026-02-11', -25000, { category: null, transfer: ACCT_SAVINGS, payee: 'Transfer : Savings' }),
    txn('2026-03-02', -7000, { category: null, payee: 'Mystery' }),
    txn('2026-04-02', -99000, { category: CAT_GROCERIES, payee: 'Market' }), // after until_date
  ];
}

async function run(mock: MockClient, args: Record<string, unknown>) {
  return JSON.parse(await handleQuery({ ...PERIOD, ...args }, mock as never));
}

describe('handleQuery', () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    mockClient.getTransactions.mockResolvedValue(transactionsResponse(sample()));
    mockClient.getCategories.mockResolvedValue(categoriesResponse());
  });

  it('totals net spending, excluding transfers, income, uncategorized and later dates', async () => {
    const result = await run(mockClient, {});
    // 100 + 40 + 60 - 10 (refund) + 120
    expect(result.total).toBe(310);
    expect(result.line_count).toBe(5);
    expect(result.rows).toEqual([{ total: 310, count: 5, average: 62, monthly_average: 103.33 }]);
    expect(result.excluded_from_total).toEqual({
      income: { count: 1, net: 500 },
      transfer: { count: 1, net: -25 },
      uncategorized: { count: 1, net: -7 },
    });
    expect(mockClient.getTransactions).toHaveBeenCalledWith('test-budget-id', { sinceDate: '2026-01-01' });
  });

  it('groups by month in date order, filling empty months with zero', async () => {
    const result = await run(mockClient, { categories: ['eating out'], group_by: ['month'] });
    expect(result.rows).toEqual([
      { month: '2026-01', total: 40, count: 1, average: 40 },
      { month: '2026-02', total: 0, count: 0, average: 0 },
      { month: '2026-03', total: 0, count: 0, average: 0 },
    ]);
  });

  it('groups by two dimensions, largest first', async () => {
    const result = await run(mockClient, { group_by: ['category_group', 'category'] });
    expect(result.rows.map((r: Record<string, unknown>) => [r['category_group'], r['category'], r['total']])).toEqual([
      ['Everyday', 'Groceries', 150],
      ['Bills', 'Rent', 120],
      ['Everyday', 'Eating Out', 40],
    ]);
  });

  it('reports income and other kinds with YNAB signs', async () => {
    expect((await run(mockClient, { kind: 'income' })).total).toBe(500);
    expect((await run(mockClient, { kind: 'transfer' })).total).toBe(-25);
    const uncategorized = await run(mockClient, { kind: 'uncategorized', group_by: ['payee'] });
    expect(uncategorized.rows).toEqual([{ payee: 'Mystery', total: -7, count: 1, average: -7, monthly_average: -2.33 }]);
  });

  it('filters by tag, payee (including bank description), account, text and amount', async () => {
    expect((await run(mockClient, { tags: ['trip'] })).total).toBe(40);
    expect((await run(mockClient, { payees: ['pos mkt'] })).total).toBe(60);
    expect((await run(mockClient, { payees: ['market'] })).total).toBe(150);
    expect((await run(mockClient, { accounts: ['check'] })).total).toBe(310);
    expect((await run(mockClient, { accounts: ['nope'] })).total).toBe(0);
    expect((await run(mockClient, { text: 'refund' })).total).toBe(-10);
    expect((await run(mockClient, { min_amount: 50, max_amount: 100 })).total).toBe(160);
    expect((await run(mockClient, { category_groups: ['grp-bills'] })).total).toBe(120);
    const filtered = await run(mockClient, { tags: ['#trip'] });
    expect(filtered.filters_applied).toEqual({ tags: ['#trip'] });
  });

  it('groups by tag, counting untagged lines separately', async () => {
    const result = await run(mockClient, { group_by: ['tag'] });
    expect(result.rows.map((r: Record<string, unknown>) => [r['tag'], r['total']])).toEqual([
      ['(untagged)', 270],
      ['#trip', 40],
    ]);
  });

  it('combines rows beyond the limit into "other"', async () => {
    const result = await run(mockClient, { group_by: ['category'], limit: 1 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].category).toBe('Groceries');
    expect(result.other).toEqual({ groups: 2, total: 160, count: 2 });
    expect(result.total).toBe(310);
  });

  it('sorts by count or key when asked', async () => {
    const byCount = await run(mockClient, { group_by: ['payee'], sort: 'count' });
    expect(byCount.rows[0].payee).toBe('Market');
    const byKey = await run(mockClient, { group_by: ['payee'], sort: 'key' });
    expect(byKey.rows.map((r: Record<string, unknown>) => r['payee'])).toEqual(['Cafe', 'Landlord', 'Market']);
  });

  it('averages "all" over the months that have data, not since 1900', async () => {
    const result = JSON.parse(
      await handleQuery({ since_date: 'all', until_date: '2026-03-31' }, mockClient as never)
    );
    expect(result.period.months).toBe(3);
    expect(mockClient.getTransactions).toHaveBeenCalledWith('test-budget-id', { sinceDate: '1900-01-01' });
  });

  describe('with a fixed clock', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2027-01-15T12:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('defaults to the last 12 full months plus this month', async () => {
      const result = JSON.parse(await handleQuery({}, mockClient as never));
      expect(result.period).toEqual({ since_date: '2026-01-01', until_date: '2027-01-15', months: 13 });
      // The April line is now inside the period.
      expect(result.total).toBe(409);
    });
  });

  it('rejects an end date before the start date and unknown dimensions', async () => {
    await expect(
      handleQuery({ since_date: '2026-03-01', until_date: '2026-01-01' }, mockClient as never)
    ).rejects.toThrow('before since_date');
    await expect(handleQuery({ group_by: ['weekday'] }, mockClient as never)).rejects.toThrow();
    await expect(
      handleQuery({ group_by: ['month', 'payee', 'account'] }, mockClient as never)
    ).rejects.toThrow();
  });
});
