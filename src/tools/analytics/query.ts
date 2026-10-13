/**
 * Query Tool
 *
 * Groups and totals transactions for reports ("eating out by month", "top payees
 * in Household", "everything tagged #trip") using the shared ledger rules, so
 * transfers, splits, refunds and opening balances are handled the same way in
 * every answer.
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { YnabClient } from '../../services/ynab-client.js';
import { toDecimal, toMilliunits, sumMilliunits } from '../../utils/milliunits.js';
import { parseNaturalDate, resolveSinceDate } from '../../utils/dates.js';
import { sanitizeName } from '../../utils/sanitize.js';
import {
  buildCategoryIndex,
  monthStartMonthsAgo,
  monthsBetween,
  toLedgerLines,
  todayIso,
  type LedgerLine,
  type LineKind,
} from './ledger.js';

const DIMENSIONS = ['month', 'year', 'category', 'category_group', 'payee', 'account', 'tag'] as const;
type Dimension = (typeof DIMENSIONS)[number];
const KINDS = ['spending', 'income', 'uncategorized', 'transfer'] as const;
const DEFAULT_MONTHS = 12;
const DEFAULT_LIMIT = 50;

const nameList = z.array(z.string().min(1).max(200)).max(50).optional();

// Input schema
const inputSchema = z.object({
  budget_id: z
    .string()
    .optional()
    .describe('Plan ID; defaults to the configured plan'),
  kind: z.enum(KINDS).optional().describe('What to total (default "spending")'),
  group_by: z
    .array(z.enum(DIMENSIONS))
    .max(2)
    .optional()
    .describe('Up to two dimensions to group by'),
  since_date: z.string().optional().describe('Start date (default: 12 months ago)'),
  until_date: z.string().optional().describe('End date, inclusive (default: today)'),
  categories: nameList.describe('Only these categories (names or IDs)'),
  category_groups: nameList.describe('Only these category groups (names or IDs)'),
  payees: nameList.describe('Only payees containing any of these strings'),
  accounts: nameList.describe('Only accounts whose name contains any of these strings, or IDs'),
  tags: nameList.describe('Only lines with any of these memo tags, e.g. "#trip"'),
  text: z.string().max(200).optional().describe('Only lines whose payee, memo or bank description contains this'),
  min_amount: z.number().nonnegative().optional().describe('Minimum line amount in dollars (absolute)'),
  max_amount: z.number().nonnegative().optional().describe('Maximum line amount in dollars (absolute)'),
  sort: z.enum(['total', 'count', 'key']).optional().describe('Row order'),
  limit: z.number().int().min(1).max(500).optional().describe('Maximum rows (default 50)'),
});

type QueryInput = z.infer<typeof inputSchema>;

// Tool definition
export const queryTool: Tool = {
  name: 'ynab_query',
  description: `Total and group transactions for reports and questions about past spending or income.

Rules applied to every result (so totals match the budget):
- Split transactions are counted per split line.
- Transfers between accounts are not spending or income (kind "transfer" shows them).
- Spending is net: refunds and reimbursements categorized to a category reduce it.
  Spending totals are positive numbers (money out).
- Income is money assigned to "Ready to Assign".
- Uncategorized lines and "Starting Balance" entries are excluded from spending
  and income; the response reports how much was left out.

Amounts are in dollars. With no month/year grouping each row also has a
monthly_average over the whole period. Rows beyond limit are combined into "other".
Default period: the last 12 full months plus this month.`,
  inputSchema: {
    type: 'object',
    properties: {
      budget_id: { type: 'string' },
      kind: {
        type: 'string',
        enum: [...KINDS],
        description: 'What to total: spending (default), income, uncategorized, or transfer',
      },
      group_by: {
        type: 'array',
        items: { type: 'string', enum: [...DIMENSIONS] },
        maxItems: 2,
        description:
          'Up to two of: month, year, category, category_group, payee, account, tag. Omit for a single total.',
      },
      since_date: {
        type: 'string',
        description:
          'Start date: YYYY-MM-DD, natural language ("past 6 months", "this year"), or "all". Default: 12 months ago.',
      },
      until_date: {
        type: 'string',
        description: 'End date, inclusive (YYYY-MM-DD or natural language). Default: today.',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only these categories (exact names, case-insensitive, or IDs)',
      },
      category_groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only these category groups (exact names, case-insensitive, or IDs)',
      },
      payees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only payees whose name or bank description contains any of these (case-insensitive)',
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only accounts whose name contains any of these (case-insensitive), or account IDs',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only lines whose memo has any of these tags, e.g. ["#vegas-2026"]',
      },
      text: {
        type: 'string',
        description: 'Only lines whose payee, memo or bank description contains this (case-insensitive)',
      },
      min_amount: {
        type: 'number',
        description: 'Only lines of at least this many dollars (absolute value)',
      },
      max_amount: {
        type: 'number',
        description: 'Only lines of at most this many dollars (absolute value)',
      },
      sort: {
        type: 'string',
        enum: ['total', 'count', 'key'],
        description: 'Row order: total (largest first, default), count, or key (default when grouping by month/year)',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 500,
        description: 'Maximum rows to return (default 50); the rest are combined into "other"',
      },
    },
    required: [],
  },
};

function dollars(milliunits: number): number {
  return toDecimal(milliunits).toDecimalPlaces(2).toNumber();
}

function matchesNameOrId(value: string | null, id: string | null, wanted: string[]): boolean {
  const lower = value?.toLowerCase();
  return wanted.some((w) => w === id || w.toLowerCase() === lower);
}

function containsAny(haystacks: Array<string | null>, needles: string[]): boolean {
  const lowered = haystacks.filter((h): h is string => !!h).map((h) => h.toLowerCase());
  return needles.some((n) => lowered.some((h) => h.includes(n.toLowerCase())));
}

function lineFilter(input: QueryInput, groupIds: Map<string, string>): (line: LedgerLine) => boolean {
  const min = input.min_amount !== undefined ? toMilliunits(input.min_amount) : undefined;
  const max = input.max_amount !== undefined ? toMilliunits(input.max_amount) : undefined;
  const tags = input.tags?.map((t) => (t.startsWith('#') ? t : `#${t}`).toLowerCase());
  return (line) => {
    if (input.categories && !matchesNameOrId(line.category_name, line.category_id, input.categories)) {
      return false;
    }
    if (input.category_groups) {
      const groupId = line.category_id ? groupIds.get(line.category_id) ?? null : null;
      if (!matchesNameOrId(line.category_group_name, groupId, input.category_groups)) return false;
    }
    if (input.payees && !containsAny([line.payee_name, line.import_payee_name_original], input.payees)) {
      return false;
    }
    if (
      input.accounts &&
      !input.accounts.includes(line.account_id) &&
      !containsAny([line.account_name], input.accounts)
    ) {
      return false;
    }
    if (tags && !line.tags.some((t) => tags.includes(t))) return false;
    if (
      input.text &&
      !containsAny([line.payee_name, line.memo, line.import_payee_name_original], [input.text])
    ) {
      return false;
    }
    const abs = Math.abs(line.amount);
    if (min !== undefined && abs < min) return false;
    if (max !== undefined && abs > max) return false;
    return true;
  };
}

function keysFor(line: LedgerLine, dimension: Dimension): string[] {
  switch (dimension) {
    case 'month':
      return [line.month];
    case 'year':
      return [line.date.substring(0, 4)];
    case 'category':
      return [line.category_name ?? '(none)'];
    case 'category_group':
      return [line.category_group_name ?? '(none)'];
    case 'payee':
      return [line.payee_name ?? '(none)'];
    case 'account':
      return [line.account_name];
    case 'tag':
      // A line with several tags counts toward each of them.
      return line.tags.length > 0 ? line.tags : ['(untagged)'];
  }
}

interface Bucket {
  keys: string[];
  amounts: number[];
}

// Handler function
/**
 * Handler for the ynab_query tool.
 */
export async function handleQuery(
  args: Record<string, unknown>,
  client: YnabClient
): Promise<string> {
  const input = inputSchema.parse(args);
  const budgetId = client.resolveBudgetId(input.budget_id);
  const kind: LineKind = input.kind ?? 'spending';
  const groupBy = [...new Set(input.group_by ?? [])];

  const sinceDate =
    input.since_date !== undefined
      ? resolveSinceDate(input.since_date).since_date
      : monthStartMonthsAgo(DEFAULT_MONTHS);
  const untilDate = input.until_date !== undefined ? parseNaturalDate(input.until_date) : todayIso();
  if (untilDate < sinceDate) {
    throw new Error(`until_date (${untilDate}) is before since_date (${sinceDate})`);
  }

  const [transactionsResponse, categoriesResponse] = await Promise.all([
    client.getTransactions(budgetId, { sinceDate }),
    client.getCategories(budgetId),
  ]);

  const groups = categoriesResponse.data.category_groups;
  const categories = buildCategoryIndex(groups);
  const groupIds = new Map<string, string>();
  for (const group of groups) {
    for (const category of group.categories) groupIds.set(category.id, group.id);
  }

  const inPeriod = toLedgerLines(transactionsResponse.data.transactions, categories).filter(
    (line) => line.date >= sinceDate && line.date <= untilDate
  );
  const filter = lineFilter(input, groupIds);
  const matching = inPeriod.filter(filter);
  const lines = matching.filter((line) => line.kind === kind);

  // Spending is reported as positive money out; other kinds keep YNAB's sign.
  const sign = kind === 'spending' ? -1 : 1;
  // Count months from the first transaction when the plan starts after
  // since_date (e.g. "all"), so monthly averages aren't diluted.
  const earliest = inPeriod.reduce((min, l) => (l.date < min ? l.date : min), untilDate);
  const periodStart = inPeriod.length > 0 && earliest > sinceDate ? earliest : sinceDate;
  const periodMonths = monthsBetween(periodStart, untilDate);

  const buckets = new Map<string, Bucket>();
  const addTo = (keys: string[], amount: number): void => {
    const id = JSON.stringify(keys);
    const bucket = buckets.get(id) ?? { keys, amounts: [] };
    bucket.amounts.push(amount);
    buckets.set(id, bucket);
  };
  for (const line of lines) {
    let combos: string[][] = [[]];
    for (const dimension of groupBy) {
      combos = combos.flatMap((prefix) => keysFor(line, dimension).map((key) => [...prefix, key]));
    }
    for (const keys of combos) addTo(keys, sign * line.amount);
  }
  // Show months with no activity as zero when the report is a monthly series.
  if (groupBy.length === 1 && groupBy[0] === 'month') {
    for (const month of periodMonths) {
      const id = JSON.stringify([month]);
      if (!buckets.has(id)) buckets.set(id, { keys: [month], amounts: [] });
    }
  }

  const timeGrouped = groupBy.includes('month') || groupBy.includes('year');
  const sort = input.sort ?? (timeGrouped ? 'key' : 'total');
  const rows = [...buckets.values()].map((bucket) => {
    const total = sumMilliunits(bucket.amounts);
    const row: Record<string, unknown> = {};
    groupBy.forEach((dimension, i) => {
      const key = bucket.keys[i] ?? '';
      row[dimension] = dimension === 'month' || dimension === 'year' ? key : sanitizeName(key);
    });
    row['total'] = dollars(total);
    row['count'] = bucket.amounts.length;
    row['average'] = bucket.amounts.length > 0 ? dollars(total / bucket.amounts.length) : 0;
    if (!timeGrouped) row['monthly_average'] = dollars(total / periodMonths.length);
    return { row, total, count: bucket.amounts.length, sortKey: bucket.keys.join('\u0000') };
  });
  rows.sort((a, b) => {
    if (sort === 'key') return a.sortKey.localeCompare(b.sortKey);
    if (sort === 'count') return b.count - a.count || b.total - a.total;
    return b.total - a.total;
  });

  const limit = input.limit ?? DEFAULT_LIMIT;
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  const grandTotal = sumMilliunits(rows.map((r) => r.total));

  // What the kind filter left out of the matching lines, so totals are never
  // silently partial.
  const excluded: Record<string, { count: number; net: number }> = {};
  for (const line of matching) {
    if (line.kind === kind) continue;
    const entry = excluded[line.kind] ?? { count: 0, net: 0 };
    entry.count += 1;
    entry.net += line.amount;
    excluded[line.kind] = entry;
  }

  const filtersApplied = Object.fromEntries(
    (['categories', 'category_groups', 'payees', 'accounts', 'tags', 'text', 'min_amount', 'max_amount'] as const)
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]])
  );

  return JSON.stringify(
    {
      kind,
      period: { since_date: sinceDate, until_date: untilDate, months: periodMonths.length },
      group_by: groupBy,
      ...(Object.keys(filtersApplied).length > 0 ? { filters_applied: filtersApplied } : {}),
      total: dollars(grandTotal),
      line_count: lines.length,
      rows: shown.map((r) => r.row),
      ...(rest.length > 0
        ? {
            other: {
              groups: rest.length,
              total: dollars(sumMilliunits(rest.map((r) => r.total))),
              count: rest.reduce((n, r) => n + r.count, 0),
            },
          }
        : {}),
      excluded_from_total: Object.fromEntries(
        Object.entries(excluded).map(([k, v]) => [k, { count: v.count, net: dollars(v.net) }])
      ),
      notes: [
        kind === 'spending'
          ? 'Spending is net of refunds and reimbursements and shown as a positive number.'
          : 'Amounts keep YNAB signs: inflows positive, outflows negative.',
        'Transfers, uncategorized lines and starting balances are counted only under their own kind.',
      ],
    },
    null,
    2
  );
}
