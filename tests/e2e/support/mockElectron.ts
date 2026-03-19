import type { Page } from '@playwright/test';

export type MockSeed = {
  activeUserId?: string | null;
  users?: Array<{ id: string; name: string; activeProfileId?: string; profiles?: Array<{ id: string; name: string; isLab?: boolean; created_at?: string }>; avatar?: string | null }>;
  categories?: Array<{ id: string; name: string; type: 'income' | 'expense'; color?: string }>;
  accounts?: Array<{ id: string; name: string; type?: string; initial_balance?: number }>;
  transactions?: Array<{ id: string; amount: number; date: string; merchant: string; notes?: string; category_id?: string | null; account_id: string; to_account_id?: string | null; type: 'income' | 'expense' | 'transfer'; tags?: string[] }>;
  alerts?: Array<{ id: string; source_type: string; source_id: string; trigger_type: string; condition_text: string; severity: 'info' | 'warning' | 'critical'; message: string; recommended_action: string; status: 'active' | 'acknowledged' | 'snoozed' | 'resolved'; created_at?: string }>;
  settlements?: Array<{ id: string; month: string; status: 'in_review' | 'finalized'; is_dirty?: number; unresolved_count?: number; notes?: string; reconciled_at?: string | null; checklist?: { unresolvedCount?: number; items?: Array<{ key: string; label: string; done: boolean; meta?: Record<string, unknown> }> } }>;
  reports?: Array<{ id: string; month: string; generated_at: string; snapshot_data?: Record<string, unknown> }>;
  snapshots?: Array<{ id: string; report_id: string; snapshot_name: string; status: 'active' | 'revoked'; integrity_hash: string; created_at?: string }>;
  permissions?: Array<{ id: string; scope_type: string; scope_id: string; role: 'Owner' | 'Editor' | 'Viewer'; subject_type: string; subject_id: string; visibility?: string }>;
  appSettings?: Array<{ key: string; value: string }>;
  localStorage?: Record<string, string>;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const DEFAULT_SEED: Required<Omit<MockSeed, 'localStorage'>> & { localStorage: Record<string, string> } = {
  activeUserId: 'user-e2e-1',
  users: [{ id: 'user-e2e-1', name: 'Regression User', activeProfileId: 'profile-default', profiles: [{ id: 'profile-default', name: 'Default Profile', created_at: '2026-03-14T00:00:00.000Z' }] }],
  categories: [
    { id: 'cat-expense', name: 'General Expense', type: 'expense', color: '#EF4444' },
    { id: 'cat-income', name: 'General Income', type: 'income', color: '#10B981' }
  ],
  accounts: [
    { id: 'acc-checking', name: 'Checking', type: 'checking', initial_balance: 1500 },
    { id: 'acc-savings', name: 'Savings', type: 'savings', initial_balance: 3200 }
  ],
  transactions: [{ id: 'tx-seed-1', amount: 180, date: '2026-03-05', merchant: 'Seed Grocery', notes: 'Seeded transaction', category_id: 'cat-expense', account_id: 'acc-checking', type: 'expense', tags: ['seed'] }],
  alerts: [],
  settlements: [],
  reports: [],
  snapshots: [],
  permissions: [],
  appSettings: [{ key: 'app_language', value: 'en' }],
  localStorage: {}
};

const withDefaults = (seed: MockSeed): MockSeed => ({
  ...DEFAULT_SEED,
  ...seed,
  users: seed.users ?? DEFAULT_SEED.users,
  categories: seed.categories ?? DEFAULT_SEED.categories,
  accounts: seed.accounts ?? DEFAULT_SEED.accounts,
  transactions: seed.transactions ?? DEFAULT_SEED.transactions,
  alerts: seed.alerts ?? DEFAULT_SEED.alerts,
  settlements: seed.settlements ?? DEFAULT_SEED.settlements,
  reports: seed.reports ?? DEFAULT_SEED.reports,
  snapshots: seed.snapshots ?? DEFAULT_SEED.snapshots,
  permissions: seed.permissions ?? DEFAULT_SEED.permissions,
  appSettings: seed.appSettings ?? DEFAULT_SEED.appSettings,
  localStorage: seed.localStorage ?? DEFAULT_SEED.localStorage
});

export const installMockElectron = async (page: Page, seed: MockSeed = {}) => {
  const merged = withDefaults(seed);

  await page.addInitScript((injectedSeed: MockSeed) => {
    const nowIso = () => new Date().toISOString();
    const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
    const toMonth = (value: unknown) => String(value ?? '').slice(0, 7);
    const num = (value: unknown, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const roleRank: Record<string, number> = { Viewer: 1, Editor: 2, Owner: 3 };

    const users = (injectedSeed.users || []).map((user) => {
      const profiles = (user.profiles && user.profiles.length > 0)
        ? clone(user.profiles)
        : [{ id: `${user.id}-profile-default`, name: 'Default Profile', created_at: nowIso() }];
      return { ...clone(user), profiles, activeProfileId: user.activeProfileId || profiles[0]?.id };
    });

    const store = {
      activeUserId: injectedSeed.activeUserId || users[0]?.id || null,
      users,
      categories: clone(injectedSeed.categories || []),
      accounts: (injectedSeed.accounts || []).map((a) => ({ id: a.id, name: a.name, type: a.type || 'checking', initial_balance: num(a.initial_balance, 0) })),
      transactions: (injectedSeed.transactions || []).map((tx) => ({ ...clone(tx), amount: num(tx.amount), notes: tx.notes || '', tags: Array.isArray(tx.tags) ? [...tx.tags] : [] })),
      alerts: (injectedSeed.alerts || []).map((a) => ({ ...clone(a), created_at: a.created_at || nowIso() })),
      settlementsByMonth: Object.fromEntries((injectedSeed.settlements || []).map((s) => [s.month, clone(s)])),
      reports: (injectedSeed.reports || []).map((r) => clone(r)),
      snapshots: (injectedSeed.snapshots || []).map((s) => ({ ...clone(s), created_at: s.created_at || nowIso() })),
      permissions: (injectedSeed.permissions || []).map((p) => ({ ...clone(p), visibility: p.visibility || 'private' })),
      appSettings: (injectedSeed.appSettings || []).map((s) => clone(s)),
      windowMaximized: false
    };

    for (const [k, v] of Object.entries(injectedSeed.localStorage || {})) {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, String(v));
    }
    if (store.activeUserId && !localStorage.getItem('authUserId')) localStorage.setItem('authUserId', store.activeUserId);

    const findAccount = (id?: string | null) => store.accounts.find((a) => a.id === id);
    const findCategory = (id?: string | null) => store.categories.find((c) => c.id === id);

    const accountBalances = () => {
      const map = new Map<string, number>();
      for (const a of store.accounts) map.set(a.id, num(a.initial_balance));
      for (const tx of store.transactions) {
        const amount = num(tx.amount);
        if (tx.type === 'income') map.set(tx.account_id, num(map.get(tx.account_id)) + amount);
        if (tx.type === 'expense') map.set(tx.account_id, num(map.get(tx.account_id)) - amount);
        if (tx.type === 'transfer') {
          map.set(tx.account_id, num(map.get(tx.account_id)) - amount);
          if (tx.to_account_id) map.set(tx.to_account_id, num(map.get(tx.to_account_id)) + amount);
        }
      }
      return store.accounts.map((a) => ({ ...a, current_balance: num(map.get(a.id), num(a.initial_balance)) }));
    };

    const decorateTransaction = (tx: Record<string, unknown>) => {
      const cat = findCategory(String(tx.category_id || ''));
      const from = findAccount(String(tx.account_id || ''));
      const to = findAccount(String(tx.to_account_id || ''));
      return {
        ...tx,
        notes: tx.notes || '',
        tags: Array.isArray(tx.tags) ? tx.tags : [],
        account_name: from?.name || 'Unknown Account',
        to_account_name: to?.name || '',
        category_name: cat?.name || (tx.type === 'transfer' ? 'Transfer' : 'Uncategorized'),
        category_color: cat?.color || '#9CA3AF'
      };
    };

    const buildChecklist = (month: string) => {
      const txCount = store.transactions.filter((tx) => toMonth(tx.date) === month).length;
      const unresolved = store.alerts.filter((a) => ['active', 'acknowledged', 'snoozed'].includes(a.status) && toMonth(a.created_at) === month).length;
      return {
        unresolvedCount: unresolved,
        items: [
          { key: 'transactions_collected', label: 'Transactions captured', done: txCount > 0, meta: { txCount } },
          { key: 'alerts_reviewed', label: 'Active alerts reviewed', done: unresolved === 0, meta: { unresolved } },
          { key: 'balances_reconciled', label: 'Balances reconciled', done: true, meta: {} }
        ]
      };
    };

    const ensureSettlement = (month: string) => {
      if (!store.settlementsByMonth[month]) {
        const checklist = buildChecklist(month);
        store.settlementsByMonth[month] = {
          id: `settlement-${month}`,
          month,
          status: 'in_review',
          is_dirty: 1,
          unresolved_count: checklist.unresolvedCount,
          notes: '',
          checklist
        };
      }
      return store.settlementsByMonth[month];
    };

    const getSystemState = (month: string) => {
      const settlement = store.settlementsByMonth[month] || null;
      const report = store.reports.find((r) => r.month === month) || null;
      const alerts = { active: 0, acknowledged: 0, snoozed: 0, resolved: 0 };
      for (const alert of store.alerts) {
        if (alerts[alert.status as keyof typeof alerts] !== undefined) alerts[alert.status as keyof typeof alerts] += 1;
      }
      return {
        month,
        settlement: settlement ? { status: settlement.status, isDirty: Boolean(settlement.is_dirty), unresolvedCount: settlement.unresolved_count || 0 } : null,
        report: { status: report ? 'ready' : 'missing', generatedAt: report?.generated_at || null },
        alerts
      };
    };

    const dashboardStats = () => {
      const balances = accountBalances();
      const totalBalance = balances.reduce((sum, a) => sum + num(a.current_balance), 0);
      const totalIncome = store.transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + num(tx.amount), 0);
      const totalExpense = store.transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + num(tx.amount), 0);
      const grouped = new Map<string, { income: number; expense: number }>();
      for (const tx of store.transactions) {
        const row = grouped.get(tx.date) || { income: 0, expense: 0 };
        if (tx.type === 'income') row.income += num(tx.amount);
        if (tx.type === 'expense') row.expense += num(tx.amount);
        grouped.set(tx.date, row);
      }
      const chartData = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([date, values]) => ({ date, ...values }));
      return { totalBalance, totalIncome, totalExpense, chartData, activeAlerts: store.alerts.filter((a) => a.status === 'active').length };
    };

    const checkPermission = (payload: Record<string, string>) => {
      const requiredRole = payload.requiredRole || 'Viewer';
      const scopeType = payload.scopeType || payload.scope_type;
      const scopeId = payload.scopeId || payload.scope_id;
      const subjectType = payload.subjectType || payload.subject_type;
      const subjectId = payload.subjectId || payload.subject_id;
      const matching = store.permissions.filter((p) => p.scope_type === scopeType && p.scope_id === scopeId && p.subject_type === subjectType && p.subject_id === subjectId);
      if (matching.length === 0) return { allowed: true, reason: 'default-allow' };
      const allowed = matching.some((m) => num(roleRank[m.role], 0) >= num(roleRank[requiredRole], 1));
      return { allowed, reason: allowed ? 'matched-role' : 'insufficient-role', matchedRole: matching[0]?.role || null };
    };

    const refreshSettlementFromDate = (iso: unknown) => {
      const month = toMonth(iso);
      const settlement = store.settlementsByMonth[month];
      if (!settlement) return;
      const checklist = buildChecklist(month);
      settlement.is_dirty = 1;
      settlement.checklist = checklist;
      settlement.unresolved_count = checklist.unresolvedCount;
      if (settlement.status === 'finalized') settlement.status = 'in_review';
      store.reports = store.reports.filter((r) => r.month !== month);
    };

    const invoke = async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'db-get-app-settings': return store.appSettings;
        case 'db-set-app-setting': {
          const key = String(args[0] || '');
          const value = String(args[1] || '');
          const found = store.appSettings.find((s) => s.key === key);
          if (found) found.value = value;
          else store.appSettings.push({ key, value });
          return { ok: true };
        }
        case 'user-get-all': return { activeUserId: store.activeUserId, users: clone(store.users) };
        case 'user-set-active': {
          const id = String(args[0] || '');
          if (!store.users.some((u) => u.id === id)) throw new Error(`User ${id} not found.`);
          store.activeUserId = id;
          localStorage.setItem('authUserId', id);
          return { activeUserId: id, users: clone(store.users) };
        }
        case 'user-create': {
          const name = String(args[0] || '').trim();
          if (!name) throw new Error('User name is required.');
          const id = `user-${Math.random().toString(16).slice(2, 10)}`;
          const profileId = `${id}-profile-default`;
          const user = { id, name, activeProfileId: profileId, profiles: [{ id: profileId, name: 'Default Profile', created_at: nowIso() }] };
          store.users.push(user);
          if (!store.activeUserId) {
            store.activeUserId = id;
            localStorage.setItem('authUserId', id);
          }
          return { activeUserId: store.activeUserId, users: clone(store.users) };
        }
        case 'user-update-avatar': {
          const userId = String(args[0] || '');
          const avatar = String(args[1] || '');
          const user = store.users.find((u) => u.id === userId);
          if (!user) throw new Error('User not found.');
          user.avatar = avatar;
          return { activeUserId: store.activeUserId, users: clone(store.users) };
        }
        case 'db-get-dashboard-stats': return dashboardStats();
        case 'db-get-categories': return clone(store.categories);
        case 'db-create-category': {
          const payload = clone(args[0] || {});
          store.categories.push({ id: payload.id || `cat-${Math.random().toString(16).slice(2, 10)}`, name: payload.name || 'Category', type: payload.type || 'expense', color: payload.color || '#9CA3AF' });
          return { ok: true };
        }
        case 'db-delete-category': {
          const categoryId = String(args[0] || '');
          if (store.transactions.some((tx) => tx.category_id === categoryId)) throw new Error('Category is in use by transactions. Reassign before deletion.');
          store.categories = store.categories.filter((c) => c.id !== categoryId);
          return { ok: true };
        }
        case 'db-get-accounts': return accountBalances().map(({ id, name, type }) => ({ id, name, type }));
        case 'db-get-accounts-with-balance': return accountBalances();
        case 'db-create-account': {
          const payload = clone(args[0] || {});
          store.accounts.push({ id: payload.id || `acc-${Math.random().toString(16).slice(2, 10)}`, name: payload.name || 'Account', type: payload.type || 'checking', initial_balance: num(payload.initialBalance ?? payload.initial_balance, 0) });
          return { ok: true };
        }
        case 'db-update-account': {
          const payload = clone(args[0] || {});
          const acc = store.accounts.find((a) => a.id === payload.id);
          if (!acc) throw new Error('Account not found.');
          acc.name = payload.name || acc.name;
          acc.type = payload.type || acc.type;
          acc.initial_balance = num(payload.initialBalance ?? payload.initial_balance, acc.initial_balance);
          return { ok: true };
        }
        case 'db-delete-account': {
          const id = String(args[0] || '');
          store.accounts = store.accounts.filter((a) => a.id !== id);
          store.transactions = store.transactions.filter((tx) => tx.account_id !== id && tx.to_account_id !== id);
          return { ok: true };
        }
        case 'db-get-transactions':
          return store.transactions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((tx) => decorateTransaction(tx));
        case 'db-add-transaction': {
          const payload = clone(args[0] || {});
          const dupe = store.transactions.find((tx) => tx.id === payload.id);
          if (dupe) return decorateTransaction(dupe);
          const tx = {
            id: payload.id || `tx-${Math.random().toString(16).slice(2, 10)}`,
            amount: num(payload.amount),
            date: payload.date || new Date().toISOString().slice(0, 10),
            merchant: payload.merchant || 'Unnamed',
            notes: payload.notes || '',
            category_id: payload.category || payload.category_id || null,
            account_id: payload.accountId || payload.account_id,
            to_account_id: payload.toAccountId || payload.to_account_id || null,
            type: payload.type || 'expense',
            tags: Array.isArray(payload.tags) ? payload.tags : (typeof payload.tags === 'string' ? (JSON.parse(payload.tags || '[]') as string[]) : [])
          };
          store.transactions.push(tx);
          refreshSettlementFromDate(tx.date);
          return decorateTransaction(tx);
        }
        case 'db-update-transaction': {
          const payload = clone(args[0] || {});
          const tx = store.transactions.find((row) => row.id === payload.id);
          if (!tx) throw new Error('Transaction not found.');
          tx.amount = num(payload.amount, tx.amount);
          tx.date = payload.date || tx.date;
          tx.merchant = payload.merchant || tx.merchant;
          tx.notes = payload.notes || tx.notes;
          tx.category_id = payload.category || payload.category_id || tx.category_id;
          tx.account_id = payload.accountId || payload.account_id || tx.account_id;
          tx.to_account_id = payload.toAccountId || payload.to_account_id || tx.to_account_id;
          tx.type = payload.type || tx.type;
          if (Array.isArray(payload.tags)) tx.tags = payload.tags;
          else if (typeof payload.tags === 'string') tx.tags = JSON.parse(payload.tags || '[]');
          refreshSettlementFromDate(tx.date);
          return decorateTransaction(tx);
        }
        case 'db-delete-transaction': {
          const id = String(args[0] || '');
          const target = store.transactions.find((tx) => tx.id === id);
          store.transactions = store.transactions.filter((tx) => tx.id !== id);
          refreshSettlementFromDate(target?.date);
          return { ok: true };
        }
        case 'db-get-alerts': {
          const filter = clone(args[0] || {});
          return store.alerts.filter((a) => {
            if (filter.includeResolved !== true && a.status === 'resolved') return false;
            if (filter.status && filter.status !== a.status) return false;
            if (filter.severity && filter.severity !== a.severity) return false;
            return true;
          });
        }
        case 'db-set-alert-status': {
          const id = String(args[0] || '');
          const status = String(args[1] || 'active');
          const alert = store.alerts.find((a) => a.id === id);
          if (!alert) throw new Error(`Alert ${id} not found.`);
          alert.status = status as 'active' | 'acknowledged' | 'snoozed' | 'resolved';
          return clone(alert);
        }
        case 'db-get-settlement-by-month': return clone(store.settlementsByMonth[String(args[0] || new Date().toISOString().slice(0, 7))] || null);
        case 'db-finalize-settlement': {
          const month = String(args[0] || new Date().toISOString().slice(0, 7));
          const notes = String(args[1] || '');
          const s = ensureSettlement(month);
          const checklist = buildChecklist(month);
          s.checklist = checklist;
          s.unresolved_count = checklist.unresolvedCount;
          if (s.unresolved_count > 0) throw new Error('Cannot finalize month with unresolved active alerts.');
          s.status = 'finalized';
          s.is_dirty = 0;
          s.reconciled_at = nowIso();
          s.notes = notes || s.notes || '';
          return { settlement: clone(s) };
        }
        case 'db-reopen-settlement': {
          const month = String(args[0] || new Date().toISOString().slice(0, 7));
          const reason = String(args[1] || 'Reopened from UI');
          const s = ensureSettlement(month);
          s.status = 'in_review';
          s.is_dirty = 1;
          s.notes = reason;
          s.checklist = buildChecklist(month);
          s.unresolved_count = s.checklist.unresolvedCount || 0;
          return clone(s);
        }
        case 'db-get-system-state': return getSystemState(String(args[0] || new Date().toISOString().slice(0, 7)));
        case 'db-get-reports': return store.reports.slice().sort((a, b) => String(b.month).localeCompare(String(a.month))).map((r) => clone(r));
        case 'db-generate-report': {
          const month = String(args[0] || new Date().toISOString().slice(0, 7));
          const settlement = ensureSettlement(month);
          if (settlement.status !== 'finalized') throw new Error('Cannot generate report from a non-finalized month.');
          const monthTx = store.transactions.filter((tx) => toMonth(tx.date) === month);
          const income = monthTx.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + num(tx.amount), 0);
          const expense = monthTx.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + num(tx.amount), 0);
          const report = { id: `report-${month}`, month, generated_at: nowIso(), snapshot_data: { cashFlow: { income, expense, net: income - expense }, actualVsBudget: [], goalProgress: [], loanStatus: [], tagBreakdown: [], labelBreakdown: [], riskNotes: ['Snapshot generated from finalized month.'] } };
          const idx = store.reports.findIndex((r) => r.month === month);
          if (idx >= 0) store.reports[idx] = report;
          else store.reports.push(report);
          return clone(report);
        }
        case 'db-export-report-csv': {
          const month = String(args[0] || '');
          const report = store.reports.find((r) => r.month === month);
          if (!report) throw new Error(`Report ${month} not found.`);
          const cash = (report.snapshot_data as Record<string, any>)?.cashFlow || {};
          return `month,income,expense,net\n${month},${num(cash.income)},${num(cash.expense)},${num(cash.net)}`;
        }
        case 'db-export-report-pdf-content': {
          const month = String(args[0] || '');
          const report = store.reports.find((r) => r.month === month);
          if (!report) throw new Error(`Report ${month} not found.`);
          return `Stock Tracker Monthly Report\nMonth: ${month}\nGenerated: ${report.generated_at}`;
        }
        case 'db-check-permission': return checkPermission(clone(args[0] || {}));
        case 'db-list-share-snapshots': return clone(store.snapshots);
        case 'db-create-share-snapshot': {
          const payload = clone(args[0] || {});
          const permission = checkPermission({
            scopeType: payload.scopeType || payload.scope_type || 'module',
            scopeId: payload.scopeId || payload.scope_id || 'sharing',
            subjectType: payload.subjectType || payload.subject_type || 'user',
            subjectId: payload.subjectId || payload.subject_id || localStorage.getItem('authUserId') || 'local',
            requiredRole: 'Editor'
          });
          if (!permission.allowed) throw new Error('Permission denied: insufficient role for sharing.');
          const reportId = String(payload.reportId || payload.report_id || '');
          if (!store.reports.some((r) => r.id === reportId)) throw new Error('Report not found for snapshot.');
          const snapshot = { id: payload.id || `snapshot-${Math.random().toString(16).slice(2, 10)}`, report_id: reportId, snapshot_name: payload.snapshot_name || payload.snapshotName || 'Share Snapshot', status: 'active', integrity_hash: `hash-${Math.random().toString(16).slice(2, 10)}`, created_at: nowIso() };
          store.snapshots.unshift(snapshot);
          return clone(snapshot);
        }
        case 'db-revoke-share-snapshot': {
          const id = String(args[0] || '');
          const snapshot = store.snapshots.find((s) => s.id === id);
          if (!snapshot) throw new Error('Snapshot not found.');
          snapshot.status = 'revoked';
          return clone(snapshot);
        }
        case 'db-export-share-snapshot': {
          const id = String(args[0] || '');
          const snapshot = store.snapshots.find((s) => s.id === id);
          if (!snapshot) throw new Error('Snapshot not found.');
          const report = store.reports.find((r) => r.id === snapshot.report_id) || null;
          return { fileName: `${snapshot.snapshot_name.replace(/\s+/g, '_').toLowerCase() || id}.json`, packageJson: JSON.stringify({ snapshot, report, exported_at: nowIso() }, null, 2) };
        }
        case 'db-get-permissions': return clone(store.permissions);
        case 'db-save-permission': {
          const payload = clone(args[0] || {});
          const entry = { id: payload.id || `perm-${Math.random().toString(16).slice(2, 10)}`, scope_type: payload.scope_type, scope_id: payload.scope_id, role: payload.role || 'Viewer', subject_type: payload.subject_type || 'user', subject_id: payload.subject_id || localStorage.getItem('authUserId') || 'local', visibility: payload.visibility || 'private' };
          const idx = store.permissions.findIndex((p) => p.id === entry.id);
          if (idx >= 0) store.permissions[idx] = entry;
          else store.permissions.unshift(entry);
          return clone(entry);
        }
        case 'db-delete-permission': {
          const id = String(args[0] || '');
          store.permissions = store.permissions.filter((p) => p.id !== id);
          return { ok: true };
        }
        case 'window:minimize': return undefined;
        case 'window:toggleMaximize': store.windowMaximized = !store.windowMaximized; return store.windowMaximized;
        case 'window:isMaximized': return store.windowMaximized;
        case 'window:close': return undefined;
        default: return [];
      }
    };

    Object.defineProperty(window, 'electron', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {
        invoke,
        on: () => () => undefined,
        off: () => undefined,
        windowControl: {
          minimize: () => invoke('window:minimize'),
          toggleMaximize: () => invoke('window:toggleMaximize'),
          close: () => invoke('window:close'),
          isMaximized: () => invoke('window:isMaximized')
        }
      }
    });
  }, merged);
};

export const defaultMockSeed = (): MockSeed => clone(DEFAULT_SEED);
