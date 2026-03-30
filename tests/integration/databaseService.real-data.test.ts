// @vitest-environment node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addGoalContribution,
  createAccount,
  createCategory,
  getAccounts,
  getAccountsWithBalance,
  getBudgets,
  getCategories,
  getDashboardOptimization,
  getGoals,
  getGoalContributions,
  getLoanPayments,
  getLoans,
  getTransactions,
  payLoan,
  replaceAllData,
  resetAllData,
  saveBudget,
  saveGoal,
  saveLoan,
  switchDatabase
} from '../../src/services/databaseService.js';

const viewerContext = {
  scopeType: 'module',
  scopeId: 'dashboard',
  subjectType: 'user',
  subjectId: 'local',
  requiredRole: 'Viewer'
} as const;

const createTempDbPath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-regression-'));
  return path.join(dir, 'finance.db');
};

describe('databaseService real data regression', () => {
  beforeEach(() => {
    switchDatabase(createTempDbPath());
  });

  it('keeps linked goal and loan transactions aligned with balances and dashboard analytics', () => {
    createCategory({
      id: 'cat_income_regression',
      name: 'Regression Income',
      type: 'income',
      color: '#10B981',
      icon: 'circle'
    });
    createCategory({
      id: 'cat_debt_regression',
      name: 'Regression Debt',
      type: 'expense',
      color: '#EF4444',
      icon: 'circle'
    });

    createAccount({
      id: 'acc_regression',
      name: 'Regression Checking',
      type: 'checking',
      currency: 'USD',
      initialBalance: 1000
    });

    saveGoal({
      id: 'goal_regression',
      name: 'Regression Goal',
      target_amount: 2000,
      current_amount: 500,
      target_date: '2026-12-31',
      linked_account_id: 'acc_regression',
      goal_type: 'standard',
      priority: 'high',
      funding_source: 'salary',
      risk_status: 'watch'
    });

    const goalResult = addGoalContribution({
      goalId: 'goal_regression',
      amount: 200,
      date: '2026-03-10',
      categoryId: 'cat_income_regression'
    });

    saveLoan({
      id: 'loan_regression',
      name: 'Regression Loan',
      lender: 'Regression Bank',
      principal_amount: 1200,
      current_balance: 900,
      interest_rate: 6,
      payment_amount: 150,
      payment_frequency: 'monthly',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      linked_account_id: 'acc_regression',
      notes: 'Integration test loan',
      next_due_date: '2026-04-01',
      due_status: 'due_soon'
    });

    const loanResult = payLoan({
      loanId: 'loan_regression',
      amount: 150,
      paidAt: '2026-03-11T10:00:00.000Z',
      categoryId: 'cat_debt_regression'
    });

    const account = getAccountsWithBalance().find((entry) => entry.id === 'acc_regression');
    const goal = getGoals().find((entry) => entry.id === 'goal_regression');
    const contributions = getGoalContributions();
    const payments = getLoanPayments({ loanId: 'loan_regression', limit: 10 });
    const analytics = getDashboardOptimization({ periodDays: 90, month: '2026-03' }, viewerContext);
    const transactions = getTransactions({});

    expect(goalResult.linkedTransaction).toBeTruthy();
    expect(loanResult.linkedTransaction).toBeTruthy();
    expect(account?.current_balance).toBeCloseTo(1050, 2);
    expect(goal?.current_amount).toBeCloseTo(700, 2);
    expect(contributions.some((entry) => entry.transaction_id === goalResult.linkedTransaction?.id)).toBe(true);
    expect(payments).toHaveLength(1);
    expect(getLoans().find((entry) => entry.id === 'loan_regression')?.current_balance).toBeCloseTo(750, 2);
    expect(transactions.some((entry) => String(entry.merchant).includes('Regression Goal'))).toBe(true);
    expect(transactions.some((entry) => String(entry.merchant).includes('Regression Loan'))).toBe(true);
    expect(analytics.stats.totalSpend).toBeCloseTo(150, 2);
    expect(analytics.stats.debtLoad).toBeCloseTo(750, 2);
    expect(analytics.goalProgress.find((entry) => entry.goalId === 'goal_regression')?.currentAmount).toBeCloseTo(700, 2);
  });

  it('restores a backup payload after reset without losing custom entities', () => {
    createCategory({
      id: 'cat_restore_income',
      name: 'Restore Income',
      type: 'income',
      color: '#14B8A6',
      icon: 'circle'
    });
    createAccount({
      id: 'acc_restore',
      name: 'Restore Wallet',
      type: 'cash',
      currency: 'USD',
      initialBalance: 300
    });
    saveBudget({
      id: 'budget_restore',
      category_id: 'cat_restore_income',
      period: 'monthly',
      limit_amount: 500
    });
    saveGoal({
      id: 'goal_restore',
      name: 'Restore Goal',
      target_amount: 1200,
      current_amount: 250,
      target_date: '2026-11-30',
      linked_account_id: 'acc_restore',
      goal_type: 'standard',
      priority: 'medium',
      funding_source: 'surplus',
      risk_status: 'normal'
    });
    addGoalContribution({
      goalId: 'goal_restore',
      amount: 125,
      date: '2026-03-20',
      categoryId: 'cat_restore_income'
    });

    const payload = {
      accounts: getAccounts().filter((entry) => entry.id === 'acc_restore'),
      categories: getCategories().filter((entry) => entry.id === 'cat_restore_income'),
      transactions: getTransactions({}).filter(
        (entry) =>
          entry.account_id === 'acc_restore' ||
          String(entry.merchant).includes('Restore Goal')
      ),
      budgets: getBudgets().filter((entry) => entry.id === 'budget_restore'),
      goals: getGoals().filter((entry) => entry.id === 'goal_restore'),
      goal_contributions: getGoalContributions().filter((entry) => entry.goal_id === 'goal_restore')
    };

    resetAllData();

    expect(getAccounts().some((entry) => entry.id === 'acc_restore')).toBe(false);
    expect(getGoals().some((entry) => entry.id === 'goal_restore')).toBe(false);

    replaceAllData(payload);

    expect(getAccounts().some((entry) => entry.id === 'acc_restore')).toBe(true);
    expect(getBudgets().some((entry) => entry.id === 'budget_restore')).toBe(true);
    expect(getGoals().find((entry) => entry.id === 'goal_restore')?.current_amount).toBeCloseTo(375, 2);
    expect(getTransactions({}).some((entry) => String(entry.merchant).includes('Restore Goal'))).toBe(true);
    expect(
      getDashboardOptimization({ periodDays: 90, month: '2026-03' }, viewerContext).goalProgress.some(
        (entry) => entry.goalId === 'goal_restore'
      )
    ).toBe(true);
  });
});
