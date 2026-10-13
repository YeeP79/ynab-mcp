/**
 * Spending Report Prompt
 *
 * A household money report for a period: whether income covers spending (tied
 * to real account balances), where the money goes, and what is worth
 * discussing. Built on ynab_cash_flow_check and ynab_query so every number
 * follows the same rules for transfers, splits and refunds.
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

// YYYY-MM-DD or "all"; anything else is ignored rather than interpolated.
const SINCE_PATTERN = /^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])|all)$/;

export const spendingReportPrompt: Prompt = {
  name: 'ynab-spending-report',
  description:
    'Builds a household spending report for a period: whether income covers spending (checked against actual account balances), where the money goes by category and payee, biggest changes, and conversation points. Use for "make a spending report", "where does our money go", "year in review", "are we living within our means", or "report for my partner". Not for this month\'s budget status (use ynab-pulse-check or ynab-monthly-review).',
  arguments: [
    {
      name: 'since_date',
      description: 'Start of the report period, YYYY-MM-DD or "all". Defaults to the last 12 months.',
      required: false,
    },
  ],
};

export function buildSpendingReportMessages(args: Record<string, string>): {
  description: string;
  messages: PromptMessage[];
} {
  const rawSince = args['since_date']?.trim();
  const since = rawSince && SINCE_PATTERN.test(rawSince) ? rawSince : undefined;
  const sinceArg = since ? `since_date: "${since}"` : 'no since_date (last 12 months)';

  return {
    description: 'A household spending report for a period.',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Build a household spending report. Use ${sinceArg} for every call below.

Gather the numbers:
1. ynab_cash_flow_check: income vs spending by month, and the real change in account balances.
2. ynab_query with group_by ["category_group"], then group_by ["category"]: where the money goes.
3. ynab_query with group_by ["month"] for the three largest categories: their trend.
4. ynab_query with group_by ["payee"], limit 15: the biggest payees.
5. ynab_query with kind "uncategorized": what still needs a category.
6. If memos use tags, ynab_query with group_by ["tag"]: projects and trips.

Then write the report with these sections:
1. Headline: average monthly income vs spending, and the opening-to-closing balance change. Lead with the balance change; it doesn't depend on categorization.
2. Regular income vs one-offs: from largest_inflows, separate bonuses, gifts and other one-off deposits from regular pay, and state the monthly gap without them.
3. Where the money goes: category groups and the top categories, with monthly averages.
4. Trends: months or categories that stand out, and why if the payees explain it.
5. Unfinished data: how much is uncategorized and how it could move the numbers.
6. Things worth talking about: 3 to 5 neutral, specific observations, not judgments.

Rules: use only numbers returned by the tools, don't re-add or re-derive totals yourself, and say which period each number covers. Spending figures are net of refunds and reimbursements. Don't change anything in the budget. If the client can show charts or a document, offer one, but keep the written summary.`,
        },
      },
    ],
  };
}
