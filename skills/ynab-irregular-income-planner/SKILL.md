---
name: ynab-irregular-income-planner
description: Teaches the budgeting approach for freelancers, commission earners, and gig workers with variable month-to-month income. Use when a user says "my income is different every month", "I'm a freelancer, how do I budget", "I don't know how much I'll make next month", "how do I stop overspending in good months", or "how does budgeting work without a steady paycheck".
license: MIT
compatibility: Works standalone; optionally enriched with live income data when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Irregular Income Planner

## What this does

Teaches YNAB's specific approach to variable income: budget only money
already received, never projected income. Walks through calculating an
average monthly expense baseline, capping spending to that baseline even in
high-earning months, and rolling the surplus forward — sometimes called
"paying yourself a salary."

## When to use this skill

- "My income is different every month"
- "I'm a freelancer, how do I budget?"
- "I don't know how much I'll make next month"
- "How do I stop overspending in good months?"
- "How does budgeting work without a steady paycheck?"

**Should NOT trigger on:** measuring an existing cash cushion (use
`ynab-age-of-money`) — this skill is about designing the income structure,
not diagnosing current health.

## Workflow

### Step 1: Establish the core rule
Budget only money that has already arrived — never forecast or budget
against an expected future payment. This is the opposite instinct from most
income-planning advice, so it's worth stating explicitly and explaining why:
forecasted income that doesn't arrive on schedule is what causes variable
earners to overspend into a shortfall.

### Step 2 (if MCP-connected): Establish a baseline
Call MCP tool: `ynab_income_expense` — pull several months of actual income/expense history
Call MCP tool: `ynab_quick_summary` — current Ready to Assign state

If not connected, ask the person for their lowest 2-3 months of income over
the last year as a rough floor.

### Step 3: Set the spending baseline
Calculate an average monthly expense baseline from real spending, then cap
monthly spending to that baseline regardless of how much came in that
specific month. In high-earning months, the surplus is assigned forward to
future months' categories, not spent — this is the "pay yourself a salary"
pattern.

### Step 4: Set a larger buffer target
Because income is less predictable, recommend a larger emergency/buffer
target than a steady-paycheck household — **6-12 months** of expenses versus
the standard 3-6 months. Point to `ynab-emergency-fund-builder` for the
staged plan to get there.

## Output format

```
Baseline monthly expense: $X (from Y months of history, or user-estimated)
This month's income: $Z received
  → if Z > X: assign $(Z-X) forward to future months
  → if Z < X: cover the gap from already-assigned future-month funds
Recommended buffer target: 6-12 months of $X (larger than standard due to
  income variability)
```

## Troubleshooting

**MCP connection failed** — proceed with user-estimated figures; note that
live income history isn't available this session.

**Unauthorized / token expired** — the YNAB connection needs re-authorization
to pull income history.

## When the skill is NOT the right tool

- Diagnosing the health of an existing cash cushion — use
  `ynab-age-of-money`.
- A single known upcoming income change (not ongoing variability) — use
  `ynab-income-change-prep`.
