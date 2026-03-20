import type { Page } from '@playwright/test';

export async function installElectronMock(page: Page) {
  await page.addInitScript(() => {
    type User = { id: string; name: string; created_at: string };
    type Account = {
      id: string;
      name: string;
      type: string;
      currency: string;
      initial_balance: number;
      current_balance: number;
    };
    type Category = { id: string; name: string; type: string; color: string; icon: string };
    type WindowWithMocks = Window & {
      electron?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
        off: (channel: string, callback: (...args: unknown[]) => void) => void;
        windowControl: {
          minimize: () => Promise<boolean>;
          toggleMaximize: () => Promise<boolean>;
          close: () => Promise<boolean>;
          isMaximized: () => Promise<boolean>;
        };
      };
    };

    const nowIso = new Date().toISOString();
    const currentMonth = nowIso.slice(0, 7);

    const state = {
      users: [
        { id: 'user_demo', name: 'Demo User', created_at: nowIso } as User
      ],
      activeUserId: 'user_demo',
      appSettings: [{ key: 'language', value: 'en' }],
      accounts: [
        {
          id: 'acc_checking',
          name: 'Checking',
          type: 'checking',
          currency: 'USD',
          initial_balance: 2100,
          current_balance: 2450
        },
        {
          id: 'acc_savings',
          name: 'Savings',
          type: 'savings',
          currency: 'USD',
          initial_balance: 5200,
          current_balance: 5400
        }
      ] as Account[],
      categories: [
        { id: 'cat_salary', name: 'Salary', type: 'income', color: '#10B981', icon: 'money-bill' },
        { id: 'cat_food', name: 'Food & Dining', type: 'expense', color: '#EF4444', icon: 'utensils' },
        { id: 'cat_transport', name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'bus' }
      ] as Category[],
      transactions: [
        {
          id: 'tx_1',
          account_id: 'acc_checking',
          to_account_id: null,
          category_id: 'cat_salary',
          type: 'income',
          amount: 3200,
          date: `${currentMonth}-01`,
          merchant: 'Payroll',
          notes: 'Monthly salary',
          tags: ['income'],
          labels: []
        },
        {
          id: 'tx_2',
          account_id: 'acc_checking',
          to_account_id: null,
          category_id: 'cat_food',
          type: 'expense',
          amount: 62,
          date: `${currentMonth}-03`,
          merchant: 'Market',
          notes: 'Groceries',
          tags: ['home'],
          labels: ['verified']
        },
        {
          id: 'tx_3',
          account_id: 'acc_checking',
          to_account_id: null,
          category_id: 'cat_transport',
          type: 'expense',
          amount: 18,
          date: `${currentMonth}-06`,
          merchant: 'Taxi',
          notes: '',
          tags: ['ride'],
          labels: []
        }
      ],
      budgets: [
        { id: 'budget_food', category_id: 'cat_food', period: 'monthly', limit_amount: 400, spent: 210, category_name: 'Food & Dining' }
      ],
      goals: [
        { id: 'goal_1', name: 'Emergency Fund', target_amount: 10000, current_amount: 2600, target_date: '2027-12-31', priority: 'high' }
      ],
      goalContributions: [
        { id: 'gc_1', goal_id: 'goal_1', transaction_id: 'tx_1', amount: 300, date: `${currentMonth}-02` }
      ],
      bills: [
        { id: 'bill_1', name: 'Internet', amount: 45, next_due_date: `${currentMonth}-20`, recurrence: 'monthly', is_paid: 0, auto_pay: 1 }
      ],
      loans: [
        {
          id: 'loan_1',
          name: 'Car Loan',
          principal_amount: 18000,
          current_balance: 12500,
          interest_rate: 4.9,
          payment_amount: 320,
          payment_frequency: 'monthly',
          start_date: '2025-01-01',
          end_date: '2030-01-01',
          lender: 'City Bank',
          notes: 'Auto loan',
          due_status: 'upcoming'
        }
      ],
      loanPaymentStats: [
        { loan_id: 'loan_1', payment_count: 12, total_paid: 3840, last_paid_at: `${currentMonth}-01`, last_amount: 320 }
      ],
      plans: [
        {
          id: 'plan_1',
          item_type: 'goal',
          item_id: 'goal_1',
          title: 'Boost goal contribution',
          scenario_if: 'Save 10% extra',
          scenario_else: 'Keep baseline',
          what_if: 'Cut takeout by 20%',
          outcome: 'Goal ETA improves by 3 months',
          months_overdue: 0
        }
      ],
      scenarios: [
        {
          id: 'scenario_1',
          title: 'Baseline Forecast',
          assumptions_json: '{}',
          result_snapshot_json: JSON.stringify({
            summary: { finalBalance: 12000, riskLevel: 'low' }
          }),
          risk_level: 'low'
        }
      ],
      alerts: [
        {
          id: 'alert_1',
          source_type: 'budget',
          source_id: 'budget_food',
          trigger_type: 'budget-pressure',
          condition_text: 'Food budget crossed 75%',
          severity: 'warning',
          message: 'Food budget is getting tight',
          status: 'active'
        }
      ],
      reports: [],
      settlements: []
    };

    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    const emit = (channel: string, ...args: unknown[]) => {
      const set = listeners.get(channel);
      if (!set) return;
      for (const listener of set) listener(...args);
    };

    const findAccount = (id: string) => state.accounts.find((acc) => acc.id === id);

    const mockedWindow = window as WindowWithMocks;
    mockedWindow.alert = () => undefined;
    mockedWindow.confirm = () => true;

    mockedWindow.electron = {
      invoke: async (channel: string, ...args: unknown[]) => {
        switch (channel) {
          case 'user-get-all':
            return { users: state.users, activeUserId: state.activeUserId };
          case 'user-set-active': {
            const nextId = String(args[0] || '');
            if (nextId && state.users.some((user) => user.id === nextId)) {
              state.activeUserId = nextId;
            }
            return true;
          }
          case 'user-create': {
            const id = `user_${Math.random().toString(36).slice(2, 8)}`;
            const name = String(args[0] || 'New User').trim() || 'New User';
            state.users.push({ id, name, created_at: new Date().toISOString() });
            state.activeUserId = id;
            return { id, name };
          }
          case 'db-get-app-settings':
            return state.appSettings;
          case 'db-set-app-setting': {
            const [key, value] = args;
            const existing = state.appSettings.find((entry) => entry.key === key);
            if (existing) existing.value = String(value);
            else state.appSettings.push({ key: String(key), value: String(value) });
            return { key, value };
          }
          case 'db-get-system-state':
            return {
              month: String(args[0] || currentMonth),
              settlement: { status: 'in_review', isDirty: true, unresolvedCount: 1 },
              report: { status: 'missing', generatedAt: null },
              alerts: { active: 1, acknowledged: 0, snoozed: 0, resolved: 0 }
            };
          case 'db-get-dashboard-stats':
            return {
              totalBalance: 7850,
              totalIncome: 3200,
              totalExpense: 900,
              activeAlerts: 1,
              chartData: [
                { date: `${currentMonth}-01`, income: 3200, expense: 0 },
                { date: `${currentMonth}-03`, income: 0, expense: 62 },
                { date: `${currentMonth}-06`, income: 0, expense: 18 }
              ]
            };
          case 'db-get-accounts':
          case 'db-get-accounts-with-balance':
            return state.accounts;
          case 'db-create-account': {
            const payload = args[0] || {};
            const created = {
              id: String(payload.id || `acc_${Math.random().toString(36).slice(2, 8)}`),
              name: String(payload.name || 'Account'),
              type: String(payload.type || 'checking'),
              currency: String(payload.currency || 'USD'),
              initial_balance: Number(payload.initialBalance || payload.initial_balance || 0),
              current_balance: Number(payload.initialBalance || payload.initial_balance || 0)
            };
            state.accounts.push(created);
            emit('finance:data-changed');
            return created;
          }
          case 'db-update-account': {
            const payload = args[0] || {};
            const account = findAccount(String(payload.id || ''));
            if (!account) return null;
            account.name = String(payload.name || account.name);
            account.type = String(payload.type || account.type);
            account.currency = String(payload.currency || account.currency);
            account.initial_balance = Number(payload.initialBalance ?? account.initial_balance);
            account.current_balance = Number(payload.initialBalance ?? account.current_balance);
            emit('finance:data-changed');
            return account;
          }
          case 'db-delete-account': {
            const id = String(args[0] || '');
            const idx = state.accounts.findIndex((account) => account.id === id);
            if (idx >= 0) state.accounts.splice(idx, 1);
            emit('finance:data-changed');
            return true;
          }
          case 'db-get-categories':
            return state.categories;
          case 'db-get-transactions':
            return state.transactions;
          case 'db-add-transaction':
          case 'db-update-transaction':
          case 'db-delete-transaction':
            emit('finance:data-changed');
            return true;
          case 'db-get-budgets':
            return state.budgets;
          case 'db-save-budget':
          case 'db-delete-budget':
            emit('finance:data-changed');
            return true;
          case 'db-get-goals':
            return state.goals;
          case 'db-get-goal-contributions':
            return state.goalContributions;
          case 'db-save-goal':
          case 'db-update-goal':
          case 'db-delete-goal':
            emit('finance:data-changed');
            return true;
          case 'db-get-bills':
            return state.bills;
          case 'db-save-bill':
          case 'db-delete-bill':
            emit('finance:data-changed');
            return true;
          case 'db-get-loans':
            return state.loans;
          case 'db-get-loan-payment-stats':
            return state.loanPaymentStats;
          case 'db-pay-loan': {
            emit('finance:data-changed');
            return { loan: state.loans[0], payment: { id: `pay_${Date.now()}` } };
          }
          case 'db-save-loan':
          case 'db-delete-loan':
            emit('finance:data-changed');
            return true;
          case 'db-get-plans':
            return state.plans;
          case 'db-save-plan':
          case 'db-delete-plan':
            emit('finance:data-changed');
            return true;
          case 'db-get-scenarios':
            return state.scenarios.map((scenario) => ({
              ...scenario,
              assumptions: {},
              result_snapshot: scenario.result_snapshot_json ? JSON.parse(scenario.result_snapshot_json) : null
            }));
          case 'db-save-scenario':
            emit('finance:data-changed');
            return true;
          case 'db-delete-scenario':
            emit('finance:data-changed');
            return true;
          case 'db-get-alerts':
            return state.alerts;
          case 'db-set-alert-status':
            emit('finance:data-changed');
            return true;
          case 'db-get-cash-collision-forecast':
            return {
              asOf: nowIso,
              horizonDays: 30,
              startBalance: 7850,
              projectedEndBalance: 6900,
              baselineDailyIncome: 48,
              expectedIncome: 1450,
              expectedDebits: 2400,
              collisions: [
                {
                  date: `${currentMonth}-25`,
                  daysAway: 8,
                  projectedBalance: -120,
                  deficit: 120,
                  severity: 'warning',
                  drivers: [
                    { sourceType: 'bill', sourceId: 'bill_1', name: 'Internet', amount: 45 }
                  ]
                }
              ]
            };
          case 'db-get-settlement-by-month':
            return {
              id: `settlement_${String(args[0] || currentMonth)}`,
              month: String(args[0] || currentMonth),
              status: 'in_review',
              unresolved_count: 0,
              checklist: { items: [] }
            };
          case 'db-get-settlements':
            return state.settlements;
          case 'db-finalize-settlement':
          case 'db-reopen-settlement':
            emit('finance:data-changed');
            return { settlement: null, report: null };
          case 'db-get-reports':
            return state.reports;
          case 'db-generate-report':
          case 'db-export-report-csv':
          case 'db-export-report-pdf-content':
            return '';
          case 'db-check-permission':
            return { allowed: true, actualRole: 'Owner', requiredRole: 'Viewer' };
          case 'db-list-share-snapshots':
          case 'db-get-permissions':
          case 'db-get-report-exports':
          case 'db-get-alert-events':
          case 'db-get-settlement-events':
          case 'db-get-tax-rules':
          case 'db-get-subcategories':
          case 'db-get-tags':
          case 'db-get-labels':
          case 'db-get-classification-rules':
          case 'db-get-recurring-items':
          case 'db-get-loan-payments':
          case 'db-get-metadata':
          case 'db-get-realtime-state':
            return [];
          case 'db-reset-all':
          case 'db-restore-all':
          case 'db-mark-v2-backup-complete':
          case 'db-complete-v2-upgrade':
          case 'db-optimize':
          case 'app-open-zip':
          case 'app-save-zip':
            return { ok: true };
          default:
            if (channel.startsWith('db-get-')) return [];
            return true;
        }
      },
      on: (channel: string, callback: (...args: unknown[]) => void) => {
        if (!listeners.has(channel)) listeners.set(channel, new Set());
        listeners.get(channel)?.add(callback);
        return () => {
          listeners.get(channel)?.delete(callback);
        };
      },
      off: (channel: string, callback: (...args: unknown[]) => void) => {
        listeners.get(channel)?.delete(callback);
      },
      windowControl: {
        minimize: async () => true,
        toggleMaximize: async () => false,
        close: async () => true,
        isMaximized: async () => false
      }
    };
  });
}
