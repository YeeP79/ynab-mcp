---
name: ynab-debt-payoff-planner
description: Helps build a sustainable debt-payoff plan that fits inside a real budget instead of fighting it. Use when a user says "help me pay off my credit cards", "snowball or avalanche, which should I do", "how do I set up a debt goal", "I keep going into debt for emergencies while paying off debt", or "what order should I attack my debts".
license: MIT
compatibility: Works standalone; optionally enriched with live goal/category data when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Debt Payoff Planner

## What this does

Builds a sustainable debt-payoff plan grounded in YNAB's own recommended
sequencing — cover monthly expenses, save for non-monthly true expenses,
*then* attack one debt at a time — because paying debt aggressively while
skipping the true-expenses buffer is the most common cause of relapsing back
into new debt. Also walks through Debt Snowball vs. Debt Avalanche.

## When to use this skill

- "Help me pay off my credit cards"
- "Snowball or avalanche, which should I do?"
- "How do I set up a debt goal?"
- "I keep going into debt for emergencies while paying off debt"
- "What order should I attack my debts?"

**Should NOT trigger on:** fixing already-overspent categories this month
(use `ynab-overspending-triage`), or funding non-debt irregular costs (use
`ynab-true-expenses`).

## Workflow

### Step 1: Explain the sequencing

Before picking a strategy, confirm the foundation is in place: monthly
expenses covered, and at least a starter true-expenses buffer, *before*
throwing extra money at debt. Attacking debt without this buffer is why many
people end up back in debt the moment a car repair or medical bill hits.

### Step 2: Choose a strategy

Present both, with YNAB's own stance:
- **Debt Snowball** (smallest balance first) — YNAB's own recommended
  default, "with a gold star," because paying off a full balance quickly
  creates psychological momentum that keeps people going.
- **Debt Avalanche** (highest interest rate first) — mathematically optimal
  (saves more in total interest), valid if the person is more motivated by
  the math than by quick wins.
Let the person pick; both are legitimate.

### Step 3 (if MCP-connected): Ground it in real numbers

Call MCP tool: `ynab_list_categories` and `ynab_get_category` — to see current debt category balances
Call MCP tool: `ynab_goal_progress` — to check DEBT-type goal progress (YNAB's DEBT goal type is a per-category payoff target that pairs with either strategy)

### Step 4: Set the plan

Order the debts per the chosen strategy, propose a DEBT goal for the first
target, and note that other debts stay at minimum payments until the current
target is cleared.

## Output format

```text
Sequencing check: monthly expenses covered? true-expenses buffer started?
  [yes/no — address gaps before proceeding]
Strategy: [Snowball / Avalanche] — [why this fits]
Payoff order:
1. [Debt name]: $X balance, Y% APR — attack first
2. [Debt name]: $X balance, Y% APR — minimum payments only
   ...
Suggested DEBT goal for #1: $Z/month
```

## Troubleshooting

**MCP connection failed** — proceed in coaching mode using whatever numbers
the user provides directly; note that live category/goal data isn't
available this session.

**Unauthorized / token expired** — the YNAB connection needs re-authorization
to pull live debt balances.

## When the skill is NOT the right tool

- This-month overspending fixes — use `ynab-overspending-triage`.
- Non-debt irregular/annual costs — use `ynab-true-expenses`.
