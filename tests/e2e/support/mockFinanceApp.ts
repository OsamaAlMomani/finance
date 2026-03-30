import type { Page } from '@playwright/test';

const TODAY = '2026-03-30';
type MockFinanceSeed = ReturnType<typeof buildSeed>;
type MockFinanceOptions = {
  seed?: Partial<MockFinanceSeed>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const mergeSeed = <T>(base: T, override?: Partial<T>): T => {
  if (override === undefined) {
    return deepClone(base);
  }

  if (Array.isArray(override)) {
    return deepClone(override) as T;
  }

  if (isRecord(base) && isRecord(override)) {
    const merged: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(override)]);

    for (const key of keys) {
      const baseValue = base[key];
      const overrideValue = override[key];
      merged[key] = overrideValue === undefined ? deepClone(baseValue) : mergeSeed(baseValue, overrideValue as never);
    }

    return merged as T;
  }

  return deepClone(override as T);
};

const buildSeed = () => ({
  users: [
    {
      id: 'user_main',
      name: 'Osama',
      avatar: 'avatar-01',
      activeProfileId: 'profile_main',
      profiles: [
        { id: 'profile_main', name: 'Main Profile', isLab: false },
        { id: 'profile_lab', name: 'Design Lab', isLab: true }
      ]
    }
  ],
  activeUserId: 'user_main',
  appSettings: [
    { key: 'app_language', value: 'en' },
    { key: 'currency', value: 'USD' },
    { key: 'locale', value: 'en-US' }
  ],
  categories: [
    { id: 'cat_salary', name: 'Salary', type: 'income', color: '#10B981', icon: 'money-bill' },
    { id: 'cat_food', name: 'Food & Dining', type: 'expense', color: '#EF4444', icon: 'utensils' },
    { id: 'cat_housing', name: 'Housing', type: 'expense', color: '#3B82F6', icon: 'home' },
    { id: 'cat_utilities', name: 'Utilities', type: 'expense', color: '#6366F1', icon: 'bolt' },
    { id: 'cat_travel', name: 'Travel', type: 'expense', color: '#F59E0B', icon: 'plane' },
    { id: 'cat_saving', name: 'Savings', type: 'income', color: '#14B8A6', icon: 'piggy-bank' }
  ],
  accounts: [
    { id: 'acc_checking', name: 'Main Checking', type: 'checking', initial_balance: 5200, currency: 'USD' },
    { id: 'acc_savings', name: 'Savings Vault', type: 'savings', initial_balance: 7400, currency: 'USD' },
    { id: 'acc_credit', name: 'Rewards Card', type: 'credit', initial_balance: -380, currency: 'USD' }
  ],
  transactions: [
    {
      id: 'tx_salary_march',
      account_id: 'acc_checking',
      to_account_id: null,
      category_id: 'cat_salary',
      subcategory_id: null,
      type: 'income',
      amount: 4200,
      date: '2026-03-01',
      merchant: 'Primary Employer',
      notes: 'Monthly salary',
      tags: ['income', 'salary'],
      goal_id: null
    },
    {
      id: 'tx_rent_march',
      account_id: 'acc_checking',
      to_account_id: null,
      category_id: 'cat_housing',
      subcategory_id: null,
      type: 'expense',
      amount: 1250,
      date: '2026-03-02',
      merchant: 'City Apartments',
      notes: 'Rent',
      tags: ['housing'],
      goal_id: null
    },
    {
      id: 'tx_food_march',
      account_id: 'acc_checking',
      to_account_id: null,
      category_id: 'cat_food',
      subcategory_id: null,
      type: 'expense',
      amount: 84.5,
      date: '2026-03-08',
      merchant: 'Fresh Market',
      notes: 'Weekly groceries',
      tags: ['groceries', 'family'],
      goal_id: null
    },
    {
      id: 'tx_power_march',
      account_id: 'acc_checking',
      to_account_id: null,
      category_id: 'cat_utilities',
      subcategory_id: null,
      type: 'expense',
      amount: 96.2,
      date: '2026-03-11',
      merchant: 'Jordan Electric',
      notes: 'Power bill',
      tags: ['utilities', 'home'],
      goal_id: null
    },
    {
      id: 'tx_trip_march',
      account_id: 'acc_credit',
      to_account_id: null,
      category_id: 'cat_travel',
      subcategory_id: null,
      type: 'expense',
      amount: 310,
      date: '2026-03-17',
      merchant: 'Amman Taxi',
      notes: 'Client visits',
      tags: ['travel', 'work'],
      goal_id: null
    },
    {
      id: 'tx_goal_seed',
      account_id: 'acc_savings',
      to_account_id: null,
      category_id: 'cat_saving',
      subcategory_id: null,
      type: 'income',
      amount: 400,
      date: '2026-03-20',
      merchant: 'Goal contribution - Car Fund',
      notes: 'Seeded contribution',
      tags: ['goal', 'car'],
      goal_id: 'goal_car'
    }
  ],
  budgets: [
    { id: 'budget_food', category_id: 'cat_food', period: 'monthly', limit_amount: 450 },
    { id: 'budget_utilities', category_id: 'cat_utilities', period: 'monthly', limit_amount: 220 }
  ],
  goals: [
    {
      id: 'goal_car',
      name: 'Car Fund',
      target_amount: 12000,
      current_amount: 2400,
      target_date: '2026-12-30',
      linked_account_id: 'acc_savings',
      goal_type: 'standard',
      priority: 'high',
      funding_source: 'salary',
      risk_status: 'watch'
    },
    {
      id: 'goal_trip',
      name: 'Summer Trip',
      target_amount: 3000,
      current_amount: 800,
      target_date: '2026-07-10',
      linked_account_id: 'acc_checking',
      goal_type: 'standard',
      priority: 'medium',
      funding_source: 'surplus',
      risk_status: 'normal'
    }
  ],
  goalContributions: [
    { id: 'goal_contrib_tx_goal_seed', goal_id: 'goal_car', transaction_id: 'tx_goal_seed', amount: 400, date: '2026-03-20', source_type: 'transaction', notes: 'Seeded contribution' },
    { id: 'goal_contrib_manual_trip', goal_id: 'goal_trip', transaction_id: null, amount: 150, date: '2026-03-10', source_type: 'manual', notes: 'Manual trip save' }
  ],
  bills: [
    { id: 'bill_rent', name: 'Rent', amount: 1250, next_due_date: '2026-04-01', recurrence: 'monthly', is_paid: 0, auto_pay: 0 },
    { id: 'bill_internet', name: 'Internet', amount: 55, next_due_date: '2026-03-31', recurrence: 'monthly', is_paid: 0, auto_pay: 1 },
    { id: 'bill_power', name: 'Electricity Bill', amount: 96.2, next_due_date: '2026-03-15', recurrence: 'monthly', is_paid: 1, auto_pay: 1 }
  ],
  loans: [
    {
      id: 'loan_car',
      name: 'Car Loan',
      principal_amount: 18000,
      current_balance: 8400,
      interest_rate: 5.2,
      payment_amount: 420,
      payment_frequency: 'monthly',
      start_date: '2025-01-01',
      end_date: '2029-01-01',
      linked_account_id: 'acc_checking',
      lender: 'Jordan Bank',
      notes: 'Auto-linked for payment tracking.',
      next_due_date: '2026-04-05',
      due_status: 'due_soon'
    }
  ],
  loanPayments: [
    { id: 'loan_payment_1', loan_id: 'loan_car', amount: 420, balance_before: 8820, balance_after: 8400, paid_at: '2026-03-05', note: 'March payment' }
  ],
  plans: [
    { id: 'plan_1', item_type: 'goal', item_id: 'goal_car', title: 'Boost car fund', scenario_if: 'Save extra travel budget', action_then: 'Move $300 to savings', review_date: '2026-04-15', status: 'active' }
  ],
  alerts: [
    { id: 'alert_bill_1', title: 'Internet due tomorrow', type: 'bill_due', status: 'active', severity: 'warning', message: 'Internet bill is due soon', created_at: '2026-03-29T10:00:00.000Z' },
    { id: 'alert_goal_1', title: 'Car fund behind target', type: 'goal_watch', status: 'acknowledged', severity: 'warning', message: 'Goal pace is behind', created_at: '2026-03-28T10:00:00.000Z' }
  ],
  reports: [
    {
      id: 'report_2026_03',
      month: '2026-03',
      generated_at: '2026-03-25T08:00:00.000Z',
      snapshot_data: {
        cashFlow: { income: 4200, expense: 1740.7, net: 2459.3 },
        actualVsBudget: [
          { categoryName: 'Food & Dining', limitAmount: 450, spent: 84.5, variance: 365.5 },
          { categoryName: 'Utilities', limitAmount: 220, spent: 96.2, variance: 123.8 }
        ],
        goalProgress: [
          { name: 'Car Fund', current_amount: 2400, target_amount: 12000, goal_type: 'standard', risk_status: 'watch' }
        ],
        loanStatus: [
          { name: 'Car Loan', current_balance: 8400, next_due_date: '2026-04-05', due_status: 'due_soon' }
        ],
        riskNotes: ['Internet bill due tomorrow.', 'Car fund needs an extra top-up this month.']
      }
    }
  ],
  settlements: [
    {
      id: 'settlement_2026_03',
      month: '2026-03',
      status: 'in_review',
      is_dirty: 1,
      unresolved_count: 1,
      reconciled_at: null,
      notes: 'Awaiting final report review',
      checklist: {
        items: [
          { key: 'alerts', label: 'Review active alerts', done: false, meta: { count: 1 } },
          { key: 'reports', label: 'Generate monthly report', done: true, meta: { report: '2026-03' } }
        ],
        unresolvedCount: 1
      }
    }
  ],
  scenarios: [
    {
      id: 'scenario_seed',
      title: 'Balanced plan',
      mode: 'balanced',
      risk_level: 'low',
      created_at: '2026-03-20T10:00:00.000Z',
      assumptions: { monthly_income: 4200, monthly_expense: 1800 },
      result_snapshot: { summary: { finalBalance: 10420, riskLevel: 'low' } }
    }
  ],
  permissions: [
    { id: 'perm_reports_owner', scope_type: 'module', scope_id: 'reports', role: 'Owner', subject_type: 'user', subject_id: 'user_main', visibility: 'private' }
  ],
  shareSnapshots: [
    { id: 'share_seed', report_id: 'report_2026_03', snapshot_name: 'March board pack', status: 'active', integrity_hash: 'hash_seed_123456', created_at: '2026-03-25T09:00:00.000Z' }
  ],
  subcategories: [],
  tags: [
    { id: 'tag_family', name: 'family', color: '#10B981' },
    { id: 'tag_work', name: 'work', color: '#3B82F6' },
    { id: 'tag_travel', name: 'travel', color: '#F59E0B' }
  ],
  labels: [],
  classificationRules: [],
  metadata: [],
  realtimeState: [],
  recurringItems: [],
  alertEvents: [],
  settlementEvents: [],
  reportExports: [],
  taxRules: [],
  schemaStatus: {
    schemaVersion: 2,
    targetVersion: 2,
    requiresUpgrade: false,
    backupCompletedAt: null
  }
});

export const APP_ROUTES = [
  { path: '/', heading: 'Dashboard' },
  { path: '/transactions', heading: 'Transactions' },
  { path: '/accounts', heading: 'Accounts' },
  { path: '/budget', heading: 'Budgets' },
  { path: '/goals', heading: 'Financial Goals' },
  { path: '/bills', heading: 'Upcoming Bills' },
  { path: '/loans', heading: 'Loans & Debts' },
  { path: '/plans', heading: 'Plans' },
  { path: '/scenarios', heading: 'Loan + Goals Planner' },
  { path: '/alerts', heading: 'System Alerts' },
  { path: '/settlement', heading: 'Monthly Settlement' },
  { path: '/reports', heading: 'Monthly Reports' },
  { path: '/sharing', heading: 'Sharing & Permissions' },
  { path: '/import-export', heading: 'Import / Export Data' },
  { path: '/settings', heading: 'App Settings' }
] as const;

export async function installMockFinanceApp(page: Page, options: MockFinanceOptions = {}) {
  const seed = mergeSeed(buildSeed(), options.seed);

  await page.addInitScript((payload) => {
    const deepClone = (value) => JSON.parse(JSON.stringify(value));
    const today = payload.today;
    const STATE_STORAGE_KEY = '__mockFinanceState';
    const readPersistedState = () => {
      try {
        const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };
    const state = readPersistedState() || deepClone(payload.seed);
    const listeners = new Map();
    const mutationRe = /^db-(add|update|delete|save|create|set|pay|finalize|reopen|reset|restore|replace|revoke|complete|mark|refresh|optimize)-/i;
    const mockWindow = window as typeof window & {
      __mockBackupZip?: { filePath: string; dataBase64: string };
      __mockWindowMaximized?: boolean;
    };
    const persistState = () => {
      try {
        window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore persistence issues in tests.
      }
    };
    const BACKUP_STATE_KEYS = [
      ['accounts', 'accounts'],
      ['categories', 'categories'],
      ['subcategories', 'subcategories'],
      ['tags', 'tags'],
      ['labels', 'labels'],
      ['classificationRules', 'classification_rules'],
      ['transactions', 'transactions'],
      ['budgets', 'budgets'],
      ['goals', 'goals'],
      ['goalContributions', 'goal_contributions'],
      ['bills', 'bills'],
      ['loans', 'loans'],
      ['loanPayments', 'loan_payments'],
      ['metadata', 'metadata_entries'],
      ['realtimeState', 'realtime_state'],
      ['plans', 'plans'],
      ['recurringItems', 'recurring_items'],
      ['scenarios', 'scenarios'],
      ['alerts', 'alerts'],
      ['alertEvents', 'alert_events'],
      ['settlements', 'monthly_settlements'],
      ['settlementEvents', 'settlement_events'],
      ['reports', 'monthly_reports'],
      ['reportExports', 'report_exports'],
      ['permissions', 'permissions'],
      ['shareSnapshots', 'share_snapshots'],
      ['taxRules', 'tax_rules'],
      ['appSettings', 'app_settings']
    ];

    const ensureBlobApis = () => {
      if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = () => 'blob:mock-finance';
      }
      if (!window.URL.revokeObjectURL) {
        window.URL.revokeObjectURL = () => {};
      }
    };

    const dispatchFinanceChange = (channel) => {
      window.dispatchEvent(new CustomEvent('finance:data-changed', {
        detail: { channel, at: `${today}T12:00:00.000Z` }
      }));
    };

    const generateId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
    const findCategory = (id) => state.categories.find((entry) => entry.id === id) || null;
    const findAccount = (id) => state.accounts.find((entry) => entry.id === id) || null;
    const findGoal = (id) => state.goals.find((entry) => entry.id === id) || null;
    const overwriteArrayState = (stateKey, nextValue) => {
      state[stateKey] = Array.isArray(nextValue) ? deepClone(nextValue) : [];
    };
    const resetBackupCollections = () => {
      for (const [stateKey] of BACKUP_STATE_KEYS) {
        overwriteArrayState(stateKey, []);
      }
      state.schemaStatus = {
        ...state.schemaStatus,
        requiresUpgrade: false
      };
    };
    const replaceBackupCollections = (payloadData) => {
      resetBackupCollections();
      for (const [stateKey, payloadKey] of BACKUP_STATE_KEYS) {
        overwriteArrayState(stateKey, payloadData?.[payloadKey]);
      }
      state.schemaStatus = {
        ...state.schemaStatus,
        requiresUpgrade: false
      };
    };

    const serializeTransaction = (tx) => {
      const category = findCategory(tx.category_id);
      const account = findAccount(tx.account_id);
      const toAccount = tx.to_account_id ? findAccount(tx.to_account_id) : null;
      return {
        ...tx,
        category_name: category?.name || '',
        category_color: category?.color || '#6B7280',
        account_name: account?.name || '',
        to_account_name: toAccount?.name || '',
        tags: Array.isArray(tx.tags) ? tx.tags : []
      };
    };

    const computeAccountBalance = (account) => {
      const income = state.transactions
        .filter((tx) => tx.account_id === account.id && tx.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expense = state.transactions
        .filter((tx) => tx.account_id === account.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const transfersOut = state.transactions
        .filter((tx) => tx.account_id === account.id && tx.type === 'transfer')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const transfersIn = state.transactions
        .filter((tx) => tx.to_account_id === account.id && tx.type === 'transfer')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return Number(account.initial_balance || 0) + income - expense - transfersOut + transfersIn;
    };

    const getLoanPaymentStats = () =>
      state.loans.map((loan) => {
        const payments = state.loanPayments.filter((payment) => payment.loan_id === loan.id);
        const lastPayment = payments.slice().sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))[0];
        return {
          loan_id: loan.id,
          payment_count: payments.length,
          total_paid: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          last_paid_at: lastPayment?.paid_at || null,
          last_amount: Number(lastPayment?.amount || 0)
        };
      });

    const GOAL_MANUAL_SEED_SOURCE = 'manual_seed';
    const getGoalManualSeedId = (goalId) => `goal_seed_${goalId}`;

    const syncGoalFromContributions = (goalId) => {
      const goal = findGoal(goalId);
      if (!goal) return null;
      goal.current_amount = state.goalContributions
        .filter((entry) => entry.goal_id === goalId)
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      return goal;
    };

    const syncGoalManualSeed = (goalId, desiredAmount, options = {}) => {
      const goal = findGoal(goalId);
      if (!goal) return null;

      const nonSeedTotal = state.goalContributions
        .filter((entry) => entry.goal_id === goalId && entry.source_type !== GOAL_MANUAL_SEED_SOURCE)
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const seedAmount = Number((Number(desiredAmount || 0) - nonSeedTotal).toFixed(2));
      const seedId = getGoalManualSeedId(goalId);

      state.goalContributions = state.goalContributions.filter((entry) => entry.id !== seedId);

      if (Math.abs(seedAmount) >= 0.005) {
        state.goalContributions.push({
          id: seedId,
          goal_id: goalId,
          transaction_id: null,
          amount: seedAmount,
          date: options.date || today,
          source_type: GOAL_MANUAL_SEED_SOURCE,
          source_id: null,
          notes: options.notes || 'Manual goal baseline synced from goal editor.'
        });
      }

      return syncGoalFromContributions(goalId);
    };

    const linkTransactionToGoal = (transaction) => {
      if (!transaction.goal_id) return;
      state.goalContributions = state.goalContributions.filter((entry) => entry.transaction_id !== transaction.id);
      state.goalContributions.push({
        id: `goal_contrib_${transaction.id}`,
        goal_id: transaction.goal_id,
        transaction_id: transaction.id,
        amount: transaction.type === 'expense' ? -Math.abs(Number(transaction.amount || 0)) : Math.abs(Number(transaction.amount || 0)),
        date: transaction.date,
        source_type: 'transaction',
        notes: transaction.notes || ''
      });
      syncGoalFromContributions(transaction.goal_id);
    };

    const removeGoalContributionByTransaction = (transactionId) => {
      const affected = state.goalContributions.filter((entry) => entry.transaction_id === transactionId).map((entry) => entry.goal_id);
      state.goalContributions = state.goalContributions.filter((entry) => entry.transaction_id !== transactionId);
      affected.forEach((goalId) => syncGoalFromContributions(goalId));
    };

    const buildReport = (month) => {
      const monthTransactions = state.transactions.filter((tx) => String(tx.date || '').startsWith(month));
      const income = monthTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expense = monthTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      return {
        id: `report_${month.replace('-', '_')}`,
        month,
        generated_at: `${today}T09:00:00.000Z`,
        snapshot_data: {
          cashFlow: { income, expense, net: income - expense },
          actualVsBudget: state.budgets.map((budget) => {
            const category = findCategory(budget.category_id);
            const spent = monthTransactions
              .filter((tx) => tx.type === 'expense' && tx.category_id === budget.category_id)
              .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
            return {
              categoryName: category?.name || budget.category_id,
              limitAmount: Number(budget.limit_amount || 0),
              spent,
              variance: Number(budget.limit_amount || 0) - spent
            };
          }),
          goalProgress: state.goals.map((goal) => ({
            name: goal.name,
            current_amount: Number(goal.current_amount || 0),
            target_amount: Number(goal.target_amount || 0),
            goal_type: goal.goal_type,
            risk_status: goal.risk_status
          })),
          loanStatus: state.loans.map((loan) => ({
            name: loan.name,
            current_balance: Number(loan.current_balance || 0),
            next_due_date: loan.next_due_date,
            due_status: loan.due_status
          })),
          riskNotes: state.alerts.filter((alert) => alert.status !== 'resolved').map((alert) => alert.title)
        }
      };
    };

    const buildDashboardStats = () => {
      const totalIncome = state.transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const totalExpense = state.transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const totalBalance = state.accounts.reduce((sum, account) => sum + computeAccountBalance(account), 0);
      return {
        totalBalance,
        totalIncome,
        totalExpense,
        chartData: [],
        activeAlerts: state.alerts.filter((alert) => alert.status !== 'resolved').length
      };
    };

    const buildDashboardOptimization = (options = {}) => {
      const periodDays = Number(options.periodDays || 90);
      const month = String(options.month || today.slice(0, 7));
      const monthTransactions = state.transactions.filter((tx) => String(tx.date || '').startsWith(month) && tx.type === 'expense');
      const totalSpend = monthTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const currentDay = month === today.slice(0, 7) ? today : null;
      const year = Number(month.slice(0, 4));
      const monthIndex = Number(month.slice(5, 7));
      const daysInMonth = new Date(year, monthIndex, 0).getDate();

      const tagMap = new Map();
      for (const tx of monthTransactions) {
        const txTags = Array.isArray(tx.tags) ? tx.tags : [];
        for (const tagName of txTags) {
          const tagRecord = state.tags.find((entry) => entry.name === tagName);
          const key = tagRecord?.id || tagName;
          if (!tagMap.has(key)) {
            tagMap.set(key, {
              id: key,
              name: tagRecord?.name || tagName,
              color: tagRecord?.color || '#6B7280',
              totalAmount: 0,
              txCount: 0
            });
          }
          const current = tagMap.get(key);
          current.totalAmount += Number(tx.amount || 0);
          current.txCount += 1;
        }
      }

      const points = Array.from({ length: daysInMonth }, (_, index) => {
        const day = String(index + 1).padStart(2, '0');
        const date = `${month}-${day}`;
        const dailyTransactions = monthTransactions.filter((tx) => tx.date === date);
        const tagAmounts = {};
        for (const tx of dailyTransactions) {
          for (const tagName of Array.isArray(tx.tags) ? tx.tags : []) {
            const tagRecord = state.tags.find((entry) => entry.name === tagName);
            const key = tagRecord?.id || tagName;
            tagAmounts[key] = Number(tagAmounts[key] || 0) + Number(tx.amount || 0);
          }
        }
        return {
          date,
          day,
          total: dailyTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
          tagAmounts
        };
      });

      return {
        asOf: `${today}T12:00:00.000Z`,
        periodDays,
        stats: {
          totalSpend,
          avgDailySpend: totalSpend / Math.max(1, new Date(today).getDate()),
          billsDue7d: state.bills.filter((bill) => !Number(bill.is_paid)).reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
          debtLoad: state.loans.reduce((sum, loan) => sum + Number(loan.current_balance || 0), 0),
          overdueBills: state.bills.filter((bill) => !Number(bill.is_paid) && bill.next_due_date < today).length,
          dueSoonBills: state.bills.filter((bill) => !Number(bill.is_paid) && bill.next_due_date >= today).length
        },
        budgetAlignment: state.budgets.map((budget) => {
          const category = findCategory(budget.category_id);
          const spentAmount = monthTransactions
            .filter((tx) => tx.category_id === budget.category_id)
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
          const remainingAmount = Number(budget.limit_amount || 0) - spentAmount;
          const usagePct = Number(budget.limit_amount || 0) > 0 ? (spentAmount / Number(budget.limit_amount || 0)) * 100 : 0;
          return {
            budgetId: budget.id,
            categoryId: budget.category_id,
            category: category?.name || budget.category_id,
            color: category?.color || '#6B7280',
            period: budget.period,
            limitAmount: Number(budget.limit_amount || 0),
            spentAmount,
            remainingAmount,
            usagePct,
            alertCount: 0,
            status: usagePct > 100 ? 'overspent' : usagePct > 80 ? 'watch' : 'on_track'
          };
        }),
        debtPressure: state.loans.map((loan) => ({
          loanId: loan.id,
          name: loan.name,
          balance: Number(loan.current_balance || 0),
          interestRate: Number(loan.interest_rate || 0),
          paymentAmount: Number(loan.payment_amount || 0),
          dueStatus: loan.due_status || 'upcoming',
          riskScore: Number(loan.interest_rate || 0) * Number(loan.current_balance || 0),
          monthlyPressure: Number(loan.payment_amount || 0),
          alertCount: 0,
          health: loan.due_status || 'upcoming'
        })),
        billsPressure: state.bills.filter((bill) => !Number(bill.is_paid)).map((bill) => ({
          billId: bill.id,
          name: bill.name,
          amount: Number(bill.amount || 0),
          dueDate: bill.next_due_date,
          daysToDue: Math.round((new Date(`${bill.next_due_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000),
          alertCount: 0,
          status: bill.next_due_date < today ? 'overdue' : bill.next_due_date <= `${month}-31` ? 'due_soon' : 'upcoming'
        })),
        goalProgress: state.goals.map((goal) => ({
          goalId: goal.id,
          name: goal.name,
          currentAmount: Number(goal.current_amount || 0),
          targetAmount: Number(goal.target_amount || 0),
          remainingAmount: Math.max(0, Number(goal.target_amount || 0) - Number(goal.current_amount || 0)),
          progressPct: Number(goal.target_amount || 0) > 0 ? (Number(goal.current_amount || 0) / Number(goal.target_amount || 0)) * 100 : 0,
          targetDate: goal.target_date,
          riskStatus: goal.risk_status || 'normal',
          linkedAccountName: findAccount(goal.linked_account_id)?.name || ''
        })),
        expenseTrend: {
          month,
          currentDay,
          daysInMonth,
          totalMonthSpend: totalSpend,
          tagOptions: Array.from(tagMap.values()),
          points
        }
      };
    };

    const applyMutationSideEffects = (channel) => {
      if (mutationRe.test(String(channel || ''))) {
        dispatchFinanceChange(channel);
      }
    };

    ensureBlobApis();
    persistState();
    window.localStorage.setItem('appSettings', JSON.stringify({ currency: 'USD' }));

    window.electron = {
      invoke: async (channel, ...args) => {
        const firstArg = args[0];
        let result = null;

        switch (channel) {
          case 'user-get-all':
            result = { users: deepClone(state.users), activeUserId: state.activeUserId };
            break;
          case 'user-set-active': {
            const [userId] = args;
            const user = state.users.find((entry) => entry.id === userId);
            if (user) {
              state.activeUserId = user.id;
            }
            result = { users: deepClone(state.users), activeUserId: state.activeUserId };
            break;
          }
          case 'profile-set-active': {
            const [userId, profileId] = args;
            const user = state.users.find((entry) => entry.id === userId);
            if (user?.profiles?.some((profile) => profile.id === profileId)) {
              user.activeProfileId = profileId;
              state.activeUserId = user.id;
            }
            result = { users: deepClone(state.users), activeUserId: state.activeUserId };
            break;
          }
          case 'user-update-avatar': {
            const [userId, avatar] = args;
            const user = state.users.find((entry) => entry.id === userId);
            if (user) user.avatar = avatar;
            result = { users: deepClone(state.users), activeUserId: state.activeUserId };
            break;
          }
          case 'db-get-app-settings':
            result = deepClone(state.appSettings);
            break;
          case 'db-set-app-setting': {
            const [key, value] = args;
            const existing = state.appSettings.find((entry) => entry.key === key);
            if (existing) existing.value = value;
            else state.appSettings.push({ key, value });
            result = { ok: true };
            break;
          }
          case 'db-check-permission':
            result = { allowed: true, actualRole: 'Owner', requiredRole: firstArg?.requiredRole || 'Viewer' };
            break;
          case 'db-get-accounts':
            result = deepClone(state.accounts);
            break;
          case 'db-get-accounts-with-balance':
            result = deepClone(state.accounts.map((account) => ({ ...account, current_balance: computeAccountBalance(account) })));
            break;
          case 'db-create-account':
          case 'db-update-account': {
            const account = {
              id: firstArg.id,
              name: firstArg.name,
              type: firstArg.type,
              initial_balance: Number(firstArg.initialBalance ?? firstArg.initial_balance ?? 0),
              currency: firstArg.currency || 'USD'
            };
            const index = state.accounts.findIndex((entry) => entry.id === account.id);
            if (index >= 0) state.accounts[index] = account;
            else state.accounts.push(account);
            result = deepClone(account);
            break;
          }
          case 'db-delete-account':
            state.accounts = state.accounts.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-categories':
            result = deepClone(state.categories);
            break;
          case 'db-create-category':
            state.categories.push({ id: firstArg.id, name: firstArg.name, type: firstArg.type, color: firstArg.color || '#3B82F6', icon: firstArg.icon || 'circle' });
            result = deepClone(firstArg);
            break;
          case 'db-delete-category':
            state.categories = state.categories.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-transactions':
            result = deepClone(state.transactions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(serializeTransaction));
            break;
          case 'db-add-transaction': {
            const transaction = { id: firstArg.id, account_id: firstArg.accountId || firstArg.account_id, to_account_id: firstArg.toAccountId || firstArg.to_account_id || null, category_id: firstArg.category || firstArg.category_id || null, subcategory_id: firstArg.subcategory || firstArg.subcategory_id || null, type: firstArg.type, amount: Number(firstArg.amount || 0), date: firstArg.date, merchant: firstArg.merchant, notes: firstArg.notes || '', tags: Array.isArray(firstArg.tags) ? firstArg.tags : [], goal_id: firstArg.goalId || firstArg.goal_id || null };
            state.transactions.push(transaction);
            linkTransactionToGoal(transaction);
            result = deepClone(serializeTransaction(transaction));
            break;
          }
          case 'db-update-transaction': {
            const index = state.transactions.findIndex((entry) => entry.id === firstArg.id);
            if (index >= 0) {
              state.transactions[index] = { ...state.transactions[index], account_id: firstArg.accountId || firstArg.account_id, to_account_id: firstArg.toAccountId || firstArg.to_account_id || null, category_id: firstArg.category || firstArg.category_id || null, subcategory_id: firstArg.subcategory || firstArg.subcategory_id || null, type: firstArg.type, amount: Number(firstArg.amount || 0), date: firstArg.date, merchant: firstArg.merchant, notes: firstArg.notes || '', tags: Array.isArray(firstArg.tags) ? firstArg.tags : [], goal_id: firstArg.goalId || firstArg.goal_id || null };
              removeGoalContributionByTransaction(firstArg.id);
              linkTransactionToGoal(state.transactions[index]);
              result = deepClone(serializeTransaction(state.transactions[index]));
            }
            break;
          }
          case 'db-delete-transaction':
            state.transactions = state.transactions.filter((entry) => entry.id !== firstArg);
            removeGoalContributionByTransaction(firstArg);
            result = { ok: true };
            break;
          case 'db-get-budgets':
            result = deepClone(state.budgets);
            break;
          case 'db-save-budget': {
            const budget = { id: firstArg.id, category_id: firstArg.category_id, period: firstArg.period, limit_amount: Number(firstArg.limit_amount || 0) };
            const index = state.budgets.findIndex((entry) => entry.id === budget.id);
            if (index >= 0) state.budgets[index] = budget;
            else state.budgets.push(budget);
            result = deepClone(budget);
            break;
          }
          case 'db-delete-budget':
            state.budgets = state.budgets.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-goals':
            result = deepClone(state.goals);
            break;
          case 'db-get-goal-contributions':
            result = deepClone(state.goalContributions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))));
            break;
          case 'db-save-goal':
          case 'db-update-goal': {
            const goal = { id: firstArg.id, name: firstArg.name, target_amount: Number(firstArg.target_amount || 0), current_amount: Number(firstArg.current_amount || 0), target_date: firstArg.target_date, linked_account_id: firstArg.linked_account_id || null, goal_type: firstArg.goal_type || 'standard', priority: firstArg.priority || 'medium', funding_source: firstArg.funding_source || null, risk_status: firstArg.risk_status || 'normal' };
            const index = state.goals.findIndex((entry) => entry.id === goal.id);
            if (index >= 0) state.goals[index] = goal;
            else state.goals.push(goal);
            syncGoalManualSeed(goal.id, goal.current_amount, { date: today });
            result = deepClone(findGoal(goal.id));
            break;
          }
          case 'db-add-goal-contribution': {
            const goal = findGoal(firstArg.goalId || firstArg.goal_id);
            const contributionId = firstArg.id || generateId('goal_contrib');
            if (goal) {
              syncGoalManualSeed(goal.id, Number(goal.current_amount || 0), {
                date: firstArg.date || today,
                notes: 'Auto baseline sync before manual contribution.'
              });
              const contribution = { id: contributionId, goal_id: goal.id, transaction_id: null, amount: Number(firstArg.amount || 0), date: firstArg.date || today, source_type: firstArg.sourceType || firstArg.source_type || 'manual', notes: firstArg.notes || '' };
              if (goal.linked_account_id && firstArg.createLinkedTransaction !== false) {
                const transaction = { id: `goal_tx_${contributionId}`, account_id: goal.linked_account_id, to_account_id: null, category_id: firstArg.categoryId || firstArg.category_id || 'cat_saving', subcategory_id: null, type: Number(firstArg.amount || 0) > 0 ? 'income' : 'expense', amount: Math.abs(Number(firstArg.amount || 0)), date: contribution.date, merchant: `Goal contribution - ${goal.name}`, notes: contribution.notes, tags: ['goal'], goal_id: goal.id };
                state.transactions.push(transaction);
                contribution.transaction_id = transaction.id;
                contribution.source_type = 'transaction';
              }
              state.goalContributions.push(contribution);
              syncGoalFromContributions(goal.id);
              result = { goal: deepClone(goal), contribution: deepClone(contribution) };
            }
            break;
          }
          case 'db-delete-goal':
            state.goals = state.goals.filter((entry) => entry.id !== firstArg);
            state.goalContributions = state.goalContributions.filter((entry) => entry.goal_id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-bills':
            result = deepClone(state.bills);
            break;
          case 'db-save-bill': {
            const bill = { id: firstArg.id, name: firstArg.name, amount: Number(firstArg.amount || 0), next_due_date: firstArg.next_due_date, recurrence: firstArg.recurrence || 'monthly', is_paid: Number(firstArg.is_paid ? 1 : 0), auto_pay: Number(firstArg.auto_pay ? 1 : 0) };
            const index = state.bills.findIndex((entry) => entry.id === bill.id);
            if (index >= 0) state.bills[index] = bill;
            else state.bills.push(bill);
            result = deepClone(bill);
            break;
          }
          case 'db-delete-bill':
            state.bills = state.bills.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-loans':
            result = deepClone(state.loans);
            break;
          case 'db-get-loan-payments':
            result = deepClone(state.loanPayments);
            break;
          case 'db-get-loan-payment-stats':
            result = deepClone(getLoanPaymentStats());
            break;
          case 'db-save-loan': {
            const loan = { id: firstArg.id, name: firstArg.name, principal_amount: Number(firstArg.principal_amount || 0), current_balance: Number(firstArg.current_balance || 0), interest_rate: Number(firstArg.interest_rate || 0), payment_amount: Number(firstArg.payment_amount || 0), payment_frequency: firstArg.payment_frequency || 'monthly', start_date: firstArg.start_date, end_date: firstArg.end_date, linked_account_id: firstArg.linked_account_id || null, lender: firstArg.lender, notes: firstArg.notes || '', next_due_date: firstArg.next_due_date, due_status: firstArg.due_status || 'upcoming' };
            const index = state.loans.findIndex((entry) => entry.id === loan.id);
            if (index >= 0) state.loans[index] = loan;
            else state.loans.push(loan);
            result = deepClone(loan);
            break;
          }
          case 'db-pay-loan': {
            const loan = state.loans.find((entry) => entry.id === (firstArg.loanId || firstArg.loan_id));
            if (loan) {
              const amount = Number(firstArg.amount || loan.payment_amount || 0);
              const balanceBefore = Number(loan.current_balance || 0);
              loan.current_balance = Math.max(0, balanceBefore - amount);
              const payment = { id: generateId('loan_payment'), loan_id: loan.id, amount, balance_before: balanceBefore, balance_after: loan.current_balance, paid_at: `${today}T09:00:00.000Z`, note: 'Mock payment' };
              state.loanPayments.push(payment);
              if (loan.linked_account_id) {
                state.transactions.push({ id: `loan_tx_${payment.id}`, account_id: loan.linked_account_id, to_account_id: null, category_id: 'cat_housing', subcategory_id: null, type: 'expense', amount, date: today, merchant: `Loan payment - ${loan.name}`, notes: 'Auto-linked loan payment', tags: ['loan'], goal_id: null });
              }
              result = { loan: deepClone(loan), payment: deepClone(payment) };
            }
            break;
          }
          case 'db-delete-loan':
            state.loans = state.loans.filter((entry) => entry.id !== firstArg);
            state.loanPayments = state.loanPayments.filter((entry) => entry.loan_id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-plans':
            result = deepClone(state.plans);
            break;
          case 'db-save-plan': {
            const index = state.plans.findIndex((entry) => entry.id === firstArg.id);
            if (index >= 0) state.plans[index] = { ...state.plans[index], ...firstArg };
            else state.plans.push({ ...firstArg });
            result = deepClone(firstArg);
            break;
          }
          case 'db-delete-plan':
            state.plans = state.plans.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-alerts':
            result = deepClone(state.alerts);
            break;
          case 'db-set-alert-status': {
            const [id, status] = args;
            const alert = state.alerts.find((entry) => entry.id === id);
            if (alert) alert.status = status;
            result = deepClone(alert || null);
            break;
          }
          case 'db-get-dashboard-stats':
            result = buildDashboardStats();
            break;
          case 'db-get-dashboard-optimization':
            result = buildDashboardOptimization(firstArg || {});
            break;
          case 'db-get-reports':
            result = deepClone(state.reports);
            break;
          case 'db-generate-report': {
            const report = buildReport(String(firstArg || today.slice(0, 7)));
            state.reports = [report, ...state.reports.filter((entry) => entry.month !== report.month)];
            result = deepClone(report);
            break;
          }
          case 'db-export-report-csv':
            result = 'month,income,expense,net\n2026-03,4200,1740.7,2459.3';
            break;
          case 'db-export-report-pdf-content':
            result = '%PDF-1.4 mock report content';
            break;
          case 'db-get-settlement-by-month':
            result = deepClone(state.settlements.find((entry) => entry.month === firstArg) || null);
            break;
          case 'db-finalize-settlement': {
            let settlement = state.settlements.find((entry) => entry.month === args[0]);
            if (!settlement) {
              settlement = { id: generateId('settlement'), month: args[0], status: 'in_review', is_dirty: 1, unresolved_count: 0, reconciled_at: null, notes: '', checklist: { items: [], unresolvedCount: 0 } };
              state.settlements.push(settlement);
            }
            settlement.status = 'finalized';
            settlement.is_dirty = 0;
            settlement.reconciled_at = `${today}T15:00:00.000Z`;
            settlement.notes = args[1] || '';
            result = { settlement: deepClone(settlement) };
            break;
          }
          case 'db-reopen-settlement': {
            const settlement = state.settlements.find((entry) => entry.month === args[0]);
            if (settlement) {
              settlement.status = 'in_review';
              settlement.is_dirty = 1;
            }
            result = deepClone(settlement || null);
            break;
          }
          case 'db-get-scenarios':
            result = deepClone(state.scenarios);
            break;
          case 'db-save-scenario': {
            const scenario = { id: firstArg.id || generateId('scenario'), title: firstArg.title, mode: firstArg.mode, risk_level: firstArg.risk_level || 'medium', created_at: `${today}T14:00:00.000Z`, assumptions: firstArg.assumptions || {}, result_snapshot: firstArg.result_snapshot || { summary: { finalBalance: 0, riskLevel: 'medium' } } };
            state.scenarios.unshift(scenario);
            result = deepClone(scenario);
            break;
          }
          case 'db-delete-scenario':
            state.scenarios = state.scenarios.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-list-share-snapshots':
            result = deepClone(state.shareSnapshots);
            break;
          case 'db-create-share-snapshot': {
            const snapshot = { id: firstArg.id || generateId('snapshot'), report_id: firstArg.reportId || firstArg.report_id, snapshot_name: firstArg.snapshot_name, status: 'active', integrity_hash: generateId('hash'), created_at: `${today}T16:00:00.000Z` };
            state.shareSnapshots.unshift(snapshot);
            result = deepClone(snapshot);
            break;
          }
          case 'db-revoke-share-snapshot': {
            const snapshot = state.shareSnapshots.find((entry) => entry.id === firstArg);
            if (snapshot) snapshot.status = 'revoked';
            result = deepClone(snapshot || null);
            break;
          }
          case 'db-export-share-snapshot':
            result = { fileName: `${firstArg}.json`, packageJson: JSON.stringify({ id: firstArg, exportedAt: `${today}T16:30:00.000Z` }, null, 2) };
            break;
          case 'db-get-permissions':
            result = deepClone(state.permissions);
            break;
          case 'db-save-permission':
            state.permissions.unshift({ ...firstArg });
            result = deepClone(firstArg);
            break;
          case 'db-delete-permission':
            state.permissions = state.permissions.filter((entry) => entry.id !== firstArg);
            result = { ok: true };
            break;
          case 'db-get-schema-status':
            result = deepClone(state.schemaStatus);
            break;
          case 'db-mark-v2-backup-complete':
            state.schemaStatus.backupCompletedAt = `${today}T17:00:00.000Z`;
            result = deepClone(state.schemaStatus);
            break;
          case 'db-complete-v2-upgrade':
            state.schemaStatus.requiresUpgrade = false;
            result = deepClone(state.schemaStatus);
            break;
          case 'db-reset-all':
            resetBackupCollections();
            result = { ok: true };
            break;
          case 'db-replace-all':
            replaceBackupCollections(firstArg);
            result = { ok: true };
            break;
          case 'db-get-subcategories':
            result = deepClone(state.subcategories);
            break;
          case 'db-get-tags':
            result = deepClone(state.tags);
            break;
          case 'db-get-labels':
            result = deepClone(state.labels);
            break;
          case 'db-get-classification-rules':
            result = deepClone(state.classificationRules);
            break;
          case 'db-get-metadata':
            result = deepClone(state.metadata);
            break;
          case 'db-get-realtime-state':
            result = deepClone(state.realtimeState);
            break;
          case 'db-get-recurring-items':
            result = deepClone(state.recurringItems);
            break;
          case 'db-get-alert-events':
            result = deepClone(state.alertEvents);
            break;
          case 'db-get-settlements':
            result = deepClone(state.settlements);
            break;
          case 'db-get-settlement-events':
            result = deepClone(state.settlementEvents);
            break;
          case 'db-get-report-exports':
            result = deepClone(state.reportExports);
            break;
          case 'db-get-tax-rules':
            result = deepClone(state.taxRules);
            break;
          case 'app-open-zip':
            result = mockWindow.__mockBackupZip
              ? {
                  canceled: false,
                  filePath: mockWindow.__mockBackupZip.filePath,
                  dataBase64: mockWindow.__mockBackupZip.dataBase64
                }
              : { canceled: true };
            break;
          case 'app-save-zip': {
            const filePath = firstArg?.defaultPath || 'mock-backup.zip';
            mockWindow.__mockBackupZip = {
              filePath,
              dataBase64: firstArg?.dataBase64 || ''
            };
            result = { canceled: false, filePath };
            break;
          }
          case 'window:minimize':
          case 'window:close':
            result = true;
            break;
          case 'window:toggleMaximize':
            window.__mockWindowMaximized = !window.__mockWindowMaximized;
            result = Boolean(window.__mockWindowMaximized);
            break;
          case 'window:isMaximized':
            result = Boolean(window.__mockWindowMaximized);
            break;
          default:
            result = null;
        }

        applyMutationSideEffects(channel);
        persistState();
        return deepClone(result);
      },
      on: (channel, handler) => {
        const list = listeners.get(channel) || [];
        list.push(handler);
        listeners.set(channel, list);
        return () => {
          const current = listeners.get(channel) || [];
          listeners.set(channel, current.filter((entry) => entry !== handler));
        };
      },
      off: (channel, handler) => {
        const current = listeners.get(channel) || [];
        listeners.set(channel, current.filter((entry) => entry !== handler));
      },
      windowControl: {
        minimize: async () => true,
        toggleMaximize: async () => {
          window.__mockWindowMaximized = !window.__mockWindowMaximized;
          return Boolean(window.__mockWindowMaximized);
        },
        close: async () => true,
        isMaximized: async () => Boolean(window.__mockWindowMaximized)
      }
    };
  }, { today: TODAY, seed });
}

export async function gotoApp(page: Page, path = '/') {
  await page.goto(`/#${path === '/' ? '/' : path}`);
  await page.locator('.app-container').waitFor({ state: 'visible' });
}

export async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `
  });
}
