---
name: ynab-income-change-prep
description: Helps prepare financially for a known or likely upcoming income change — parental leave, job-loss risk, retirement transition, return to school — before it happens. Use when a user says "I'm going on parental leave, how do I prepare", "I might get laid off", "I'm planning to retire in a year", "how do I prepare for a pay cut", or "help me plan for reduced income".
license: MIT
compatibility: Works standalone; optionally enriched with live income/spending data when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB Income Change Prep

## What this does

Helps prepare financially for a *known or reasonably anticipated* upcoming
income change — parental leave, layoff risk, retirement, a return to school —
by building a dedicated Income Replacement category ahead of time and
practicing on the reduced budget before the change actually happens.

## When to use this skill

- "I'm going on parental leave, how do I prepare?"
- "I might get laid off"
- "I'm planning to retire in a year"
- "How do I prepare for a pay cut?"
- "Help me plan for reduced income"

**Should NOT trigger on:** ongoing month-to-month income variability with no
single anticipated change (use `ynab-irregular-income-planner`), or a
cushion against unnamed/general risk (use `ynab-emergency-fund-builder`).

## Workflow

### Step 1: Quantify the gap

Establish the expected reduced income (or $0, for leave/layoff) and how long
the reduced period is expected to last. For job-loss risk specifically,
treat the duration as unknown and plan conservatively.

### Step 2 (if MCP-connected): Establish the real baseline

Call MCP tool: `ynab_income_expense` — current income/spending baseline
Call MCP tool: `ynab_budget_vs_actuals` — category-level detail to distinguish trim-able vs. protect

### Step 3: Build a dedicated Income Replacement category

Fund it ahead of time, sized to bridge the anticipated gap. This is distinct
from the general emergency fund — it's specifically earmarked for this known
change.

### Step 4: Categorize trim vs. protect

Go category by category: which spending gets cut during the reduced-income
period, and which stays protected (housing, insurance, minimum debt
payments). For job-loss risk specifically, flag two commonly-missed costs:
**COBRA/health coverage** and **job-search expenses** — both tend to appear
right when income drops, which is exactly the wrong time to discover them.

### Step 5: Practice-run the reduced budget

Recommend running the trimmed budget for a few months *before* the actual
change, if there's lead time — this surfaces problems with the plan while
there's still full income to patch them.

## Output format

```text
Anticipated change: [type] starting [date/timeframe], duration: [known/unknown]
Income gap to bridge: $X/month for N months
Income Replacement category target: $Y
Categories to trim: [list]
Categories to protect: [list]
Job-loss-specific flags (if applicable): COBRA/health coverage, job-search costs
Practice-run recommendation: [start date, if there's lead time]
```

## Troubleshooting

**MCP connection failed** — proceed with user-provided figures; note live
budget data isn't available this session.

**Unauthorized / token expired** — the YNAB connection needs re-authorization.

## When the skill is NOT the right tool

- Ongoing structural income variability (freelance/gig, not a single known
  change) — use `ynab-irregular-income-planner`.
- General unnamed-risk cushion — use `ynab-emergency-fund-builder`.
