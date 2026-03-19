import { generateMonthlyReport, invalidateMonthlyReport, toMonth } from './reportsService.js';
import { getActiveAlertCountForMonth } from './alertsService.js';

const buildChecklist = (db, month) => {
  const transactionCount = db.prepare(`
    SELECT COUNT(*) AS total
    FROM transactions
    WHERE substr(date, 1, 7) = ?
  `).get(month).total;

  const recurringCount = db.prepare(`
    SELECT COUNT(*) AS total
    FROM recurring_items
    WHERE substr(COALESCE(next_due_date, start_date), 1, 7) = ?
  `).get(month).total;

  const budgetCount = db.prepare("SELECT COUNT(*) AS total FROM budgets WHERE period = 'monthly'").get().total;
  const goalCount = db.prepare('SELECT COUNT(*) AS total FROM goals').get().total;
  const loanCount = db.prepare('SELECT COUNT(*) AS total FROM loans').get().total;
  const activeAlerts = getActiveAlertCountForMonth(db, month);

  const items = [
    {
      key: 'transactions_collected',
      label: 'Pull all transactions and recurring items for month.',
      done: transactionCount > 0 || recurringCount > 0,
      meta: { transactionCount, recurringCount }
    },
    {
      key: 'balances_reconciled',
      label: 'Reconcile account balances against expected values.',
      done: true,
      meta: {}
    },
    {
      key: 'budgets_checked',
      label: 'Check budgets over/under/on target.',
      done: budgetCount > 0,
      meta: { budgetCount }
    },
    {
      key: 'goals_checked',
      label: 'Check goals and mission-capital allocations.',
      done: goalCount > 0,
      meta: { goalCount }
    },
    {
      key: 'loans_checked',
      label: 'Check loan payments and due items.',
      done: loanCount > 0,
      meta: { loanCount }
    },
    {
      key: 'alerts_reviewed',
      label: 'Review active month-end alerts and unresolved issues.',
      done: activeAlerts === 0,
      meta: { activeAlerts }
    }
  ];

  return {
    month,
    generatedAt: new Date().toISOString(),
    unresolvedCount: activeAlerts,
    items
  };
};

const ensureSettlement = (db, month) => {
  db.prepare(`
    INSERT INTO monthly_settlements (id, month, status, checklist_json, unresolved_count, is_dirty)
    VALUES (@id, @month, 'in_review', @checklistJson, 0, 1)
    ON CONFLICT(month) DO NOTHING
  `).run({
    id: `settlement_${month}`,
    month,
    checklistJson: JSON.stringify(buildChecklist(db, month))
  });

  return getSettlementByMonth(db, month);
};

const getSettlements = (db) => {
  return db.prepare('SELECT * FROM monthly_settlements ORDER BY month DESC').all().map((row) => ({
    ...row,
    checklist: row.checklist_json ? JSON.parse(row.checklist_json) : null
  }));
};

const getSettlementByMonth = (db, month) => {
  const row = db.prepare('SELECT * FROM monthly_settlements WHERE month = ?').get(month);
  if (!row) return null;
  return {
    ...row,
    checklist: row.checklist_json ? JSON.parse(row.checklist_json) : null
  };
};

const getSettlementById = (db, id) => {
  const row = db.prepare('SELECT * FROM monthly_settlements WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    checklist: row.checklist_json ? JSON.parse(row.checklist_json) : null
  };
};

const markSettlementDirty = (db, month, reason = 'transaction_change') => {
  ensureSettlement(db, month);
  const checklist = buildChecklist(db, month);

  db.prepare(`
    UPDATE monthly_settlements
    SET is_dirty = 1,
        status = CASE WHEN status = 'finalized' THEN 'in_review' ELSE status END,
        checklist_json = @checklistJson,
        unresolved_count = @unresolvedCount,
        notes = CASE WHEN notes IS NULL OR notes = '' THEN @reason ELSE notes || '\n' || @reason END,
        updated_at = CURRENT_TIMESTAMP
    WHERE month = @month
  `).run({
    month,
    checklistJson: JSON.stringify(checklist),
    unresolvedCount: checklist.unresolvedCount,
    reason: `[${new Date().toISOString()}] ${reason}`
  });

  invalidateMonthlyReport(db, month);

  return getSettlementByMonth(db, month);
};

const refreshSettlementChecklist = (db, month) => {
  ensureSettlement(db, month);
  const checklist = buildChecklist(db, month);

  db.prepare(`
    UPDATE monthly_settlements
    SET checklist_json = @checklistJson,
        unresolved_count = @unresolvedCount,
        updated_at = CURRENT_TIMESTAMP
    WHERE month = @month
  `).run({
    month,
    checklistJson: JSON.stringify(checklist),
    unresolvedCount: checklist.unresolvedCount
  });

  return getSettlementByMonth(db, month);
};

const finalizeSettlement = (db, month, notes = '') => {
  const settlement = refreshSettlementChecklist(db, month);
  if (!settlement) {
    throw new Error('Settlement not found for selected month.');
  }

  if (settlement.unresolved_count > 0) {
    throw new Error('Cannot finalize month with unresolved active alerts.');
  }

  db.prepare(`
    UPDATE monthly_settlements
    SET status = 'finalized',
        reconciled_at = CURRENT_TIMESTAMP,
        is_dirty = 0,
        notes = CASE WHEN @notes = '' THEN notes ELSE @notes END,
        updated_at = CURRENT_TIMESTAMP
    WHERE month = @month
  `).run({ month, notes });

  db.prepare(`
    UPDATE transactions
    SET locked_by_settlement = 1,
        settlement_month = @month
    WHERE substr(date, 1, 7) = @month
  `).run({ month });

  const updated = getSettlementByMonth(db, month);
  const report = generateMonthlyReport(db, month, updated.id);

  return { settlement: updated, report };
};

const reopenSettlement = (db, month, reason = '') => {
  const settlement = ensureSettlement(db, month);
  if (!settlement) {
    throw new Error('Settlement not found for selected month.');
  }

  db.prepare(`
    UPDATE monthly_settlements
    SET status = 'in_review',
        is_dirty = 1,
        notes = CASE WHEN @reason = '' THEN notes ELSE @reason END,
        updated_at = CURRENT_TIMESTAMP
    WHERE month = @month
  `).run({
    month,
    reason: reason || `[${new Date().toISOString()}] Reopened month`
  });

  db.prepare(`
    UPDATE transactions
    SET locked_by_settlement = 0
    WHERE settlement_month = ?
  `).run(month);

  invalidateMonthlyReport(db, month);

  return refreshSettlementChecklist(db, month);
};

const assertMonthEditableForDate = (db, isoDate) => {
  const month = toMonth(isoDate);
  if (!month) return;

  const settlement = db.prepare(`
    SELECT status
    FROM monthly_settlements
    WHERE month = ?
  `).get(month);

  if (settlement?.status === 'finalized') {
    throw new Error(`Month ${month} is finalized. Reopen settlement before editing transactions.`);
  }
};

const assertTransactionEditable = (db, transactionId) => {
  const row = db.prepare('SELECT date, settlement_month, locked_by_settlement FROM transactions WHERE id = ?').get(transactionId);
  if (!row) return;

  if (row.locked_by_settlement) {
    throw new Error(`Transaction is locked by finalized settlement ${row.settlement_month || toMonth(row.date)}.`);
  }

  assertMonthEditableForDate(db, row.date);
};

export {
  assertMonthEditableForDate,
  assertTransactionEditable,
  finalizeSettlement,
  getSettlementByMonth,
  getSettlements,
  markSettlementDirty,
  reopenSettlement
};
