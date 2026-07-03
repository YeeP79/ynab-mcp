---
name: ynab-emergency-fund-builder
description: Guides building an emergency fund from zero, or strengthening a thin one, with staged achievable milestones. Use when a user says "I have no emergency fund", "how much should I have saved for emergencies", "help me build a safety net", "I keep raiding savings for car repairs", or "where do I start with an emergency fund".
license: MIT
compatibility: Works standalone; optionally enriched with live goal/category data when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Emergency Fund Builder

## What this does

Guides building an emergency fund from zero (or strengthening a thin one)
using staged, achievable milestones rather than one intimidating target, and
recommends naming specific potential emergencies as separate categories
instead of one vague catch-all.

## When to use this skill

- "I have no emergency fund"
- "How much should I have saved for emergencies?"
- "Help me build a safety net"
- "I keep raiding savings for car repairs"
- "Where do I start with an emergency fund?"

**Should NOT trigger on:** planned, recurring irregular costs already
showing up in transaction history (use `ynab-true-expenses`), or allocating
one lump sum across several priorities (use `ynab-windfall-planner`).

## Workflow

### Step 1: Set the staged milestones

Present the staged approach rather than one big number:
1. **Starter fund**: ~$500 — enough to absorb a small surprise without going
   into debt.
2. **Intermediate**: $1,000-2,000 — covers most common one-off emergencies.
3. **Full buffer**: 3-6 months of expenses (6-12 months if income is
   irregular — see `ynab-irregular-income-planner`).

### Step 2: Name specific categories, not one catch-all

Recommend breaking "Emergency Fund" into a few named sub-categories tied to
real, plausible emergencies (e.g. Car Repair, Tech Replacement, Medical) —
this makes the fund feel concrete and makes it easier to say yes to a
withdrawal when the specific thing it was for actually happens, rather than
feeling like raiding a vague pile of savings.

### Step 3 (if MCP-connected): Set it up

Call MCP tool: `ynab_create_category` — for each named emergency sub-category
Call MCP tool: `ynab_goal_progress` — to track progress toward each stage
Call MCP tool: `ynab_category_balances` — to check current funding level

### Step 4: Suggest the funding mechanism

Recommend small automated weekly/monthly transfers as the base, with
windfalls (see `ynab-windfall-planner`) as accelerants to jump between
stages faster.

## Output format

```text
Current stage: [none / starter / intermediate / full buffer]
Next milestone: $X (currently at $Y)
Suggested categories: [Car Repair, Tech Replacement, Medical, ...]
Suggested monthly contribution: $Z to reach the next milestone in N months
```

## Troubleshooting

**MCP connection failed** — proceed in coaching mode using amounts the user
provides; note live category data isn't available this session.

**Unauthorized / token expired** — the YNAB connection needs re-authorization
before categories can be created directly.

## When the skill is NOT the right tool

- Known/recurring irregular costs (not true emergencies) — use
  `ynab-true-expenses`.
- Splitting a specific lump sum across several priorities — use
  `ynab-windfall-planner`.
