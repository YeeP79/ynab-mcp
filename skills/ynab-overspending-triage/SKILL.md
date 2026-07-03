---
name: ynab-overspending-triage
description: Finds where money is being overspent and helps roll with the punches — move funds from categories with slack, and surface discretionary cuts. Use when the user says "find places I'm overspending", "where did I overspend", "help me fix overspending", "roll with the punches", "where can I find extra money", or "help me cut back this month".
license: MIT
compatibility: Requires the ynab-mcp MCP server to be connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Overspending Triage

## What this does

Implements YNAB's third rule — Roll With the Punches — by finding currently
overspent categories and proposing specific moves from categories that have
slack, plus surfacing discretionary cuts if slack alone isn't enough.

## When to use this skill

- "Find places I'm overspending"
- "Where did I overspend?"
- "Help me fix overspending"
- "Roll with the punches"
- "Where can I find extra money?"
- "Help me cut back this month"

**Should NOT trigger on:** computing true-expense monthly contributions (use
`ynab-true-expenses`), or the initial "assign new money" pass (use
`ynab-assign-money`) — this skill is remediation of overspending, not
allocation of unassigned money.

## Workflow

### Step 1: Find overspent categories

Call MCP tool: `ynab_overspending_alerts`
Parameters: threshold (optional, minimum $ to report)

### Step 2: Get variance context

Call MCP tool: `ynab_budget_vs_actuals`
Parameters: none

### Step 3: Find categories with slack

Call MCP tool: `ynab_category_balances`
Parameters: filter: "positive"

### Step 4: Find cut opportunities

Call MCP tool: `ynab_savings_opportunities`
Parameters: months: 3

### Step 5: Identify the specific merchants driving overspending

Call MCP tool: `ynab_spending_by_payee`
Parameters: none

## Output format

```text
Overspent now: [category: -$amount, days until it resets]
Candidates to pull from (positive balance, low priority): [category: $available]
Suggested moves: move $X from [A] → [B]
Cut opportunities (subscriptions/high-variance/one-offs): [list w/ $ impact]
```

## Troubleshooting

**MCP connection failed** — confirm the ynab-mcp server is connected.

**Unauthorized / token expired** — the YNAB connection needs re-authorization.

**No categories with slack found** — if every category is tight, say so
plainly and pivot to the cut-opportunities list rather than forcing a
category-to-category move that doesn't exist.

## When the skill is NOT the right tool

- Planning for a known future irregular cost — use `ynab-true-expenses`.
- The initial monthly allocation of unassigned funds — use
  `ynab-assign-money`.
