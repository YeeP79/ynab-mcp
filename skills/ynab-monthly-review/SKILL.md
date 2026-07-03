---
name: ynab-monthly-review
description: Runs a complete end-of-month budget review — this month's performance vs. plan, goal progress, income/savings trend, net worth change, and suggested targets for next month. Use when the user says "let's do my monthly budget review", "end of month check-in", "how did this month go", "review my budget", "close out this month", or "help me plan next month's budget".
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Monthly Review

## What this does

Orchestrates a full end-of-month budget review in one sitting: category-level
plan vs. actual, what changed since last month, goal progress, the income and
savings trend, net worth movement, and a proposed budget for next month. This
matches YNAB's own recommended end-of-month routine — reflect on what
deviated, reconcile, and set next month's targets — rather than a quick daily
glance.

## When to use this skill

- "Let's do my monthly budget review"
- "End of month check-in"
- "How did [month] go?"
- "Review my budget"
- "Close out this month"
- "Help me plan next month's budget"

**Should NOT trigger on:** a quick "how am I doing" gut-check (use
`ynab-pulse-check`), or a request to deep-dive reconciliation or cash flow
specifically (use `ynab-reconcile-cleanup` / `ynab-age-of-money` — this skill
flags those but doesn't do the full workup).

## Workflow

### Step 1: Category-level plan vs. actual

Call MCP tool: `ynab_budget_vs_actuals`
Parameters: month (optional, defaults to current), include_previous: true

### Step 2: Month-over-month comparison

Call MCP tool: `ynab_monthly_comparison`
Parameters: none

### Step 3: Income and savings trend

Call MCP tool: `ynab_income_expense`
Parameters: months: 6

### Step 4: Goal progress

Call MCP tool: `ynab_goal_progress`
Parameters: filter: "all"

### Step 5: Net worth

Call MCP tool: `ynab_net_worth`
Parameters: none

### Step 6: Age of Money (one-line check, not a deep dive)

Call MCP tool: `ynab_age_of_money`
Parameters: none

### Step 7: Reconciliation status (flag only, not a deep dive)

Call MCP tool: `ynab_reconciliation_helper`
Parameters: none

### Step 8: Next month's suggested budget

Call MCP tool: `ynab_budget_suggestions`
Parameters: months: 3

## Output format

```text
Monthly Review — [Month Year]
1. Scorecard: budgeted vs. actual by category group, variance %, status
2. What changed vs. last month (top 3 movers)
3. Goals: on-track / behind / underfunded (counts + names)
4. Income & savings rate trend (6mo)
5. Net worth: this month vs. last
6. Housekeeping flags: Age of Money = N days; N uncleared transactions
   (if > 0, suggest running ynab-reconcile-cleanup)
7. Next month's suggested budget (per category) — offer for confirmation
   before creating or changing anything
```

## Troubleshooting

**MCP connection failed** — confirm the ynab-mcp server shows as connected
before retrying.

**Unauthorized / token expired** — the YNAB connection needs re-authorization;
walk the user through reconnecting.

**A tool in the sequence fails partway through** — report the partial results
gathered so far rather than discarding everything; note which section is
missing and why.

## When the skill is NOT the right tool

- A fast status check with no historical comparison — use `ynab-pulse-check`.
- Actually fixing overspending — use `ynab-overspending-triage`.
- A deep reconciliation walk-through or category cleanup — use
  `ynab-reconcile-cleanup`.
- A deep cash-flow forecast — use `ynab-age-of-money`.
