import { describe, expect, it } from 'vitest';
import {
  buildDashboardOptimizationPayload,
  normalizeOptimizationPeriod
} from '../../src/services/v2/dashboardOptimizationService.js';

describe('dashboardOptimizationService', () => {
  it('returns stable defaults for empty inputs', () => {
    const payload = buildDashboardOptimizationPayload({});

    expect(payload.periodDays).toBe(90);
    expect(payload.stats.totalSpend).toBe(0);
    expect(payload.stats.avgDailySpend).toBe(0);
    expect(payload.stats.billsDue7d).toBe(0);
    expect(payload.stats.debtLoad).toBe(0);
    expect(payload.categorySpend).toEqual([]);
    expect(payload.debtPressure).toEqual([]);
    expect(payload.billsPressure).toEqual([]);
  });

  it('calculates category shares and keeps ranking data', () => {
    const payload = buildDashboardOptimizationPayload({
      periodDays: 90,
      totalSpend: 1000,
      categories: [
        { category_id: 'rent', category_name: 'Rent', amount: 700, tx_count: 1 },
        { category_id: 'food', category_name: 'Food', amount: 300, tx_count: 4 }
      ]
    });

    expect(payload.categorySpend).toHaveLength(2);
    expect(payload.categorySpend[0]).toMatchObject({
      categoryId: 'rent',
      category: 'Rent',
      amount: 700,
      txCount: 1
    });
    expect(payload.categorySpend[0].sharePct).toBeCloseTo(70, 2);
    expect(payload.categorySpend[1].sharePct).toBeCloseTo(30, 2);
  });

  it('classifies bills into overdue, due soon, and upcoming correctly', () => {
    const payload = buildDashboardOptimizationPayload({
      asOf: '2026-03-25T12:00:00.000Z',
      bills: [
        { id: 'b1', name: 'Late Bill', amount: 120, next_due_date: '2026-03-24' },
        { id: 'b2', name: 'Soon Bill', amount: 220, next_due_date: '2026-03-28' },
        { id: 'b3', name: 'Future Bill', amount: 500, next_due_date: '2026-04-20' }
      ]
    });

    expect(payload.billsPressure.find((row: (typeof payload.billsPressure)[number]) => row.billId === 'b1')?.status).toBe('overdue');
    expect(payload.billsPressure.find((row: (typeof payload.billsPressure)[number]) => row.billId === 'b2')?.status).toBe('due_soon');
    expect(payload.billsPressure.find((row: (typeof payload.billsPressure)[number]) => row.billId === 'b3')?.status).toBe('upcoming');
    expect(payload.stats.overdueBills).toBe(1);
    expect(payload.stats.dueSoonBills).toBe(1);
  });

  it('keeps debt metrics finite for zero/edge values', () => {
    const payload = buildDashboardOptimizationPayload({
      debtLoad: 4500,
      loans: [
        { id: 'l1', name: 'Loan A', current_balance: 3000, interest_rate: 8, payment_amount: 200, due_status: 'upcoming' },
        { id: 'l2', name: 'Loan B', current_balance: 1500, interest_rate: 0, payment_amount: 0, due_status: 'overdue' }
      ]
    });

    expect(payload.stats.debtLoad).toBe(4500);
    expect(payload.debtPressure).toHaveLength(2);
    expect(Number.isFinite(payload.debtPressure[0].riskScore)).toBe(true);
    expect(Number.isFinite(payload.debtPressure[1].riskScore)).toBe(true);
    expect(payload.debtPressure[1].health).toBe('overdue');
  });

  it('normalizes period to supported values only', () => {
    expect(normalizeOptimizationPeriod(30)).toBe(30);
    expect(normalizeOptimizationPeriod(90)).toBe(90);
    expect(normalizeOptimizationPeriod(180)).toBe(180);
    expect(normalizeOptimizationPeriod(45)).toBe(90);
    expect(normalizeOptimizationPeriod(undefined)).toBe(90);
  });
});
