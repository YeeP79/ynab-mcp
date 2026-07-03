---
name: ynab-windfall-planner
description: Helps decide what to do with a one-time lump sum — bonus, tax refund, inheritance, settlement, or side-hustle payout — before spending it reactively. Use when a user says "I just got a bonus, what should I do with it", "I'm getting a tax refund", "I inherited some money", or "I have extra cash, what's the smart move".
license: MIT
compatibility: Works standalone; optionally enriched with live budget data when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Windfall Planner

## What this does

Provides a decision framework for a one-time lump sum so it gets actively
allocated instead of dissolving into a checking balance and quietly getting
spent. Walks through a prioritization order and flags "getting a month
ahead" as a particularly high-leverage use for anyone currently
paycheck-to-paycheck.

## When to use this skill

- "I just got a bonus, what should I do with it?"
- "I'm getting a tax refund"
- "I inherited some money"
- "I have extra cash, what's the smart move?"

**Should NOT trigger on:** executing the chosen allocation once decided (use
`ynab-assign-money`) — this skill is the decision framework, not the
execution step. It also doesn't replace the depth of `ynab-debt-payoff-planner`
or `ynab-emergency-fund-builder` — it decides the split across them.

## Workflow

### Step 1 (if MCP-connected): Check current state

Call MCP tool: `ynab_quick_summary`
Call MCP tool: `ynab_category_balances`
Call MCP tool: `ynab_goal_progress`

### Step 2: Walk the prioritization order

Present this order, explaining that windfalls are a decision point, not
something to let dissolve into a balance:
1. **High-interest debt** — if a credit card or similar is carrying a
   balance, this is usually the highest-return use of the money.
2. **Emergency fund** — if the buffer is thin or nonexistent, top it up next
   (see `ynab-emergency-fund-builder` for staged targets).
3. **Behind true-expense categories** — catch up anything that's fallen
   short (see `ynab-true-expenses`).
4. **Existing savings goals** — accelerate a goal already in motion (house,
   car — see `ynab-big-goal-savings-planner`).
5. **Discretionary** — it's fine, and recommended, to spend some of it on
   something enjoyable; the point is an active decision, not zero fun.

### Step 3: Flag "getting a month ahead" as an accelerant

If the person describes living paycheck-to-paycheck, note that a windfall is
a common and effective way to jump-start funding next month's expenses ahead
of time — one of YNAB's highest-leverage milestones.

### Step 4: Caution against snap decisions

Especially for emotionally-charged money (inheritance, settlement),
recommend not deciding in the first sitting — park it in a holding category
for a few days if the amount is large.

## Output format

```text
Windfall amount: $X
Current state: [debt balances / emergency fund level / behind categories /
  active goals, from live data if available]
Suggested split:
  $A → [debt payoff]
  $B → [emergency fund]
  $C → [true expenses catch-up]
  $D → [goal acceleration]
  $E → [discretionary — enjoy it]
```

## Troubleshooting

**MCP connection failed** — proceed using whatever numbers the user
describes; note live data isn't available this session.

**Unauthorized / token expired** — the YNAB connection needs re-authorization.

## When the skill is NOT the right tool

- Actually executing the chosen split — use `ynab-assign-money`.
- The person wants deep debt-strategy detail specifically — use
  `ynab-debt-payoff-planner`, then return here for the overall split.
