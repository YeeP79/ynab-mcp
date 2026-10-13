# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Transaction tools silently returned only recent history when `since_date`
  was omitted.** The YNAB API applies an undocumented server-side window when
  no `since_date` is sent (about 30 days for plain lists, about one year with a
  `type` filter), and nothing in the response says so. `ynab_list_transactions`,
  `ynab_list_account_transactions`, `ynab_list_category_transactions`,
  `ynab_list_payee_transactions` and `ynab_transaction_search` now always send
  an explicit date: the last 30 days by default, and report it in the response
  (`date_filter` / `filters_applied.since_date`, with a note when the default
  was applied).
- `ynab_income_expense`, `ynab_spending_analysis`, `ynab_spending_by_payee` and
  `ynab_savings_opportunities` counted every non-transfer outflow as spending
  (and `ynab_income_expense` every inflow as income): refunds never reduced
  spending, split transactions were filed under their parent instead of their
  own categories, and starting balances and uncategorized money were counted.
  They now use the same rules as `ynab_query` and report uncategorized money
  separately. `ynab_spending_by_payee` counts a split purchase once.
- `ynab_transaction_search` reported `date_range.from: "beginning"` while
  searching only the server's default window; it now reports the date used.
- Transaction list tools dropped the bank's original description
  (`import_payee_name_original`), the most useful clue for identifying an
  unfamiliar payee. The list tools and `ynab_transaction_search` now return it,
  and search's `query`/`payee` filters match against it. `ynab_get_transaction`
  returns `null` instead of `"Unknown"` for these fields on transactions that
  weren't imported.

### Security

- **HTTP header mode no longer serves the server-held token to the whole
  network by default.** A request without `X-YNAB-Token` falls back to
  `YNAB_ACCESS_TOKEN`; the server now refuses to start when that token is set,
  `HOST` is not loopback and no `MCP_API_KEYS` are configured (override:
  `ALLOW_UNAUTHENTICATED_FALLBACK=true`, for an authenticating proxy).
- Sessions using the same YNAB token now share one rate limiter. YNAB limits
  per token, so per-session limiters could together exceed it.

### Added

- `MCP_API_KEYS`: named shared-secret client keys for LAN or self-hosted use.
  Clients authenticate with `Authorization: Bearer <key>` and the YNAB token
  stays on the server.
- `HOST`: interface to bind in http mode.
- `mcpb/` and `npm run build:mcpb`: a Claude Desktop extension (MCP Bundle) that
  bridges stdio to a remote HTTP server using an `MCP_API_KEYS` key, so client
  machines need no Node.js install.
- `ynab_update_category_details`: rename a category, move it to another group,
  edit its note, or set or remove its target (amount, date, and "set aside" vs
  "refill up to"). `ynab_create_category` accepts the same target fields.
- `ynab_query`: group and total spending, income, transfers or uncategorized
  money by month, year, category, category group, payee, account or memo tag,
  with filters (categories, groups, payees including bank descriptions,
  accounts, tags, text, amount range). Split transactions count per line,
  transfers and starting balances are excluded, and spending is net of refunds;
  the response reports what was left out.
- `ynab_cash_flow_check`: monthly income vs spending tied to the actual change
  in on-budget balances (opening, closing, and a breakdown that always adds up),
  plus the largest inflows and income by payee.
- `ynab-spending-report` prompt: a household report built on the two tools above.
- Server instructions: clients such as Claude Desktop now receive a short guide
  at connect (about 500 tokens, once per conversation) that maps everyday
  questions to tools and asks the model to confirm before any write and to send
  API-unsupported changes (hiding or deleting categories, closing accounts) to
  the YNAB app. People no longer need to know tool names.
- `ynab_list_categories` returns each category's note when it has one, so
  notes can describe what belongs in a category.
- Releases attach `ynab-mcp-remote.mcpb` alongside the skill zips.
- `since_date: "all"` (or `"all time"`) on the transaction tools above returns
  full history.

## [0.3.3]

### Added

- **MCP Prompts.** The server now exposes 7 guided-workflow prompts
  (`ynab-pulse-check`, `ynab-monthly-review`, `ynab-assign-money`,
  `ynab-true-expenses`, `ynab-overspending-triage`, `ynab-age-of-money`,
  `ynab-reconcile-cleanup`), grounded in YNAB's own budgeting methodology (the
  Four Rules, Age of Money, True Expenses). Available to any MCP client that
  supports the `prompts` capability, automatically, with no extra install step.
- **`skills/` — a standalone, distributable YNAB best-practices skill
  library.** 15 Claude Agent Skills covering both live-budget workflows
  (mirroring the 7 prompts above) and general budgeting/YNAB philosophy
  coaching (getting started, debt payoff, irregular income, windfalls,
  emergency funds, big goals, income-change prep) that work standalone, with
  or without this MCP server connected. Packaged as downloadable zips on each
  GitHub Release.

### Security

- Added `gitleaks` as a required CI check on every PR, scanning for
  accidentally-committed secrets.

## [0.3.2]

> Note: `0.3.1` was published to npm from a commit that bypassed code review and
> was subsequently reverted from `main`; `0.3.2` reintroduces the same fix through
> the normal review process. There is no `0.3.1` git tag/GitHub release.

### Fixed

- HTTP mode: `express-rate-limit` logged an `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`
  validation error on every request when deployed behind a reverse proxy, because
  Express's `trust proxy` setting was left at its default (`false`) while the proxy
  set `X-Forwarded-For`. Added a `TRUST_PROXY` env var (default `0`, i.e. trust
  none) to set Express's `trust proxy` explicitly, so rate limiting keys correctly
  off the real client IP when deployed behind a known number of proxy hops.

## [0.3.0]

### Added

- **Remote HTTP transport.** `MCP_TRANSPORT=http` runs the server over the MCP
  Streamable HTTP transport (`POST /mcp`) with a plain `GET /health`. Each session
  gets an isolated client / cache / rate limiter / audit log. stdio remains the
  default and is unchanged.
- **Multi-user YNAB OAuth.** When the YNAB OAuth app credentials + `ENCRYPTION_KEY`
  + `PUBLIC_URL` are configured, the server acts as an OAuth 2.1 Authorization
  Server (Dynamic Client Registration + PKCE) federated to YNAB. Each user connects
  their own YNAB account; identity is their YNAB user id. Users choose read-only vs
  read-write at a consent screen. YNAB refresh tokens are encrypted at rest
  (AES-256-GCM) and rotated on refresh.
- **Pluggable storage** for users + tokens: `memory` (default), `sqlite`
  (`better-sqlite3`), or `postgres` (`pg`); the durable drivers are optional
  dependencies loaded on demand.
- Interim header auth for HTTP mode (`X-YNAB-Token`) to run single-user remote
  before configuring OAuth.
- `docs/REMOTE_HOSTING.md` with deployer setup (registering a YNAB OAuth app, env,
  TLS), and DNS-rebinding/Origin protections for the HTTP transport.

### Changed

- Internal: `createServer` generalized into `buildYnabClient` / `createServerForUser`
  (per-user context); the audit log is now an injected instance (per user) rather
  than a process-global singleton.

## [0.2.0]

### Added

- New write tools unlocked by the YNAB SDK v4 surface:
  - `ynab_update_payee` — rename a payee (closes a real API coverage gap)
  - `ynab_create_payee` — create a payee
  - `ynab_create_category` — create a category within a group
  - `ynab_create_category_group` — create a category group
  - `ynab_update_category_group` — rename a category group
  - `ynab_update_transactions` — bulk update transactions (up to 100)
- New read tool `ynab_list_money_movements` for category-to-category fund moves
  (a YNAB API v1.83 / SDK v4 resource).

### Changed

- Upgraded the `ynab` SDK from `^2.10.0` to `^4.4.0`. This is an internal-only
  migration (`api.budgets` → `api.plans`, `Budget*` response types → `Plan*`); the
  MCP tool names, parameters, and output shapes are unchanged, so existing clients
  are unaffected.
- Upgraded `@modelcontextprotocol/sdk` from `^1.25.3` to `^1.29.0`, resolving a
  HIGH-severity cross-client data-leak advisory.
- `ynab_create_account` now offers only the account types the YNAB API actually
  supports creating (`checking`, `savings`, `cash`, `creditCard`, `otherAsset`,
  `otherLiability`); previously-offered loan/mortgage types always failed at the API.

### Fixed

- The server now reports its real version to MCP clients (was hardcoded to `0.1.0`;
  now read from `package.json`).
- Re-enabled the test coverage gate: the Vitest threshold config used the pre-1.0
  `thresholds.global.*` shape, which Vitest 1.x silently ignored. Thresholds are now
  enforced as a floor.
- Corrected `README.md` tool counts and listings (now 66 tools: 40 core API,
  23 analytics, 3 system), including previously omitted scheduled-transaction and
  analytics tools.
- Replaced the stale, partly-fictional `tools` list in `server.json` with the actual
  registered tool names and added a `version` field.
