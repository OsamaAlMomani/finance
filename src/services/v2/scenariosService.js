import { createScenarioRiskAlert } from './alertsService.js';

const getMonthlyAverages = (db, monthCount = 3) => {
  const rows = db.prepare(`
    SELECT substr(date, 1, 7) AS month,
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    GROUP BY substr(date, 1, 7)
    ORDER BY month DESC
    LIMIT ?
  `).all(monthCount);

  if (rows.length === 0) {
    return { monthlyIncome: 0, monthlyExpense: 0 };
  }

  const monthlyIncome = rows.reduce((sum, row) => sum + Number(row.income || 0), 0) / rows.length;
  const monthlyExpense = rows.reduce((sum, row) => sum + Number(row.expense || 0), 0) / rows.length;

  return { monthlyIncome, monthlyExpense };
};

const runScenarioSimulation = (db, assumptions = {}) => {
  const base = getMonthlyAverages(db);

  const months = Number(assumptions.duration_months || assumptions.months || 6);
  const monthlyIncome = Number(assumptions.monthly_income ?? base.monthlyIncome ?? 0);
  const monthlyExpense = Number(assumptions.monthly_expense ?? base.monthlyExpense ?? 0);
  const extraMonthlyExpense = Number(assumptions.extra_monthly_expense || 0);
  const oneOffExpense = Number(assumptions.one_off_expense || 0);
  const incomeDelta = Number(assumptions.income_delta || 0);
  const expenseDelta = Number(assumptions.expense_delta || 0);

  const accountTotals = db.prepare('SELECT COALESCE(SUM(initial_balance), 0) AS total FROM accounts').get().total || 0;
  const historicalNet = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount WHEN type='expense' THEN -amount ELSE 0 END), 0) AS total
    FROM transactions
  `).get().total || 0;

  let runningBalance = Number(assumptions.start_balance ?? (Number(accountTotals) + Number(historicalNet)));
  const timeline = [];

  for (let i = 0; i < months; i += 1) {
    const monthIncome = monthlyIncome + incomeDelta * i;
    const monthExpense = monthlyExpense + expenseDelta * i + extraMonthlyExpense;
    const oneOff = i === 0 ? oneOffExpense : 0;
    const net = monthIncome - monthExpense - oneOff;

    runningBalance += net;

    const date = new Date();
    date.setMonth(date.getMonth() + i);

    timeline.push({
      month: date.toISOString().slice(0, 7),
      income: Number(monthIncome.toFixed(2)),
      expense: Number((monthExpense + oneOff).toFixed(2)),
      net: Number(net.toFixed(2)),
      projectedBalance: Number(runningBalance.toFixed(2))
    });
  }

  const finalBalance = timeline.length > 0
    ? timeline[timeline.length - 1].projectedBalance
    : runningBalance;

  const lowestBalance = timeline.reduce((min, item) => Math.min(min, item.projectedBalance), finalBalance);

  let riskLevel = 'low';
  const riskNotes = [];

  if (lowestBalance < 0 || finalBalance < 0) {
    riskLevel = 'high';
    riskNotes.push('Projection enters negative balance.');
  } else if (finalBalance < runningBalance * 0.75) {
    riskLevel = 'medium';
    riskNotes.push('Projection shows significant runway reduction.');
  } else {
    riskNotes.push('Projection remains within healthy runway.');
  }

  return {
    assumptions: {
      months,
      monthly_income: monthlyIncome,
      monthly_expense: monthlyExpense,
      extra_monthly_expense: extraMonthlyExpense,
      income_delta: incomeDelta,
      expense_delta: expenseDelta,
      one_off_expense: oneOffExpense,
      start_balance: Number((Number(assumptions.start_balance ?? (accountTotals + historicalNet))).toFixed(2))
    },
    timeline,
    summary: {
      finalBalance,
      lowestBalance,
      riskLevel,
      riskNotes
    }
  };
};

const saveScenario = (db, scenario) => {
  const assumptions = typeof scenario.assumptions_json === 'string'
    ? JSON.parse(scenario.assumptions_json)
    : (scenario.assumptions || {});

  const result = scenario.result_snapshot_json
    ? (typeof scenario.result_snapshot_json === 'string' ? JSON.parse(scenario.result_snapshot_json) : scenario.result_snapshot_json)
    : runScenarioSimulation(db, assumptions);

  const riskLevel = result?.summary?.riskLevel || scenario.risk_level || 'low';

  db.prepare(`
    INSERT INTO scenarios (id, title, assumptions_json, duration_months, result_snapshot_json, risk_level)
    VALUES (@id, @title, @assumptionsJson, @durationMonths, @resultSnapshotJson, @riskLevel)
    ON CONFLICT(id) DO UPDATE SET
      title = @title,
      assumptions_json = @assumptionsJson,
      duration_months = @durationMonths,
      result_snapshot_json = @resultSnapshotJson,
      risk_level = @riskLevel,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: scenario.id,
    title: scenario.title,
    assumptionsJson: JSON.stringify(assumptions),
    durationMonths: Number(assumptions.duration_months || assumptions.months || scenario.duration_months || 6),
    resultSnapshotJson: JSON.stringify(result),
    riskLevel
  });

  createScenarioRiskAlert(db, scenario.id, riskLevel, `Scenario \"${scenario.title}\" risk level is ${riskLevel}.`);

  return getScenarioById(db, scenario.id);
};

const runScenario = (db, input) => {
  const assumptions = input.assumptions || input;
  return runScenarioSimulation(db, assumptions);
};

const getScenarioById = (db, id) => {
  const row = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    assumptions: row.assumptions_json ? JSON.parse(row.assumptions_json) : {},
    result_snapshot: row.result_snapshot_json ? JSON.parse(row.result_snapshot_json) : null
  };
};

const getScenarios = (db) => {
  return db.prepare('SELECT * FROM scenarios ORDER BY updated_at DESC, created_at DESC').all().map((row) => ({
    ...row,
    assumptions: row.assumptions_json ? JSON.parse(row.assumptions_json) : {},
    result_snapshot: row.result_snapshot_json ? JSON.parse(row.result_snapshot_json) : null
  }));
};

const deleteScenario = (db, id) => {
  db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
};

export {
  deleteScenario,
  getScenarioById,
  getScenarios,
  runScenario,
  saveScenario
};
