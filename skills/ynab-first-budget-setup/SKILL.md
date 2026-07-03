---
name: ynab-first-budget-setup
description: Guides a brand-new YNAB user through structuring their first budget — category-group pattern, right level of detail, and avoiding beginner traps. Use when a user says "I just signed up for YNAB, where do I start", "how should I set up categories", "how many categories should I have", "should I track every subscription separately", or "I'm overwhelmed setting up my budget".
license: MIT
compatibility: Works standalone; optionally enriched (structure built directly) when the ynab-mcp MCP server is connected.
metadata:
  author: auzroz
  version: 1.0.0
  mcp-server: ynab-mcp
---

# YNAB First Budget Setup

## What this does

Walks a brand-new user through structuring their very first budget: picking a
category-group pattern that fits how they think, choosing the right level of
detail to start with, and avoiding the most common beginner traps (too many
categories, trying to run all Four Rules on day one).

## When to use this skill

- "I just signed up for YNAB, where do I start?"
- "How should I set up categories?"
- "How many categories should I have?"
- "Should I track every subscription separately?"
- "I'm overwhelmed setting up my budget"

**Should NOT trigger on:** allocating money into an existing, mature category
structure (use `ynab-assign-money`), or explaining the underlying philosophy
first (use `ynab-budgeting-foundations` if the person doesn't yet buy into
budgeting at all).

## Workflow

### Step 1: Pick a category-group pattern
Walk through YNAB's three beginner patterns and let the person choose
whichever fits how they naturally think about money — there's no single
correct answer:
- **Mandatory & Optional** — split every category into "must-pay" vs.
  "nice-to-have" groups.
- **Themed Budget** — group by life area (Home, Auto, Kids, Fun).
- **Pin It to the Paycheck** — group by which paycheck/pay period covers it.

### Step 2: Set the right level of detail
Recommend starting around **15-25 categories**, not more. Explain that new
categories should "earn their way in" as real spending reveals a genuine gap
— not be pre-built for every hypothetical expense. Over-detailed budgets are
a top reason new users quit within the first month.

### Step 3: Sequence the rules
Explicitly recommend NOT trying to apply all Four Rules simultaneously in
month one. Start with **Give Every Dollar a Job** only; layer in True
Expenses, Roll With the Punches, and Age of Money as the budget matures over
the following months.

### Step 4 (if MCP-connected): Build the chosen structure
If the ynab-mcp server is connected, offer to build it directly:
Call MCP tool: `ynab_list_categories` — to see what already exists
Call MCP tool: `ynab_create_category_group` and `ynab_create_category` — to build the chosen structure, one group at a time, with confirmation before each write

If no MCP connection is available, describe the structure in enough detail
that the person can build it themselves in the YNAB app.

## Output format

```
Recommended pattern: [Mandatory & Optional / Themed / Pin It to the Paycheck]
Starting categories (15-25):
  [Group]: [category, category, ...]
  ...
This month's focus: Give Every Dollar a Job only — the other three rules
come later, once this feels normal.
```

## Troubleshooting

**MCP connection failed while trying to build categories** — fall back to
describing the structure conversationally; the person can create it manually
in the app.

**Unauthorized / token expired** — the YNAB connection needs re-authorization
before categories can be created directly.

## When the skill is NOT the right tool

- Allocating money into an already-built structure — use `ynab-assign-money`.
- Explaining the underlying "why" of budgeting before setup — use
  `ynab-budgeting-foundations`.
