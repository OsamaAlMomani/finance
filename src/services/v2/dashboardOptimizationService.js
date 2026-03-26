const ALLOWED_PERIODS = [30, 90, 180];
const DEFAULT_PERIOD_DAYS = 90;

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

const normalizeDebtRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.map((row) => {
    const balance = toMoney(Math.max(0, toNumber(row.current_balance, 0)));
    const interestRate = toPercent(Math.max(0, toNumber(row.interest_rate, 0)));
    const paymentAmount = toMoney(Math.max(0, toNumber(row.payment_amount, 0)));
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
      status: classifyBillStatus(daysToDue)
    };
  });
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
  const debtPressure = normalizeDebtRows(input.loans);
  const billsPressure = normalizeBillRows(input.bills, asOfDate);

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
    debtPressure,
    billsPressure
  };
};
