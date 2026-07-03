---
name: ynab-assign-money
description: Helps give every dollar a job — assigns unallocated Ready to Assign money to categories, funds underfunded goals, and sets up new categories or category groups. Use when the user says "I have money to assign", "help me budget this month", "what should I fund", "help me set up a new category", "organize my budget categories", or "assign my leftover funds".
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Assign Money

## What this does

Implements YNAB's first rule — Give Every Dollar a Job — by helping decide
where unassigned Ready to Assign money should go this month: underfunded
goals first, then unfunded or negative categories, then general allocation
guided by spending history.

## When to use this skill

- "I have money to assign"
- "Help me budget this month"
- "What should I fund?"
- "Help me set up a new category"
- "Organize my budget categories"
- "Assign my leftover funds"

**Should NOT trigger on:** fixing an already-overspent category (use
`ynab-overspending-triage`), or structuring a brand-new budget from scratch
(that's a bigger first-time-setup conversation — see the `ynab-first-budget-setup`
skill if the MCP isn't yet connected or the budget has no history).

## Workflow

### Step 1: Check Ready to Assign

Call MCP tool: `ynab_quick_summary`
Parameters: none

### Step 2: Find unfunded categories

Call MCP tool: `ynab_category_balances`
Parameters: filter: "unfunded"

### Step 3: Find underfunded goals

Call MCP tool: `ynab_goal_progress`
Parameters: filter: "underfunded"

### Step 4: Get funding suggestions from history

Call MCP tool: `ynab_budget_suggestions`
Parameters: none

### Step 5 (if needed): Create or update categories

Call MCP tool: `ynab_create_category_group` / `ynab_create_category` / `ynab_update_category`
Parameters: as needed — propose first, confirm, then apply

## Output format

```text
Ready to Assign: $X to give a job
Priority funding order:
1. [underfunded goal categories, amount needed]
2. [unfunded/negative categories]
3. [suggested amounts from history]
Proposed allocation: [category: $amount, ...] — confirm to apply?
```

## Troubleshooting

**MCP connection failed** — confirm the ynab-mcp server is connected.

**Unauthorized / token expired** — walk the user through reconnecting YNAB
rather than retrying.

**Ready to Assign is negative** — do not proceed with allocation; report the
shortfall and suggest `ynab-overspending-triage` instead.

## When the skill is NOT the right tool

- Ready to Assign is negative, or a category is already overspent — use
  `ynab-overspending-triage` first.
- Planning for a known irregular/annual cost — use `ynab-true-expenses`,
  which computes the correct monthly contribution math.
