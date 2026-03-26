type PermissionRole = 'Viewer' | 'Editor' | 'Owner';

type PermissionContext = {
  scopeType: 'module' | 'global';
  scopeId: string;
  subjectType: 'user';
  subjectId: string;
  requiredRole: PermissionRole;
};

type PermissionCheckResult = {
  allowed: boolean;
  actualRole?: PermissionRole;
  requiredRole?: PermissionRole;
};

const getSubjectId = () => localStorage.getItem('authUserId') || 'local';

const permissionContext = (scopeId: string, requiredRole: PermissionRole): PermissionContext => ({
  scopeType: 'module',
  scopeId,
  subjectType: 'user',
  subjectId: getSubjectId(),
  requiredRole
});

const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  if (!window.electron?.invoke) {
    throw new Error('Electron API is not available.');
  }
  return window.electron.invoke(channel, ...args) as Promise<T>;
};

const viewerContext = (scopeId: string) => permissionContext(scopeId, 'Viewer');
const editorContext = (scopeId: string) => permissionContext(scopeId, 'Editor');

const invokeWithContext = <T>(channel: string, scopeId: string, role: PermissionRole, ...args: unknown[]) =>
  invoke<T>(channel, ...args, permissionContext(scopeId, role));

export const ipcClient = {
  auth: {
    storeCredential: (userId: string, secret: string) => invoke('auth-store-credential', userId, secret),
    verifyCredential: (userId: string, secret: string) => invoke<{ ok: boolean }>('auth-verify-credential', userId, secret),
    clearCredential: (userId: string) => invoke<{ ok: boolean }>('auth-clear-credential', userId)
  },

  permission: {
    async check(scopeId: string, requiredRole: PermissionRole = 'Viewer'): Promise<PermissionCheckResult> {
      try {
        return await invoke<PermissionCheckResult>('db-check-permission', permissionContext(scopeId, requiredRole));
      } catch {
        return { allowed: true, actualRole: 'Owner', requiredRole };
      }
    }
  },

  app: {
    openZip: () => invoke<{ canceled?: boolean; filePath?: string; dataBase64?: string }>('app-open-zip'),
    saveZip: (payload: { defaultPath: string; dataBase64: string }) =>
      invoke<{ canceled?: boolean; filePath?: string }>('app-save-zip', payload)
  },

  reports: {
    getAll: () => invoke('db-get-reports', viewerContext('reports')),
    generate: (month: string) => invokeWithContext('db-generate-report', 'reports', 'Editor', month),
    exportCsv: (month: string) => invokeWithContext<string>('db-export-report-csv', 'reports', 'Editor', month),
    exportPdf: (month: string) => invokeWithContext<string>('db-export-report-pdf-content', 'reports', 'Editor', month)
  },

  settlement: {
    getByMonth: (month: string) => invoke('db-get-settlement-by-month', month, viewerContext('settlement')),
    finalize: (month: string, notes: string) =>
      invokeWithContext('db-finalize-settlement', 'settlement', 'Editor', month, notes),
    reopen: (month: string, reason: string) =>
      invokeWithContext('db-reopen-settlement', 'settlement', 'Editor', month, reason)
  },

  sharing: {
    getReports: () => invoke('db-get-reports', viewerContext('reports')),
    listSnapshots: () => invoke('db-list-share-snapshots', {}, viewerContext('sharing')),
    getPermissions: () => invoke('db-get-permissions'),
    createSnapshot: (payload: Record<string, unknown>) =>
      invoke('db-create-share-snapshot', {
        ...payload,
        subjectType: 'user',
        subjectId: getSubjectId(),
        scopeType: 'module',
        scopeId: 'sharing'
      }),
    revokeSnapshot: (id: string) => invokeWithContext('db-revoke-share-snapshot', 'sharing', 'Editor', id),
    exportSnapshot: (id: string) => invokeWithContext('db-export-share-snapshot', 'sharing', 'Editor', id),
    savePermission: (permission: Record<string, unknown>) =>
      invoke('db-save-permission', permission, editorContext('permissions')),
    deletePermission: (id: string) => invoke('db-delete-permission', id, editorContext('permissions'))
  },

  dashboard: {
    getOptimization: (periodDays = 90) =>
      invoke('db-get-dashboard-optimization', { periodDays }, viewerContext('dashboard'))
  },

  accounts: {
    getWithBalance: () => invoke('db-get-accounts-with-balance'),
    create: (payload: Record<string, unknown>) =>
      invoke('db-create-account', payload, editorContext('accounts')),
    update: (payload: Record<string, unknown>) =>
      invoke('db-update-account', payload, editorContext('accounts')),
    delete: (id: string) =>
      invoke('db-delete-account', id, editorContext('accounts'))
  },

  scenarios: {
    getLoans: () => invoke('db-get-loans'),
    getGoals: () => invoke('db-get-goals'),
    getScenarios: () => invoke('db-get-scenarios'),
    getDashboardStats: () => invoke('db-get-dashboard-stats'),
    saveScenario: (payload: Record<string, unknown>) => invoke('db-save-scenario', payload, editorContext('scenarios')),
    deleteScenario: (id: string) => invoke('db-delete-scenario', id, editorContext('scenarios'))
  },

  importExport: {
    getSchemaStatus: () => invoke('db-get-schema-status'),
    markV2BackupComplete: (meta: Record<string, unknown>) => invoke('db-mark-v2-backup-complete', meta, editorContext('import_export')),
    completeV2Upgrade: () => invoke('db-complete-v2-upgrade', editorContext('import_export')),
    resetAll: () => invoke('db-reset-all', editorContext('import_export')),
    replaceAll: (payload: Record<string, unknown>) => invoke('db-replace-all', payload, editorContext('import_export')),
    getAccounts: () => invoke('db-get-accounts'),
    getCategories: () => invoke('db-get-categories'),
    getSubcategories: () => invoke('db-get-subcategories'),
    getTags: () => invoke('db-get-tags'),
    getLabels: () => invoke('db-get-labels'),
    getClassificationRules: () => invoke('db-get-classification-rules'),
    getTransactions: (filter: Record<string, unknown> = {}) => invoke('db-get-transactions', filter),
    getBudgets: () => invoke('db-get-budgets'),
    getGoals: () => invoke('db-get-goals'),
    getGoalContributions: () => invoke('db-get-goal-contributions'),
    getBills: () => invoke('db-get-bills'),
    getLoans: () => invoke('db-get-loans'),
    getLoanPayments: (filter: Record<string, unknown> = {}) => invoke('db-get-loan-payments', filter),
    getMetadata: (filter: Record<string, unknown> = {}) => invoke('db-get-metadata', filter),
    getRealtimeState: (filter: Record<string, unknown> = {}) => invoke('db-get-realtime-state', filter),
    getPlans: () => invoke('db-get-plans'),
    getRecurringItems: () => invoke('db-get-recurring-items'),
    getScenarios: () => invoke('db-get-scenarios'),
    getAlerts: (filter: Record<string, unknown> = {}) => invoke('db-get-alerts', filter),
    getAlertEvents: (filter: Record<string, unknown> = {}) => invoke('db-get-alert-events', filter),
    getSettlements: () => invoke('db-get-settlements'),
    getSettlementEvents: (filter: Record<string, unknown> = {}) => invoke('db-get-settlement-events', filter),
    getReports: () => invoke('db-get-reports'),
    getReportExports: (filter: Record<string, unknown> = {}) => invoke('db-get-report-exports', filter),
    getPermissions: () => invoke('db-get-permissions'),
    listShareSnapshots: (filter: Record<string, unknown> = {}) => invoke('db-list-share-snapshots', filter),
    getTaxRules: () => invoke('db-get-tax-rules'),
    getAppSettings: () => invoke('db-get-app-settings'),
    addTransaction: (payload: Record<string, unknown>) => invoke('db-add-transaction', payload, editorContext('transactions')),
    updateTransaction: (payload: Record<string, unknown>) => invoke('db-update-transaction', payload, editorContext('transactions')),
    saveLoan: (payload: Record<string, unknown>) => invoke('db-save-loan', payload, editorContext('loans')),
    saveBill: (payload: Record<string, unknown>) => invoke('db-save-bill', payload, editorContext('bills'))
  }
};
