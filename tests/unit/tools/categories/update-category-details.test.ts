/**
 * Update Category Details Tool Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleUpdateCategoryDetails } from '../../../../src/tools/categories/update-category-details.js';
import { createMockClient } from '../fixtures/index.js';
import type { MockClient } from '../fixtures/index.js';

const CATEGORY_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const GROUP_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

function categoryResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      category: {
        id: CATEGORY_ID,
        name: 'Groceries',
        category_group_id: GROUP_ID,
        note: null,
        goal_type: null,
        ...overrides,
      },
    },
  };
}

describe('handleUpdateCategoryDetails', () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('renames and moves a category, sending only the given fields', async () => {
    mockClient.updateCategory.mockResolvedValue(categoryResponse({ name: 'Food' }));

    const result = await handleUpdateCategoryDetails(
      { category_id: CATEGORY_ID, name: 'Food', category_group_id: GROUP_ID },
      mockClient as never
    );
    const parsed = JSON.parse(result);

    expect(mockClient.updateCategory).toHaveBeenCalledWith('test-budget-id', CATEGORY_ID, {
      category: { name: 'Food', category_group_id: GROUP_ID },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.changed_fields).toEqual(['name', 'category_group_id']);
    expect(parsed.category.name).toBe('Food');
    expect(parsed.category.target).toBeNull();
  });

  it('sets a target in milliunits and reports it back', async () => {
    mockClient.updateCategory.mockResolvedValue(
      categoryResponse({
        goal_type: 'NEED',
        goal_target: 600000,
        goal_target_date: null,
        goal_needs_whole_amount: false,
      })
    );

    const result = await handleUpdateCategoryDetails(
      { category_id: CATEGORY_ID, target_amount: 600, target_behavior: 'refill' },
      mockClient as never
    );
    const parsed = JSON.parse(result);

    expect(mockClient.updateCategory).toHaveBeenCalledWith('test-budget-id', CATEGORY_ID, {
      category: { goal_target: 600000, goal_needs_whole_amount: false },
    });
    expect(parsed.category.target).toEqual({
      type: 'NEED',
      amount: '$600.00',
      target_date: null,
      behavior: 'refill',
    });
  });

  it('maps set_aside to goal_needs_whole_amount true and passes a target date', async () => {
    mockClient.updateCategory.mockResolvedValue(categoryResponse());

    await handleUpdateCategoryDetails(
      { category_id: CATEGORY_ID, target_behavior: 'set_aside', target_date: '2027-06-01' },
      mockClient as never
    );

    expect(mockClient.updateCategory).toHaveBeenCalledWith('test-budget-id', CATEGORY_ID, {
      category: { goal_target_date: '2027-06-01', goal_needs_whole_amount: true },
    });
  });

  it('sends null to remove a target and clear a note', async () => {
    mockClient.updateCategory.mockResolvedValue(categoryResponse());

    await handleUpdateCategoryDetails(
      { category_id: CATEGORY_ID, target_amount: null, note: null },
      mockClient as never
    );

    expect(mockClient.updateCategory).toHaveBeenCalledWith('test-budget-id', CATEGORY_ID, {
      category: { note: null, goal_target: null },
    });
  });

  it('rounds fractional target amounts to milliunits', async () => {
    mockClient.updateCategory.mockResolvedValue(categoryResponse());

    await handleUpdateCategoryDetails(
      { category_id: CATEGORY_ID, target_amount: 42.505 },
      mockClient as never
    );

    expect(mockClient.updateCategory).toHaveBeenCalledWith('test-budget-id', CATEGORY_ID, {
      category: { goal_target: 42505 },
    });
  });

  it('uses the given budget_id', async () => {
    mockClient.updateCategory.mockResolvedValue(categoryResponse());

    await handleUpdateCategoryDetails(
      { budget_id: 'other-budget', category_id: CATEGORY_ID, name: 'X' },
      mockClient as never
    );

    expect(mockClient.resolveBudgetId).toHaveBeenCalledWith('other-budget');
  });

  it('rejects a call that changes nothing', async () => {
    await expect(
      handleUpdateCategoryDetails({ category_id: CATEGORY_ID }, mockClient as never)
    ).rejects.toThrow('at least one field');
    expect(mockClient.updateCategory).not.toHaveBeenCalled();
  });

  it('rejects a negative target, a bad date, an unknown behavior and a non-UUID id', async () => {
    const bad = [
      { category_id: CATEGORY_ID, target_amount: -5 },
      { category_id: CATEGORY_ID, target_date: '06/01/2027' },
      { category_id: CATEGORY_ID, target_behavior: 'sometimes' },
      { category_id: 'not-a-uuid', name: 'X' },
      { category_id: CATEGORY_ID, name: '' },
    ];
    for (const args of bad) {
      await expect(handleUpdateCategoryDetails(args, mockClient as never)).rejects.toThrow();
    }
    expect(mockClient.updateCategory).not.toHaveBeenCalled();
  });

  it('propagates API errors', async () => {
    mockClient.updateCategory.mockRejectedValue(new Error('API Error'));

    await expect(
      handleUpdateCategoryDetails({ category_id: CATEGORY_ID, name: 'X' }, mockClient as never)
    ).rejects.toThrow('API Error');
  });
});
