// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, beforeEach, afterAll } from 'vitest';

import * as dbService from '../../src/services/databaseService.js';

const tempDirs: string[] = [];

const createTempDbPath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-db-harsh-'));
  tempDirs.push(dir);
  return path.join(dir, 'finance.sqlite');
};

const makeDate = (offsetDays: number) => {
  const base = new Date('2026-01-01T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
};

type CategoryRow = { id: string; type: string };
type IdRow = { id: string };
type TransactionTagRow = { id?: string };
type TransactionRow = {
  id: string;
  account_id?: string | null;
  to_account_id?: string | null;
  tags?: TransactionTagRow[];
};
type GoalRow = { id: string; linked_account_id?: string | null };
type GoalContributionRow = { goal_id?: string; transaction_id?: string | null };
type LoanRow = { id: string; current_balance: number | string };
type LoanPaymentRow = { balance_after: number | string };
type LoanPaymentStatRow = { loan_id: string; payment_count: number | string; total_paid: number | string };
type AlertSourceRow = { source_id: string };

beforeEach(() => {
  dbService.switchDatabase(createTempDbPath());
});

afterAll(() => {
  const sinkPath = path.join(os.tmpdir(), `finance-db-harsh-sink-${Date.now()}.sqlite`);
  dbService.switchDatabase(sinkPath);

  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Database Harsh Scenarios', () => {
  test('deletes account and preserves referential integrity across dependent data', () => {
    const expenseCategory = (dbService.getCategories() as CategoryRow[]).find((c) => c.type === 'expense');
    expect(expenseCategory).toBeTruthy();

    dbService.createAccount({
      id: 'acc_a',
      name: 'Primary',
      type: 'checking',
      currency: 'USD',
      initialBalance: 1500
    });
    dbService.createAccount({
      id: 'acc_b',
      name: 'Reserve',
      type: 'savings',
      currency: 'USD',
      initialBalance: 500
    });

    dbService.saveGoal({
      id: 'goal_a',
      name: 'Emergency Fund',
      target_amount: 6000,
      current_amount: 0,
      target_date: '2027-12-31',
      linked_account_id: 'acc_a'
    });

    dbService.saveRecurringItem({
      id: 'ri_a_1',
      name: 'Phone Bill',
      account_id: 'acc_a',
      category_id: expenseCategory.id,
      type: 'expense',
      amount: 40,
      start_date: '2026-01-01',
      next_due_date: '2026-01-10',
      frequency: 'monthly',
      status: 'active'
    });

    dbService.addTransaction({
      id: 'tx_income_a',
      account_id: 'acc_a',
      type: 'income',
      amount: 2200,
      date: '2026-01-05',
      merchant: 'Company Payroll',
      goal_id: 'goal_a'
    });

    dbService.addTransaction({
      id: 'tx_transfer_ab',
      account_id: 'acc_a',
      to_account_id: 'acc_b',
      type: 'transfer',
      amount: 200,
      date: '2026-01-06',
      merchant: 'Move Funds'
    });

    dbService.addTransaction({
      id: 'tx_transfer_ba',
      account_id: 'acc_b',
      to_account_id: 'acc_a',
      type: 'transfer',
      amount: 50,
      date: '2026-01-07',
      merchant: 'Return Funds'
    });

    dbService.addTransaction({
      id: 'tx_expense_b',
      account_id: 'acc_b',
      category_id: expenseCategory.id,
      type: 'expense',
      amount: 35,
      date: '2026-01-08',
      merchant: 'Groceries'
    });

    dbService.deleteAccount('acc_a');

    const accountIds = (dbService.getAccounts() as IdRow[]).map((a) => a.id);
    expect(accountIds).toContain('acc_b');
    expect(accountIds).not.toContain('acc_a');

    const transactions = dbService.getTransactions({}) as TransactionRow[];
    expect(transactions.some((tx) => tx.account_id === 'acc_a' || tx.to_account_id === 'acc_a')).toBe(false);
    expect(transactions.some((tx) => tx.id === 'tx_expense_b')).toBe(true);

    const recurringForDeletedAccount = dbService.getRecurringItems({ account_id: 'acc_a' });
    expect(recurringForDeletedAccount).toHaveLength(0);

    const goal = (dbService.getGoals() as GoalRow[]).find((g) => g.id === 'goal_a');
    expect(goal?.linked_account_id ?? null).toBeNull();

    const goalContributions = (dbService.getGoalContributions() as GoalContributionRow[]).filter((row) => row.goal_id === 'goal_a');
    expect(goalContributions).toHaveLength(0);
  });

  test(
    'survives high-churn transaction load with tags, labels, updates, deletes, and dedupe protection',
    { timeout: 60000 },
    () => {
      const expenseCategory = (dbService.getCategories() as CategoryRow[]).find((c) => c.type === 'expense');
      expect(expenseCategory).toBeTruthy();

      dbService.createAccount({
        id: 'acc_load_a',
        name: 'Ops A',
        type: 'checking',
        currency: 'USD',
        initialBalance: 3000
      });
      dbService.createAccount({
        id: 'acc_load_b',
        name: 'Ops B',
        type: 'checking',
        currency: 'USD',
        initialBalance: 3000
      });

      dbService.saveGoal({
        id: 'goal_stress',
        name: 'Stress Goal',
        target_amount: 10000,
        current_amount: 0,
        target_date: '2028-01-01'
      });

      dbService.saveTag({ id: 'tag_stress', name: 'stress-tag', color: '#334155' });
      dbService.saveLabel({ id: 'label_stress', name: 'stress-label', type: 'status', color: '#0f766e', locked_flag: 0 });

      for (let i = 0; i < 300; i += 1) {
        dbService.addTransaction({
          id: `tx_stress_${i}`,
          account_id: i % 2 === 0 ? 'acc_load_a' : 'acc_load_b',
          to_account_id: i % 10 === 0 ? (i % 2 === 0 ? 'acc_load_b' : 'acc_load_a') : null,
          category_id: expenseCategory.id,
          type: i % 6 === 0 ? 'income' : 'expense',
          amount: (i % 6 === 0 ? 450 : 25) + (i % 17),
          date: makeDate(i % 120),
          merchant: `merchant_${i % 19}`,
          notes: `batch_${Math.floor(i / 10)}`,
          goal_id: i % 9 === 0 ? 'goal_stress' : null,
          tagIds: i % 3 === 0 ? ['tag_stress'] : [],
          labelIds: i % 4 === 0 ? ['label_stress'] : []
        });
      }

      for (let i = 0; i < 60; i += 1) {
        dbService.updateTransaction({
          id: `tx_stress_${i}`,
          account_id: 'acc_load_a',
          category_id: expenseCategory.id,
          type: 'expense',
          amount: 80 + i,
          date: makeDate(130 + i),
          merchant: `updated_${i}`,
          notes: 'updated',
          tagIds: ['tag_stress'],
          labelIds: ['label_stress']
        });
      }

      for (let i = 0; i < 40; i += 1) {
        dbService.deleteTransaction(`tx_stress_${i}`);
      }

      const remaining = dbService.getTransactions({}) as TransactionRow[];
      expect(remaining).toHaveLength(260);
      expect(remaining.every((tx) => Array.isArray(tx.tags))).toBe(true);
      expect(
        remaining.some((tx) => (tx.tags || []).some((tag) => tag?.id === 'tag_stress'))
      ).toBe(true);

      const contributions = dbService.getGoalContributions() as GoalContributionRow[];
      const uniqueTransactionIds = new Set(contributions.map((row) => row.transaction_id).filter(Boolean));
      expect(uniqueTransactionIds.size).toBe(contributions.length);

      dbService.addTransaction({
        id: 'tx_dup_1',
        account_id: 'acc_load_a',
        category_id: expenseCategory.id,
        type: 'expense',
        amount: 77,
        date: '2026-06-10',
        merchant: 'dup-merchant',
        notes: 'dup-notes'
      });

      expect(() => {
        dbService.addTransaction({
          id: 'tx_dup_2',
          account_id: 'acc_load_a',
          category_id: expenseCategory.id,
          type: 'expense',
          amount: 77,
          date: '2026-06-10',
          merchant: 'dup-merchant',
          notes: 'dup-notes'
        });
      }).toThrow(/Duplicate transaction blocked/i);

      const stats = dbService.getDashboardStats();
      expect(Number.isFinite(Number(stats.totalBalance))).toBe(true);
      expect(Array.isArray(stats.chartData)).toBe(true);
    }
  );

  test(
    'handles heavy loan payments plus metadata and realtime state churn',
    { timeout: 60000 },
    () => {
      dbService.saveLoan({
        id: 'loan_harsh',
        name: 'Harsh Loan',
        principal_amount: 24000,
        current_balance: 24000,
        interest_rate: 6.4,
        payment_amount: 260,
        payment_frequency: 'monthly',
        start_date: '2026-01-01',
        end_date: '2032-01-01',
        lender: 'Bank A',
        notes: 'stress loan'
      });

      let paymentCount = 0;

      for (let i = 0; i < 260; i += 1) {
        const loan = (dbService.getLoans() as LoanRow[]).find((row) => row.id === 'loan_harsh');
        if (!loan || Number(loan.current_balance) <= 0) break;

        const amount = 120 + (i % 11) * 17;
        const result = dbService.payLoan({
          loanId: 'loan_harsh',
          amount,
          paidAt: makeDate(i),
          note: `payment_${i}`
        });

        if (result?.payment) {
          paymentCount += 1;
        }
      }

      expect(paymentCount).toBeGreaterThan(0);

      const loanAfter = (dbService.getLoans() as LoanRow[]).find((row) => row.id === 'loan_harsh');
      expect(loanAfter).toBeTruthy();
      expect(Number(loanAfter.current_balance)).toBeGreaterThanOrEqual(0);

      const payments = dbService.getLoanPayments({ loanId: 'loan_harsh', limit: 3000 }) as LoanPaymentRow[];
      expect(payments).toHaveLength(paymentCount);
      expect(payments.some((row) => Number(row.balance_after) < 0)).toBe(false);

      const paymentStats = (dbService.getLoanPaymentStats() as LoanPaymentStatRow[]).find((row) => row.loan_id === 'loan_harsh');
      expect(paymentStats).toBeTruthy();
      expect(Number(paymentStats.payment_count)).toBe(paymentCount);
      expect(Number(paymentStats.total_paid)).toBeGreaterThan(0);

      for (let i = 0; i < 300; i += 1) {
        dbService.setMetadata({
          scopeType: 'loan',
          scopeId: 'loan_harsh',
          metadataKey: `k_${i}`,
          value: { index: i, shard: i % 7 },
          tags: ['stress', i % 2 === 0 ? 'even' : 'odd']
        });
      }

      const metadataRows = dbService.getMetadata({
        scopeType: 'loan',
        scopeId: 'loan_harsh',
        limit: 5000
      });
      expect(metadataRows).toHaveLength(300);

      const deleteOne = dbService.deleteMetadata({
        scopeType: 'loan',
        scopeId: 'loan_harsh',
        metadataKey: 'k_10'
      });
      expect(deleteOne.deleted).toBe(1);

      const deleteRest = dbService.deleteMetadata({
        scopeType: 'loan',
        scopeId: 'loan_harsh'
      });
      expect(deleteRest.deleted).toBe(299);

      dbService.setRealtimeState({
        stateKey: 'stress.expired',
        payload: { status: 'stale' },
        updatedAt: '2020-01-01T00:00:00.000Z',
        ttlSeconds: 1
      });

      expect(dbService.getRealtimeState({ stateKey: 'stress.expired' })).toBeNull();
      expect(dbService.getRealtimeState({ stateKey: 'stress.expired', includeExpired: true })).toBeTruthy();

      const optimization = dbService.optimizeDatabase({ checkpointMode: 'FULL' });
      expect(optimization).toHaveProperty('optimizedAt');
    }
  );

  test('rolls back restore operation on FK failure with no partial writes', () => {
    dbService.resetAllData();
    const baselineAccountCount = dbService.getAccounts().length;

    const invalidPayload = {
      accounts: [
        {
          id: 'acc_restore_candidate',
          name: 'Restore Candidate',
          type: 'checking',
          currency: 'USD',
          initial_balance: 1000,
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ],
      transactions: [
        {
          id: 'tx_bad_fk',
          account_id: 'missing_account',
          to_account_id: null,
          category_id: null,
          subcategory_id: null,
          type: 'expense',
          amount: 10,
          date: '2026-01-01',
          merchant: 'bad fk',
          notes: '',
          tags_json: '[]',
          attachment_path: null,
          tax_amount: 0,
          dedupe_hash: null,
          settlement_month: null,
          locked_by_settlement: 0,
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ]
    };

    expect(() => dbService.restoreAllData(invalidPayload)).toThrow();

    const accountsAfter = dbService.getAccounts();
    const transactionsAfter = dbService.getTransactions({});

    expect(accountsAfter.length).toBe(baselineAccountCount);
    expect((accountsAfter as IdRow[]).some((row) => row.id === 'acc_restore_candidate')).toBe(false);
    expect((transactionsAfter as IdRow[]).some((row) => row.id === 'tx_bad_fk')).toBe(false);
  });

  test('scenario lifecycle works under simulation/save/list/delete flow', () => {
    dbService.createAccount({
      id: 'acc_scenario',
      name: 'Scenario Account',
      type: 'checking',
      currency: 'USD',
      initialBalance: 1000
    });

    dbService.addTransaction({
      id: 'tx_scenario_income',
      account_id: 'acc_scenario',
      type: 'income',
      amount: 1200,
      date: '2026-01-03',
      merchant: 'salary'
    });

    dbService.addTransaction({
      id: 'tx_scenario_expense',
      account_id: 'acc_scenario',
      type: 'expense',
      amount: 700,
      date: '2026-01-04',
      merchant: 'rent'
    });

    const simulation = dbService.runScenarioSimulation({
      duration_months: 8,
      start_balance: 100,
      monthly_income: 200,
      monthly_expense: 1800,
      one_off_expense: 600
    });

    expect(simulation.timeline).toHaveLength(8);
    expect(simulation.summary).toHaveProperty('riskLevel');

    const scenarioId = 'scenario_harsh_1';
    const saved = dbService.saveScenarioModel({
      id: scenarioId,
      title: 'Harsh scenario plan',
      assumptions: simulation.assumptions,
      duration_months: 8,
      result_snapshot_json: simulation
    });

    expect(saved).toBeTruthy();
    expect(saved.id).toBe(scenarioId);

    const details = dbService.getScenarioDetails(scenarioId);
    expect(details).toBeTruthy();
    expect(details.result_snapshot?.summary?.riskLevel).toBeTruthy();

    const scenarios = dbService.getScenariosList();
    expect((scenarios as IdRow[]).some((row) => row.id === scenarioId)).toBe(true);

    const scenarioAlerts = dbService.getAlertsList({ sourceType: 'scenario' });
    expect((scenarioAlerts as AlertSourceRow[]).some((row) => row.source_id === scenarioId)).toBe(true);

    dbService.deleteScenarioModel(scenarioId);
    expect(dbService.getScenarioDetails(scenarioId)).toBeNull();
  });
});
