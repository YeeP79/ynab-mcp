/**
 * Update Category Details Tool
 *
 * Renames a category, moves it to another group, edits its note, or sets its
 * target. (ynab_update_category sets one month's budgeted amount.)
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type * as ynab from 'ynab';
import type { YnabClient } from '../../services/ynab-client.js';
import { sanitizeMemo, sanitizeName } from '../../utils/sanitize.js';
import {
  describeTarget,
  targetInputShape,
  targetJsonSchemaProperties,
  toTargetFields,
} from './category-target.js';

// Input schema
const inputSchema = z
  .object({
    budget_id: z
      .string()
      .optional()
      .describe('Plan ID. Omit to use the configured plan.'),
    category_id: z.string().uuid().describe('The category UUID to update'),
    name: z.string().min(1).max(500).optional().describe('New name for the category'),
    note: z.string().max(500).nullable().optional().describe('New note. null clears it.'),
    category_group_id: z
      .string()
      .uuid()
      .optional()
      .describe('Move the category to this category group'),
    ...targetInputShape,
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.note !== undefined ||
      input.category_group_id !== undefined ||
      input.target_amount !== undefined ||
      input.target_date !== undefined ||
      input.target_behavior !== undefined,
    { message: 'Provide at least one field to change' }
  );

// Tool definition
export const updateCategoryDetailsTool: Tool = {
  name: 'ynab_update_category_details',
  description: `Rename a category, move it to another group, change its note, or set its target.

Use when the user asks:
- "Rename Dining Out to Eating Out"
- "Move Therapy into Bills"
- "Set a $600 monthly target for Groceries"
- "Make Insurance a refill-up-to target of $1,200"
- "Remove the target from Hobbies"

Only the fields you pass are changed. Targets: setting target_amount on a category
without a target creates a monthly "Needed for Spending" target; target_amount null
removes the target. To set one month's budgeted amount, use ynab_update_category.

The YNAB API cannot hide, delete or reorder categories, or choose other target types
or cadences; those must be done in the YNAB app.

Requires a category_id. Use ynab_list_categories first to find category and group IDs.

**Note:** This is a write operation. Requires YNAB_READ_ONLY=false.`,
  inputSchema: {
    type: 'object',
    properties: {
      budget_id: {
        type: 'string',
        description: 'Plan ID. Omit to use the configured plan.',
      },
      category_id: {
        type: 'string',
        description: 'The category UUID to update',
      },
      name: {
        type: 'string',
        description: 'New name for the category',
      },
      note: {
        type: ['string', 'null'],
        description: 'New note for the category. null clears it.',
      },
      category_group_id: {
        type: 'string',
        description: 'Move the category to this category group (UUID)',
      },
      ...targetJsonSchemaProperties,
    },
    required: ['category_id'],
  },
};

// Handler function
/**
 * Handler for the ynab_update_category_details tool.
 */
export async function handleUpdateCategoryDetails(
  args: Record<string, unknown>,
  client: YnabClient
): Promise<string> {
  const validated = inputSchema.parse(args);
  const budgetId = client.resolveBudgetId(validated.budget_id);

  const changes = {
    ...(validated.name !== undefined ? { name: validated.name } : {}),
    ...(validated.note !== undefined ? { note: validated.note } : {}),
    ...(validated.category_group_id !== undefined
      ? { category_group_id: validated.category_group_id }
      : {}),
    ...toTargetFields(validated),
  };

  // The SDK types these fields as non-nullable on PATCH, but the API accepts
  // null to clear a note or remove a target (SaveCategory documents this).
  const response = await client.updateCategory(budgetId, validated.category_id, {
    category: changes as ynab.ExistingCategory,
  });

  const category = response.data.category;
  const categoryName = sanitizeName(category.name);

  return JSON.stringify(
    {
      success: true,
      message: `Category "${categoryName}" updated`,
      changed_fields: Object.keys(validated).filter(
        (key) => key !== 'budget_id' && key !== 'category_id'
      ),
      category: {
        id: category.id,
        name: categoryName,
        category_group_id: category.category_group_id,
        note: sanitizeMemo(category.note),
        target: describeTarget(category),
      },
    },
    null,
    2
  );
}
