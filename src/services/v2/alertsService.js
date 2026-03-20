const ACTIVE_STATES = ['active', 'acknowledged', 'snoozed'];
const CASH_COLLISION_SOURCE_TYPE = 'cashflow';
const CASH_COLLISION_TRIGGER_TYPE = 'cash-collision';

const toMonth = (isoDate) => String(isoDate || '').slice(0, 7);
const toIsoDate = (value) => String(value || '').slice(0, 10);

const parseIsoDate = (value) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + Number(days || 0));
  return result;
};

const toMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const describeFrequencyDays = (frequency) => {
  if (frequency === 'weekly') return 7;
  if (frequency === 'biweekly') return 14;
  return null;
};

const incrementByFrequency = (date, frequency, fallback = 'monthly') => {
  const effective = String(frequency || fallback || 'once').toLowerCase();
  const next = new Date(date);

  if (effective === 'none' || effective === 'once' || effective === 'one-time') {
    return null;
  }

  const everyDays = describeFrequencyDays(effective);
  if (everyDays) {
    next.setDate(next.getDate() + everyDays);
    return next;
  }

  if (effective === 'yearly' || effective === 'annual') {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  next.setMonth(next.getMonth() + 1);
  return next;
};

const computeBalanceAsOfToday = (db, todayIso) => {
  const initial = Number(db.prepare('SELECT COALESCE(SUM(initial_balance), 0) AS total FROM accounts').get()?.total || 0);

  const ledger = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) AS transferOut,
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) AS transferIn
    FROM transactions
    WHERE date <= @today
  `).get({ today: todayIso }) || {};

  return toMoney(
    initial
    + Number(ledger.income || 0)
    - Number(ledger.expense || 0)
    - Number(ledger.transferOut || 0)
    + Number(ledger.transferIn || 0)
  );
};

const estimateBaselineDailyIncome = (db, lookbackDays = 90) => {
  const safeWindow = Math.max(30, Math.min(365, Number(lookbackDays) || 90));
  const result = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'income'
      AND date >= date('now', @window)
      AND date <= date('now')
  `).get({ window: `-${safeWindow} days` });

  const total = Number(result?.total || 0);
  if (total <= 0) return 0;
  return toMoney(total / safeWindow);
};

const collectFutureTransactions = (db, todayIso, endIso) => {
  const rows = db.prepare(`
    SELECT id, merchant, amount, type, date
    FROM transactions
    WHERE date > @today
      AND date <= @end
      AND type IN ('income', 'expense')
    ORDER BY date ASC
  `).all({ today: todayIso, end: endIso });

  const incomeEvents = [];
  const debitEvents = [];

  for (const row of rows) {
    const amount = toMoney(row.amount);
    if (amount <= 0) continue;
    const event = {
      date: toIsoDate(row.date),
      amount,
      sourceType: 'transaction',
      sourceId: row.id,
      name: row.merchant || 'Scheduled transaction'
    };
    if (row.type === 'income') incomeEvents.push(event);
    else debitEvents.push(event);
  }

  return { incomeEvents, debitEvents };
};

const collectBillDebitEvents = (db, startDate, endDate) => {
  const rows = db.prepare(`
    SELECT id, name, amount, next_due_date, recurrence, is_paid
    FROM bills
  `).all();

  const events = [];
  for (const row of rows) {
    if (Number(row.amount) <= 0) continue;
    if (Number(row.is_paid) === 1) continue;
    let cursor = parseIsoDate(row.next_due_date);
    if (!cursor) continue;

    const recurrence = String(row.recurrence || 'once').toLowerCase();
    while (cursor && cursor <= endDate) {
      if (cursor >= startDate) {
        events.push({
          date: toIsoDate(cursor.toISOString()),
          amount: toMoney(row.amount),
          sourceType: 'bill',
          sourceId: row.id,
          name: row.name || 'Bill'
        });
      }
      const next = incrementByFrequency(cursor, recurrence, 'once');
      if (!next || next.getTime() <= cursor.getTime()) break;
      cursor = next;
    }
  }
  return events;
};

const collectLoanDebitEvents = (db, startDate, endDate) => {
  const rows = db.prepare(`
    SELECT id, name, current_balance, payment_amount, payment_frequency, next_due_date
    FROM loans
  `).all();

  const events = [];
  for (const row of rows) {
    if (Number(row.current_balance) <= 0 || Number(row.payment_amount) <= 0) continue;
    let remainingBalance = Number(row.current_balance);
    let cursor = parseIsoDate(row.next_due_date);
    if (!cursor) continue;

    const frequency = String(row.payment_frequency || 'monthly').toLowerCase();
    while (cursor && cursor <= endDate && remainingBalance > 0) {
      if (cursor >= startDate) {
        const paymentAmount = toMoney(Math.min(Number(row.payment_amount), remainingBalance));
        events.push({
          date: toIsoDate(cursor.toISOString()),
          amount: paymentAmount,
          sourceType: 'loan',
          sourceId: row.id,
          name: row.name || 'Loan payment'
        });
        remainingBalance -= paymentAmount;
      }
      const next = incrementByFrequency(cursor, frequency, 'monthly');
      if (!next || next.getTime() <= cursor.getTime()) break;
      cursor = next;
    }
  }
  return events;
};

const collectRecurringEvents = (db, startDate, endDate) => {
  const rows = db.prepare(`
    SELECT id, name, type, amount, next_due_date, frequency, status
    FROM recurring_items
    WHERE status = 'active'
  `).all();

  const incomeEvents = [];
  const debitEvents = [];
  for (const row of rows) {
    const amount = toMoney(row.amount);
    if (amount <= 0) continue;
    let cursor = parseIsoDate(row.next_due_date);
    if (!cursor) continue;
    const frequency = String(row.frequency || 'monthly').toLowerCase();
    while (cursor && cursor <= endDate) {
      if (cursor >= startDate) {
        const event = {
          date: toIsoDate(cursor.toISOString()),
          amount,
          sourceType: 'recurring',
          sourceId: row.id,
          name: row.name || 'Recurring item'
        };
        if (row.type === 'income') incomeEvents.push(event);
        else debitEvents.push(event);
      }
      const next = incrementByFrequency(cursor, frequency, 'monthly');
      if (!next || next.getTime() <= cursor.getTime()) break;
      cursor = next;
    }
  }

  return { incomeEvents, debitEvents };
};

const getCashCollisionForecast = (db, options = {}) => {
  const horizonDays = Math.max(7, Math.min(120, Number(options.horizonDays) || 30));
  const lookbackDays = Math.max(30, Math.min(365, Number(options.lookbackDays) || 90));
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDate = addDays(startDate, horizonDays);
  const todayIso = toIsoDate(startDate.toISOString());
  const endIso = toIsoDate(endDate.toISOString());

  const startBalance = computeBalanceAsOfToday(db, todayIso);
  const baselineDailyIncome = estimateBaselineDailyIncome(db, lookbackDays);

  const futureTransactions = collectFutureTransactions(db, todayIso, endIso);
  const recurring = collectRecurringEvents(db, startDate, endDate);
  const billDebits = collectBillDebitEvents(db, startDate, endDate);
  const loanDebits = collectLoanDebitEvents(db, startDate, endDate);

  const incomeEvents = [...futureTransactions.incomeEvents, ...recurring.incomeEvents];
  const debitEvents = [...futureTransactions.debitEvents, ...recurring.debitEvents, ...billDebits, ...loanDebits];

  const incomeByDate = new Map();
  for (const event of incomeEvents) {
    const list = incomeByDate.get(event.date) || [];
    list.push(event);
    incomeByDate.set(event.date, list);
  }

  const debitsByDate = new Map();
  for (const event of debitEvents) {
    const list = debitsByDate.get(event.date) || [];
    list.push(event);
    debitsByDate.set(event.date, list);
  }

  const collisions = [];
  let runningBalance = startBalance;
  let expectedIncome = 0;
  let expectedDebits = 0;

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const current = addDays(startDate, offset);
    const currentIso = toIsoDate(current.toISOString());

    if (baselineDailyIncome > 0) {
      runningBalance += baselineDailyIncome;
      expectedIncome += baselineDailyIncome;
    }

    const todayIncome = incomeByDate.get(currentIso) || [];
    for (const incomeEvent of todayIncome) {
      runningBalance += incomeEvent.amount;
      expectedIncome += incomeEvent.amount;
    }

    const todayDebits = debitsByDate.get(currentIso) || [];
    for (const debitEvent of todayDebits) {
      runningBalance -= debitEvent.amount;
      expectedDebits += debitEvent.amount;
    }

    const projectedBalance = toMoney(runningBalance);
    if (projectedBalance < 0) {
      const deficit = toMoney(Math.abs(projectedBalance));
      const severity = deficit >= 500 || offset <= 3 ? 'critical' : 'warning';
      const topDrivers = [...todayDebits]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map((event) => ({
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          name: event.name,
          amount: toMoney(event.amount)
        }));

      collisions.push({
        date: currentIso,
        daysAway: offset,
        projectedBalance,
        deficit,
        severity,
        drivers: topDrivers
      });
    }
  }

  return {
    asOf: todayIso,
    horizonDays,
    startBalance: toMoney(startBalance),
    projectedEndBalance: toMoney(runningBalance),
    baselineDailyIncome: toMoney(baselineDailyIncome),
    expectedIncome: toMoney(expectedIncome),
    expectedDebits: toMoney(expectedDebits),
    collisions
  };
};

const buildCollisionMessage = (collision) => {
  const prefix = collision.daysAway <= 0 ? 'Cash collision expected today' : `Cash collision expected in ${collision.daysAway} day(s)`;
  return `${prefix}: projected balance ${collision.projectedBalance.toFixed(2)} on ${collision.date}.`;
};

const buildCollisionCondition = (collision) => {
  const driverSummary = collision.drivers.length > 0
    ? collision.drivers.map((driver) => `${driver.name} (${driver.amount.toFixed(2)})`).join(', ')
    : 'No single debit driver.';
  return `Projected deficit ${collision.deficit.toFixed(2)} on ${collision.date}. Drivers: ${driverSummary}`;
};

const evaluateCashCollisionAlerts = (db, options = {}) => {
  const forecast = getCashCollisionForecast(db, options);
  const activeSourceIds = new Set();

  for (const collision of forecast.collisions) {
    const sourceId = collision.date;
    activeSourceIds.add(sourceId);
    const alertId = `${CASH_COLLISION_SOURCE_TYPE}_${sourceId}_${CASH_COLLISION_TRIGGER_TYPE}`;
    const existing = db.prepare('SELECT status FROM alerts WHERE id = ?').get(alertId);
    const preservedStatus = ACTIVE_STATES.includes(existing?.status) ? existing.status : 'active';

    createAlert(db, {
      id: alertId,
      sourceType: CASH_COLLISION_SOURCE_TYPE,
      sourceId,
      triggerType: CASH_COLLISION_TRIGGER_TYPE,
      conditionText: buildCollisionCondition(collision),
      severity: collision.severity,
      message: buildCollisionMessage(collision),
      recommendedAction: 'Shift payment dates, pre-fund required bills, or reduce optional spending before this date.',
      status: preservedStatus
    });
  }

  const placeholders = [...activeSourceIds].map(() => '?').join(', ');
  const statusPlaceholders = ACTIVE_STATES.map(() => '?').join(', ');
  const params = [CASH_COLLISION_SOURCE_TYPE, CASH_COLLISION_TRIGGER_TYPE, ...ACTIVE_STATES];

  let query = `
    UPDATE alerts
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE source_type = ?
      AND trigger_type = ?
      AND status IN (${statusPlaceholders})
  `;
  if (activeSourceIds.size > 0) {
    query += ` AND source_id NOT IN (${placeholders})`;
    params.push(...activeSourceIds);
  }
  db.prepare(query).run(...params);

  return forecast;
};

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
  evaluateCashCollisionAlerts,
  getActiveAlertCountForMonth,
  getAlerts,
  getCashCollisionForecast,
  summarizeAlertCounts,
  updateAlertStatus
};
