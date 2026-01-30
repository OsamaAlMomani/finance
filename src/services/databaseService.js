import Database from 'better-sqlite3';

let db;

export function initDatabase(dbPath) {
  if (db) return db;

  // Verbose logging for dev
  db = new Database(dbPath, { verbose: console.log });
  db.pragma('journal_mode = WAL');

  createTables();
  seedInitialData();

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase first.");
  }
  return db;
}

function createTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      initial_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'income' or 'expense'
      color TEXT,
      icon TEXT,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      category_id TEXT,
      type TEXT NOT NULL, -- 'income', 'expense', 'transfer'
      amount REAL NOT NULL,
      date TEXT NOT NULL, -- ISO8601 string
      merchant TEXT,
      notes TEXT,
      tags_json TEXT, -- JSON array
      attachment_path TEXT,
      tax_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      period TEXT NOT NULL, -- 'weekly', 'monthly', 'yearly'
      limit_amount REAL NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      target_date TEXT,
      linked_account_id TEXT,
      current_amount REAL DEFAULT 0,
      FOREIGN KEY(linked_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      next_due_date TEXT NOT NULL,
      recurrence TEXT, -- 'monthly', 'weekly', etc.
      is_paid INTEGER DEFAULT 0,
      auto_pay INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tax_rules (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      rate REAL NOT NULL,
      mode TEXT DEFAULT 'flat', -- 'flat', 'included'
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;

  db.exec(schema);
}

function seedInitialData() {
  // Check if categories exist
  const count = db.prepare('SELECT count(*) as c FROM categories').get().c;
  if (count > 0) return;

  const insert = db.prepare('INSERT INTO categories (id, name, type, color, icon, is_default) VALUES (?, ?, ?, ?, ?, 1)');
  
  const defaults = [
    { id: 'cat_salary', name: 'Salary', type: 'income', color: '#10B981', icon: 'money-bill' },
    { id: 'cat_freelance', name: 'Freelance', type: 'income', color: '#34D399', icon: 'laptop' },
    { id: 'cat_food', name: 'Food & Dining', type: 'expense', color: '#EF4444', icon: 'utensils' },
    { id: 'cat_transport', name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'bus' },
    { id: 'cat_housing', name: 'Housing', type: 'expense', color: '#3B82F6', icon: 'home' },
    { id: 'cat_utilities', name: 'Utilities', type: 'expense', color: '#6366F1', icon: 'bolt' },
    { id: 'cat_shopping', name: 'Shopping', type: 'expense', color: '#EC4899', icon: 'shopping-bag' },
    { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', color: '#8B5CF6', icon: 'film' },
    { id: 'cat_health', name: 'Health', type: 'expense', color: '#EF4444', icon: 'heart' },
    { id: 'cat_education', name: 'Education', type: 'expense', color: '#14B8A6', icon: 'book' },
  ];

  const transaction = db.transaction((items) => {
    for (const item of items) insert.run(item.id, item.name, item.type, item.color, item.icon);
  });

  transaction(defaults);
  console.log('Seeded default categories.');
}

// -- Helpers --

// -- Accounts --
export function getAccounts() {
  return db.prepare('SELECT * FROM accounts').all();
}

export function createAccount(account) {
  const stmt = db.prepare(`
    INSERT INTO accounts (id, name, type, currency, initial_balance)
    VALUES (@id, @name, @type, @currency, @initialBalance)
  `);
  stmt.run({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency || 'USD',
    initialBalance: account.initialBalance || 0
  });
  return account;
}

export function updateAccount(account) {
  const stmt = db.prepare(`
    UPDATE accounts SET name = @name, type = @type, currency = @currency, initial_balance = @initialBalance
    WHERE id = @id
  `);
  stmt.run({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    initialBalance: account.initialBalance
  });
  return account;
}

export function deleteAccount(id) {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  // Also delete related transactions? Or cascade?
  // For now simple delete.
  db.prepare('DELETE FROM transactions WHERE account_id = ?').run(id);
}

// -- Transactions --
export function getTransactions(filter = {}) {
  let query = 'SELECT t.*, c.name as category_name, c.color as category_color, a.name as account_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN accounts a ON t.account_id = a.id';
  const params = [];
  const conditions = [];

  if (filter.accountId) {
    conditions.push('t.account_id = ?');
    params.push(filter.accountId);
  }
  
  if (filter.startDate) {
    conditions.push('t.date >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push('t.date <= ?');
    params.push(filter.endDate);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY t.date DESC';

  return db.prepare(query).all(...params).map(t => ({
    ...t,
    tags: t.tags_json ? JSON.parse(t.tags_json) : []
  }));
}

export function addTransaction(tx) {
  const stmt = db.prepare(`
    INSERT INTO transactions (id, account_id, category_id, type, amount, date, merchant, notes, tags_json, attachment_path, tax_amount)
    VALUES (@id, @accountId, @categoryId, @type, @amount, @date, @merchant, @notes, @tagsJson, @attachmentPath, @taxAmount)
  `);
  stmt.run({
    id: tx.id,
    accountId: tx.accountId,
    categoryId: tx.category, // Mapped to category_id
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    merchant: tx.merchant,
    notes: tx.notes,
    tagsJson: JSON.stringify(tx.tags || []),
    attachmentPath: tx.attachmentPath,
    taxAmount: tx.taxAmount || 0
  });
  return tx;
}

export function deleteTransaction(id) {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

// -- Categories --
export function getCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY type, name').all();
}

export function createCategory(cat) {
    const stmt = db.prepare(`
        INSERT INTO categories (id, name, type, color, icon)
        VALUES (@id, @name, @type, @color, @icon)
    `);
    stmt.run({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon
    });
    return cat;
}

export function deleteCategory(id) {
    // Check for usage? Or set null?
    // Setting null for integrity
    db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM budgets WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

// -- Dashboard Stats --
export function getDashboardStats() {
    // Better: sum of account initial_balance + sum of transactions
    const initialBalStart = db.prepare('SELECT SUM(initial_balance) as t FROM accounts').get().t || 0;
    
    const income = db.prepare("SELECT SUM(amount) as t FROM transactions WHERE type = 'income'").get().t || 0;
    const expense = db.prepare("SELECT SUM(amount) as t FROM transactions WHERE type = 'expense'").get().t || 0;
    
    // Recent activity (Last 30 days chart data)
    // Group by date
    const chartData = db.prepare(`
        SELECT date, 
               SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
        FROM transactions 
        WHERE date >= date('now', '-30 days')
        GROUP BY date
        ORDER BY date ASC
    `).all();

    return {
        totalBalance: initialBalStart + income - expense,
        totalIncome: income,
        totalExpense: expense,
        chartData
    };
}

// -- Budgets --
export function getBudgets() {
  return db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color 
    FROM budgets b 
    LEFT JOIN categories c ON b.category_id = c.id
  `).all();
}

export function saveBudget(budget) {
  // Upsert style
  const stmt = db.prepare(`
    INSERT INTO budgets (id, category_id, period, limit_amount)
    VALUES (@id, @categoryId, @period, @limitAmount)
    ON CONFLICT(id) DO UPDATE SET
      category_id = @categoryId,
      period = @period,
      limit_amount = @limitAmount
  `);
  stmt.run({
    id: budget.id,
    categoryId: budget.category_id,
    period: budget.period,
    limitAmount: budget.limit_amount
  });
  return budget;
}

export function deleteBudget(id) {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
}

// -- Goals --
export function getGoals() {
  return db.prepare('SELECT * FROM goals').all();
}

export function saveGoal(goal) {
  const stmt = db.prepare(`
    INSERT INTO goals (id, name, target_amount, target_date, linked_account_id, current_amount)
    VALUES (@id, @name, @targetAmount, @targetDate, @linkedAccountId, @currentAmount)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      target_amount = @targetAmount,
      target_date = @targetDate,
      linked_account_id = @linkedAccountId,
      current_amount = @currentAmount
  `);
  stmt.run({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
    linkedAccountId: goal.linked_account_id,
    currentAmount: goal.current_amount || 0
  });
  return goal;
}

export function deleteGoal(id) {
    db.prepare('DELETE FROM goals WHERE id = ?').run(id);
}

// -- Bills --
export function getBills() {
  return db.prepare('SELECT * FROM bills ORDER BY next_due_date ASC').all();
}

export function saveBill(bill) {
  const stmt = db.prepare(`
    INSERT INTO bills (id, name, amount, next_due_date, recurrence, is_paid, auto_pay)
    VALUES (@id, @name, @amount, @nextDueDate, @recurrence, @isPaid, @autoPay)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      amount = @amount,
      next_due_date = @nextDueDate,
      recurrence = @recurrence,
      is_paid = @isPaid,
      auto_pay = @autoPay
  `);
  stmt.run({
    id: bill.id,
    name: bill.name,
    amount: bill.amount,
    nextDueDate: bill.next_due_date,
    recurrence: bill.recurrence,
    isPaid: bill.is_paid ? 1 : 0,
    autoPay: bill.auto_pay ? 1 : 0
  });
  return bill;
}

export function deleteBill(id) {
    db.prepare('DELETE FROM bills WHERE id = ?').run(id);
}

