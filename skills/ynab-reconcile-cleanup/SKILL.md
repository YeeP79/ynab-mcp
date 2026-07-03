---
name: ynab-reconcile-cleanup
description: Runs the weekly housekeeping pass — clears/flags uncleared transactions per account for reconciliation, and audits the budget for unused or overly-granular ("sprawl") categories worth merging or archiving. Use when the user says "let's reconcile my accounts", "clean up my budget", "find categories I don't use", "check for uncleared transactions", or "audit my budget for clutter".
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Reconcile & Cleanup

## What this does

Runs the weekly hygiene pass YNAB recommends: check every account for
uncleared transactions (reconciling regularly keeps this list short), and
scan for unused or overly-granular categories that make budgeting harder
instead of easier — YNAB's own guidance explicitly warns against category
sprawl.

## When to use this skill

- "Let's reconcile my accounts"
- "Clean up my budget"
- "Find categories I don't use"
- "Check for uncleared transactions"
- "Audit my budget for clutter"

**Should NOT trigger on:** spending analysis or overspending remediation —
this is purely data-integrity and structure hygiene, feeding accuracy into
every other skill.

## Workflow

### Step 1: Check reconciliation status per account

Call MCP tool: `ynab_reconciliation_helper`
Parameters: account_id (optional — omit to check all accounts)

### Step 2: Find unused categories

Call MCP tool: `ynab_unused_categories`
Parameters: months: 6

### Step 3: Scan for sprawl

Call MCP tool: `ynab_category_balances`
Parameters: filter: "all"

### Step 4 (if confirmed): Merge or archive

Call MCP tool: `ynab_update_category_group`
Parameters: as needed — propose merges first, apply only after confirmation

## Output format

```text
Uncleared transactions by account: [account: count, oldest pending date]
Unused categories (no activity in 6mo): [list, current balance if any]
Sprawl candidates (similar/overlapping categories): [suggested merges]
```

## Troubleshooting

**MCP connection failed** — confirm the ynab-mcp server is connected.

**Unauthorized / token expired** — the YNAB connection needs re-authorization.

**Large number of very old uncleared transactions** — flag the oldest ones
specifically rather than presenting an undifferentiated list; those are the
ones most likely to represent a forgotten or duplicate entry.

## When the skill is NOT the right tool

- Spending analysis or trend questions — use `ynab-pulse-check` or
  `ynab-monthly-review`.
- Overspending remediation — use `ynab-overspending-triage`.
