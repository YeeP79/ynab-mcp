---
name: ynab-pulse-check
description: Gives a fast, at-a-glance snapshot of a YNAB budget — Ready to Assign, overspending flags, spending pace, and an overall health score. Use when the user asks "how am I doing this month", "how's my budget looking", "quick check on my finances", "am I on track", "give me a status update", or wants a fast gut-check without a full review.
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Pulse Check

## What this does

Runs a fast, low-ceremony status check on a YNAB budget: Ready to Assign, an
overall health score, any overspent categories, and how spending pace compares
to target for the month. It's the "how am I doing right now" answer, not a
full review.

## When to use this skill

- "How am I doing this month?"
- "How's my budget looking?"
- "Quick check on my finances"
- "Am I on track?"
- "Give me a status update"
- Any fast gut-check that doesn't need a full breakdown

**Should NOT trigger on:** "let's do my monthly review" (use `ynab-monthly-review`),
"where am I overspending" (use `ynab-overspending-triage`), or "how's my cash
flow" (use `ynab-age-of-money`).

## Workflow

### Step 1: Get the overview

Call MCP tool: `ynab_quick_summary`
Parameters: none

### Step 2: Get the health score

Call MCP tool: `ynab_budget_health`
Parameters: none

### Step 3: Check for overspending

Call MCP tool: `ynab_overspending_alerts`
Parameters: none

### Step 4: Check spending pace

Call MCP tool: `ynab_spending_pace`
Parameters: none

## Output format

```text
YNAB Pulse Check — [date]
Ready to Assign: $X | Health Score: NN/100
Overspent categories: [list, or "none"]
Pace: spending $X/day vs $Y/day target → projected month-end: $Z
Top action item: [one sentence, or "nothing urgent"]
```

## Troubleshooting

**MCP connection failed** — if tool calls fail with a connection error, check
that the ynab-mcp server is connected (Settings > Connectors, or Claude
Desktop's MCP server list should show it as "Connected").

**Unauthorized / token expired** — if calls return a 401 or an authorization
error, the YNAB connection needs to be re-authorized. Walk the user through
reconnecting rather than retrying the same call repeatedly.

**Rate limit exceeded** — YNAB API calls are capped; if a rate-limit error
appears, wait before retrying rather than looping the same call.

## When the skill is NOT the right tool

- A full end-of-month review with goals, net worth, and next month's
  targets — use `ynab-monthly-review`.
- Actually fixing overspending (moving money between categories) — use
  `ynab-overspending-triage`.
- Checking the cash cushion or credit card float specifically — use
  `ynab-age-of-money`.
