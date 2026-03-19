import * as dbService from '../services/databaseService.js';

const register = (ipcMainInstance, channel, handler) => {
  ipcMainInstance.handle(channel, async (_event, ...args) => {
    try {
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

  // Accounts
  on('db-get-accounts', () => dbService.getAccounts());
  on('db-get-accounts-with-balance', () => dbService.getAccountsWithBalance());
  on('db-create-account', (account) => dbService.createAccount(account));
  on('db-update-account', (account) => dbService.updateAccount(account));
  on('db-delete-account', (id) => dbService.deleteAccount(id));

  // Transactions
  on('db-get-transactions', (filter) => dbService.getTransactions(filter || {}));
  on('db-add-transaction', (tx) => dbService.addTransaction(tx));
  on('db-update-transaction', (tx) => dbService.updateTransaction(tx));
  on('db-delete-transaction', (id) => dbService.deleteTransaction(id));

  // Dashboard
  on('db-get-dashboard-stats', () => dbService.getDashboardStats());

  // Categories
  on('db-get-categories', () => dbService.getCategories());
  on('db-create-category', (cat) => dbService.createCategory(cat));
  on('db-delete-category', (id, reassignmentCategoryId = null) => dbService.deleteCategory(id, reassignmentCategoryId));

  // Classification layer
  on('db-get-subcategories', (categoryId) => dbService.getSubcategoriesList(categoryId));
  on('db-save-subcategory', (subcategory) => dbService.saveSubcategory(subcategory));
  on('db-delete-subcategory', (id) => dbService.deleteSubcategoryById(id));

  on('db-get-tags', () => dbService.getTagsList());
  on('db-save-tag', (tag) => dbService.saveTag(tag));
  on('db-delete-tag', (id) => dbService.deleteTagById(id));

  on('db-get-labels', () => dbService.getLabelsList());
  on('db-save-label', (label) => dbService.saveLabel(label));
  on('db-delete-label', (id) => dbService.deleteLabelById(id));

  on('db-get-classification-rules', () => dbService.getClassificationRulesList());
  on('db-save-classification-rule', (rule) => dbService.saveClassificationRule(rule));
  on('db-delete-classification-rule', (id) => dbService.deleteClassificationRuleById(id));

  // Recurring
  on('db-get-recurring-items', (filter) => dbService.getRecurringItems(filter || {}));
  on('db-save-recurring-item', (item) => dbService.saveRecurringItem(item));
  on('db-delete-recurring-item', (id) => dbService.deleteRecurringItem(id));

  // Budgets
  on('db-get-budgets', () => dbService.getBudgets());
  on('db-save-budget', (budget) => dbService.saveBudget(budget));
  on('db-delete-budget', (id) => dbService.deleteBudget(id));

  // Goals
  on('db-get-goals', () => dbService.getGoals());
  on('db-get-goal-contributions', () => dbService.getGoalContributions());
  on('db-save-goal', (goal) => dbService.saveGoal(goal));
  on('db-update-goal', (goal) => dbService.saveGoal(goal));
  on('db-delete-goal', (id) => dbService.deleteGoal(id));

  // Bills
  on('db-get-bills', () => dbService.getBills());
  on('db-save-bill', (bill) => dbService.saveBill(bill));
  on('db-delete-bill', (id) => dbService.deleteBill(id));

  // Loans
  on('db-get-loans', () => dbService.getLoans());
  on('db-save-loan', (loan) => dbService.saveLoan(loan));
  on('db-delete-loan', (id) => dbService.deleteLoan(id));

  // Plans
  on('db-get-plans', () => dbService.getPlans());
  on('db-save-plan', (plan) => dbService.savePlan(plan));
  on('db-delete-plan', (id) => dbService.deletePlan(id));

  // Alerts
  on('db-get-alerts', (filter, context) => dbService.getAlertsList(filter || {}, context || {}));
  on('db-set-alert-status', (id, status, options, context) => dbService.setAlertStatus(id, status, options || {}, context || {}));
  on('db-get-alert-summary', (context) => dbService.getAlertSummary(context || {}));
  on('db-get-alert-events', (filter, context) => dbService.getAlertEvents(filter || {}, context || {}));
  on('db-get-system-state', (month, context) => dbService.getSystemState(month, context || {}));

  // Settlement / Reports
  on('db-get-settlements', (context) => dbService.getMonthlySettlements(context || {}));
  on('db-get-settlement-by-month', (month, context) => dbService.getMonthlySettlementByMonth(month, context || {}));
  on('db-finalize-settlement', (month, notes, context) => dbService.finalizeMonthlySettlement(month, notes, context || {}));
  on('db-reopen-settlement', (month, reason, context) => dbService.reopenMonthlySettlement(month, reason, context || {}));
  on('db-get-settlement-events', (filter, context) => dbService.getSettlementEvents(filter || {}, context || {}));

  on('db-get-reports', (context) => dbService.getReports(context || {}));
  on('db-get-report-by-month', (month, context) => dbService.getReportByMonth(month, context || {}));
  on('db-generate-report', (month, context) => dbService.generateReport(month, context || {}));
  on('db-export-report-csv', (month, context) => dbService.exportReportCsv(month, context || {}));
  on('db-export-report-pdf-content', (month, context) => dbService.exportReportPdfContent(month, context || {}));
  on('db-get-report-exports', (filter, context) => dbService.getReportExports(filter || {}, context || {}));

  // Scenarios
  on('db-get-scenarios', () => dbService.getScenariosList());
  on('db-get-scenario', (id) => dbService.getScenarioDetails(id));
  on('db-run-scenario', (input) => dbService.runScenarioSimulation(input));
  on('db-save-scenario', (scenario) => dbService.saveScenarioModel(scenario));
  on('db-delete-scenario', (id) => dbService.deleteScenarioModel(id));

  // Permissions
  on('db-get-permissions', (filter) => dbService.getPermissionsList(filter || {}));
  on('db-save-permission', (permission) => dbService.savePermissionEntry(permission));
  on('db-delete-permission', (id) => dbService.deletePermissionEntry(id));
  on('db-check-permission', (context) => dbService.checkPermissionEntry(context || {}));

  // Share snapshots
  on('db-create-share-snapshot', (input) => dbService.createShareSnapshotEntry(input));
  on('db-list-share-snapshots', (filter, context) => dbService.listShareSnapshotsEntries(filter || {}, context || {}));
  on('db-revoke-share-snapshot', (id, context) => dbService.revokeShareSnapshotEntry(id, context || {}));
  on('db-export-share-snapshot', (id, context) => dbService.exportShareSnapshotEntry(id, context || {}));

  // Tax rules / App settings
  on('db-get-tax-rules', () => dbService.getTaxRules());
  on('db-get-app-settings', () => dbService.getAppSettings());
  on('db-set-app-setting', (key, value) => dbService.setAppSetting(key, value));

  // Schema version / upgrade
  on('db-get-schema-status', () => dbService.getSchemaStatus());
  on('db-mark-v2-backup-complete', (meta) => dbService.markV2BackupCompleted(meta || {}));
  on('db-complete-v2-upgrade', () => dbService.completeV2Upgrade());

  // Backup / Restore
  on('db-reset-all', () => dbService.resetAllData());
  on('db-restore-all', (payload) => dbService.restoreAllData(payload));
}
