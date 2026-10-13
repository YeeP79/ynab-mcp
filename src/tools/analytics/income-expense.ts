/**
 * Income vs Expense Tool
 *
 * Tracks income and expenses with month-over-month comparison.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { YnabClient } from '../../services/ynab-client.js';
import { formatCurrency, sumMilliunits } from '../../utils/milliunits.js';
import { buildCategoryIndex, toLedgerLines } from './ledger.js';

// Input schema
const inputSchema = z.object({
  budget_id: z
    .string()
    .optional()
    .describe('Plan ID; defaults to the configured plan'),
  months: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe('Number of months to analyze (default 6)'),
});

// Tool definition
export const incomeExpenseTool: Tool = {
  name: 'ynab_income_expense',
  description: `Track income vs expenses with monthly breakdown.

Returns monthly income, expenses, net savings, and savings rate. Income is money
assigned to Ready to Assign; expenses are net of refunds. Transfers, starting
balances and uncategorized transactions are excluded (uncategorized is reported).`,
  inputSchema: {
    type: 'object',
    properties: {
      budget_id: { type: 'string' },
      months: {
        type: 'integer',
        description: 'Number of months to analyze (default 6)',
        minimum: 1,
        maximum: 12,
      },
    },
    required: [],
  },
};

interface MonthData {
  month: string;
  income: string;
  expenses: string;
  net: string;
  income_raw: number;
  expenses_raw: number;
  net_raw: number;
  savings_rate: number | null;
}

// Handler function
/**
 * Handler for the ynab_income_expense tool.
 */
export async function handleIncomeExpense(
  args: Record<string, unknown>,
  client: YnabClient
): Promise<string> {
  const validated = inputSchema.parse(args);
  const budgetId = client.resolveBudgetId(validated.budget_id);
  const monthsToAnalyze = validated.months ?? 6;

  // Calculate date range
  const sinceDate = new Date();
  sinceDate.setDate(1); // Avoid overflow when subtracting months (e.g., Mar 31 - 1 month)
  sinceDate.setMonth(sinceDate.getMonth() - monthsToAnalyze);
  const sinceDateStr = sinceDate.toISOString().split('T')[0];
  if (!sinceDateStr) {
    throw new Error('Failed to compute since date for income/expense analysis');
  }

  // Get transactions and categories; the ledger decides what is income
  // (Ready to Assign inflows) and spending (net of refunds, split lines counted
  // separately), leaving out transfers, starting balances and uncategorized money.
  const [transactionsResponse, categoriesResponse] = await Promise.all([
    client.getTransactions(budgetId, { sinceDate: sinceDateStr }),
    client.getCategories(budgetId),
  ]);
  const lines = toLedgerLines(
    transactionsResponse.data.transactions,
    buildCategoryIndex(categoriesResponse.data.category_groups)
  );

  // Group by month
  const byMonth = new Map<string, { income: number[]; expenses: number[] }>();
  const uncategorized: number[] = [];

  for (const line of lines) {
    if (line.kind === 'uncategorized') uncategorized.push(line.amount);
    if (line.kind !== 'income' && line.kind !== 'spending') continue;

    if (!byMonth.has(line.month)) {
      byMonth.set(line.month, { income: [], expenses: [] });
    }

    const monthData = byMonth.get(line.month)!;

    if (line.kind === 'income') {
      monthData.income.push(line.amount);
    } else {
      // Outflows are negative; a refund (positive) reduces expenses.
      monthData.expenses.push(-line.amount);
    }
  }

  // Build monthly data
  const monthlyData: MonthData[] = [];

  for (const [month, data] of byMonth) {
    const income = sumMilliunits(data.income);
    const expenses = sumMilliunits(data.expenses);
    const net = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : null;

    monthlyData.push({
      month,
      income: formatCurrency(income),
      expenses: formatCurrency(expenses),
      net: formatCurrency(net),
      income_raw: income,
      expenses_raw: expenses,
      net_raw: net,
      savings_rate: savingsRate !== null ? Math.round(savingsRate) : null,
    });
  }

  // Sort by month
  monthlyData.sort((a, b) => a.month.localeCompare(b.month));

  // Calculate totals
  const totalIncome = sumMilliunits(monthlyData.map((m) => m.income_raw));
  const totalExpenses = sumMilliunits(monthlyData.map((m) => m.expenses_raw));
  const totalNet = totalIncome - totalExpenses;
  // When totalIncome is 0, savings_rate should be null (not 0%)
  const overallSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : null;

  // Calculate averages
  const avgIncome = monthlyData.length > 0 ? totalIncome / monthlyData.length : 0;
  const avgExpenses = monthlyData.length > 0 ? totalExpenses / monthlyData.length : 0;
  const avgNet = avgIncome - avgExpenses;

  // Calculate trend
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  let trendMessage = 'Savings rate is stable';

  if (monthlyData.length >= 2) {
    const firstHalf = monthlyData.slice(0, Math.floor(monthlyData.length / 2));
    const secondHalf = monthlyData.slice(Math.floor(monthlyData.length / 2));

    // Calculate savings rates, handling zero income explicitly
    const firstHalfIncome = sumMilliunits(firstHalf.map((m) => m.income_raw));
    const secondHalfIncome = sumMilliunits(secondHalf.map((m) => m.income_raw));
    const firstHalfRate = firstHalfIncome > 0
      ? sumMilliunits(firstHalf.map((m) => m.net_raw)) / firstHalfIncome
      : 0;
    const secondHalfRate = secondHalfIncome > 0
      ? sumMilliunits(secondHalf.map((m) => m.net_raw)) / secondHalfIncome
      : 0;

    // Only compare rates if both periods have income
    if (firstHalfIncome > 0 && secondHalfIncome > 0) {
      if (secondHalfRate > firstHalfRate + 0.05) {
        trend = 'improving';
        trendMessage = 'Savings rate is improving';
      } else if (secondHalfRate < firstHalfRate - 0.05) {
        trend = 'declining';
        trendMessage = 'Savings rate is declining';
      }
    }
  }

  // Determine status
  let status: 'healthy' | 'warning' | 'concern';
  let statusMessage: string;

  // Handle zero-income case explicitly
  if (overallSavingsRate === null) {
    // No income in the period
    if (totalExpenses > 0) {
      status = 'concern';
      statusMessage = 'No income recorded, but expenses occurred';
    } else {
      status = 'warning';
      statusMessage = 'No income or expenses recorded in this period';
    }
  } else if (overallSavingsRate >= 20) {
    status = 'healthy';
    statusMessage = 'Excellent savings rate (20%+)';
  } else if (overallSavingsRate >= 10) {
    status = 'healthy';
    statusMessage = 'Good savings rate (10-20%)';
  } else if (overallSavingsRate >= 0) {
    status = 'warning';
    statusMessage = 'Low savings rate (0-10%)';
  } else {
    status = 'concern';
    statusMessage = 'Spending exceeds income';
  }

  return JSON.stringify(
    {
      status,
      message: statusMessage,
      trend,
      trend_message: trendMessage,
      period: {
        months_analyzed: monthlyData.length,
        since_date: sinceDateStr,
      },
      totals: {
        total_income: formatCurrency(totalIncome),
        total_expenses: formatCurrency(totalExpenses),
        net_savings: formatCurrency(totalNet),
        savings_rate: overallSavingsRate !== null ? `${Math.round(overallSavingsRate)}%` : 'N/A',
      },
      ...(uncategorized.length > 0
        ? {
            uncategorized: {
              count: uncategorized.length,
              net: formatCurrency(sumMilliunits(uncategorized)),
              note: 'Not counted as income or expenses until categorized.',
            },
          }
        : {}),
      averages: {
        avg_monthly_income: formatCurrency(avgIncome),
        avg_monthly_expenses: formatCurrency(avgExpenses),
        avg_monthly_net: formatCurrency(avgNet),
      },
      monthly_breakdown: monthlyData.map((m) => ({
        month: m.month,
        income: m.income,
        expenses: m.expenses,
        net: m.net,
        savings_rate: m.savings_rate !== null ? `${m.savings_rate}%` : 'N/A',
      })),
      insights: {
        best_month: monthlyData.length > 0
          ? monthlyData.reduce((best, m) => m.net_raw > best.net_raw ? m : best).month
          : null,
        worst_month: monthlyData.length > 0
          ? monthlyData.reduce((worst, m) => m.net_raw < worst.net_raw ? m : worst).month
          : null,
      },
    },
    null,
    2
  );
}
