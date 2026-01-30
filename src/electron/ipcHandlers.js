import { ipcMain } from 'electron';
import * as dbService from '../services/databaseService.js';

export function registerIpcHandlers() {
  // Accounts
  ipcMain.handle('db-get-accounts', () => dbService.getAccounts());
  ipcMain.handle('db-create-account', (e, account) => dbService.createAccount(account));
  ipcMain.handle('db-update-account', (e, account) => dbService.updateAccount(account));
  ipcMain.handle('db-delete-account', (e, id) => dbService.deleteAccount(id));

  // Transactions
  ipcMain.handle('db-get-transactions', (e, filter) => dbService.getTransactions(filter));
  ipcMain.handle('db-add-transaction', (e, tx) => dbService.addTransaction(tx));
  ipcMain.handle('db-delete-transaction', (e, id) => dbService.deleteTransaction(id));

  // Dashboard
  ipcMain.handle('db-get-dashboard-stats', () => dbService.getDashboardStats());

  // Categories
  ipcMain.handle('db-get-categories', () => dbService.getCategories());
  ipcMain.handle('db-create-category', (e, cat) => dbService.createCategory(cat));
  ipcMain.handle('db-delete-category', (e, id) => dbService.deleteCategory(id));

  // Budgets
  ipcMain.handle('db-get-budgets', () => dbService.getBudgets());
  ipcMain.handle('db-save-budget', (e, budget) => dbService.saveBudget(budget));
  ipcMain.handle('db-delete-budget', (e, id) => dbService.deleteBudget(id));

  // Goals
  ipcMain.handle('db-get-goals', () => dbService.getGoals());
  ipcMain.handle('db-save-goal', (e, goal) => dbService.saveGoal(goal));
  ipcMain.handle('db-delete-goal', (e, id) => dbService.deleteGoal(id));

  // Bills
  ipcMain.handle('db-get-bills', () => dbService.getBills());
  ipcMain.handle('db-save-bill', (e, bill) => dbService.saveBill(bill));
  ipcMain.handle('db-delete-bill', (e, id) => dbService.deleteBill(id));
}

