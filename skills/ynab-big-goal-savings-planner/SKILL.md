---
name: ynab-big-goal-savings-planner
description: Helps plan and fund a large, specific, one-time savings goal with a dollar target and timeline — house down payment, car, wedding, sabbatical. Use when a user says "I'm saving for a house down payment", "how much do I need to save monthly for X", "help me set a savings target with a deadline", or "I want to buy a car in a year".
license: MIT
compatibility: Works standalone; optionally enriched with live goal-tracking data when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Big Goal Savings Planner

## What this does

Plans and funds a large, specific, one-time savings goal with a dollar
target and timeline — house down payment, car, wedding, sabbatical — using
YNAB's target-date goal mechanics, and frames the monthly contribution as
non-negotiable alongside true expenses rather than "whatever's left over."

## When to use this skill

- "I'm saving for a house down payment"
- "How much do I need to save monthly for X?"
- "Help me set a savings target with a deadline"
- "I want to buy a car in a year"

**Should NOT trigger on:** an open-ended safety-net fund with no fixed date
(use `ynab-emergency-fund-builder`), or allocating this month's Ready to
Assign across all goals at once (use `ynab-assign-money`).

## Workflow

### Step 1: Set the target amount and date

Establish the dollar target and target date. For a house down payment
specifically, flag YNAB's guidance to add **5-10% on top** of the down
payment figure to cover closing costs — a very common shortfall if skipped.

### Step 2: Calculate the required monthly contribution

Target amount ÷ months remaining = required monthly contribution. Frame this
number as non-negotiable, the same way a true-expense category is — not
something to fund only with leftover money at the end of the month.

### Step 3 (if MCP-connected): Set it up and track it

Call MCP tool: `ynab_create_category` — a dedicated category for this goal
Call MCP tool: `ynab_goal_progress` — using YNAB's "Have a balance of... by [date]" target-date goal type, distinct from an open-ended goal with no date

### Step 4: Sanity-check against the rest of the budget

If the required monthly contribution looks unrealistic against current
income/expenses, say so plainly and offer to either extend the timeline or
reduce the target — don't let an unrealistic number stand unexamined.

## Output format

```text
Goal: [description] — $X target by [date]
  (if down payment: includes +5-10% for closing costs: $Y adjusted target)
Months remaining: N
Required monthly contribution: $Z
Feasibility check: [fits current budget / would require trimming elsewhere]
```

## Troubleshooting

**MCP connection failed** — proceed with the math in coaching mode; note
live goal tracking isn't available this session.

**Unauthorized / token expired** — the YNAB connection needs re-authorization
before the goal category can be created directly.

## When the skill is NOT the right tool

- Open-ended emergency savings with no fixed date — use
  `ynab-emergency-fund-builder`.
- Allocating this month's Ready to Assign across all active goals — use
  `ynab-assign-money`.
