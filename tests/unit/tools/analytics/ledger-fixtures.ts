/**
 * Small plan used by the ledger, query and cash-flow-check tests.
 */

export const ACCT_CHECKING = 'acct-checking';
export const ACCT_SAVINGS = 'acct-savings';
export const ACCT_TRACKING = 'acct-tracking'; // off budget

export const CAT_RTA = 'cat-rta';
export const CAT_UNCATEGORIZED = 'cat-uncat';
export const CAT_GROCERIES = 'cat-groceries';
export const CAT_DINING = 'cat-dining';
export const CAT_RENT = 'cat-rent';

export const categoryGroups = [
  {
    id: 'grp-internal',
    name: 'Internal Master Category',
    categories: [
      { id: CAT_RTA, name: 'Inflow: Ready to Assign' },
      { id: CAT_UNCATEGORIZED, name: 'Uncategorized' },
    ],
  },
  {
    id: 'grp-everyday',
    name: 'Everyday',
    categories: [
      { id: CAT_GROCERIES, name: 'Groceries' },
      { id: CAT_DINING, name: 'Eating Out' },
    ],
  },
  { id: 'grp-bills', name: 'Bills', categories: [{ id: CAT_RENT, name: 'Rent' }] },
];

export const accounts = [
  { id: ACCT_CHECKING, name: 'Checking', on_budget: true, deleted: false, balance: 0 },
  { id: ACCT_SAVINGS, name: 'Savings', on_budget: true, deleted: false, balance: 0 },
  { id: ACCT_TRACKING, name: 'Brokerage', on_budget: false, deleted: false, balance: 0 },
];

const names: Record<string, string> = {
  [ACCT_CHECKING]: 'Checking',
  [ACCT_SAVINGS]: 'Savings',
  [ACCT_TRACKING]: 'Brokerage',
};

let seq = 0;

export function txn(
  date: string,
  amount: number,
  opts: {
    category?: string | null;
    payee?: string;
    account?: string;
    transfer?: string;
    memo?: string;
    original?: string;
    deleted?: boolean;
    subs?: Array<{ amount: number; category?: string | null; memo?: string; transfer?: string; deleted?: boolean }>;
  } = {}
) {
  seq += 1;
  const account = opts.account ?? ACCT_CHECKING;
  return {
    id: `t${seq}`,
    date,
    amount,
    memo: opts.memo ?? null,
    account_id: account,
    account_name: names[account] ?? account,
    payee_name: opts.payee ?? 'Store',
    category_id: opts.category === undefined ? CAT_GROCERIES : opts.category,
    transfer_account_id: opts.transfer ?? null,
    import_payee_name_original: opts.original ?? null,
    deleted: opts.deleted ?? false,
    subtransactions: (opts.subs ?? []).map((s, i) => ({
      id: `t${seq}-s${i}`,
      amount: s.amount,
      memo: s.memo ?? null,
      payee_name: null,
      category_id: s.category === undefined ? CAT_GROCERIES : s.category,
      transfer_account_id: s.transfer ?? null,
      deleted: s.deleted ?? false,
    })),
  };
}

export function transactionsResponse(transactions: unknown[]) {
  return { data: { transactions, server_knowledge: 1 } };
}

export function categoriesResponse() {
  return { data: { category_groups: categoryGroups, server_knowledge: 1 } };
}

export function accountsResponse(balances: Record<string, number> = {}) {
  return {
    data: {
      accounts: accounts.map((a) => ({ ...a, balance: balances[a.id] ?? 0 })),
      server_knowledge: 1,
    },
  };
}
