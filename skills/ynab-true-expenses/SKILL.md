---
name: ynab-true-expenses
description: Finds and plans for irregular or infrequent costs — annual subscriptions, car repairs, holiday spending, insurance premiums — and detects recurring bills that may be missing from the budget or scheduled transactions. Use when the user says "help me plan for an annual expense", "I have a big bill coming up", "make sure my recurring bills are captured", "set up a sinking fund", "did I forget any subscriptions", or "embrace my true expenses".
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB True Expenses

## What this does

Implements YNAB's second rule — Embrace Your True Expenses — by finding
irregular-but-predictable costs already showing up in transaction history and
computing the right monthly contribution so they never blindside the budget
again (annual total ÷ 12, or ÷ months-until-due for a known bill).

## When to use this skill

- "Help me plan for an annual expense"
- "I have a big bill coming up"
- "Make sure my recurring bills are captured"
- "Set up a sinking fund"
- "Did I forget any subscriptions?"
- "Embrace my true expenses"

**Should NOT trigger on:** general new-category creation unrelated to
irregular costs (use `ynab-assign-money`), or fixing an already-overspent
category (use `ynab-overspending-triage`).

## Workflow

### Step 1: Detect recurring charges

Call MCP tool: `ynab_detect_recurring`
Parameters: months: 6

### Step 2: Cross-check against existing categories

Call MCP tool: `ynab_list_categories` and `ynab_unused_categories`
Parameters: months: 6

### Step 3: Analyze irregular-category history

Call MCP tool: `ynab_spending_analysis` or `ynab_spending_trends`
Parameters: category_id of the irregular category, if known

### Step 4: Propose funding and scheduling

Call MCP tool: `ynab_create_category` / `ynab_update_category` (if a category doesn't exist)
Call MCP tool: `ynab_preview_scheduled_transaction` then `ynab_create_scheduled_transaction` (for unscheduled recurring charges)

### Step 5: Sanity-check the new commitment

Call MCP tool: `ynab_cash_flow_forecast`
Parameters: days: 30

## Output format

```text
Detected recurring charges not yet scheduled: [payee, amount, cadence]
True-expense categories to fund:
- [Category]: est. $X/yr → $Y/mo (due in N months)
Proposed: create scheduled transaction for [payee]? create/fund category for [X]?
Cash flow impact if applied: [30-day forecast delta]
```

## Troubleshooting

**MCP connection failed** — confirm the ynab-mcp server is connected before
retrying.

**Unauthorized / token expired** — the YNAB connection needs re-authorization.

**No recurring charges detected** — this can mean genuinely no recurring
spend, or too little history (fewer than `min_occurrences` in the lookback
window); try a longer `months` value before concluding there's nothing to
find.

## When the skill is NOT the right tool

- General new-category setup with no irregular-cost angle — use
  `ynab-assign-money`.
- Fixing an already-overspent category — use `ynab-overspending-triage`.
