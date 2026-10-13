/**
 * HTTP transport wiring: health, auth gate, and session validation.
 * (Full MCP protocol round-trips are exercised by integration tests later.)
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createHttpApp, isLoopbackHost } from '../../src/http.js';
import type { HttpConfig } from '../../src/config/environment.js';

function makeConfig(overrides: Partial<HttpConfig> = {}): HttpConfig {
  return {
    port: 0,
    host: undefined,
    apiKeys: undefined,
    allowUnauthenticatedFallback: false,
    publicUrl: undefined,
    allowedHosts: undefined,
    allowedOrigins: undefined,
    enableDnsRebindingProtection: false,
    trustProxy: 0,
    fallbackAccessToken: undefined,
    defaultBudgetId: undefined,
    readOnly: true,
    cacheTtlMs: 300000,
    rateLimitPerHour: 180,
    authMode: 'header',
    oauthClientId: undefined,
    oauthClientSecret: undefined,
    encryptionKey: undefined,
    allowWrite: true,
    accessTokenTtlSec: 3600,
    authCodeTtlSec: 600,
    storageDriver: 'memory',
    sqlitePath: undefined,
    databaseUrl: undefined,
    ...overrides,
  };
}

const initializeBody = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.0' },
  },
};

describe('HTTP transport', () => {
  it('GET /health returns ok', async () => {
    const app = await createHttpApp(makeConfig());
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.transport).toBe('http');
  });

  it('defaults to not trusting any reverse proxy hop', async () => {
    const app = await createHttpApp(makeConfig());
    expect(app.get('trust proxy')).toBe(0);
  });

  it('trusts the configured number of reverse-proxy hops', async () => {
    const app = await createHttpApp(makeConfig({ trustProxy: 1 }));
    expect(app.get('trust proxy')).toBe(1);
  });

  it('POST /mcp with a non-initialize request and no session → 400', async () => {
    const app = await createHttpApp(makeConfig({ fallbackAccessToken: 'env-token', host: '127.0.0.1' }));
    const res = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(res.status).toBe(400);
  });

  it('POST /mcp initialize with no YNAB token → 401', async () => {
    const app = await createHttpApp(makeConfig({ fallbackAccessToken: undefined }));
    const res = await request(app).post('/mcp').send(initializeBody);
    expect(res.status).toBe(401);
  });

  it('GET /mcp without a session id → 400', async () => {
    const app = await createHttpApp(makeConfig());
    const res = await request(app).get('/mcp');
    expect(res.status).toBe(400);
  });

  it('DELETE /mcp without a session id → 400', async () => {
    const app = await createHttpApp(makeConfig());
    const res = await request(app).delete('/mcp');
    expect(res.status).toBe(400);
  });

  it('POST /mcp initialize with a token opens a session (returns Mcp-Session-Id)', async () => {
    const app = await createHttpApp(makeConfig({ fallbackAccessToken: 'env-token', host: '127.0.0.1' }));
    const res = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send(initializeBody);

    // A successful initialize issues a session id header regardless of body framing.
    expect(res.status).toBeLessThan(400);
    expect(res.headers['mcp-session-id']).toBeDefined();
  });

  it('DELETE /mcp with a valid session id tears the session down', async () => {
    const app = await createHttpApp(makeConfig({ fallbackAccessToken: 'env-token', host: '127.0.0.1' }));
    const init = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send(initializeBody);
    const sessionId = init.headers['mcp-session-id'] as string;
    expect(sessionId).toBeDefined();

    const del = await request(app).delete('/mcp').set('mcp-session-id', sessionId);
    expect(del.status).toBeLessThan(400);
  });
});

describe('HTTP exposure guard', () => {
  it('refuses a server-held token on all interfaces with no API keys', async () => {
    await expect(createHttpApp(makeConfig({ fallbackAccessToken: 'env-token' }))).rejects.toThrow(
      'Refusing to start'
    );
  });

  it('refuses a server-held token bound to a LAN address with no API keys', async () => {
    await expect(
      createHttpApp(makeConfig({ fallbackAccessToken: 'env-token', host: '192.168.1.20' }))
    ).rejects.toThrow('Refusing to start');
  });

  it('allows it on loopback, with API keys, or with the explicit opt-out', async () => {
    await expect(createHttpApp(makeConfig({ fallbackAccessToken: 't', host: '127.0.0.1' }))).resolves.toBeDefined();
    await expect(
      createHttpApp(makeConfig({ fallbackAccessToken: 't', apiKeys: [{ name: 'laptop', key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }] }))
    ).resolves.toBeDefined();
    await expect(
      createHttpApp(makeConfig({ fallbackAccessToken: 't', allowUnauthenticatedFallback: true }))
    ).resolves.toBeDefined();
  });

  it('does not apply when the server holds no token', async () => {
    await expect(createHttpApp(makeConfig({ host: '0.0.0.0' }))).resolves.toBeDefined();
  });

  it('rejects API keys combined with OAuth mode', async () => {
    await expect(
      createHttpApp(makeConfig({ authMode: 'oauth', apiKeys: [{ name: 'laptop', key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }] }))
    ).rejects.toThrow('header auth only');
  });

  it('recognizes loopback hosts', () => {
    for (const h of ['127.0.0.1', '127.1.2.3', 'localhost', '::1', '[::1]']) expect(isLoopbackHost(h)).toBe(true);
    for (const h of [undefined, '0.0.0.0', '192.168.1.20', '::', 'myhost']) expect(isLoopbackHost(h)).toBe(false);
  });
});

describe('HTTP API key auth', () => {
  const apiKeys = [
    { name: 'laptop', key: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { name: 'desktop', key: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
  ];
  const config = (): HttpConfig => makeConfig({ fallbackAccessToken: 'env-token', host: '0.0.0.0', apiKeys });

  it('rejects /mcp without a key, with WWW-Authenticate', async () => {
    const app = await createHttpApp(config());
    const res = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send(initializeBody);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('Bearer');
  });

  it('rejects a wrong key, including one of a different length', async () => {
    const app = await createHttpApp(config());
    for (const bad of ['cccccccccccccccccccccccccccccccccccccccc', 'short']) {
      const res = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${bad}`)
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeBody);
      expect(res.status).toBe(401);
    }
  });

  it('opens a session with any configured key and uses the server-held token', async () => {
    const app = await createHttpApp(config());
    for (const { key } of apiKeys) {
      const res = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${key}`)
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeBody);
      expect(res.status).toBeLessThan(400);
      expect(res.headers['mcp-session-id']).toBeDefined();
    }
  });

  it('guards session follow-ups too (GET/DELETE need the key)', async () => {
    const app = await createHttpApp(config());
    const init = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)
      .set('Accept', 'application/json, text/event-stream')
      .send(initializeBody);
    const sessionId = init.headers['mcp-session-id'] as string;
    const del = await request(app).delete('/mcp').set('mcp-session-id', sessionId);
    expect(del.status).toBe(401);
  });

  it('leaves /health open', async () => {
    const app = await createHttpApp(config());
    expect((await request(app).get('/health')).status).toBe(200);
  });
});
