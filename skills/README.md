# YNAB Best-Practices Skills

A library of 15 [Claude Agent Skills](https://www.anthropic.com/news/skills)
that teach Claude how to apply [YNAB](https://www.ynab.com)'s own budgeting
methodology — the Four Rules, Age of Money, True Expenses — plus general
budgeting best practices for situations YNAB users commonly run into (debt,
irregular income, windfalls, big goals, and more).

They're grouped into two tiers:

- **Live-budget skills** — orchestrate the [`ynab-mcp`](https://github.com/auzroz/ynab-mcp)
  MCP server's tools into guided reviews. **Require the ynab-mcp MCP server to
  be connected.**
- **Coaching skills** — teach YNAB's philosophy and general budgeting
  strategy for specific life situations. **Work standalone**, no MCP server
  required, though they'll pull in live numbers when one happens to be
  connected.

Our MCP server gives Claude access to your YNAB budget. Our skills teach
Claude YNAB's own best practices — some work standalone, some get sharper
when connected. Together, they turn raw budget data into an actual coach.

## Live-budget skills (require ynab-mcp)

| Skill | What it does |
|---|---|
| [`ynab-pulse-check`](ynab-pulse-check/SKILL.md) | Fast daily-style status check |
| [`ynab-monthly-review`](ynab-monthly-review/SKILL.md) | Full end-of-month budget review and next month's suggested targets |
| [`ynab-assign-money`](ynab-assign-money/SKILL.md) | Give Every Dollar a Job — allocate unassigned funds |
| [`ynab-true-expenses`](ynab-true-expenses/SKILL.md) | Embrace Your True Expenses — plan for irregular/annual costs |
| [`ynab-overspending-triage`](ynab-overspending-triage/SKILL.md) | Roll With the Punches — find and fix overspending |
| [`ynab-age-of-money`](ynab-age-of-money/SKILL.md) | Age Your Money — check cash cushion and credit card float |
| [`ynab-reconcile-cleanup`](ynab-reconcile-cleanup/SKILL.md) | Weekly hygiene: reconciliation and category cleanup |

## Coaching skills (standalone, MCP optional)

| Skill | What it does |
|---|---|
| [`ynab-budgeting-foundations`](ynab-budgeting-foundations/SKILL.md) | Explains zero-based/envelope budgeting and the "why" behind the Four Rules |
| [`ynab-first-budget-setup`](ynab-first-budget-setup/SKILL.md) | Structures a brand-new user's first budget |
| [`ynab-debt-payoff-planner`](ynab-debt-payoff-planner/SKILL.md) | Builds a sustainable debt payoff plan (Snowball vs. Avalanche) |
| [`ynab-irregular-income-planner`](ynab-irregular-income-planner/SKILL.md) | Budgeting for freelance/commission/gig income |
| [`ynab-windfall-planner`](ynab-windfall-planner/SKILL.md) | Decision framework for a bonus, refund, or inheritance |
| [`ynab-emergency-fund-builder`](ynab-emergency-fund-builder/SKILL.md) | Zero-to-funded emergency fund with staged milestones |
| [`ynab-big-goal-savings-planner`](ynab-big-goal-savings-planner/SKILL.md) | Target-date savings goals (house down payment, car, wedding) |
| [`ynab-income-change-prep`](ynab-income-change-prep/SKILL.md) | Preparing for a known upcoming income change |

## Installing a skill

Each skill is a self-contained folder with a `SKILL.md` file. Every
[GitHub Release](https://github.com/auzroz/ynab-mcp/releases) of this project
attaches:

- `ynab-mcp-skills-vX.Y.Z.zip` — all 15 skills bundled together
- One zip per individual skill, for installing just what you need

**Option 1 — Claude.ai (web or mobile):**
1. Download and unzip the skill folder you want.
2. Go to **Settings → Capabilities → Skills → Upload skill**.
3. Select the skill folder.

**Option 2 — Claude Code:**
1. Download and unzip the skill folder(s) you want.
2. Place them in your Claude Code skills directory (either a project-local
   `.claude/skills/` or your personal `~/.claude/skills/`).

No installation of `ynab-mcp` itself is required for the coaching skills
above — they work with Claude's own knowledge. The live-budget skills need
the [`ynab-mcp` MCP server](https://github.com/auzroz/ynab-mcp#readme)
connected to actually pull your budget data.

## License

MIT, same as [ynab-mcp](../LICENSE).
