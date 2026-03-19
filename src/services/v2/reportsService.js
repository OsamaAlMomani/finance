const toMonth = (isoDate) => String(isoDate || '').slice(0, 7);

const buildBudgetBreakdown = (db, month) => {
  const rows = db.prepare(`
    SELECT b.id, b.limit_amount, b.period, c.name AS category_name, c.id AS category_id
    FROM budgets b
    LEFT JOIN categories c ON c.id = b.category_id
    WHERE b.period = 'monthly'
    ORDER BY c.name
  `).all();

  return rows.map((row) => {
    const spent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE type = 'expense'
        AND category_id = ?
        AND substr(date, 1, 7) = ?
    `).get(row.category_id, month).total;

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      limitAmount: row.limit_amount,
      spent,
      variance: Number(row.limit_amount) - Number(spent)
    };
  });
};

const buildTagBreakdown = (db, month) => {
  return db.prepare(`
    SELECT t.name AS tag, COUNT(*) AS count, COALESCE(SUM(tx.amount), 0) AS amount
    FROM transaction_tags tt
    JOIN tags t ON t.id = tt.tag_id
    JOIN transactions tx ON tx.id = tt.transaction_id
    WHERE substr(tx.date, 1, 7) = ?
    GROUP BY t.name
    ORDER BY count DESC, t.name
  `).all(month);
};

const buildLabelBreakdown = (db, month) => {
  return db.prepare(`
    SELECT l.name AS label, l.type, COUNT(*) AS count, COALESCE(SUM(tx.amount), 0) AS amount
    FROM transaction_labels tl
    JOIN labels l ON l.id = tl.label_id
    JOIN transactions tx ON tx.id = tl.transaction_id
    WHERE substr(tx.date, 1, 7) = ?
    GROUP BY l.name, l.type
    ORDER BY count DESC, l.name
  `).all(month);
};

const buildGoalSummary = (db) => {
  return db.prepare(`
    SELECT id, name, goal_type, target_amount, current_amount, target_date, priority, risk_status
    FROM goals
    ORDER BY priority DESC, target_date ASC
  `).all();
};

const buildLoanSummary = (db) => {
  return db.prepare(`
    SELECT id, name, lender, current_balance, interest_rate, payment_amount, next_due_date, due_status
    FROM loans
    ORDER BY current_balance DESC
  `).all();
};

const buildCashFlowSummary = (db, month) => {
  const income = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'income' AND substr(date, 1, 7) = ?
  `).get(month).total;

  const expense = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'expense' AND substr(date, 1, 7) = ?
  `).get(month).total;

  return {
    income,
    expense,
    net: Number(income) - Number(expense)
  };
};

const buildAlertSummary = (db, month) => {
  return db.prepare(`
    SELECT severity, COUNT(*) AS total
    FROM alerts
    WHERE substr(created_at, 1, 7) = ?
      AND status IN ('active', 'acknowledged', 'snoozed')
    GROUP BY severity
    ORDER BY severity
  `).all(month);
};

const buildMonthlyReportSnapshot = (db, month) => {
  const cashFlow = buildCashFlowSummary(db, month);

  return {
    month,
    generatedAt: new Date().toISOString(),
    cashFlow,
    actualVsBudget: buildBudgetBreakdown(db, month),
    goalProgress: buildGoalSummary(db),
    loanStatus: buildLoanSummary(db),
    tagBreakdown: buildTagBreakdown(db, month),
    labelBreakdown: buildLabelBreakdown(db, month),
    alertSummary: buildAlertSummary(db, month),
    riskNotes: cashFlow.net < 0
      ? ['Net cash-flow is negative this month.']
      : ['No immediate net cash-flow risk detected for this month.']
  };
};

const generateMonthlyReport = (db, month, settlementId) => {
  const settlement = db.prepare('SELECT * FROM monthly_settlements WHERE month = ?').get(month);
  if (!settlement || settlement.status !== 'finalized') {
    throw new Error('Monthly report generation requires a finalized settlement.');
  }

  const snapshot = buildMonthlyReportSnapshot(db, month);

  db.prepare(`
    INSERT INTO monthly_reports (id, month, settlement_id, generated_at, snapshot_data_json)
    VALUES (@id, @month, @settlementId, CURRENT_TIMESTAMP, @snapshot)
    ON CONFLICT(month) DO UPDATE SET
      settlement_id = @settlementId,
      generated_at = CURRENT_TIMESTAMP,
      snapshot_data_json = @snapshot
  `).run({
    id: `report_${month}`,
    month,
    settlementId: settlementId || settlement.id,
    snapshot: JSON.stringify(snapshot)
  });

  return getMonthlyReportByMonth(db, month);
};

const getMonthlyReports = (db) => {
  return db.prepare('SELECT * FROM monthly_reports ORDER BY month DESC').all().map((row) => ({
    ...row,
    snapshot_data: row.snapshot_data_json ? JSON.parse(row.snapshot_data_json) : null
  }));
};

const getMonthlyReportByMonth = (db, month) => {
  const row = db.prepare('SELECT * FROM monthly_reports WHERE month = ?').get(month);
  if (!row) return null;
  return {
    ...row,
    snapshot_data: row.snapshot_data_json ? JSON.parse(row.snapshot_data_json) : null
  };
};

const getMonthlyReportById = (db, id) => {
  const row = db.prepare('SELECT * FROM monthly_reports WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    snapshot_data: row.snapshot_data_json ? JSON.parse(row.snapshot_data_json) : null
  };
};

const invalidateMonthlyReport = (db, month) => {
  db.prepare('DELETE FROM monthly_reports WHERE month = ?').run(month);
};

const getReportCsv = (report) => {
  if (!report?.snapshot_data) return '';

  const lines = [
    'section,key,value',
    `cash_flow,income,${Number(report.snapshot_data.cashFlow?.income || 0).toFixed(2)}`,
    `cash_flow,expense,${Number(report.snapshot_data.cashFlow?.expense || 0).toFixed(2)}`,
    `cash_flow,net,${Number(report.snapshot_data.cashFlow?.net || 0).toFixed(2)}`
  ];

  for (const row of report.snapshot_data.actualVsBudget || []) {
    lines.push(`actual_vs_budget,${row.categoryName || 'unknown'},${Number(row.variance || 0).toFixed(2)}`);
  }

  for (const row of report.snapshot_data.tagBreakdown || []) {
    lines.push(`tags,${row.tag},${Number(row.amount || 0).toFixed(2)}`);
  }

  for (const row of report.snapshot_data.labelBreakdown || []) {
    lines.push(`labels,${row.label},${Number(row.amount || 0).toFixed(2)}`);
  }

  return lines.join('\n');
};

const getReportPdfLikeContent = (report) => {
  if (!report?.snapshot_data) return 'No report data available.';

  const snapshot = report.snapshot_data;

  return [
    `Monthly Report: ${snapshot.month}`,
    `Generated At: ${snapshot.generatedAt}`,
    '',
    'Cash Flow Summary',
    `Income: ${Number(snapshot.cashFlow?.income || 0).toFixed(2)}`,
    `Expense: ${Number(snapshot.cashFlow?.expense || 0).toFixed(2)}`,
    `Net: ${Number(snapshot.cashFlow?.net || 0).toFixed(2)}`,
    '',
    'Risk Notes',
    ...(snapshot.riskNotes || ['No risk notes'])
  ].join('\n');
};

export {
  generateMonthlyReport,
  getMonthlyReportById,
  getMonthlyReportByMonth,
  getMonthlyReports,
  getReportCsv,
  getReportPdfLikeContent,
  invalidateMonthlyReport,
  toMonth
};
