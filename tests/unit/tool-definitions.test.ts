/**
 * Tool definition size tests
 *
 * Every client loads all tool definitions into every conversation, so their
 * size is a per-conversation cost. Routing examples belong in the server
 * instructions (sent once), not in each tool description.
 */

import { describe, it, expect } from 'vitest';
import { tools } from '../../src/tools/index.js';

describe('tool definitions', () => {
  it('stay within the size budget', () => {
    // About 10.5k tokens today; raise deliberately if a new tool needs it.
    expect(JSON.stringify(tools).length).toBeLessThan(46000);
  });

  it('do not carry example-question lists or repeat the budget_id description', () => {
    for (const tool of tools) {
      expect(tool.description, tool.name).not.toMatch(/Use when/);
      const budgetId = (tool.inputSchema.properties as Record<string, { description?: string }> | undefined)?.[
        'budget_id'
      ];
      expect(budgetId?.description, tool.name).toBeUndefined();
    }
  });

  it('give every tool a short purpose', () => {
    for (const tool of tools) {
      expect(tool.description?.trim().length, tool.name).toBeGreaterThan(20);
    }
  });
});
