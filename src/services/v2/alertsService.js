const ACTIVE_STATES = ['active', 'acknowledged', 'snoozed'];

const toMonth = (isoDate) => String(isoDate || '').slice(0, 7);

const upsertAlert = (db, alertInput) => {
  const alert = {
    id: alertInput.id,
    sourceType: alertInput.sourceType,
    sourceId: alertInput.sourceId,
    triggerType: alertInput.triggerType,
    conditionText: alertInput.conditionText,
    severity: alertInput.severity || 'warning',
    message: alertInput.message,
    recommendedAction: alertInput.recommendedAction || '',
    status: alertInput.status || 'active',
    snoozedUntil: alertInput.snoozedUntil || null
  };

  db.prepare(`
    INSERT INTO alerts (
      id, source_type, source_id, trigger_type, condition_text, severity, message,
      recommended_action, status, snoozed_until, acknowledged_at, resolved_at, updated_at
    ) VALUES (
      @id, @sourceType, @sourceId, @triggerType, @conditionText, @severity, @message,
      @recommendedAction, @status, @snoozedUntil,
      CASE WHEN @status = 'acknowledged' THEN CURRENT_TIMESTAMP ELSE NULL END,
      CASE WHEN @status = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      source_type = @sourceType,
      source_id = @sourceId,
      trigger_type = @triggerType,
      condition_text = @conditionText,
      severity = @severity,
      message = @message,
      recommended_action = @recommendedAction,
      status = @status,
      snoozed_until = @snoozedUntil,
      acknowledged_at = CASE WHEN @status = 'acknowledged' THEN CURRENT_TIMESTAMP ELSE alerts.acknowledged_at END,
      resolved_at = CASE WHEN @status = 'resolved' THEN CURRENT_TIMESTAMP ELSE alerts.resolved_at END,
      updated_at = CURRENT_TIMESTAMP
  `).run(alert);
};

const createAlert = (db, alertInput) => {
  upsertAlert(db, {
    ...alertInput,
    id: alertInput.id || `${alertInput.sourceType}_${alertInput.sourceId}_${alertInput.triggerType}`
  });
};

const clearAlertsForSource = (db, sourceType, sourceId) => {
  db.prepare(`
    UPDATE alerts
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = ?
      AND source_id = ?
      AND status IN ('active', 'acknowledged', 'snoozed')
  `).run(sourceType, sourceId);
};

const createBudgetPressureAlert = (db, tx) => {
  if (tx.type !== 'expense' || !tx.category_id) return;

  const budget = db.prepare(`
    SELECT * FROM budgets
    WHERE category_id = ? AND period = 'monthly'
    LIMIT 1
  `).get(tx.category_id);

  if (!budget) return;

  const month = toMonth(tx.date);
  const spent = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE category_id = ?
      AND type = 'expense'
      AND substr(date, 1, 7) = ?
  `).get(tx.category_id, month).total;

  const ratio = budget.limit_amount > 0 ? spent / budget.limit_amount : 0;

  if (ratio < 0.9) return;

  const severity = ratio >= 1 ? 'critical' : 'warning';
  const conditionText = ratio >= 1
    ? `Spent ${spent.toFixed(2)} exceeds limit ${Number(budget.limit_amount).toFixed(2)}.`
    : `Spent ${spent.toFixed(2)} is ${(ratio * 100).toFixed(0)}% of limit ${Number(budget.limit_amount).toFixed(2)}.`;

  createAlert(db, {
    sourceType: 'budget',
    sourceId: `${budget.id}:${month}`,
    triggerType: 'budget-pressure',
    conditionText,
    severity,
    message: ratio >= 1 ? 'Budget exceeded.' : 'Budget almost exhausted.',
    recommendedAction: 'Review category spending or adjust budget target.'
  });
};

const createLargeTransactionAlert = (db, tx) => {
  if (tx.type !== 'expense') return;
  if (Number(tx.amount) < 500) return;

  createAlert(db, {
    sourceType: 'transaction',
    sourceId: tx.id,
    triggerType: 'large-transaction',
    conditionText: `Expense amount ${Number(tx.amount).toFixed(2)} exceeded large-transaction threshold (500).`,
    severity: Number(tx.amount) >= 1000 ? 'critical' : 'warning',
    message: 'Unusually large expense detected.',
    recommendedAction: 'Confirm this transaction and review budget impact.'
  });
};

const evaluateLoanAlerts = (db) => {
  const loans = db.prepare('SELECT id, name, current_balance, next_due_date, due_status FROM loans').all();
  for (const loan of loans) {
    if (!loan.next_due_date) continue;

    const dueDate = new Date(loan.next_due_date);
    if (Number.isNaN(dueDate.getTime())) continue;

    const daysToDue = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const sourceId = loan.id;

    if (daysToDue < 0 || loan.due_status === 'overdue') {
      createAlert(db, {
        sourceType: 'loan',
        sourceId,
        triggerType: 'loan-overdue',
        conditionText: `Loan payment for ${loan.name} is overdue by ${Math.abs(daysToDue)} day(s).`,
        severity: 'critical',
        message: 'Loan payment overdue.',
        recommendedAction: 'Pay overdue amount and update payment schedule.'
      });
      continue;
    }

    if (daysToDue <= 7) {
      createAlert(db, {
        sourceType: 'loan',
        sourceId,
        triggerType: 'loan-due-soon',
        conditionText: `Loan payment for ${loan.name} is due in ${daysToDue} day(s).`,
        severity: daysToDue <= 2 ? 'warning' : 'info',
        message: 'Loan payment due soon.',
        recommendedAction: 'Prepare upcoming payment and verify account balance.'
      });
    }
  }
};

const evaluateAlertsForTransaction = (db, tx) => {
  clearAlertsForSource(db, 'transaction', tx.id);
  createLargeTransactionAlert(db, tx);
  createBudgetPressureAlert(db, tx);
  evaluateLoanAlerts(db);
};

const createScenarioRiskAlert = (db, scenarioId, riskLevel, message) => {
  if (!['medium', 'high', 'critical'].includes(riskLevel)) return;

  createAlert(db, {
    sourceType: 'scenario',
    sourceId: scenarioId,
    triggerType: 'scenario-risk',
    conditionText: `Scenario produced risk level: ${riskLevel}.`,
    severity: riskLevel === 'high' || riskLevel === 'critical' ? 'critical' : 'warning',
    message,
    recommendedAction: 'Review assumptions and adjust planned actions.'
  });
};

const getAlerts = (db, filter = {}) => {
  let query = 'SELECT * FROM alerts';
  const params = [];
  const conditions = [];

  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }

  if (filter.severity) {
    conditions.push('severity = ?');
    params.push(filter.severity);
  }

  if (filter.sourceType) {
    conditions.push('source_type = ?');
    params.push(filter.sourceType);
  }

  if (filter.includeResolved !== true) {
    conditions.push("status != 'resolved'");
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
};

const updateAlertStatus = (db, id, status, options = {}) => {
  const snoozedUntil = options.snoozedUntil || null;

  db.prepare(`
    UPDATE alerts
    SET status = @status,
        snoozed_until = @snoozedUntil,
        acknowledged_at = CASE WHEN @status = 'acknowledged' THEN CURRENT_TIMESTAMP ELSE acknowledged_at END,
        resolved_at = CASE WHEN @status = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id, status, snoozedUntil });

  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
};

const getActiveAlertCountForMonth = (db, month) => {
  return db.prepare(`
    SELECT COUNT(*) AS total
    FROM alerts
    WHERE status IN ('active', 'acknowledged', 'snoozed')
      AND substr(created_at, 1, 7) = ?
  `).get(month).total;
};

const resolveAlertsForSource = (db, sourceType, sourceId) => {
  db.prepare(`
    UPDATE alerts
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = ? AND source_id = ? AND status IN ('active', 'acknowledged', 'snoozed')
  `).run(sourceType, sourceId);
};

const summarizeAlertCounts = (db) => {
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM alerts
    GROUP BY status
  `).all();

  const summary = { active: 0, acknowledged: 0, snoozed: 0, resolved: 0 };

  for (const row of rows) {
    if (summary[row.status] !== undefined) {
      summary[row.status] = row.total;
    }
  }

  return summary;
};

export {
  createScenarioRiskAlert,
  evaluateAlertsForTransaction,
  getActiveAlertCountForMonth,
  getAlerts,
  summarizeAlertCounts,
  updateAlertStatus
};
