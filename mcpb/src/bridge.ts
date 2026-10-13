/**
 * stdio <-> Streamable HTTP bridge for Claude Desktop.
 *
 * Claude Desktop launches local MCP servers over stdio. This bridge lets it use a
 * ynab-mcp server running in HTTP mode elsewhere (e.g. on the LAN): it relays every
 * JSON-RPC message unchanged and adds the client's API key to each HTTP request.
 * Packaged as an MCP Bundle (.mcpb) it runs on Claude Desktop's built-in Node, so
 * the client machine needs nothing else installed.
 *
 * Configuration (set by the bundle's user_config):
 *   YNAB_MCP_URL      - server endpoint, e.g. http://192.168.1.20:3000/mcp
 *   YNAB_MCP_API_KEY  - one of the server's MCP_API_KEYS
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  isJSONRPCRequest,
  isJSONRPCResponse,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

function fail(message: string): never {
  // stderr only: stdout carries the MCP protocol.
  console.error(`ynab-mcp bridge: ${message}`);
  process.exit(1);
}

const rawUrl = process.env['YNAB_MCP_URL']?.trim();
const apiKey = process.env['YNAB_MCP_API_KEY']?.trim();
if (!rawUrl) fail('YNAB_MCP_URL is not set');
if (!apiKey) fail('YNAB_MCP_API_KEY is not set');

let url: URL;
try {
  url = new URL(rawUrl);
} catch {
  fail(`YNAB_MCP_URL is not a valid URL: ${rawUrl}`);
}
if (url.protocol !== 'http:' && url.protocol !== 'https:') fail('YNAB_MCP_URL must be http(s)');
if (!url.pathname || url.pathname === '/') url.pathname = '/mcp';

const remote = new StreamableHTTPClientTransport(url, {
  requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
});
const local = new StdioServerTransport();

// The HTTP transport must send the negotiated protocol version on every request
// after initialize; a raw relay has to learn it from the initialize response.
const initializeIds = new Set<string | number>();

// Network error codes that, on macOS, usually mean the app lacks Local Network
// permission rather than the server being down.
const LOCAL_NETWORK_HINT_CODES = new Set(['EHOSTUNREACH', 'ENETUNREACH', 'EPERM', 'EACCES']);

/**
 * Describes a failed request. Node's fetch reports every network failure as
 * "fetch failed" and keeps the real reason (ECONNREFUSED, EHOSTUNREACH, ...) on
 * `error.cause`, so surface that and add a hint where the fix is not obvious.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: unknown; message?: unknown } | undefined;
  const code = typeof cause?.code === 'string' ? cause.code : undefined;
  let detail = error.message;
  if (code) detail += ` (${code})`;
  else if (typeof cause?.message === 'string') detail += ` (${cause.message})`;
  if (code && process.platform === 'darwin' && LOCAL_NETWORK_HINT_CODES.has(code)) {
    detail +=
      '. On macOS, check System Settings > Privacy & Security > Local Network and allow Claude, then restart it.';
  }
  return detail;
}

local.onmessage = (message: JSONRPCMessage): void => {
  if (isJSONRPCRequest(message) && message.method === 'initialize') initializeIds.add(message.id);
  remote.send(message).catch((error: unknown) => {
    const detail = describeError(error);
    console.error(`ynab-mcp bridge: request to ${url.origin} failed: ${detail}`);
    // Answer requests with an error so the client does not wait forever.
    if (isJSONRPCRequest(message)) {
      void local.send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32000, message: `ynab-mcp server unreachable or rejected the request: ${detail}` },
      });
    }
  });
};

remote.onmessage = (message: JSONRPCMessage): void => {
  if (isJSONRPCResponse(message) && initializeIds.delete(message.id)) {
    const version = (message.result as { protocolVersion?: unknown }).protocolVersion;
    if (typeof version === 'string') remote.setProtocolVersion(version);
  }
  void local.send(message);
};

remote.onerror = (error: Error): void => {
  console.error(`ynab-mcp bridge: ${describeError(error)}`);
};

const shutdown = async (): Promise<void> => {
  await remote.close().catch(() => undefined);
  process.exit(0);
};
local.onclose = (): void => void shutdown();
process.stdin.on('end', () => void shutdown());

await remote.start();
await local.start();
