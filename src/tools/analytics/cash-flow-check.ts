/**
 * Cash Flow Check Tool
 *
 * Month by month: income, spending, and the actual change in on-budget account
 * balances, with every dollar of the balance change accounted for. Answers "are
 * we living within our means?" from the accounts themselves, so the answer
 * doesn't depend on categorization being finished.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { YnabClient } from '../../services/ynab-client.js';
import { toDecimal, sumMilliunits } from '../../utils/milliunits.js';
import { parseNaturalDate, resolveSinceDate } from '../../utils/dates.js';
import { sanitizeName } from '../../utils/sanitize.js';
import {
  buildCategoryIndex,
  monthStartMonthsAgo,
  monthsBetween,
  toLedgerLines,
  todayIso,
} from './ledger.js';

const DEFAULT_MONTHS = 12;
const TOP_INFLOWS = 10;

// Input schema
const inputSchema = z.object({
  budget_id: z
    .string()
    .optional()
    .describe('Budget UUID. Defaults to YNAB_BUDGET_ID env var or "last-used"'),
  since_date: z.string().optional().describe('Start date (default: 12 months ago)'),
  until_date: z.string().optional().describe('End date, inclusive (default: today)'),
});

// Tool definition
export const cashFlowCheckTool: Tool = {
  name: 'ynab_cash_flow_check',
  description: `Check income against spending month by month, tied to the real change in account balances.

Use when the user asks:
- "Are we spending more than we make?"
- "Where did our savings go this year?"
- "Did our accounts grow or shrink, and why?"
- "Are bonuses covering our regular spending?"

For each month: income, spending (net of refunds), uncategorized money, transfers
to off-budget accounts, and the change in total on-budget balances. These always
add up, so the balance change is accounted for even when some transactions still
need a category. Also returns opening and closing balances for the period and the
largest inflows, which is where bonuses and one-off deposits show up.

Amounts are in dollars. Default period: the last 12 full months plus this month.`,
  inputSchema: {
    type: 'object',
    properties: {
      budget_id: {
        type: 'string',
        description: 'Budget UUID. Defaults to YNAB_BUDGET_ID env var or "last-used"',
      },
      since_date: {
        type: 'string',
        description:
          'Start date: YYYY-MM-DD, natural language ("this year", "past 6 months"), or "all". Default: 12 months ago.',
      },
      until_date: {
        type: 'string',
        description: 'End date, inclusive. Default: today.',
      },
    },
    required: [],
  },
};

function dollars(milliunits: number): number {
  return toDecimal(milliunits).toDecimalPlaces(2).toNumber();
}

interface MonthTotals {
  income: number[];
  spending: number[];
  uncategorized: number[];
  starting_balance: number[];
  off_budget_transfers: number[];
  all: number[];
}

// Handler function
/**
 * Handler for the ynab_cash_flow_check tool.
 */
export async function handleCashFlowCheck(
  args: Record<string, unknown>,
  client: YnabClient
): Promise<string> {
  const input = inputSchema.parse(args);
  const budgetId = client.resolveBudgetId(input.budget_id);

  const sinceDate =
    input.since_date !== undefined
      ? resolveSinceDate(input.since_date).since_date
      : monthStartMonthsAgo(DEFAULT_MONTHS);
  const untilDate = input.until_date !== undefined ? parseNaturalDate(input.until_date) : todayIso();
  if (untilDate < sinceDate) {
    throw new Error(`until_date (${untilDate}) is before since_date (${sinceDate})`);
  }

  const [transactionsResponse, categoriesResponse, accountsResponse] = await Promise.all([
    client.getTransactions(budgetId, { sinceDate }),
    client.getCategories(budgetId),
    client.getAccounts(budgetId),
  ]);

  const onBudget = new Set(
    accountsResponse.data.accounts.filter((a) => a.on_budget && !a.deleted).map((a) => a.id)
  );
  const currentBalance = sumMilliunits(
    accountsResponse.data.accounts.filter((a) => onBudget.has(a.id)).map((a) => a.balance)
  );

  const categories = buildCategoryIndex(categoriesResponse.data.category_groups);
  const lines = toLedgerLines(transactionsResponse.data.transactions, categories).filter((line) =>
    onBudget.has(line.account_id)
  );

  const afterPeriod = lines.filter((l) => l.date > untilDate);
  const inPeriod = lines.filter((l) => l.date >= sinceDate && l.date <= untilDate);
  const closing = currentBalance - sumMilliunits(afterPeriod.map((l) => l.amount));
  const opening = closing - sumMilliunits(inPeriod.map((l) => l.amount));

  const earliest = inPeriod.reduce((min, l) => (l.date < min ? l.date : min), untilDate);
  const periodStart = inPeriod.length > 0 && earliest > sinceDate ? earliest : sinceDate;
  const months = monthsBetween(periodStart, untilDate);

  const byMonth = new Map<string, MonthTotals>();
  for (const month of months) {
    byMonth.set(month, {
      income: [],
      spending: [],
      uncategorized: [],
      starting_balance: [],
      off_budget_transfers: [],
      all: [],
    });
  }

  const inflows: Array<{ date: string; payee: string; category: string | null; amount: number }> = [];
  for (const line of inPeriod) {
    const totals = byMonth.get(line.month);
    if (!totals) continue;
    totals.all.push(line.amount);
    switch (line.kind) {
      case 'income':
        totals.income.push(line.amount);
        break;
      case 'spending':
        totals.spending.push(-line.amount);
        break;
      case 'uncategorized':
        totals.uncategorized.push(line.amount);
        break;
      case 'starting_balance':
        totals.starting_balance.push(line.amount);
        break;
      case 'transfer':
        // Transfers between two on-budget accounts cancel out; one to a
        // tracking (off-budget) account changes the on-budget total.
        if (!line.transfer_account_id || !onBudget.has(line.transfer_account_id)) {
          totals.off_budget_transfers.push(line.amount);
        }
        break;
    }
    if (line.amount > 0 && (line.kind === 'income' || line.kind === 'uncategorized')) {
      inflows.push({
        date: line.date,
        payee: sanitizeName(line.payee_name),
        category: line.kind === 'income' ? 'Ready to Assign' : 'Uncategorized',
        amount: line.amount,
      });
    }
  }

  const monthly = months.map((month) => {
    const t = byMonth.get(month)!;
    const income = sumMilliunits(t.income);
    const spending = sumMilliunits(t.spending);
    const uncategorized = sumMilliunits(t.uncategorized);
    const startingBalance = sumMilliunits(t.starting_balance);
    const offBudget = sumMilliunits(t.off_budget_transfers);
    const change = sumMilliunits(t.all);
    const explained = income - spending + uncategorized + startingBalance + offBudget;
    return {
      month,
      income: dollars(income),
      spending: dollars(spending),
      income_minus_spending: dollars(income - spending),
      uncategorized_net: dollars(uncategorized),
      ...(startingBalance !== 0 ? { starting_balances: dollars(startingBalance) } : {}),
      ...(offBudget !== 0 ? { off_budget_transfers: dollars(offBudget) } : {}),
      balance_change: dollars(change),
      ...(change !== explained ? { unexplained: dollars(change - explained) } : {}),
      raw: { income, spending, uncategorized, startingBalance, offBudget, change },
    };
  });

  const sum = (pick: (m: (typeof monthly)[number]['raw']) => number): number =>
    sumMilliunits(monthly.map((m) => pick(m.raw)));
  const totalIncome = sum((r) => r.income);
  const totalSpending = sum((r) => r.spending);
  const totalUncategorized = sum((r) => r.uncategorized);
  const monthCount = Math.max(months.length, 1);

  inflows.sort((a, b) => b.amount - a.amount);
  const incomeByPayee = new Map<string, number[]>();
  for (const inflow of inflows) {
    if (inflow.category !== 'Ready to Assign') continue;
    incomeByPayee.set(inflow.payee, [...(incomeByPayee.get(inflow.payee) ?? []), inflow.amount]);
  }
  const deficitMonths = monthly.filter((m) => m.raw.income < m.raw.spending).length;

  return JSON.stringify(
    {
      period: { since_date: sinceDate, until_date: untilDate, months: months.length },
      balances: {
        opening: dollars(opening),
        closing: dollars(closing),
        change: dollars(closing - opening),
        note: 'Total of on-budget accounts (credit cards count as negative).',
      },
      summary: {
        income: dollars(totalIncome),
        spending: dollars(totalSpending),
        income_minus_spending: dollars(totalIncome - totalSpending),
        uncategorized_net: dollars(totalUncategorized),
        average_monthly_income: dollars(totalIncome / monthCount),
        average_monthly_spending: dollars(totalSpending / monthCount),
        months_spending_exceeded_income: deficitMonths,
      },
      monthly: monthly.map(({ raw: _raw, ...rest }) => rest),
      largest_inflows: inflows.slice(0, TOP_INFLOWS).map((i) => ({ ...i, amount: dollars(i.amount) })),
      income_by_payee: [...incomeByPayee.entries()]
        .map(([payee, amounts]) => ({
          payee,
          total: dollars(sumMilliunits(amounts)),
          count: amounts.length,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_INFLOWS),
      notes: [
        'balance_change = income - spending + uncategorized_net (+ starting_balances + off_budget_transfers).',
        'Spending is net of refunds and reimbursements. Transfers between on-budget accounts are excluded.',
        totalUncategorized !== 0
          ? 'Some money is uncategorized; categorizing it moves it into income or spending without changing balances.'
          : 'All transactions in the period are categorized.',
        'Large one-off inflows (bonuses, gifts, sales) appear in largest_inflows; compare income without them to spending to see the regular gap.',
      ],
    },
    null,
    2
  );
}
