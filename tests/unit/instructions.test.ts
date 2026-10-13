/**
 * Server instructions tests
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServerFromClient } from '../../src/server.js';
import { SERVER_INSTRUCTIONS } from '../../src/instructions.js';
import { tools } from '../../src/tools/index.js';
import { prompts } from '../../src/prompts/index.js';

describe('server instructions', () => {
  it('are sent to clients at initialize', async () => {
    const server = createServerFromClient({} as never);
    const client = new Client({ name: 'test', version: '0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    await client.close();
  });

  it('only name tools and prompts that exist', () => {
    const toolNames = new Set(tools.map((t) => t.name));
    const promptNames = new Set(prompts.map((p) => p.name));
    for (const name of SERVER_INSTRUCTIONS.match(/\bynab_[a-z_]+/g) ?? []) {
      expect(toolNames, name).toContain(name);
    }
    for (const name of SERVER_INSTRUCTIONS.match(/\bynab-[a-z-]+/g) ?? []) {
      expect(promptNames, name).toContain(name);
    }
  });

  it('stay short enough to load into every session', () => {
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(4000);
  });
});
