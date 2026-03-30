const ALLOWED_PERIODS = [30, 90, 180];
const DEFAULT_PERIOD_DAYS = 90;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const padNumber = (value) => String(value).padStart(2, '0');

const getCurrentMonthKey = (date = new Date()) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMoney = (value) => Number(toNumber(value, 0).toFixed(2));

const toPercent = (value) => Number(toNumber(value, 0).toFixed(2));

const toDateKey = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.slice(0, 10);
};

const parseDateKey = (value) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeTrendMonth = (value) => {
  const normalized = String(value || '').trim();
  if (!MONTH_KEY_PATTERN.test(normalized)) return getCurrentMonthKey();

  const [yearRaw, monthRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return getCurrentMonthKey();
  }

  return `${year}-${padNumber(month)}`;
};

const getDaysInMonth = (monthKey) => {
  const [yearRaw, monthRaw] = normalizeTrendMonth(monthKey).split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  return new Date(year, month, 0).getDate();
};

const diffDays = (fromDate, toDate) => {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / oneDayMs);
};

const classifyBillStatus = (daysToDue) => {
  if (daysToDue < 0) return 'overdue';
  if (daysToDue <= 7) return 'due_soon';
  return 'upcoming';
};

const normalizeCategoryRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const total = safeRows.reduce((sum, row) => sum + toNumber(row.amount, 0), 0);

  return safeRows.map((row) => {
    const amount = toMoney(row.amount);
    return {
      categoryId: String(row.category_id || row.categoryId || 'uncategorized'),
      category: String(row.category_name || row.category || 'Uncategorized'),
      amount,
      txCount: Math.max(0, Math.floor(toNumber(row.tx_count ?? row.txCount, 0))),
      sharePct: total > 0 ? toPercent((amount / total) * 100) : 0
    };
  });
};

const normalizeBudgetRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows
    .map((row) => {
      const limitAmount = toMoney(Math.max(0, toNumber(row.limit_amount ?? row.limitAmount, 0)));
      const spentAmount = toMoney(Math.max(0, toNumber(row.spent_amount ?? row.spentAmount, 0)));
      const usagePct = limitAmount > 0 ? toPercent((spentAmount / limitAmount) * 100) : 0;
      const alertCount = Math.max(0, Math.floor(toNumber(row.alert_count ?? row.alertCount, 0)));

      return {
        budgetId: String(row.id || row.budget_id || row.budgetId || ''),
        categoryId: String(row.category_id || row.categoryId || 'uncategorized'),
        category: String(row.category_name || row.category || 'Uncategorized'),
        color: String(row.category_color || row.color || '#6B7280') || '#6B7280',
        period: String(row.period || 'monthly'),
        limitAmount,
        spentAmount,
        remainingAmount: toMoney(limitAmount - spentAmount),
        usagePct,
        alertCount,
        status: spentAmount > limitAmount ? 'overspent' : usagePct >= 90 || alertCount > 0 ? 'watch' : 'on_track'
      };
    })
    .filter((row) => row.budgetId);
};

const normalizeDebtRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.map((row) => {
    const balance = toMoney(Math.max(0, toNumber(row.current_balance, 0)));
    const interestRate = toPercent(Math.max(0, toNumber(row.interest_rate, 0)));
    const paymentAmount = toMoney(Math.max(0, toNumber(row.payment_amount, 0)));
    const alertCount = Math.max(0, Math.floor(toNumber(row.alert_count ?? row.alertCount, 0)));
    const riskScore = paymentAmount > 0
      ? toPercent((balance * (1 + (interestRate / 100))) / paymentAmount)
      : toPercent(balance);

    const monthlyPressure = toMoney((balance * (interestRate / 100 / 12)) + paymentAmount);

    return {
      loanId: String(row.id || row.loan_id || ''),
      name: String(row.name || 'Loan'),
      balance,
      interestRate,
      paymentAmount,
      dueStatus: String(row.due_status || 'upcoming'),
      riskScore,
      monthlyPressure,
      alertCount,
      health: row.due_status === 'overdue' ? 'overdue' : riskScore >= 36 ? 'high' : riskScore >= 18 ? 'moderate' : 'low'
    };
  });
};

const normalizeBillRows = (rows, asOfDate) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.map((row) => {
    const dueDate = parseDateKey(row.next_due_date);
    const daysToDue = dueDate ? diffDays(asOfDate, dueDate) : 9999;

    return {
      billId: String(row.id || row.bill_id || ''),
      name: String(row.name || 'Bill'),
      amount: toMoney(Math.max(0, toNumber(row.amount, 0))),
      dueDate: toDateKey(row.next_due_date),
      daysToDue,
      alertCount: Math.max(0, Math.floor(toNumber(row.alert_count ?? row.alertCount, 0))),
      status: classifyBillStatus(daysToDue)
    };
  });
};

const normalizeGoalRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows
    .map((row) => {
      const targetAmount = toMoney(Math.max(0, toNumber(row.target_amount ?? row.targetAmount, 0)));
      const currentAmount = toMoney(Math.max(0, toNumber(row.current_amount ?? row.currentAmount, 0)));

      return {
        goalId: String(row.id || row.goal_id || row.goalId || ''),
        name: String(row.name || 'Goal'),
        currentAmount,
        targetAmount,
        remainingAmount: toMoney(Math.max(targetAmount - currentAmount, 0)),
        progressPct: targetAmount > 0 ? toPercent((currentAmount / targetAmount) * 100) : 0,
        targetDate: toDateKey(row.target_date ?? row.targetDate),
        riskStatus: String((row.risk_status ?? row.riskStatus) || 'normal'),
        linkedAccountName: String((row.linked_account_name ?? row.linkedAccountName) || '')
      };
    })
    .filter((row) => row.goalId);
};

const normalizeTrendTags = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows
    .map((row) => ({
      id: String(row.tag_id || row.tagId || ''),
      name: String(row.tag_name || row.name || 'Tag'),
      color: String(row.tag_color || row.color || '#6B7280') || '#6B7280',
      totalAmount: toMoney(Math.max(0, toNumber(row.amount ?? row.totalAmount, 0))),
      txCount: Math.max(0, Math.floor(toNumber(row.tx_count ?? row.txCount, 0)))
    }))
    .filter((tag) => tag.id);
};

export const buildDashboardExpenseTrend = (input = {}) => {
  const month = normalizeTrendMonth(input.month);
  const asOf = String(input.asOf || new Date().toISOString());
  const currentDay = toDateKey(asOf);
  const totalRows = Array.isArray(input.dailyTotals) ? input.dailyTotals : [];
  const tagRows = Array.isArray(input.dailyTagRows) ? input.dailyTagRows : [];
  const tagOptions = normalizeTrendTags(input.tags);

  const totalByDate = new Map();
  for (const row of totalRows) {
    const dateKey = toDateKey(row.date_key ?? row.dateKey ?? row.date);
    if (!dateKey || !dateKey.startsWith(`${month}-`)) continue;
    totalByDate.set(dateKey, toMoney(Math.max(0, toNumber(row.total_amount ?? row.total ?? row.amount, 0))));
  }

  const tagAmountsByDate = new Map();
  for (const row of tagRows) {
    const dateKey = toDateKey(row.date_key ?? row.dateKey ?? row.date);
    const tagId = String(row.tag_id || row.tagId || '');
    if (!dateKey || !tagId || !dateKey.startsWith(`${month}-`)) continue;

    const current = tagAmountsByDate.get(dateKey) || {};
    current[tagId] = toMoney(Math.max(0, toNumber(row.amount, 0)));
    tagAmountsByDate.set(dateKey, current);
  }

  const points = [];
  const daysInMonth = getDaysInMonth(month);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${padNumber(day)}`;
    points.push({
      date,
      day: padNumber(day),
      total: totalByDate.get(date) || 0,
      tagAmounts: tagAmountsByDate.get(date) || {}
    });
  }

  return {
    month,
    currentDay: currentDay.startsWith(`${month}-`) ? currentDay : null,
    daysInMonth,
    totalMonthSpend: toMoney(points.reduce((sum, point) => sum + toNumber(point.total, 0), 0)),
    tagOptions,
    points
  };
};

export const normalizeOptimizationPeriod = (value) => {
  const period = Math.floor(toNumber(value, DEFAULT_PERIOD_DAYS));
  return ALLOWED_PERIODS.includes(period) ? period : DEFAULT_PERIOD_DAYS;
};

export const buildDashboardOptimizationPayload = (input = {}) => {
  const periodDays = normalizeOptimizationPeriod(input.periodDays ?? input.period_days);
  const asOf = String(input.asOf || new Date().toISOString());
  const asOfDate = parseDateKey(asOf) || new Date();
  asOfDate.setHours(0, 0, 0, 0);

  const categorySpend = normalizeCategoryRows(input.categories);
  const budgetAlignment = normalizeBudgetRows(input.budgets);
  const debtPressure = normalizeDebtRows(input.loans);
  const billsPressure = normalizeBillRows(input.bills, asOfDate);
  const goalProgress = normalizeGoalRows(input.goals);

  const totalSpend = toMoney(Math.max(0, toNumber(input.totalSpend, 0)));
  const billsDue7d = toMoney(Math.max(0, toNumber(input.billsDue7d, 0)));
  const debtLoad = toMoney(Math.max(0, toNumber(input.debtLoad, 0)));

  const overdueBills = billsPressure.filter((bill) => bill.status === 'overdue').length;
  const dueSoonBills = billsPressure.filter((bill) => bill.status === 'due_soon').length;

  return {
    asOf,
    periodDays,
    stats: {
      totalSpend,
      avgDailySpend: toMoney(totalSpend / periodDays),
      billsDue7d,
      debtLoad,
      overdueBills,
      dueSoonBills
    },
    categorySpend,
    budgetAlignment,
    debtPressure,
    billsPressure,
    goalProgress,
    expenseTrend: buildDashboardExpenseTrend({
      month: input.month ?? input.trendMonth,
      asOf,
      dailyTotals: input.dailyTotals ?? input.trendDailyTotals,
      dailyTagRows: input.dailyTagRows ?? input.trendDailyTagRows,
      tags: input.tags ?? input.trendTags
    })
  };
};
