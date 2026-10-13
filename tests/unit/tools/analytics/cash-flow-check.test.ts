/**
 * Cash Flow Check Tool Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleCashFlowCheck } from '../../../../src/tools/analytics/cash-flow-check.js';
import { createMockClient } from '../fixtures/index.js';
import type { MockClient } from '../fixtures/index.js';
import {
  ACCT_CHECKING,
  ACCT_SAVINGS,
  ACCT_TRACKING,
  CAT_DINING,
  CAT_GROCERIES,
  CAT_RTA,
  accountsResponse,
  categoriesResponse,
  transactionsResponse,
  txn,
} from './ledger-fixtures.js';

const PERIOD = { since_date: '2026-01-01', until_date: '2026-02-28' };

function sample() {
  return [
    // January: paid 1,000, spent 300 net, moved 200 to savings (cancels out)
    txn('2026-01-01', 1000000, { category: CAT_RTA, payee: 'Employer' }),
    txn('2026-01-05', -350000, { category: CAT_GROCERIES }),
    txn('2026-01-06', 50000, { category: CAT_GROCERIES, payee: 'Refund' }),
    txn('2026-01-10', -200000, { category: null, transfer: ACCT_SAVINGS }),
    txn('2026-01-10', 200000, { category: null, account: ACCT_SAVINGS, transfer: ACCT_CHECKING }),
    // February: bonus 5,000, spent 900, 100 uncategorized, 400 to an off-budget account
    txn('2026-02-01', 1000000, { category: CAT_RTA, payee: 'Employer' }),
    txn('2026-02-15', 5000000, { category: CAT_RTA, payee: 'Employer Bonus' }),
    txn('2026-02-03', -900000, { category: CAT_DINING }),
    txn('2026-02-04', -100000, { category: null, payee: 'Mystery' }),
    txn('2026-02-20', -400000, { category: null, transfer: ACCT_TRACKING }),
    // Off-budget account activity is ignored
    txn('2026-02-21', 999000, { category: null, account: ACCT_TRACKING }),
    // After the period: changes today's balance, not the period's
    txn('2026-03-05', -250000, { category: CAT_GROCERIES }),
  ];
}

describe('handleCashFlowCheck', () => {
  let mockClient: MockClient;
  let result: Record<string, any>;

  beforeEach(async () => {
    mockClient = createMockClient();
    mockClient.getTransactions.mockResolvedValue(transactionsResponse(sample()));
    mockClient.getCategories.mockResolvedValue(categoriesResponse());
    // Today's on-budget total is 10,000 (checking 9,000 + savings 1,000).
    mockClient.getAccounts.mockResolvedValue(
      accountsResponse({ [ACCT_CHECKING]: 9000000, [ACCT_SAVINGS]: 1000000, [ACCT_TRACKING]: 50000000 })
    );
    result = JSON.parse(await handleCashFlowCheck(PERIOD, mockClient as never));
  });

  it('derives opening and closing balances from today\'s balances', () => {
    // closing = 10,000 + 250 (undo March); change = 700 (Jan) + 4,600 (Feb) = 5,300
    expect(result['balances']).toMatchObject({ closing: 10250, change: 5300, opening: 4950 });
  });

  it('accounts for every dollar of each month\'s balance change', () => {
    expect(result['monthly']).toEqual([
      {
        month: '2026-01',
        income: 1000,
        spending: 300,
        income_minus_spending: 700,
        uncategorized_net: 0,
        balance_change: 700,
      },
      {
        month: '2026-02',
        income: 6000,
        spending: 900,
        income_minus_spending: 5100,
        uncategorized_net: -100,
        off_budget_transfers: -400,
        balance_change: 4600,
      },
    ]);
  });

  it('summarizes the period', () => {
    expect(result['summary']).toEqual({
      income: 7000,
      spending: 1200,
      income_minus_spending: 5800,
      uncategorized_net: -100,
      average_monthly_income: 3500,
      average_monthly_spending: 600,
      months_spending_exceeded_income: 0,
    });
  });

  it('lists the largest inflows and income by payee', () => {
    expect(result['largest_inflows'][0]).toEqual({
      date: '2026-02-15',
      payee: 'Employer Bonus',
      category: 'Ready to Assign',
      amount: 5000,
    });
    expect(result['income_by_payee']).toEqual([
      { payee: 'Employer Bonus', total: 5000, count: 1 },
      { payee: 'Employer', total: 2000, count: 2 },
    ]);
  });

  it('notes uncategorized money when there is some', () => {
    expect(result['notes'].join(' ')).toContain('Some money is uncategorized');
  });

  it('flags a month whose balance change is not explained, such as a starting balance', async () => {
    mockClient.getTransactions.mockResolvedValue(
      transactionsResponse([
        txn('2026-01-01', 300000, { category: CAT_RTA, payee: 'Starting Balance' }),
        txn('2026-01-02', -100000, { category: CAT_GROCERIES }),
      ])
    );
    const r = JSON.parse(await handleCashFlowCheck(PERIOD, mockClient as never));
    expect(r.monthly[0]).toMatchObject({ income: 0, spending: 100, starting_balances: 300, balance_change: 200 });
    expect(r.monthly[0].unexplained).toBeUndefined();
    expect(r.summary.months_spending_exceeded_income).toBe(1);
    expect(r.notes.join(' ')).toContain('All transactions in the period are categorized');
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      handleCashFlowCheck({ since_date: '2026-03-01', until_date: '2026-01-01' }, mockClient as never)
    ).rejects.toThrow('before since_date');
  });
});
