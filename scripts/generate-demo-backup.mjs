import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const demoDir = path.join(repoRoot, 'demo');

fs.mkdirSync(demoDir, { recursive: true });

const pad = (value) => String(value).padStart(2, '0');
const addMonths = (date, delta) => {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + delta);
  return next;
};
const toMonthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const daysInMonth = (monthKey) => {
  const [yearRaw, monthRaw] = monthKey.split('-');
  return new Date(Number(yearRaw), Number(monthRaw), 0).getDate();
};
const toDateKey = (monthKey, day) => {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safeDay = Math.min(Math.max(day, 1), daysInMonth(monthKey));
  return `${year}-${pad(month)}-${pad(safeDay)}`;
};
const toIso = (dateKey, hour = 12, minute = 0) => `${dateKey}T${pad(hour)}:${pad(minute)}:00.000Z`;

const now = new Date();
now.setHours(12, 0, 0, 0);

const months = {
  previous2: toMonthKey(addMonths(now, -2)),
  previous1: toMonthKey(addMonths(now, -1)),
  current: toMonthKey(now),
  next: toMonthKey(addMonths(now, 1))
};
const currentDayOfMonth = now.getDate();

const activeUserIds = (() => {
  const ids = new Set(['local']);
  const usersPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'finance', 'users.json')
    : null;

  if (!usersPath || !fs.existsSync(usersPath)) return [...ids];

  try {
    const raw = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    if (raw?.activeUserId) ids.add(String(raw.activeUserId));
    for (const user of raw?.users || []) {
      if (user?.id) ids.add(String(user.id));
    }
  } catch {
    // Fall back to the default permission subject.
  }

  return [...ids];
})();

const categories = [
  { id: 'cat_salary', name: 'Salary', type: 'income', color: '#10B981', icon: 'money-bill', is_default: 1 },
  { id: 'cat_freelance', name: 'Freelance', type: 'income', color: '#34D399', icon: 'laptop', is_default: 1 },
  { id: 'cat_food', name: 'Groceries', type: 'expense', color: '#22C55E', icon: 'shopping-cart', is_default: 1 },
  { id: 'cat_dining', name: 'Dining & Coffee', type: 'expense', color: '#F97316', icon: 'utensils', is_default: 0 },
  { id: 'cat_transport', name: 'Transport', type: 'expense', color: '#3B82F6', icon: 'bus', is_default: 1 },
  { id: 'cat_housing', name: 'Housing & Rent', type: 'expense', color: '#2563EB', icon: 'home', is_default: 1 },
  { id: 'cat_utilities', name: 'Utilities', type: 'expense', color: '#6366F1', icon: 'bolt', is_default: 1 },
  { id: 'cat_health', name: 'Health & Wellness', type: 'expense', color: '#EF4444', icon: 'heart', is_default: 1 },
  { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', color: '#A855F7', icon: 'film', is_default: 1 },
  { id: 'cat_shopping', name: 'Shopping', type: 'expense', color: '#EC4899', icon: 'shopping-bag', is_default: 1 }
];

const tags = [
  { id: 'tag_groceries', name: 'groceries', color: '#22C55E' },
  { id: 'tag_commute', name: 'commute', color: '#0EA5E9' },
  { id: 'tag_home', name: 'home', color: '#2563EB' },
  { id: 'tag_wellness', name: 'wellness', color: '#F43F5E' },
  { id: 'tag_fun', name: 'fun', color: '#A855F7' },
  { id: 'tag_subscription', name: 'subscription', color: '#64748B' }
];

const tagLookup = Object.fromEntries(tags.map((tag) => [tag.id, tag]));
const categoryLookup = Object.fromEntries(categories.map((category) => [category.id, category]));

const accounts = [
  { id: 'acc_main', name: 'Main Checking', type: 'checking', currency: 'JOD', initial_balance: 1450, created_at: toIso(toDateKey(months.previous2, 1), 9) },
  { id: 'acc_savings', name: 'Rainy Day Savings', type: 'savings', currency: 'JOD', initial_balance: 5200, created_at: toIso(toDateKey(months.previous2, 1), 9) },
  { id: 'acc_credit', name: 'Travel Credit Card', type: 'credit', currency: 'JOD', initial_balance: -380, created_at: toIso(toDateKey(months.previous2, 1), 9) },
  { id: 'acc_cash', name: 'Daily Cash Wallet', type: 'cash', currency: 'JOD', initial_balance: 140, created_at: toIso(toDateKey(months.previous2, 1), 9) }
];

const subcategories = [
  { id: 'sub_fresh', category_id: 'cat_food', name: 'Fresh Market', created_at: toIso(toDateKey(months.previous2, 1), 10) },
  { id: 'sub_fuel', category_id: 'cat_transport', name: 'Fuel', created_at: toIso(toDateKey(months.previous2, 1), 10) },
  { id: 'sub_home_services', category_id: 'cat_housing', name: 'Home Services', created_at: toIso(toDateKey(months.previous2, 1), 10) },
  { id: 'sub_connectivity', category_id: 'cat_utilities', name: 'Connectivity', created_at: toIso(toDateKey(months.previous2, 1), 10) },
  { id: 'sub_wellness', category_id: 'cat_health', name: 'Wellness', created_at: toIso(toDateKey(months.previous2, 1), 10) }
];

const budgets = [
  { id: 'budget_groceries', category_id: 'cat_food', period: 'monthly', limit_amount: 260 },
  { id: 'budget_dining', category_id: 'cat_dining', period: 'monthly', limit_amount: 130 },
  { id: 'budget_transport', category_id: 'cat_transport', period: 'monthly', limit_amount: 150 },
  { id: 'budget_housing', category_id: 'cat_housing', period: 'monthly', limit_amount: 580 },
  { id: 'budget_utilities', category_id: 'cat_utilities', period: 'monthly', limit_amount: 170 },
  { id: 'budget_health', category_id: 'cat_health', period: 'monthly', limit_amount: 90 },
  { id: 'budget_fun', category_id: 'cat_entertainment', period: 'monthly', limit_amount: 95 },
  { id: 'budget_shopping', category_id: 'cat_shopping', period: 'monthly', limit_amount: 120 }
];

const goals = [
  {
    id: 'goal_emergency',
    name: 'Emergency Fund',
    target_amount: 5000,
    target_date: toDateKey(toMonthKey(addMonths(now, 5)), 20),
    linked_account_id: 'acc_savings',
    current_amount: 1850,
    goal_type: 'safety',
    priority: 'high',
    funding_source: 'salary',
    risk_status: 'normal',
    protected_pool: 1
  },
  {
    id: 'goal_trip',
    name: 'Summer Getaway',
    target_amount: 1200,
    target_date: toDateKey(toMonthKey(addMonths(now, 3)), 20),
    linked_account_id: 'acc_savings',
    current_amount: 460,
    goal_type: 'lifestyle',
    priority: 'medium',
    funding_source: 'freelance',
    risk_status: 'watch',
    protected_pool: 0
  }
];

const goalContributions = [
  { id: 'goal_contrib_emergency_prev2', goal_id: 'goal_emergency', transaction_id: null, amount: 550, date: toDateKey(months.previous2, 4), source_type: 'manual', source_id: 'seed_prev2', notes: 'Kickoff deposit', created_at: toIso(toDateKey(months.previous2, 4), 18) },
  { id: 'goal_contrib_emergency_prev1', goal_id: 'goal_emergency', transaction_id: null, amount: 650, date: toDateKey(months.previous1, 5), source_type: 'manual', source_id: 'seed_prev1', notes: 'Monthly top-up', created_at: toIso(toDateKey(months.previous1, 5), 18) },
  { id: 'goal_contrib_trip_current', goal_id: 'goal_trip', transaction_id: null, amount: 260, date: toDateKey(months.current, Math.min(15, currentDayOfMonth)), source_type: 'manual', source_id: 'seed_current', notes: 'Freelance bonus allocation', created_at: toIso(toDateKey(months.current, Math.min(15, currentDayOfMonth)), 18) }
];

const bills = [
  { id: 'bill_rent', name: 'Apartment Rent', amount: 520, next_due_date: toDateKey(months.next, 1), recurrence: 'monthly', is_paid: 0, auto_pay: 1 },
  { id: 'bill_internet', name: 'Fiber Internet', amount: 32, next_due_date: toDateKey(months.next, 12), recurrence: 'monthly', is_paid: 0, auto_pay: 1 },
  { id: 'bill_electricity', name: 'Electricity', amount: 63, next_due_date: toDateKey(months.next, 14), recurrence: 'monthly', is_paid: 0, auto_pay: 0 },
  { id: 'bill_phone', name: 'Mobile Plan', amount: 19, next_due_date: toDateKey(months.previous1, 24), recurrence: 'monthly', is_paid: 0, auto_pay: 0 },
  { id: 'bill_stream', name: 'Streaming Bundle', amount: 12, next_due_date: toDateKey(months.next, 22), recurrence: 'monthly', is_paid: 0, auto_pay: 1 }
];

const loans = [
  {
    id: 'loan_car',
    name: 'Car Loan',
    principal_amount: 12000,
    current_balance: 9070,
    interest_rate: 5.9,
    payment_amount: 285,
    payment_frequency: 'monthly',
    start_date: toDateKey(toMonthKey(addMonths(now, -18)), 6),
    end_date: toDateKey(toMonthKey(addMonths(now, 24)), 6),
    linked_account_id: 'acc_main',
    lender: 'Jordan City Bank',
    notes: 'Fixed-rate car financing',
    next_due_date: toDateKey(months.next, 6),
    due_status: 'upcoming',
    created_at: toIso(toDateKey(toMonthKey(addMonths(now, -18)), 6), 14)
  }
];

const loanPayments = [
  { id: 'loan_payment_prev1', loan_id: 'loan_car', amount: 285, balance_before: 9550, balance_after: 9310, paid_at: toDateKey(months.previous1, 6), note: 'Autopay', created_at: toIso(toDateKey(months.previous1, 6), 8) },
  { id: 'loan_payment_current', loan_id: 'loan_car', amount: 285, balance_before: 9310, balance_after: 9070, paid_at: toDateKey(months.current, Math.min(6, currentDayOfMonth)), note: 'Autopay', created_at: toIso(toDateKey(months.current, Math.min(6, currentDayOfMonth)), 8) }
];

const recurringItems = [
  { id: 'rec_salary', name: 'Salary Deposit', account_id: 'acc_main', category_id: 'cat_salary', subcategory_id: null, type: 'income', amount: 1725, start_date: toDateKey(months.previous2, 1), next_due_date: toDateKey(months.next, 1), frequency: 'monthly', status: 'active', notes: 'Expected salary on the first business day', last_applied_at: toDateKey(months.current, 1), created_at: toIso(toDateKey(months.previous2, 1), 7), updated_at: toIso(toDateKey(months.current, 1), 7) },
  { id: 'rec_rent', name: 'Apartment Rent', account_id: 'acc_main', category_id: 'cat_housing', subcategory_id: 'sub_home_services', type: 'expense', amount: 520, start_date: toDateKey(months.previous2, 1), next_due_date: toDateKey(months.next, 1), frequency: 'monthly', status: 'active', notes: 'Landlord transfer', last_applied_at: toDateKey(months.current, 1), created_at: toIso(toDateKey(months.previous2, 1), 7), updated_at: toIso(toDateKey(months.current, 1), 7) },
  { id: 'rec_internet', name: 'Fiber Internet', account_id: 'acc_credit', category_id: 'cat_utilities', subcategory_id: 'sub_connectivity', type: 'expense', amount: 32, start_date: toDateKey(months.previous2, 12), next_due_date: toDateKey(months.next, 12), frequency: 'monthly', status: 'active', notes: 'Auto-billed on credit card', last_applied_at: toDateKey(months.current, Math.min(12, currentDayOfMonth)), created_at: toIso(toDateKey(months.previous2, 12), 7), updated_at: toIso(toDateKey(months.current, Math.min(12, currentDayOfMonth)), 7) }
];

const plans = [
  { id: 'plan_emergency', item_type: 'goal', item_id: 'goal_emergency', title: 'Push emergency fund above 40%', scenario_if: 'Keep saving 220 JOD monthly', scenario_else: 'Pause top-ups if checking drops below 900 JOD', what_if: 'Trim entertainment spend for 6 weeks', outcome: 'Emergency reserve crosses halfway point before summer', months_overdue: 0, created_at: toIso(toDateKey(months.previous1, 10), 13) },
  { id: 'plan_loan', item_type: 'loan', item_id: 'loan_car', title: 'Accelerate car loan payoff', scenario_if: 'Add 60 JOD extra after freelance income lands', scenario_else: 'Stay on standard payment', what_if: 'Redirect one shopping weekend per month', outcome: 'Loan term drops by roughly 4 months', months_overdue: 1, created_at: toIso(toDateKey(months.current, Math.min(11, currentDayOfMonth)), 13) }
];

const scenarios = [
  {
    id: 'scenario_balanced_spring',
    title: 'Balanced Spring Plan',
    assumptions_json: JSON.stringify({ duration_months: 6, monthly_income: 1990, monthly_expense: 1375, extra_monthly_expense: 0, one_off_expense: 0, start_balance: 6120 }),
    duration_months: 6,
    result_snapshot_json: JSON.stringify({ projectedBalance: 7810, risk: 'low', commentary: 'Healthy monthly surplus with room to top up goals and stay current on debt.' }),
    risk_level: 'low',
    created_at: toIso(toDateKey(months.previous1, 20), 16),
    updated_at: toIso(toDateKey(months.current, Math.min(18, currentDayOfMonth)), 16)
  }
];

const expenseTemplates = [
  { day: 1, merchant: 'Apartment Rent', amount: 520, categoryId: 'cat_housing', subcategoryId: 'sub_home_services', tagIds: ['tag_home'], accountId: 'acc_main' },
  { day: 2, merchant: 'Fresh Basket Market', amount: 48, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' },
  { day: 3, merchant: 'City Fuel Stop', amount: 29, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', tagIds: ['tag_commute'], accountId: 'acc_main' },
  { day: 4, merchant: 'Corner Coffee', amount: 8, categoryId: 'cat_dining', subcategoryId: null, tagIds: ['tag_fun'], accountId: 'acc_cash' },
  { day: 5, merchant: 'Fiber Internet', amount: 32, categoryId: 'cat_utilities', subcategoryId: 'sub_connectivity', tagIds: ['tag_subscription'], accountId: 'acc_credit' },
  { day: 6, merchant: 'Neighborhood Market', amount: 41, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' },
  { day: 7, merchant: 'Pharmacy Plus', amount: 18, categoryId: 'cat_health', subcategoryId: 'sub_wellness', tagIds: ['tag_wellness'], accountId: 'acc_main' },
  { day: 8, merchant: 'Streaming Bundle', amount: 12, categoryId: 'cat_entertainment', subcategoryId: null, tagIds: ['tag_subscription'], accountId: 'acc_credit' },
  { day: 9, merchant: 'Ride Hailing', amount: 11, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', tagIds: ['tag_commute'], accountId: 'acc_main' },
  { day: 10, merchant: 'Home Essentials', amount: 36, categoryId: 'cat_shopping', subcategoryId: null, tagIds: ['tag_home'], accountId: 'acc_credit' },
  { day: 11, merchant: 'Fresh Basket Market', amount: 44, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' },
  { day: 12, merchant: 'Lunch Meeting', amount: 19, categoryId: 'cat_dining', subcategoryId: null, tagIds: ['tag_fun'], accountId: 'acc_main' },
  { day: 13, merchant: 'Electricity Top-Up', amount: 63, categoryId: 'cat_utilities', subcategoryId: 'sub_connectivity', tagIds: ['tag_home'], accountId: 'acc_main' },
  { day: 14, merchant: 'City Fuel Stop', amount: 27, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', tagIds: ['tag_commute'], accountId: 'acc_main' },
  { day: 15, merchant: 'Green Valley Grocer', amount: 52, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' },
  { day: 16, merchant: 'Gym Membership', amount: 20, categoryId: 'cat_health', subcategoryId: 'sub_wellness', tagIds: ['tag_wellness'], accountId: 'acc_credit' },
  { day: 17, merchant: 'Dinner Out', amount: 24, categoryId: 'cat_dining', subcategoryId: null, tagIds: ['tag_fun'], accountId: 'acc_credit' },
  { day: 18, merchant: 'Cleaning Supplies', amount: 28, categoryId: 'cat_shopping', subcategoryId: null, tagIds: ['tag_home'], accountId: 'acc_main' },
  { day: 19, merchant: 'Bus Card Reload', amount: 9, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', tagIds: ['tag_commute'], accountId: 'acc_cash' },
  { day: 20, merchant: 'Movie Night', amount: 14, categoryId: 'cat_entertainment', subcategoryId: null, tagIds: ['tag_fun'], accountId: 'acc_credit' },
  { day: 21, merchant: 'Neighborhood Market', amount: 46, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' },
  { day: 22, merchant: 'Mobile Plan', amount: 19, categoryId: 'cat_utilities', subcategoryId: 'sub_connectivity', tagIds: ['tag_subscription'], accountId: 'acc_credit' },
  { day: 23, merchant: 'Dentist Visit', amount: 37, categoryId: 'cat_health', subcategoryId: 'sub_wellness', tagIds: ['tag_wellness'], accountId: 'acc_main' },
  { day: 24, merchant: 'Corner Coffee', amount: 7, categoryId: 'cat_dining', subcategoryId: null, tagIds: ['tag_fun'], accountId: 'acc_cash' },
  { day: 25, merchant: 'City Fuel Stop', amount: 31, categoryId: 'cat_transport', subcategoryId: 'sub_fuel', tagIds: ['tag_commute'], accountId: 'acc_main' },
  { day: 26, merchant: 'Fresh Basket Market', amount: 49, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' },
  { day: 27, merchant: 'Home Cleaning', amount: 28, categoryId: 'cat_shopping', subcategoryId: null, tagIds: ['tag_home'], accountId: 'acc_main' },
  { day: 28, merchant: 'Weekend Park', amount: 13, categoryId: 'cat_entertainment', subcategoryId: null, tagIds: ['tag_fun'], accountId: 'acc_cash' },
  { day: 29, merchant: 'Internet Add-On', amount: 8, categoryId: 'cat_utilities', subcategoryId: 'sub_connectivity', tagIds: ['tag_subscription'], accountId: 'acc_credit' },
  { day: 30, merchant: 'Green Valley Grocer', amount: 54, categoryId: 'cat_food', subcategoryId: 'sub_fresh', tagIds: ['tag_groceries'], accountId: 'acc_main' }
];

const transactionBlueprints = [];
const pushTransaction = ({ id, monthKey, day, type, amount, merchant, categoryId = null, subcategoryId = null, accountId = 'acc_main', toAccountId = null, tagIds = [], notes = '' }) => {
  const date = toDateKey(monthKey, day);
  transactionBlueprints.push({
    id,
    account_id: accountId,
    to_account_id: toAccountId,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    type,
    amount: Number(amount.toFixed(2)),
    date,
    merchant,
    notes,
    tags_json: JSON.stringify(tagIds.map((tagId) => tagLookup[tagId]?.name).filter(Boolean)),
    attachment_path: null,
    tax_amount: 0,
    dedupe_hash: null,
    settlement_month: null,
    locked_by_settlement: 0,
    created_at: toIso(date, type === 'income' ? 8 : 12),
    tagIds
  });
};

for (const [index, monthKey] of [months.previous2, months.previous1, months.current].entries()) {
  const salaryAmount = [1680, 1710, 1725][index];
  const freelanceAmount = [190, 240, 320][index];
  const savingsTransfer = [180, 200, 220][index];
  const creditPayment = [92, 108, 124][index];
  const factor = [0.91, 0.96, 1][index];

  pushTransaction({ id: `tx_salary_${monthKey}`, monthKey, day: 1, type: 'income', amount: salaryAmount, merchant: 'Acme Holdings Payroll', categoryId: 'cat_salary', accountId: 'acc_main', notes: 'Primary salary deposit' });
  pushTransaction({ id: `tx_freelance_${monthKey}`, monthKey, day: 12, type: 'income', amount: freelanceAmount, merchant: 'Side Project Invoice', categoryId: 'cat_freelance', accountId: 'acc_main', notes: 'Freelance design and analytics work' });
  pushTransaction({ id: `tx_transfer_savings_${monthKey}`, monthKey, day: 3, type: 'transfer', amount: savingsTransfer, merchant: 'Savings Transfer', accountId: 'acc_main', toAccountId: 'acc_savings', notes: 'Monthly savings sweep' });
  pushTransaction({ id: `tx_transfer_credit_${monthKey}`, monthKey, day: 26, type: 'transfer', amount: creditPayment, merchant: 'Credit Card Payment', accountId: 'acc_main', toAccountId: 'acc_credit', notes: 'Card balance payment' });

  for (const template of expenseTemplates) {
    if (template.day > daysInMonth(monthKey)) continue;
    if (monthKey === months.current && template.day > currentDayOfMonth) continue;

    const amount = monthKey === months.current ? template.amount : Math.max(4, Number((template.amount * factor).toFixed(2)));
    pushTransaction({
      id: `tx_${monthKey}_${pad(template.day)}_${template.accountId}_${template.categoryId}`,
      monthKey,
      day: template.day,
      type: 'expense',
      amount,
      merchant: template.merchant,
      categoryId: template.categoryId,
      subcategoryId: template.subcategoryId,
      accountId: template.accountId,
      tagIds: template.tagIds,
      notes: `${template.merchant} purchase`
    });
  }
}

const transactions = transactionBlueprints.map(({ tagIds, ...row }) => row);
const transactionTags = transactionBlueprints.flatMap((tx) => tx.tagIds.map((tagId) => ({ transaction_id: tx.id, tag_id: tagId })));

const buildCashFlow = (monthKey) => transactionBlueprints.reduce((acc, tx) => {
  if (!tx.date.startsWith(`${monthKey}-`)) return acc;
  if (tx.type === 'income') acc.income += tx.amount;
  if (tx.type === 'expense') acc.expense += tx.amount;
  return acc;
}, { income: 0, expense: 0, net: 0 });

const previousMonthSpend = new Map();
for (const tx of transactionBlueprints) {
  if (tx.type !== 'expense' || !tx.date.startsWith(`${months.previous1}-`) || !tx.category_id) continue;
  previousMonthSpend.set(tx.category_id, (previousMonthSpend.get(tx.category_id) || 0) + tx.amount);
}

const tagBreakdown = (() => {
  const amounts = new Map();
  const counts = new Map();
  for (const tx of transactionBlueprints) {
    if (tx.type !== 'expense' || !tx.date.startsWith(`${months.previous1}-`)) continue;
    for (const tagId of tx.tagIds) {
      amounts.set(tagId, (amounts.get(tagId) || 0) + tx.amount);
      counts.set(tagId, (counts.get(tagId) || 0) + 1);
    }
  }
  return [...amounts.entries()].sort((a, b) => b[1] - a[1]).map(([tagId, amount]) => ({
    tag: tagLookup[tagId]?.name || tagId,
    count: counts.get(tagId) || 0,
    amount: Number(amount.toFixed(2))
  }));
})();

const reportSnapshot = {
  cashFlow: (() => {
    const flow = buildCashFlow(months.previous1);
    return { income: Number(flow.income.toFixed(2)), expense: Number(flow.expense.toFixed(2)), net: Number((flow.income - flow.expense).toFixed(2)) };
  })(),
  actualVsBudget: budgets.map((budget) => {
    const spent = Number((previousMonthSpend.get(budget.category_id) || 0).toFixed(2));
    return {
      categoryName: categoryLookup[budget.category_id]?.name || budget.category_id,
      limitAmount: budget.limit_amount,
      spent,
      variance: Number((budget.limit_amount - spent).toFixed(2))
    };
  }),
  goalProgress: goals.map((goal) => ({ name: goal.name, current_amount: goal.current_amount, target_amount: goal.target_amount, goal_type: goal.goal_type, risk_status: goal.risk_status })),
  loanStatus: loans.map((loan) => ({ name: loan.name, current_balance: loan.current_balance, next_due_date: loan.next_due_date, due_status: loan.due_status })),
  tagBreakdown,
  labelBreakdown: [],
  riskNotes: [
    'Phone bill remains overdue and should be cleared first.',
    'Dining spend is close to the monthly limit and should be watched this month.',
    'Emergency fund progress is healthy, but the car loan still drives fixed-cost pressure.'
  ]
};

const settlements = [
  {
    id: `settlement_${months.previous1}`,
    month: months.previous1,
    status: 'finalized',
    reconciled_at: toIso(toDateKey(months.previous1, 28), 18, 30),
    notes: 'Closed after payroll, bills, and loan payment matched expected balances.',
    checklist_json: JSON.stringify({ items: [{ key: 'tx-review', label: 'Transactions were categorized for the month', done: true }, { key: 'alerts-review', label: 'Alerts were cleared before close', done: true }, { key: 'bills-review', label: 'Bills and loans were reconciled', done: true }], unresolvedCount: 0 }),
    unresolved_count: 0,
    is_dirty: 0,
    created_at: toIso(toDateKey(months.previous1, 1), 9),
    updated_at: toIso(toDateKey(months.previous1, 28), 18, 30)
  },
  {
    id: `settlement_${months.current}`,
    month: months.current,
    status: 'in_review',
    reconciled_at: null,
    notes: 'Waiting on one overdue phone bill and a final weekend expense review.',
    checklist_json: JSON.stringify({ items: [{ key: 'tx-review', label: 'Transactions are categorized for the current month', done: true }, { key: 'alerts-review', label: 'Active alerts reviewed', done: false }, { key: 'bills-review', label: 'Upcoming bills checked', done: true }], unresolvedCount: 2 }),
    unresolved_count: 2,
    is_dirty: 1,
    created_at: toIso(toDateKey(months.current, 1), 9),
    updated_at: toIso(toDateKey(months.current, Math.min(currentDayOfMonth, 28)), 18, 10)
  }
];

const reports = [
  {
    id: `report_${months.previous1}`,
    month: months.previous1,
    settlement_id: `settlement_${months.previous1}`,
    generated_at: toIso(toDateKey(months.previous1, 28), 19),
    snapshot_data_json: JSON.stringify(reportSnapshot),
    created_at: toIso(toDateKey(months.previous1, 28), 19)
  }
];

const reportExports = [
  {
    id: `report_export_${months.previous1}_csv`,
    report_id: `report_${months.previous1}`,
    month: months.previous1,
    format: 'csv',
    actor_subject_type: 'user',
    actor_subject_id: activeUserIds[0],
    file_name: `monthly_report_${months.previous1}.csv`,
    metadata_json: JSON.stringify({ origin: 'demo-generator' }),
    created_at: toIso(toDateKey(months.previous1, 28), 19, 5)
  }
];

const alerts = [
  { id: 'alert_overdue_phone', source_type: 'bill', source_id: 'bill_phone', trigger_type: 'overdue', condition_text: 'Phone bill due date passed', severity: 'warning', message: 'Phone bill is overdue and should be cleared this week.', recommended_action: 'Pay the overdue phone bill from checking.', status: 'active', snoozed_until: null, acknowledged_at: null, resolved_at: null, created_at: toIso(toDateKey(months.current, Math.min(10, currentDayOfMonth)), 9), updated_at: toIso(toDateKey(months.current, Math.min(10, currentDayOfMonth)), 9) },
  { id: 'alert_dining_budget', source_type: 'budget', source_id: 'budget_dining', trigger_type: 'threshold', condition_text: 'Dining budget reached 80%', severity: 'info', message: 'Dining and coffee spend is approaching the monthly limit.', recommended_action: 'Swap two eating-out days for home meals.', status: 'active', snoozed_until: null, acknowledged_at: null, resolved_at: null, created_at: toIso(toDateKey(months.current, Math.min(20, currentDayOfMonth)), 9), updated_at: toIso(toDateKey(months.current, Math.min(20, currentDayOfMonth)), 9) },
  { id: 'alert_subscription_review', source_type: 'tag', source_id: 'tag_subscription', trigger_type: 'review', condition_text: 'Subscription spend review scheduled', severity: 'warning', message: 'Subscription costs increased compared with two months ago.', recommended_action: 'Review the streaming bundle and add-ons.', status: 'acknowledged', snoozed_until: null, acknowledged_at: toIso(toDateKey(months.current, Math.min(22, currentDayOfMonth)), 14), resolved_at: null, created_at: toIso(toDateKey(months.current, Math.min(21, currentDayOfMonth)), 9), updated_at: toIso(toDateKey(months.current, Math.min(22, currentDayOfMonth)), 14) },
  { id: 'alert_trip_pause', source_type: 'goal', source_id: 'goal_trip', trigger_type: 'snooze', condition_text: 'Vacation goal temporarily paused', severity: 'info', message: 'Vacation savings can wait until the overdue bill is cleared.', recommended_action: 'Revisit this goal after the phone bill is paid.', status: 'snoozed', snoozed_until: toIso(toDateKey(months.next, 5), 10), acknowledged_at: null, resolved_at: null, created_at: toIso(toDateKey(months.current, Math.min(24, currentDayOfMonth)), 9), updated_at: toIso(toDateKey(months.current, Math.min(24, currentDayOfMonth)), 9) },
  { id: 'alert_prev_resolved', source_type: 'loan', source_id: 'loan_car', trigger_type: 'resolved', condition_text: 'Previous due warning was cleared', severity: 'info', message: 'Loan payment posted successfully.', recommended_action: 'No action required.', status: 'resolved', snoozed_until: null, acknowledged_at: toIso(toDateKey(months.previous1, 6), 9), resolved_at: toIso(toDateKey(months.previous1, 6), 9), created_at: toIso(toDateKey(months.previous1, 5), 8), updated_at: toIso(toDateKey(months.previous1, 6), 9) }
];

const alertEvents = [
  { id: 'alert_event_subscription_ack', alert_id: 'alert_subscription_review', trigger_type: 'review', condition_text: 'Subscription spend review scheduled', severity: 'warning', action: 'acknowledge', before_status: 'active', after_status: 'acknowledged', actor_subject_type: 'user', actor_subject_id: activeUserIds[0], metadata_json: JSON.stringify({ origin: 'demo-generator' }), created_at: toIso(toDateKey(months.current, Math.min(22, currentDayOfMonth)), 14) },
  { id: 'alert_event_trip_snooze', alert_id: 'alert_trip_pause', trigger_type: 'snooze', condition_text: 'Vacation goal temporarily paused', severity: 'info', action: 'snooze', before_status: 'active', after_status: 'snoozed', actor_subject_type: 'user', actor_subject_id: activeUserIds[0], metadata_json: JSON.stringify({ until: toIso(toDateKey(months.next, 5), 10) }), created_at: toIso(toDateKey(months.current, Math.min(24, currentDayOfMonth)), 9) }
];

const settlementEvents = [
  { id: `settlement_event_${months.previous1}_finalize`, settlement_id: `settlement_${months.previous1}`, month: months.previous1, action: 'finalize', before_status: 'in_review', after_status: 'finalized', actor_subject_type: 'user', actor_subject_id: activeUserIds[0], notes: 'Demo month finalized for reporting.', metadata_json: JSON.stringify({ origin: 'demo-generator' }), created_at: toIso(toDateKey(months.previous1, 28), 18, 30) }
];

const permissions = activeUserIds.map((subjectId) => ({
  id: `perm_global_user_${subjectId}`,
  scope_type: 'global',
  scope_id: 'global',
  role: 'Owner',
  visibility: 'private',
  subject_type: 'user',
  subject_id: subjectId,
  created_at: toIso(toDateKey(months.previous2, 1), 8),
  updated_at: toIso(toDateKey(months.current, Math.min(currentDayOfMonth, 28)), 8)
}));

const payload = {
  accounts,
  categories,
  subcategories,
  tags,
  labels: [],
  classification_rules: [],
  transactions,
  transaction_tags: transactionTags,
  transaction_labels: [],
  budgets,
  goals,
  goal_contributions: goalContributions,
  bills,
  loans,
  loan_payments: loanPayments,
  realtime_state: [],
  metadata_entries: [],
  plans,
  recurring_items: recurringItems,
  scenarios,
  alerts,
  alert_events: alertEvents,
  monthly_settlements: settlements,
  settlement_events: settlementEvents,
  monthly_reports: reports,
  report_exports: reportExports,
  permissions,
  share_snapshots: [],
  tax_rules: [],
  app_settings: [
    { key: 'schema_version', value: '2' },
    { key: 'requires_v2_upgrade', value: '0' },
    { key: 'default_currency', value: 'JOD' }
  ]
};

const jsonPath = path.join(demoDir, 'finance_demo_backup.json');
const zipPath = path.join(demoDir, 'finance_demo_backup.zip');

fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

const zip = new JSZip();
zip.file('backup.json', JSON.stringify(payload, null, 2));
const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(zipPath, zipBuffer);

console.log(JSON.stringify({
  generatedAt: now.toISOString(),
  output: {
    json: path.relative(repoRoot, jsonPath),
    zip: path.relative(repoRoot, zipPath)
  },
  counts: {
    accounts: accounts.length,
    categories: categories.length,
    tags: tags.length,
    transactions: transactions.length,
    budgets: budgets.length,
    goals: goals.length,
    bills: bills.length,
    loans: loans.length,
    alerts: alerts.length,
    settlements: settlements.length,
    reports: reports.length
  }
}, null, 2));
