---
name: ynab-age-of-money
description: Checks how healthy the cash cushion is — Age of Money, near-term cash flow forecast, and whether the credit card float is quietly draining the buffer. Use when the user says "check my age of money", "am I living paycheck to paycheck", "how's my cash flow", "will I have enough before payday", or "is my credit card float catching up to me".
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Age of Money

## What this does

Implements YNAB's fourth rule — Age Your Money — by checking the current Age
of Money metric, the near-term 30-day cash forecast, and a specific check for
credit card float (paying the current statement with today's income while the
Credit Card Payment category isn't actually funded by this month's spending —
"using today's paycheck to pay for last month").

## When to use this skill

- "Check my age of money"
- "Am I living paycheck to paycheck?"
- "How's my cash flow?"
- "Will I have enough before payday?"
- "Is my credit card float catching up to me?"

**Should NOT trigger on:** the overall month scorecard (use
`ynab-monthly-review`, which references Age of Money in one line but doesn't
forecast), or fixing overspending that's causing a low Age of Money (use
`ynab-overspending-triage`).

## Workflow

### Step 1: Get Age of Money
Call MCP tool: `ynab_age_of_money`
Parameters: none

### Step 2: Check credit card float
Call MCP tool: `ynab_credit_card_status`
Parameters: none

### Step 3: Forecast near-term cash flow
Call MCP tool: `ynab_cash_flow_forecast`
Parameters: days: 30

### Step 4: Check savings-rate trend for context
Call MCP tool: `ynab_income_expense`
Parameters: months: 6

## Output format

```
Age of Money: N days [status tier + one relevant tip]
Credit card float check: card balance $X vs. payment category $Y →
  shortfall $Z (or "none — you're covered")
30-day cash forecast: lowest projected balance $X on [date]
Savings rate trend: N%
```

## Troubleshooting

**MCP connection failed** — confirm the ynab-mcp server is connected.

**Unauthorized / token expired** — the YNAB connection needs re-authorization.

**Age of Money shows as very low or zero on a new budget** — this is expected
for a budget with little history; note it rather than treating it as a
problem needing an immediate fix.

## When the skill is NOT the right tool

- The full end-of-month scorecard — use `ynab-monthly-review`.
- If the numbers point to a structural overspending problem rather than a
  timing issue — use `ynab-overspending-triage`.
