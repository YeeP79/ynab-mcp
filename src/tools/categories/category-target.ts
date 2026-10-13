/**
 * Category target fields shared by the create and update category tools.
 *
 * The YNAB API exposes a subset of target settings: an amount, an optional date,
 * and whether the amount is "set aside another" or "refill up to". Setting an
 * amount on a category without a target creates a monthly "Needed for Spending"
 * target; sending null for the amount removes the target. Other target types
 * (savings balance, monthly savings builder) and cadences can only be chosen in
 * the YNAB app.
 */

import { z } from 'zod';
import type * as ynab from 'ynab';
import { formatCurrency, toMilliunits } from '../../utils/milliunits.js';

export const targetBehaviorValues = ['set_aside', 'refill'] as const;

export const targetInputShape = {
  target_amount: z
    .number()
    .finite()
    .nonnegative()
    .nullable()
    .optional()
    .describe('Target amount in dollars. null removes the target.'),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .nullable()
    .optional()
    .describe('Date the target amount is needed by (YYYY-MM-DD). null clears it.'),
  target_behavior: z
    .enum(targetBehaviorValues)
    .optional()
    .describe('"set_aside" (set aside the amount each month) or "refill" (refill up to the amount)'),
};

export const targetJsonSchemaProperties = {
  target_amount: {
    type: ['number', 'null'],
    description:
      'Target amount in dollars (e.g. 600 for $600). On a category without a target this creates a monthly "Needed for Spending" target. null removes the target.',
  },
  target_date: {
    type: ['string', 'null'],
    description: 'Date the target amount is needed by, YYYY-MM-DD. null clears the date.',
  },
  target_behavior: {
    type: 'string',
    enum: [...targetBehaviorValues],
    description:
      '"set_aside" = set aside the full amount every month; "refill" = refill the category up to the amount. Only applies to "Needed for Spending" targets.',
  },
} as const;

type TargetInput = {
  target_amount?: number | null | undefined;
  target_date?: string | null | undefined;
  target_behavior?: (typeof targetBehaviorValues)[number] | undefined;
};

type TargetFields = Pick<
  ynab.SaveCategory,
  'goal_target' | 'goal_target_date' | 'goal_needs_whole_amount'
>;

/**
 * Maps tool input to YNAB's goal_* fields, leaving out anything not provided so
 * the API keeps its current value. null is passed through: it clears the field.
 */
export function toTargetFields(input: TargetInput): TargetFields {
  const fields: TargetFields = {};
  if (input.target_amount !== undefined) {
    fields.goal_target = input.target_amount === null ? null : toMilliunits(input.target_amount);
  }
  if (input.target_date !== undefined) fields.goal_target_date = input.target_date;
  if (input.target_behavior !== undefined) {
    fields.goal_needs_whole_amount = input.target_behavior === 'set_aside';
  }
  return fields;
}

/**
 * Summarizes a category's target in the terms the tools accept.
 */
export function describeTarget(category: ynab.Category): Record<string, unknown> | null {
  if (!category.goal_type) return null;
  return {
    type: category.goal_type,
    amount: category.goal_target != null ? formatCurrency(category.goal_target) : null,
    target_date: category.goal_target_date ?? null,
    behavior:
      category.goal_needs_whole_amount == null
        ? null
        : category.goal_needs_whole_amount
          ? 'set_aside'
          : 'refill',
  };
}
