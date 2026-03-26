import * as dbService from '../services/databaseService.js';

const PERMISSION_CONTEXT_KEYS = [
  'scopeType',
  'scopeId',
  'subjectType',
  'subjectId',
  'requiredRole',
  'scope_type',
  'scope_id',
  'subject_type',
  'subject_id'
];

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const hasPermissionContextShape = (value) => {
  if (!isObject(value)) return false;
  return PERMISSION_CONTEXT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
};

const toPermissionContext = (args, defaults = {}) => {
  const maybeContext = args.length > 0 ? args[args.length - 1] : null;
  const context = hasPermissionContextShape(maybeContext) ? maybeContext : {};
  return {
    scopeType: context.scopeType || context.scope_type || defaults.scopeType || 'module',
    scopeId: context.scopeId || context.scope_id || defaults.scopeId || 'global',
    subjectType: context.subjectType || context.subject_type || defaults.subjectType || 'user',
    subjectId: context.subjectId || context.subject_id || defaults.subjectId || 'local',
    requiredRole: context.requiredRole || defaults.requiredRole || 'Editor'
  };
};

const assertMutationPermission = (args, defaults) => {
  const permission = dbService.checkPermissionEntry(toPermissionContext(args, defaults));
  if (permission?.allowed === false) {
    throw new Error(`Permission denied. Required ${permission.requiredRole}, current role is ${permission.actualRole}.`);
  }
};

const register = (ipcMainInstance, channel, handler, options = {}) => {
  ipcMainInstance.handle(channel, async (_event, ...args) => {
    try {
      if (options.mutation === true) {
        assertMutationPermission(args, {
          scopeType: 'module',
          scopeId: options.scopeId || 'global',
          requiredRole: options.requiredRole || 'Editor'
        });
      }
      return await handler(...args);
    } catch (error) {
      console.error(`[IPC:${channel}]`, error);
      throw error;
    }
  });
};

export function registerIpcHandlers(ipcMainInstance) {
  if (!ipcMainInstance) {
    throw new Error('ipcMain instance is required to register handlers.');
  }

  const on = (channel, handler) => register(ipcMainInstance, channel, handler);
  const onMutation = (channel, scopeId, handler) =>
    register(ipcMainInstance, channel, handler, { mutation: true, scopeId, requiredRole: 'Editor' });

  // Accounts
  on('db-get-accounts', () => dbService.getAccounts());
  on('db-get-accounts-with-balance', () => dbService.getAccountsWithBalance());
  onMutation('db-create-account', 'accounts', (account) => dbService.createAccount(account));
  onMutation('db-update-account', 'accounts', (account) => dbService.updateAccount(account));
  onMutation('db-delete-account', 'accounts', (id) => dbService.deleteAccount(id));

  // Transactions
  on('db-get-transactions', (filter) => dbService.getTransactions(filter || {}));
  onMutation('db-add-transaction', 'transactions', (tx) => dbService.addTransaction(tx));
  onMutation('db-update-transaction', 'transactions', (tx) => dbService.updateTransaction(tx));
  onMutation('db-delete-transaction', 'transactions', (id) => dbService.deleteTransaction(id));

  // Dashboard
  on('db-get-dashboard-stats', () => dbService.getDashboardStats());
  on('db-get-dashboard-optimization', (options, context) =>
    dbService.getDashboardOptimization(options || {}, context || {})
  );

  // Categories
  on('db-get-categories', () => dbService.getCategories());
  onMutation('db-create-category', 'categories', (cat) => dbService.createCategory(cat));
  onMutation('db-delete-category', 'categories', (id, reassignmentCategoryId = null) => dbService.deleteCategory(id, reassignmentCategoryId));

  // Classification layer
  on('db-get-subcategories', (categoryId) => dbService.getSubcategoriesList(categoryId));
  onMutation('db-save-subcategory', 'classification', (subcategory) => dbService.saveSubcategory(subcategory));
  onMutation('db-delete-subcategory', 'classification', (id) => dbService.deleteSubcategoryById(id));

  on('db-get-tags', () => dbService.getTagsList());
  onMutation('db-save-tag', 'classification', (tag) => dbService.saveTag(tag));
  onMutation('db-delete-tag', 'classification', (id) => dbService.deleteTagById(id));

  on('db-get-labels', () => dbService.getLabelsList());
  onMutation('db-save-label', 'classification', (label) => dbService.saveLabel(label));
  onMutation('db-delete-label', 'classification', (id) => dbService.deleteLabelById(id));

  on('db-get-classification-rules', () => dbService.getClassificationRulesList());
  onMutation('db-save-classification-rule', 'classification', (rule) => dbService.saveClassificationRule(rule));
  onMutation('db-delete-classification-rule', 'classification', (id) => dbService.deleteClassificationRuleById(id));

  // Recurring
  on('db-get-recurring-items', (filter) => dbService.getRecurringItems(filter || {}));
  onMutation('db-save-recurring-item', 'plans', (item) => dbService.saveRecurringItem(item));
  onMutation('db-delete-recurring-item', 'plans', (id) => dbService.deleteRecurringItem(id));

  // Budgets
  on('db-get-budgets', () => dbService.getBudgets());
  onMutation('db-save-budget', 'budget', (budget) => dbService.saveBudget(budget));
  onMutation('db-delete-budget', 'budget', (id) => dbService.deleteBudget(id));

  // Goals
  on('db-get-goals', () => dbService.getGoals());
  on('db-get-goal-contributions', () => dbService.getGoalContributions());
  onMutation('db-add-goal-contribution', 'goals', (input) => dbService.addGoalContribution(input || {}));
  onMutation('db-save-goal', 'goals', (goal) => dbService.saveGoal(goal));
  onMutation('db-update-goal', 'goals', (goal) => dbService.saveGoal(goal));
  onMutation('db-delete-goal', 'goals', (id) => dbService.deleteGoal(id));

  // Bills
  on('db-get-bills', () => dbService.getBills());
  onMutation('db-save-bill', 'bills', (bill) => dbService.saveBill(bill));
  onMutation('db-delete-bill', 'bills', (id) => dbService.deleteBill(id));

  // Loans
  on('db-get-loans', () => dbService.getLoans());
  on('db-get-loan-payments', (filter) => dbService.getLoanPayments(filter || {}));
  on('db-get-loan-payment-stats', () => dbService.getLoanPaymentStats());
  onMutation('db-pay-loan', 'loans', (payload) => dbService.payLoan(payload || {}));
  onMutation('db-save-loan', 'loans', (loan) => dbService.saveLoan(loan));
  onMutation('db-delete-loan', 'loans', (id) => dbService.deleteLoan(id));

  // Plans
  on('db-get-plans', () => dbService.getPlans());
  onMutation('db-save-plan', 'plans', (plan) => dbService.savePlan(plan));
  onMutation('db-delete-plan', 'plans', (id) => dbService.deletePlan(id));

  // Alerts
  on('db-get-alerts', (filter, context) => dbService.getAlertsList(filter || {}, context || {}));
  onMutation('db-set-alert-status', 'alerts', (id, status, options, context) => dbService.setAlertStatus(id, status, options || {}, context || {}));
  on('db-get-alert-summary', (context) => dbService.getAlertSummary(context || {}));
  on('db-get-alert-events', (filter, context) => dbService.getAlertEvents(filter || {}, context || {}));
  on('db-get-cash-collision-forecast', (options, context) => dbService.getCashCollisionForecast(options || {}, context || {}));
  on('db-get-system-state', (month, context) => dbService.getSystemState(month, context || {}));

  // Settlement / Reports
  on('db-get-settlements', (context) => dbService.getMonthlySettlements(context || {}));
  on('db-get-settlement-by-month', (month, context) => dbService.getMonthlySettlementByMonth(month, context || {}));
  onMutation('db-finalize-settlement', 'settlement', (month, notes, context) => dbService.finalizeMonthlySettlement(month, notes, context || {}));
  onMutation('db-reopen-settlement', 'settlement', (month, reason, context) => dbService.reopenMonthlySettlement(month, reason, context || {}));
  on('db-get-settlement-events', (filter, context) => dbService.getSettlementEvents(filter || {}, context || {}));

  on('db-get-reports', (context) => dbService.getReports(context || {}));
  on('db-get-report-by-month', (month, context) => dbService.getReportByMonth(month, context || {}));
  onMutation('db-generate-report', 'reports', (month, context) => dbService.generateReport(month, context || {}));
  on('db-export-report-csv', (month, context) => dbService.exportReportCsv(month, context || {}));
  on('db-export-report-pdf-content', (month, context) => dbService.exportReportPdfContent(month, context || {}));
  on('db-get-report-exports', (filter, context) => dbService.getReportExports(filter || {}, context || {}));

  // Scenarios
  on('db-get-scenarios', () => dbService.getScenariosList());
  on('db-get-scenario', (id) => dbService.getScenarioDetails(id));
  on('db-run-scenario', (input) => dbService.runScenarioSimulation(input));
  onMutation('db-save-scenario', 'scenarios', (scenario) => dbService.saveScenarioModel(scenario));
  onMutation('db-delete-scenario', 'scenarios', (id) => dbService.deleteScenarioModel(id));

  // Permissions
  on('db-get-permissions', (filter) => dbService.getPermissionsList(filter || {}));
  onMutation('db-save-permission', 'permissions', (permission) => dbService.savePermissionEntry(permission));
  onMutation('db-delete-permission', 'permissions', (id) => dbService.deletePermissionEntry(id));
  on('db-check-permission', (context) => dbService.checkPermissionEntry(context || {}));

  // Share snapshots
  onMutation('db-create-share-snapshot', 'sharing', (input) => dbService.createShareSnapshotEntry(input));
  on('db-list-share-snapshots', (filter, context) => dbService.listShareSnapshotsEntries(filter || {}, context || {}));
  onMutation('db-revoke-share-snapshot', 'sharing', (id, context) => dbService.revokeShareSnapshotEntry(id, context || {}));
  on('db-export-share-snapshot', (id, context) => dbService.exportShareSnapshotEntry(id, context || {}));

  // Tax rules / App settings
  on('db-get-tax-rules', () => dbService.getTaxRules());
  on('db-get-app-settings', () => dbService.getAppSettings());
  onMutation('db-set-app-setting', 'settings', (key, value) => dbService.setAppSetting(key, value));
  on('db-get-metadata', (filter) => dbService.getMetadata(filter || {}));
  onMutation('db-set-metadata', 'settings', (payload) => dbService.setMetadata(payload || {}));
  onMutation('db-delete-metadata', 'settings', (payload) => dbService.deleteMetadata(payload || {}));
  on('db-get-realtime-state', (filter) => dbService.getRealtimeState(filter || {}));
  onMutation('db-set-realtime-state', 'settings', (payload) => dbService.setRealtimeState(payload || {}));
  onMutation('db-refresh-realtime-state', 'settings', () => dbService.refreshRealtimeState());
  onMutation('db-optimize-database', 'settings', (options) => dbService.optimizeDatabase(options || {}));

  // Schema version / upgrade
  on('db-get-schema-status', () => dbService.getSchemaStatus());
  onMutation('db-mark-v2-backup-complete', 'import_export', (meta) => dbService.markV2BackupCompleted(meta || {}));
  onMutation('db-complete-v2-upgrade', 'import_export', () => dbService.completeV2Upgrade());

  // Backup / Restore
  onMutation('db-reset-all', 'import_export', () => dbService.resetAllData());
  onMutation('db-restore-all', 'import_export', (payload) => dbService.restoreAllData(payload));
  onMutation('db-replace-all', 'import_export', (payload) => dbService.replaceAllData(payload));
}
