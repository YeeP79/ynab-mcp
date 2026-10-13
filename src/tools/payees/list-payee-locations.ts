/**
 * List Payee Locations Tool
 *
 * Lists all payee locations for a budget (used for map features).
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { YnabClient } from '../../services/ynab-client.js';
import { sanitizeString } from '../../utils/sanitize.js';

// Input schema
const inputSchema = z.object({
  budget_id: z
    .string()
    .optional()
    .describe('Plan ID; defaults to the configured plan'),
});

// Tool definition
export const listPayeeLocationsTool: Tool = {
  name: 'ynab_list_payee_locations',
  description: `List all payee locations for a budget.

Returns payee locations with latitude/longitude for mapping purposes.`,
  inputSchema: {
    type: 'object',
    properties: {
      budget_id: { type: 'string' },
    },
    required: [],
  },
};

// Handler function
/**
 * Handler for the ynab_list_payee_locations tool.
 */
export async function handleListPayeeLocations(
  args: Record<string, unknown>,
  client: YnabClient
): Promise<string> {
  const validated = inputSchema.parse(args);
  const budgetId = client.resolveBudgetId(validated.budget_id);

  const response = await client.getPayeeLocations(budgetId);
  const locations = response.data.payee_locations;

  return JSON.stringify(
    {
      location_count: locations.length,
      payee_locations: locations.map((loc) => ({
        id: sanitizeString(loc.id) ?? '',
        payee_id: sanitizeString(loc.payee_id) ?? '',
        latitude: loc.latitude,
        longitude: loc.longitude,
      })),
    },
    null,
    2
  );
}
