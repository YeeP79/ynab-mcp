/**
 * Server instructions sent to MCP clients at initialize.
 *
 * Clients such as Claude Desktop add these to the model's context when the
 * server connects, so people can ask plain questions without knowing tool
 * names. Keep this short and about using the tools well; budgeting coaching
 * belongs in prompts and skills.
 */

export const SERVER_INSTRUCTIONS = `This server connects to the user's YNAB budget. Users ask plain questions; pick the tools for them and never ask the user to name a tool.

Which tool for which question:
- "How are we doing this month?" / "how much is left in X?": ynab_quick_summary, ynab_list_categories (current month balances), ynab_spending_pace.
- Past spending or income, trends, "how much did we spend on X", top payees, memo tags such as #trip: ynab_query. It already excludes transfers, counts split lines and nets refunds; use its totals rather than adding transactions yourself.
- "Are we living within our means?", where savings went, bonuses: ynab_cash_flow_check.
- Finding specific transactions: ynab_transaction_search. Pass since_date (e.g. "past 6 months" or "all"); without it only about the last 30 days are searched.
- A written report for a period: follow the ynab-spending-report prompt.

Reading the budget:
- Leave budget_id out to use the configured plan; only pass it to work in a different plan (ynab_list_budgets lists them).
- Category notes (in ynab_list_categories) describe what belongs in a category. Follow them when categorizing.
- Memos may hold tags (#name) that group spending for a project or trip; ynab_query can group or filter by them.
- Amounts are dollars unless a field says milliunits. Spending is money out; a refund reduces it.

Changing the budget:
- Writes are real and immediate. Before creating, updating or deleting anything, say exactly what will change and wait for the user to confirm. Prefer one batched update over many single ones.
- To assign money for a month use ynab_update_category; to rename, move, or set targets use ynab_update_category_details.
- The YNAB API cannot hide, delete or reorder categories, close accounts, or link bank connections. Tell the user to do those in the YNAB app instead of attempting them.

Talking to the user:
- Lead with the answer in plain language and round to the dollar unless cents matter. Say which period a number covers.
- If results look incomplete (uncategorized money, a short date range), say so instead of guessing.`;
