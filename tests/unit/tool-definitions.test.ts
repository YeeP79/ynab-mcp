/**
 * Tool definition tests
 *
 * Every client loads all tool definitions into every conversation, so they
 * should be as clear as possible without growing unchecked.
 */

import { describe, it, expect } from 'vitest';
import { tools } from '../../src/tools/index.js';
import { prompts } from '../../src/prompts/index.js';

describe('tool definitions', () => {
  it('stay within the size budget', () => {
    // About 15k tokens today; raise deliberately when a new tool needs it.
    expect(JSON.stringify(tools).length).toBeLessThan(66000);
  });

  it('only point to tools and prompts that exist', () => {
    const toolNames = new Set(tools.map((t) => t.name));
    const promptNames = new Set(prompts.map((p) => p.name));
    for (const tool of tools) {
      for (const name of tool.description?.match(/\bynab_[a-z_]+/g) ?? []) {
        expect(toolNames, `${tool.name} mentions ${name}`).toContain(name);
      }
      for (const name of tool.description?.match(/\bynab-[a-z-]+/g) ?? []) {
        expect(promptNames, `${tool.name} mentions ${name}`).toContain(name);
      }
    }
  });

  it('give every tool a description', () => {
    for (const tool of tools) {
      expect(tool.description?.trim().length, tool.name).toBeGreaterThan(20);
    }
  });
});
