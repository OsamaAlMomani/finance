import Database from 'better-sqlite3';
import { format } from 'util';
import {
  applyClassificationToTransaction,
  deleteClassificationRule,
  deleteLabel,
  deleteSubcategory,
  deleteTag,
  getClassificationRules,
  getLabels,
  getSubcategories,
  getTags,
  getTransactionClassification,
  upsertClassificationRule,
  upsertLabel,
  upsertSubcategory,
  upsertTag
} from './v2/classificationService.js';
import {
  evaluateAlertsForTransaction,
  getAlerts,
  summarizeAlertCounts,
  updateAlertStatus
} from './v2/alertsService.js';
import {
  generateMonthlyReport,
  getMonthlyReportByMonth,
  getMonthlyReports,
  getReportCsv,
  getReportPdfLikeContent
} from './v2/reportsService.js';
import {
  assertMonthEditableForDate,
  assertTransactionEditable,
  finalizeSettlement,
  getSettlementByMonth,
  getSettlements,
  markSettlementDirty,
  reopenSettlement
} from './v2/settlementService.js';
import {
  deleteScenario,
  getScenarioById,
  getScenarios,
  runScenario,
  saveScenario
} from './v2/scenariosService.js';
import {
  checkPermission,
  deletePermission,
  enforcePermission,
  ensureDefaultOwnerPermission,
  getPermissions,
  savePermission
} from './v2/permissionsService.js';
import {
  createShareSnapshot,
  exportShareSnapshotPackage,
  listShareSnapshots,
  revokeShareSnapshot
} from './v2/sharingService.js';

let db;
const SCHEMA_VERSION = 2;

const isBrokenPipeError = (error) => {
  const code = error?.code;
  return code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED';
};

const writeToStream = (stream, args) => {
  if (!stream || stream.destroyed || !stream.writable) return;
  const message = format(...args);
  try {
    stream.write(`${message}\n`);
  } catch (error) {
    if (!isBrokenPipeError(error)) throw error;
  }
};

const safeLog = (...args) => {
  try {
    writeToStream(process.stdout, args);
  } catch (error) {
    if (!isBrokenPipeError(error)) throw error;
  }
};

const safeError = (...args) => {
  try {
    writeToStream(process.stderr, args);
  } catch (error) {
    if (!isBrokenPipeError(error)) throw error;
  }
};

export function initDatabase(dbPath) {
  if (db) return db;

  // SQL verbose logging can be enabled explicitly when needed (DB_VERBOSE=1).
  const verbose = process.env.NODE_ENV !== 'test' && process.env.DB_VERBOSE === '1'
    ? (...args) => safeLog(...args)
    : undefined;
  db = new Database(dbPath, verbose ? { verbose } : {});
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  seedInitialData();
  ensureDefaultOwnerPermission(db);
  initializeSchemaVersioning();

  return db;
}

export function switchDatabase(dbPath) {
  if (db) {
    db.close();
    db = null;
  }
  return initDatabase(dbPath);
}

function initializeSchemaVersioning() {
  const versionSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'schema_version'").get();
  const currentVersion = Number(versionSetting?.value || 1);

  if (currentVersion < SCHEMA_VERSION) {
    db.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES ('requires_v2_upgrade', '1')
      ON CONFLICT(key) DO UPDATE SET value = '1'
    `).run();
  }

  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(Math.max(currentVersion, SCHEMA_VERSION)));
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
      to_account_id TEXT, -- For transfers: destination account
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
      FOREIGN KEY(to_account_id) REFERENCES accounts(id),
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

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      principal_amount REAL NOT NULL,
      current_balance REAL NOT NULL,
      interest_rate REAL NOT NULL,
      payment_amount REAL NOT NULL,
      payment_frequency TEXT DEFAULT 'monthly',
      start_date TEXT NOT NULL,
      end_date TEXT,
      lender TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL, -- 'transaction', 'loan', 'goal'
      item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      scenario_if TEXT,
      scenario_else TEXT,
      what_if TEXT,
      outcome TEXT,
      months_overdue INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6B7280',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'status',
      color TEXT DEFAULT '#6B7280',
      locked_flag INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classification_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 100,
      field TEXT NOT NULL,
      operator TEXT NOT NULL,
      value TEXT NOT NULL,
      action_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (transaction_id, tag_id),
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transaction_labels (
      transaction_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (transaction_id, label_id),
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY(label_id) REFERENCES labels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_id TEXT NOT NULL,
      category_id TEXT,
      subcategory_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      start_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      frequency TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      notes TEXT,
      last_applied_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(subcategory_id) REFERENCES subcategories(id)
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      transaction_id TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      source_type TEXT DEFAULT 'manual',
      source_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(goal_id) REFERENCES goals(id),
      FOREIGN KEY(transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      assumptions_json TEXT NOT NULL,
      duration_months INTEGER DEFAULT 6,
      result_snapshot_json TEXT,
      risk_level TEXT DEFAULT 'low',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      condition_text TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      message TEXT NOT NULL,
      recommended_action TEXT,
      status TEXT DEFAULT 'active',
      snoozed_until TEXT,
      acknowledged_at TEXT,
      resolved_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_settlements (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'in_review',
      reconciled_at TEXT,
      notes TEXT,
      checklist_json TEXT,
      unresolved_count INTEGER DEFAULT 0,
      is_dirty INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      settlement_id TEXT NOT NULL,
      generated_at TEXT,
      snapshot_data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(settlement_id) REFERENCES monthly_settlements(id)
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      role TEXT NOT NULL,
      visibility TEXT DEFAULT 'private',
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS share_snapshots (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      snapshot_name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      integrity_hash TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      expires_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(report_id) REFERENCES monthly_reports(id)
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      trigger_type TEXT,
      condition_text TEXT,
      severity TEXT,
      action TEXT NOT NULL,
      before_status TEXT,
      after_status TEXT,
      actor_subject_type TEXT DEFAULT 'system',
      actor_subject_id TEXT DEFAULT 'local',
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settlement_events (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      month TEXT NOT NULL,
      action TEXT NOT NULL,
      before_status TEXT,
      after_status TEXT,
      actor_subject_type TEXT DEFAULT 'system',
      actor_subject_id TEXT DEFAULT 'local',
      notes TEXT,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(settlement_id) REFERENCES monthly_settlements(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS report_exports (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      month TEXT NOT NULL,
      format TEXT NOT NULL,
      actor_subject_type TEXT DEFAULT 'system',
      actor_subject_id TEXT DEFAULT 'local',
      file_name TEXT,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(report_id) REFERENCES monthly_reports(id) ON DELETE CASCADE
    );
  `;

  db.exec(schema);
  
  // Migration: Add to_account_id column if it doesn't exist
  try {
    const tableInfo = db.prepare('PRAGMA table_info(transactions)').all();
    const hasToAccountId = tableInfo.some(col => col.name === 'to_account_id');
    
    if (!hasToAccountId) {
      safeLog('Adding to_account_id column to transactions table...');
      db.exec('ALTER TABLE transactions ADD COLUMN to_account_id TEXT REFERENCES accounts(id)');
    }
  } catch (e) {
    safeError('Migration error:', e);
  }

  // Migration: Add months_overdue column to plans if missing
  try {
    const planInfo = db.prepare('PRAGMA table_info(plans)').all();
    const hasMonthsOverdue = planInfo.some(col => col.name === 'months_overdue');
    if (!hasMonthsOverdue) {
      safeLog('Adding months_overdue column to plans table...');
      db.exec('ALTER TABLE plans ADD COLUMN months_overdue INTEGER DEFAULT 0');
    }
  } catch (e) {
    safeError('Plans migration error:', e);
  }

  try {
    const transactionInfo = db.prepare('PRAGMA table_info(transactions)').all();
    const addColumnIfMissing = (name, ddl) => {
      if (!transactionInfo.some(col => col.name === name)) {
        db.exec(`ALTER TABLE transactions ADD COLUMN ${ddl}`);
      }
    };
    addColumnIfMissing('subcategory_id', 'subcategory_id TEXT REFERENCES subcategories(id)');
    addColumnIfMissing('dedupe_hash', 'dedupe_hash TEXT');
    addColumnIfMissing('settlement_month', 'settlement_month TEXT');
    addColumnIfMissing('locked_by_settlement', 'locked_by_settlement INTEGER DEFAULT 0');
  } catch (e) {
    safeError('Transactions v2 migration error:', e);
  }

  try {
    const goalsInfo = db.prepare('PRAGMA table_info(goals)').all();
    const addGoalColumnIfMissing = (name, ddl) => {
      if (!goalsInfo.some(col => col.name === name)) {
        db.exec(`ALTER TABLE goals ADD COLUMN ${ddl}`);
      }
    };
    addGoalColumnIfMissing('goal_type', "goal_type TEXT DEFAULT 'standard'");
    addGoalColumnIfMissing('priority', "priority TEXT DEFAULT 'medium'");
    addGoalColumnIfMissing('funding_source', 'funding_source TEXT');
    addGoalColumnIfMissing('risk_status', "risk_status TEXT DEFAULT 'normal'");
    addGoalColumnIfMissing('protected_pool', 'protected_pool INTEGER DEFAULT 0');
  } catch (e) {
    safeError('Goals v2 migration error:', e);
  }

  try {
    const loansInfo = db.prepare('PRAGMA table_info(loans)').all();
    const addLoanColumnIfMissing = (name, ddl) => {
      if (!loansInfo.some(col => col.name === name)) {
        db.exec(`ALTER TABLE loans ADD COLUMN ${ddl}`);
      }
    };
    addLoanColumnIfMissing('next_due_date', 'next_due_date TEXT');
    addLoanColumnIfMissing('due_status', "due_status TEXT DEFAULT 'upcoming'");
  } catch (e) {
    safeError('Loans v2 migration error:', e);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_month ON transactions(category_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_settlement_month ON transactions(settlement_month);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedupe_hash ON transactions(dedupe_hash) WHERE dedupe_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_classification_rules_priority ON classification_rules(priority);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts(status, severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_permissions_scope_subject ON permissions(scope_type, scope_id, subject_type, subject_id);
    CREATE INDEX IF NOT EXISTS idx_share_snapshots_status ON share_snapshots(status);
    CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_settlement_events_month ON settlement_events(month, created_at);
    CREATE INDEX IF NOT EXISTS idx_report_exports_month ON report_exports(month, created_at);
  `);
}

function seedInitialData() {
  // Check if categories exist
  const count = db.prepare('SELECT count(*) as c FROM categories').get().c;
  if (count === 0) {
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
    safeLog('Seeded default categories.');
  }

  const tagCount = db.prepare('SELECT count(*) as c FROM tags').get().c;
  if (tagCount === 0) {
    const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)');
    const tags = [
      ['tag_family', 'family', '#10B981'],
      ['tag_work', 'work', '#3B82F6'],
      ['tag_urgent', 'urgent', '#EF4444'],
      ['tag_reimbursable', 'reimbursable', '#F59E0B']
    ];
    for (const tag of tags) insertTag.run(...tag);
  }

  const labelCount = db.prepare('SELECT count(*) as c FROM labels').get().c;
  if (labelCount === 0) {
    const insertLabel = db.prepare('INSERT INTO labels (id, name, type, color, locked_flag) VALUES (?, ?, ?, ?, ?)');
    const labels = [
      ['label_pending', 'pending', 'status', '#F59E0B', 0],
      ['label_verified', 'verified', 'status', '#10B981', 1],
      ['label_shared', 'shared', 'status', '#3B82F6', 1],
      ['label_flagged', 'flagged', 'status', '#EF4444', 1]
    ];
    for (const label of labels) insertLabel.run(...label);
  }
}

// -- Helpers --
const getMonthFromDate = (date) => String(date || '').slice(0, 7);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const sanitizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createAuditId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const computeTransactionDedupeHash = (tx) => {
  const parts = [
    String(tx.accountId || tx.account_id || ''),
    String(tx.toAccountId || tx.to_account_id || ''),
    String(tx.type || ''),
    sanitizeNumber(tx.amount, 0).toFixed(2),
    String(tx.date || ''),
    String(tx.merchant || '').trim().toLowerCase(),
    String(tx.notes || '').trim().toLowerCase()
  ];
  return parts.join('|');
};

const assertNoDuplicateTransaction = (tx, existingId = null) => {
  const dedupeHash = computeTransactionDedupeHash(tx);
  const existing = db.prepare('SELECT id FROM transactions WHERE dedupe_hash = ?').get(dedupeHash);
  if (existing && existing.id !== existingId) {
    throw new Error('Duplicate transaction blocked by duplicate-save protection.');
  }
  return dedupeHash;
};

const transactionToNormalized = (tx) => ({
  id: tx.id,
  accountId: tx.accountId || tx.account_id,
  toAccountId: tx.toAccountId || tx.to_account_id || null,
  categoryId: tx.category || tx.category_id || null,
  subcategoryId: tx.subcategory || tx.subcategory_id || null,
  type: tx.type,
  amount: sanitizeNumber(tx.amount, 0),
  date: tx.date,
  merchant: tx.merchant || '',
  notes: tx.notes || '',
  tags: toArray(tx.tags),
  tagIds: toArray(tx.tagIds || tx.tag_ids),
  labelIds: toArray(tx.labelIds || tx.label_ids),
  goalId: tx.goalId || tx.goal_id || null,
  attachmentPath: tx.attachmentPath || tx.attachment_path || null,
  taxAmount: sanitizeNumber(tx.taxAmount || tx.tax_amount, 0)
});

const ensureGoalContribution = (tx) => {
  if (!tx.goalId) return;
  const amount = tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
  db.prepare(`
    INSERT INTO goal_contributions (id, goal_id, transaction_id, amount, date, source_type, source_id, notes)
    VALUES (@id, @goalId, @transactionId, @amount, @date, 'transaction', @sourceId, @notes)
    ON CONFLICT(id) DO UPDATE SET
      goal_id = @goalId,
      transaction_id = @transactionId,
      amount = @amount,
      date = @date,
      notes = @notes
  `).run({
    id: `goal_contrib_${tx.id}`,
    goalId: tx.goalId,
    transactionId: tx.id,
    amount,
    date: tx.date,
    sourceId: tx.id,
    notes: tx.notes || ''
  });

  db.prepare(`
    UPDATE goals
    SET current_amount = COALESCE((
      SELECT SUM(amount)
      FROM goal_contributions
      WHERE goal_id = goals.id
    ), 0)
    WHERE id = ?
  `).run(tx.goalId);
};

const removeGoalContributionByTransaction = (transactionId) => {
  const rows = db.prepare('SELECT goal_id FROM goal_contributions WHERE transaction_id = ?').all(transactionId);
  db.prepare('DELETE FROM goal_contributions WHERE transaction_id = ?').run(transactionId);
  for (const row of rows) {
    db.prepare(`
      UPDATE goals
      SET current_amount = COALESCE((
        SELECT SUM(amount)
        FROM goal_contributions
        WHERE goal_id = goals.id
      ), 0)
      WHERE id = ?
    `).run(row.goal_id);
  }
};

const runTransactionRipplePipeline = (transactionId, normalizedTx) => {
  applyClassificationToTransaction(db, transactionId, {
    categoryId: normalizedTx.categoryId,
    subcategoryId: normalizedTx.subcategoryId,
    tagIds: normalizedTx.tagIds,
    labelIds: normalizedTx.labelIds
  });
  ensureGoalContribution(normalizedTx);
  evaluateAlertsForTransaction(db, {
    id: transactionId,
    type: normalizedTx.type,
    amount: normalizedTx.amount,
    category_id: normalizedTx.categoryId,
    date: normalizedTx.date
  });

  const month = getMonthFromDate(normalizedTx.date);
  if (month) {
    markSettlementDirty(db, month, `Transaction ${transactionId} changed.`);
  }
};

// -- Accounts --
export function getAccounts() {
  return db.prepare('SELECT * FROM accounts').all();
}

export function getAccountsWithBalance() {
  const accounts = db.prepare('SELECT * FROM accounts').all();
  
  return accounts.map(acc => {
    // Calculate current balance: initial_balance + income - expense - transfers_out + transfers_in
    const income = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE account_id = ? AND type = 'income'
    `).get(acc.id).total;
    
    const expense = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE account_id = ? AND type = 'expense'
    `).get(acc.id).total;
    
    const transfersOut = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE account_id = ? AND type = 'transfer'
    `).get(acc.id).total;
    
    const transfersIn = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE to_account_id = ? AND type = 'transfer'
    `).get(acc.id).total;
    
    const currentBalance = acc.initial_balance + income - expense - transfersOut + transfersIn;
    
    return {
      ...acc,
      current_balance: currentBalance
    };
  });
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
  let query = `SELECT t.*, 
    c.name as category_name, 
    c.color as category_color, 
    sc.name as subcategory_name,
    a.name as account_name,
    ta.name as to_account_name,
    gc.goal_id as goal_id
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    LEFT JOIN goal_contributions gc ON gc.transaction_id = t.id`;
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

  return db.prepare(query).all(...params).map(t => {
    const classification = getTransactionClassification(db, t.id);
    return {
      ...t,
      tags: classification.tags,
      labels: classification.labels,
      tags_json: t.tags_json,
      raw_tags: t.tags_json ? JSON.parse(t.tags_json) : []
    };
  });
}

export function addTransaction(tx) {
  const normalized = transactionToNormalized(tx);
  assertMonthEditableForDate(db, normalized.date);
  const dedupeHash = assertNoDuplicateTransaction(normalized);

  const stmt = db.prepare(`
    INSERT INTO transactions (
      id, account_id, to_account_id, category_id, subcategory_id, type, amount, date, merchant, notes, tags_json, attachment_path, tax_amount, dedupe_hash, settlement_month, locked_by_settlement
    )
    VALUES (
      @id, @accountId, @toAccountId, @categoryId, @subcategoryId, @type, @amount, @date, @merchant, @notes, @tagsJson, @attachmentPath, @taxAmount, @dedupeHash, NULL, 0
    )
  `);

  stmt.run({
    id: normalized.id,
    accountId: normalized.accountId,
    toAccountId: normalized.toAccountId,
    categoryId: normalized.categoryId,
    subcategoryId: normalized.subcategoryId,
    type: normalized.type,
    amount: normalized.amount,
    date: normalized.date,
    merchant: normalized.merchant,
    notes: normalized.notes,
    tagsJson: JSON.stringify(normalized.tags),
    attachmentPath: normalized.attachmentPath,
    taxAmount: normalized.taxAmount,
    dedupeHash
  });

  runTransactionRipplePipeline(normalized.id, normalized);
  return normalized;
}

export function updateTransaction(tx) {
  const normalized = transactionToNormalized(tx);
  assertTransactionEditable(db, normalized.id);
  assertMonthEditableForDate(db, normalized.date);
  const dedupeHash = assertNoDuplicateTransaction(normalized, normalized.id);
  removeGoalContributionByTransaction(normalized.id);

  const stmt = db.prepare(`
    UPDATE transactions 
    SET account_id = @accountId, to_account_id = @toAccountId, category_id = @categoryId, subcategory_id = @subcategoryId, type = @type, amount = @amount, 
        date = @date, merchant = @merchant, notes = @notes, tags_json = @tagsJson, 
        attachment_path = @attachmentPath, tax_amount = @taxAmount, dedupe_hash = @dedupeHash
    WHERE id = @id
  `);
  stmt.run({
    id: normalized.id,
    accountId: normalized.accountId,
    toAccountId: normalized.toAccountId,
    categoryId: normalized.categoryId,
    subcategoryId: normalized.subcategoryId,
    type: normalized.type,
    amount: normalized.amount,
    date: normalized.date,
    merchant: normalized.merchant,
    notes: normalized.notes,
    tagsJson: JSON.stringify(normalized.tags),
    attachmentPath: normalized.attachmentPath,
    taxAmount: normalized.taxAmount,
    dedupeHash
  });
  runTransactionRipplePipeline(normalized.id, normalized);
  return normalized;
}

export function deleteTransaction(id) {
    assertTransactionEditable(db, id);
    const existing = db.prepare('SELECT date FROM transactions WHERE id = ?').get(id);
    removeGoalContributionByTransaction(id);
    db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(id);
    db.prepare('DELETE FROM transaction_labels WHERE transaction_id = ?').run(id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    if (existing?.date) {
      markSettlementDirty(db, getMonthFromDate(existing.date), `Transaction ${id} deleted.`);
    }
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

export function deleteCategory(id, reassignmentCategoryId = null) {
    const usage = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM transactions WHERE category_id = @id) AS txCount,
        (SELECT COUNT(*) FROM budgets WHERE category_id = @id) AS budgetCount,
        (SELECT COUNT(*) FROM recurring_items WHERE category_id = @id) AS recurringCount,
        (SELECT COUNT(*) FROM subcategories WHERE category_id = @id) AS subcategoryCount
    `).get({ id });

    const totalUsage = Number(usage.txCount || 0) + Number(usage.budgetCount || 0) + Number(usage.recurringCount || 0) + Number(usage.subcategoryCount || 0);

    if (totalUsage > 0 && !reassignmentCategoryId) {
      throw new Error('Category is in use and cannot be deleted without reassignment.');
    }

    if (reassignmentCategoryId) {
      db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(reassignmentCategoryId, id);
      db.prepare('UPDATE budgets SET category_id = ? WHERE category_id = ?').run(reassignmentCategoryId, id);
      db.prepare('UPDATE recurring_items SET category_id = ? WHERE category_id = ?').run(reassignmentCategoryId, id);
      db.prepare('UPDATE subcategories SET category_id = ? WHERE category_id = ?').run(reassignmentCategoryId, id);
    } else {
      db.prepare('DELETE FROM budgets WHERE category_id = ?').run(id);
      db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(id);
      db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(id);
    }

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

    const activeAlerts = db.prepare(`
      SELECT COUNT(*) as t FROM alerts WHERE status IN ('active', 'acknowledged', 'snoozed')
    `).get().t || 0;

    return {
        totalBalance: initialBalStart + income - expense,
        totalIncome: income,
        totalExpense: expense,
        chartData,
        activeAlerts
    };
}

// -- Budgets --
export function getBudgets() {
  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color 
    FROM budgets b 
    LEFT JOIN categories c ON b.category_id = c.id
  `).all();
  
  // Calculate actual spending for each budget based on period
  return budgets.map(budget => {
    let dateFilter = '';
    
    switch(budget.period) {
      case 'weekly':
        dateFilter = "date >= date('now', '-7 days')";
        break;
      case 'monthly':
        dateFilter = "date >= date('now', 'start of month')";
        break;
      case 'yearly':
        dateFilter = "date >= date('now', 'start of year')";
        break;
      default:
        dateFilter = "date >= date('now', 'start of month')";
    }
    
    const spent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE category_id = ? AND type = 'expense' AND ${dateFilter}
    `).get(budget.category_id).total;
    
    return {
      ...budget,
      spent: spent
    };
  });
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
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Budget ${budget.id} updated.`);
  return budget;
}

export function deleteBudget(id) {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Budget ${id} deleted.`);
}

// -- Goals --
export function getGoals() {
  return db.prepare('SELECT * FROM goals').all();
}

export function saveGoal(goal) {
  const stmt = db.prepare(`
    INSERT INTO goals (id, name, target_amount, target_date, linked_account_id, current_amount, goal_type, priority, funding_source, risk_status, protected_pool)
    VALUES (@id, @name, @targetAmount, @targetDate, @linkedAccountId, @currentAmount, @goalType, @priority, @fundingSource, @riskStatus, @protectedPool)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      target_amount = @targetAmount,
      target_date = @targetDate,
      linked_account_id = @linkedAccountId,
      current_amount = @currentAmount,
      goal_type = @goalType,
      priority = @priority,
      funding_source = @fundingSource,
      risk_status = @riskStatus,
      protected_pool = @protectedPool
  `);
  stmt.run({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
    linkedAccountId: goal.linked_account_id,
    currentAmount: goal.current_amount || 0,
    goalType: goal.goal_type || 'standard',
    priority: goal.priority || 'medium',
    fundingSource: goal.funding_source || null,
    riskStatus: goal.risk_status || 'normal',
    protectedPool: goal.protected_pool ? 1 : 0
  });
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Goal ${goal.id} updated.`);
  return goal;
}

export function deleteGoal(id) {
    db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Goal ${id} deleted.`);
}

export function getGoalContributions() {
  return db.prepare(`
    SELECT gc.*, g.name as goal_name, t.merchant as transaction_merchant
    FROM goal_contributions gc
    LEFT JOIN goals g ON g.id = gc.goal_id
    LEFT JOIN transactions t ON t.id = gc.transaction_id
    ORDER BY gc.date DESC
  `).all();
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

// -- Loans --
export function getLoans() {
  return db.prepare('SELECT * FROM loans ORDER BY interest_rate DESC').all();
}

export function saveLoan(loan) {
  const stmt = db.prepare(`
    INSERT INTO loans (id, name, principal_amount, current_balance, interest_rate, payment_amount, payment_frequency, start_date, end_date, lender, notes, next_due_date, due_status)
    VALUES (@id, @name, @principalAmount, @currentBalance, @interestRate, @paymentAmount, @paymentFrequency, @startDate, @endDate, @lender, @notes, @nextDueDate, @dueStatus)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      principal_amount = @principalAmount,
      current_balance = @currentBalance,
      interest_rate = @interestRate,
      payment_amount = @paymentAmount,
      payment_frequency = @paymentFrequency,
      start_date = @startDate,
      end_date = @endDate,
      lender = @lender,
      notes = @notes,
      next_due_date = @nextDueDate,
      due_status = @dueStatus
  `);
  stmt.run({
    id: loan.id,
    name: loan.name,
    principalAmount: loan.principal_amount,
    currentBalance: loan.current_balance,
    interestRate: loan.interest_rate,
    paymentAmount: loan.payment_amount,
    paymentFrequency: loan.payment_frequency,
    startDate: loan.start_date,
    endDate: loan.end_date,
    lender: loan.lender,
    notes: loan.notes || null,
    nextDueDate: loan.next_due_date || loan.end_date || null,
    dueStatus: loan.due_status || 'upcoming'
  });
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Loan ${loan.id} updated.`);
  return loan;
}

export function deleteLoan(id) {
  db.prepare('DELETE FROM loans WHERE id = ?').run(id);
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Loan ${id} deleted.`);
}

// -- Plans --
export function getPlans() {
  return db.prepare('SELECT * FROM plans ORDER BY created_at DESC').all();
}

export function savePlan(plan) {
  const stmt = db.prepare(`
    INSERT INTO plans (id, item_type, item_id, title, scenario_if, scenario_else, what_if, outcome, months_overdue)
    VALUES (@id, @itemType, @itemId, @title, @scenarioIf, @scenarioElse, @whatIf, @outcome, @monthsOverdue)
    ON CONFLICT(id) DO UPDATE SET
      item_type = @itemType,
      item_id = @itemId,
      title = @title,
      scenario_if = @scenarioIf,
      scenario_else = @scenarioElse,
      what_if = @whatIf,
      outcome = @outcome,
      months_overdue = @monthsOverdue
  `);
  stmt.run({
    id: plan.id,
    itemType: plan.item_type,
    itemId: plan.item_id,
    title: plan.title,
    scenarioIf: plan.scenario_if || null,
    scenarioElse: plan.scenario_else || null,
    whatIf: plan.what_if || null,
    outcome: plan.outcome || null,
    monthsOverdue: Number(plan.months_overdue || 0)
  });
  return plan;
}

export function deletePlan(id) {
  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
}

// -- Tax Rules / App Settings --
export function getTaxRules() {
  return db.prepare('SELECT * FROM tax_rules').all();
}

export function getAppSettings() {
  return db.prepare('SELECT * FROM app_settings').all();
}

export function setAppSetting(key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
  return { key, value };
}

export function getSchemaStatus() {
  const version = db.prepare("SELECT value FROM app_settings WHERE key = 'schema_version'").get()?.value || '1';
  const requiresUpgrade = db.prepare("SELECT value FROM app_settings WHERE key = 'requires_v2_upgrade'").get()?.value === '1';
  const backupReady = db.prepare("SELECT value FROM app_settings WHERE key = 'v2_backup_completed_at'").get()?.value || null;
  return {
    schemaVersion: Number(version),
    targetVersion: SCHEMA_VERSION,
    requiresUpgrade,
    backupCompletedAt: backupReady
  };
}

export function markV2BackupCompleted(meta = {}) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES ('v2_backup_completed_at', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(now);

  if (meta.filePath) {
    db.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES ('v2_backup_last_path', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(meta.filePath));
  }

  return { completedAt: now, filePath: meta.filePath || null };
}

export function completeV2Upgrade() {
  const backupMark = db.prepare("SELECT value FROM app_settings WHERE key = 'v2_backup_completed_at'").get()?.value;
  if (!backupMark) {
    throw new Error('Backup is required before running V2 upgrade.');
  }

  resetAllData();

  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(SCHEMA_VERSION));

  db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES ('requires_v2_upgrade', '0')
    ON CONFLICT(key) DO UPDATE SET value = '0'
  `).run();

  return getSchemaStatus();
}

// -- V2 Classification --
export function getSubcategoriesList(categoryId) {
  return getSubcategories(db, categoryId);
}

export function saveSubcategory(subcategory) {
  return upsertSubcategory(db, subcategory);
}

export function deleteSubcategoryById(id) {
  return deleteSubcategory(db, id);
}

export function getTagsList() {
  return getTags(db);
}

export function saveTag(tag) {
  return upsertTag(db, tag);
}

export function deleteTagById(id) {
  return deleteTag(db, id);
}

export function getLabelsList() {
  return getLabels(db);
}

export function saveLabel(label) {
  return upsertLabel(db, label);
}

export function deleteLabelById(id) {
  return deleteLabel(db, id);
}

export function getClassificationRulesList() {
  return getClassificationRules(db);
}

export function saveClassificationRule(rule) {
  return upsertClassificationRule(db, rule);
}

export function deleteClassificationRuleById(id) {
  return deleteClassificationRule(db, id);
}

// -- Recurring Items --
export function getRecurringItems(filter = {}) {
  let query = `
    SELECT ri.*, a.name AS account_name, c.name AS category_name, sc.name AS subcategory_name
    FROM recurring_items ri
    LEFT JOIN accounts a ON a.id = ri.account_id
    LEFT JOIN categories c ON c.id = ri.category_id
    LEFT JOIN subcategories sc ON sc.id = ri.subcategory_id
  `;
  const params = [];
  const conditions = [];

  if (filter.status) {
    conditions.push('ri.status = ?');
    params.push(filter.status);
  }

  if (filter.account_id) {
    conditions.push('ri.account_id = ?');
    params.push(filter.account_id);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY ri.next_due_date ASC';
  return db.prepare(query).all(...params);
}

export function saveRecurringItem(item) {
  db.prepare(`
    INSERT INTO recurring_items (id, name, account_id, category_id, subcategory_id, type, amount, start_date, next_due_date, frequency, status, notes, last_applied_at)
    VALUES (@id, @name, @accountId, @categoryId, @subcategoryId, @type, @amount, @startDate, @nextDueDate, @frequency, @status, @notes, @lastAppliedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      account_id = @accountId,
      category_id = @categoryId,
      subcategory_id = @subcategoryId,
      type = @type,
      amount = @amount,
      start_date = @startDate,
      next_due_date = @nextDueDate,
      frequency = @frequency,
      status = @status,
      notes = @notes,
      last_applied_at = @lastAppliedAt,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: item.id,
    name: item.name,
    accountId: item.account_id,
    categoryId: item.category_id || null,
    subcategoryId: item.subcategory_id || null,
    type: item.type || 'expense',
    amount: sanitizeNumber(item.amount, 0),
    startDate: item.start_date,
    nextDueDate: item.next_due_date,
    frequency: item.frequency || 'monthly',
    status: item.status || 'active',
    notes: item.notes || '',
    lastAppliedAt: item.last_applied_at || null
  });
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Recurring item ${item.id} updated.`);

  return db.prepare('SELECT * FROM recurring_items WHERE id = ?').get(item.id);
}

export function deleteRecurringItem(id) {
  db.prepare('DELETE FROM recurring_items WHERE id = ?').run(id);
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Recurring item ${id} deleted.`);
}

const withPermissionContext = (context = {}, defaults = {}) => ({
  scopeType: context.scopeType || defaults.scopeType || 'module',
  scopeId: context.scopeId || defaults.scopeId || 'global',
  subjectType: context.subjectType || defaults.subjectType || 'user',
  subjectId: context.subjectId || defaults.subjectId || 'local',
  requiredRole: context.requiredRole || defaults.requiredRole || 'Viewer'
});

const normalizeActor = (context = {}) => ({
  subjectType: context.subjectType || 'system',
  subjectId: context.subjectId || 'local'
});

const logAlertEvent = (alert, action, beforeStatus, afterStatus, context = {}, metadata = {}) => {
  if (!alert?.id) return;
  const actor = normalizeActor(context);
  db.prepare(`
    INSERT INTO alert_events (
      id, alert_id, trigger_type, condition_text, severity, action, before_status, after_status,
      actor_subject_type, actor_subject_id, metadata_json
    )
    VALUES (@id, @alertId, @triggerType, @conditionText, @severity, @action, @beforeStatus, @afterStatus, @actorType, @actorId, @metadata)
  `).run({
    id: createAuditId('alert_event'),
    alertId: alert.id,
    triggerType: alert.trigger_type || null,
    conditionText: alert.condition_text || null,
    severity: alert.severity || null,
    action,
    beforeStatus: beforeStatus || null,
    afterStatus: afterStatus || null,
    actorType: actor.subjectType,
    actorId: actor.subjectId,
    metadata: JSON.stringify(metadata || {})
  });
};

const logSettlementEvent = (settlement, action, beforeStatus, afterStatus, context = {}, notes = '', metadata = {}) => {
  if (!settlement?.id || !settlement?.month) return;
  const actor = normalizeActor(context);
  db.prepare(`
    INSERT INTO settlement_events (
      id, settlement_id, month, action, before_status, after_status, actor_subject_type, actor_subject_id, notes, metadata_json
    )
    VALUES (@id, @settlementId, @month, @action, @beforeStatus, @afterStatus, @actorType, @actorId, @notes, @metadata)
  `).run({
    id: createAuditId('settlement_event'),
    settlementId: settlement.id,
    month: settlement.month,
    action,
    beforeStatus: beforeStatus || null,
    afterStatus: afterStatus || null,
    actorType: actor.subjectType,
    actorId: actor.subjectId,
    notes: notes || '',
    metadata: JSON.stringify(metadata || {})
  });
};

const logReportExport = (report, format, context = {}, metadata = {}) => {
  if (!report?.id || !report?.month) return;
  const actor = normalizeActor(context);
  db.prepare(`
    INSERT INTO report_exports (
      id, report_id, month, format, actor_subject_type, actor_subject_id, file_name, metadata_json
    )
    VALUES (@id, @reportId, @month, @format, @actorType, @actorId, @fileName, @metadata)
  `).run({
    id: createAuditId('report_export'),
    reportId: report.id,
    month: report.month,
    format,
    actorType: actor.subjectType,
    actorId: actor.subjectId,
    fileName: metadata.fileName || null,
    metadata: JSON.stringify(metadata || {})
  });
};

// -- Alerts --
export function getAlertsList(filter = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Viewer'
  }));
  return getAlerts(db, filter);
}

export function setAlertStatus(id, status, options = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Editor'
  }));
  const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
  const updated = updateAlertStatus(db, id, status, options);
  logAlertEvent(updated || existing, `set_status:${status}`, existing?.status || null, updated?.status || status, context, options);
  return updated;
}

export function getAlertSummary(context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Viewer'
  }));
  return summarizeAlertCounts(db);
}

export function getAlertEvents(filter = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Viewer'
  }));
  let query = 'SELECT * FROM alert_events';
  const params = [];
  const conditions = [];

  if (filter.alert_id) {
    conditions.push('alert_id = ?');
    params.push(filter.alert_id);
  }

  if (filter.month) {
    conditions.push('substr(created_at, 1, 7) = ?');
    params.push(filter.month);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';
  if (filter.limit) {
    query += ` LIMIT ${Math.max(1, Number(filter.limit) || 50)}`;
  }

  return db.prepare(query).all(...params).map((row) => ({
    ...row,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {}
  }));
}

export function getSystemState(month, context = {}) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(String(month || ''))
    ? String(month)
    : new Date().toISOString().slice(0, 7);

  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'settlement',
    requiredRole: 'Viewer'
  }));
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Viewer'
  }));
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Viewer'
  }));

  const settlement = getSettlementByMonth(db, normalizedMonth);
  const report = getMonthlyReportByMonth(db, normalizedMonth);

  return {
    month: normalizedMonth,
    settlement: settlement
      ? {
          status: settlement.status,
          isDirty: Boolean(settlement.is_dirty ?? settlement.isDirty),
          unresolvedCount: Number(settlement.unresolved_count ?? settlement.unresolvedCount ?? 0)
        }
      : null,
    report: report
      ? {
          status: 'ready',
          generatedAt: report.generated_at || report.generatedAt || null
        }
      : {
          status: 'missing',
          generatedAt: null
        },
    alerts: summarizeAlertCounts(db)
  };
}

// -- Settlements / Reports --
export function getMonthlySettlements(context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'settlement',
    requiredRole: 'Viewer'
  }));
  return getSettlements(db);
}

export function getMonthlySettlementByMonth(month, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'settlement',
    requiredRole: 'Viewer'
  }));
  return getSettlementByMonth(db, month);
}

export function finalizeMonthlySettlement(month, notes, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'settlement',
    requiredRole: 'Editor'
  }));
  const before = getSettlementByMonth(db, month);
  const result = finalizeSettlement(db, month, notes || '');
  logSettlementEvent(
    result?.settlement || getSettlementByMonth(db, month),
    'finalize',
    before?.status || null,
    result?.settlement?.status || 'finalized',
    context,
    notes || ''
  );
  return result;
}

export function reopenMonthlySettlement(month, reason, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'settlement',
    requiredRole: 'Editor'
  }));
  const before = getSettlementByMonth(db, month);
  const updated = reopenSettlement(db, month, reason || '');
  logSettlementEvent(
    updated || getSettlementByMonth(db, month),
    'reopen',
    before?.status || null,
    updated?.status || 'in_review',
    context,
    reason || ''
  );
  return updated;
}

export function getSettlementEvents(filter = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'settlement',
    requiredRole: 'Viewer'
  }));
  let query = 'SELECT * FROM settlement_events';
  const params = [];
  const conditions = [];

  if (filter.month) {
    conditions.push('month = ?');
    params.push(filter.month);
  }

  if (filter.settlement_id) {
    conditions.push('settlement_id = ?');
    params.push(filter.settlement_id);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';
  if (filter.limit) {
    query += ` LIMIT ${Math.max(1, Number(filter.limit) || 50)}`;
  }

  return db.prepare(query).all(...params).map((row) => ({
    ...row,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {}
  }));
}

export function getReports(context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Viewer'
  }));
  return getMonthlyReports(db);
}

export function getReportByMonth(month, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Viewer'
  }));
  return getMonthlyReportByMonth(db, month);
}

export function generateReport(month, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Editor'
  }));
  const settlement = getSettlementByMonth(db, month);
  if (!settlement) {
    throw new Error('Settlement not found for report generation.');
  }
  if (settlement.status !== 'finalized') {
    throw new Error('Report requires finalized settlement.');
  }
  return generateMonthlyReport(db, month, settlement.id);
}

export function exportReportCsv(month, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Editor'
  }));
  const report = getMonthlyReportByMonth(db, month);
  if (!report) throw new Error('Report not found for export.');
  const csv = getReportCsv(report);
  logReportExport(report, 'csv', context, {
    fileName: `monthly_report_${month}.csv`,
    contentLength: csv.length
  });
  return csv;
}

export function exportReportPdfContent(month, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Editor'
  }));
  const report = getMonthlyReportByMonth(db, month);
  if (!report) throw new Error('Report not found for export.');
  const content = getReportPdfLikeContent(report);
  logReportExport(report, 'pdf', context, {
    fileName: `monthly_report_${month}.pdf`,
    contentLength: content.length
  });
  return content;
}

export function getReportExports(filter = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'reports',
    requiredRole: 'Viewer'
  }));
  let query = 'SELECT * FROM report_exports';
  const params = [];
  const conditions = [];

  if (filter.month) {
    conditions.push('month = ?');
    params.push(filter.month);
  }

  if (filter.report_id) {
    conditions.push('report_id = ?');
    params.push(filter.report_id);
  }

  if (filter.format) {
    conditions.push('format = ?');
    params.push(filter.format);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';
  if (filter.limit) {
    query += ` LIMIT ${Math.max(1, Number(filter.limit) || 50)}`;
  }

  return db.prepare(query).all(...params).map((row) => ({
    ...row,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {}
  }));
}

// -- Scenarios --
export function getScenariosList() {
  return getScenarios(db);
}

export function getScenarioDetails(id) {
  return getScenarioById(db, id);
}

export function runScenarioSimulation(input) {
  return runScenario(db, input);
}

export function saveScenarioModel(scenario) {
  return saveScenario(db, scenario);
}

export function deleteScenarioModel(id) {
  return deleteScenario(db, id);
}

// -- Permissions --
export function getPermissionsList(filter = {}) {
  return getPermissions(db, filter);
}

export function savePermissionEntry(permission) {
  return savePermission(db, permission);
}

export function deletePermissionEntry(id) {
  return deletePermission(db, id);
}

export function checkPermissionEntry(context) {
  return checkPermission(db, context);
}

// -- Sharing --
export function createShareSnapshotEntry(input) {
  enforcePermission(db, withPermissionContext(input, {
    scopeType: input.scopeType || 'module',
    scopeId: input.scopeId || 'reports',
    subjectType: input.subjectType || 'user',
    subjectId: input.subjectId || 'local',
    requiredRole: 'Editor'
  }));
  return createShareSnapshot(db, input);
}

export function listShareSnapshotsEntries(filter = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'sharing',
    requiredRole: 'Viewer'
  }));
  return listShareSnapshots(db, filter);
}

export function revokeShareSnapshotEntry(id, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: context.scopeType || 'module',
    scopeId: context.scopeId || 'sharing',
    subjectType: context.subjectType || 'user',
    subjectId: context.subjectId || 'local',
    requiredRole: 'Editor'
  }));
  return revokeShareSnapshot(db, id);
}

export function exportShareSnapshotEntry(id, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'sharing',
    requiredRole: 'Editor'
  }));
  return exportShareSnapshotPackage(db, id);
}

// -- Backup / Restore --
export function resetAllData() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM transaction_tags').run();
    db.prepare('DELETE FROM transaction_labels').run();
    db.prepare('DELETE FROM goal_contributions').run();
    db.prepare('DELETE FROM alert_events').run();
    db.prepare('DELETE FROM settlement_events').run();
    db.prepare('DELETE FROM report_exports').run();
    db.prepare('DELETE FROM share_snapshots').run();
    db.prepare('DELETE FROM monthly_reports').run();
    db.prepare('DELETE FROM monthly_settlements').run();
    db.prepare('DELETE FROM alerts').run();
    db.prepare('DELETE FROM scenarios').run();
    db.prepare('DELETE FROM recurring_items').run();
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM budgets').run();
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM bills').run();
    db.prepare('DELETE FROM loans').run();
    db.prepare('DELETE FROM plans').run();
    db.prepare('DELETE FROM classification_rules').run();
    db.prepare('DELETE FROM subcategories').run();
    db.prepare('DELETE FROM tags').run();
    db.prepare('DELETE FROM labels').run();
    db.prepare('DELETE FROM permissions').run();
    db.prepare('DELETE FROM tax_rules').run();
    db.prepare('DELETE FROM accounts').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM app_settings').run();
  });
  tx();
  seedInitialData();
  initializeSchemaVersioning();
  ensureDefaultOwnerPermission(db);
}

export function restoreAllData(payload) {
  if (!payload) return;
  const {
    accounts = [],
    categories = [],
    subcategories = [],
    tags = [],
    labels = [],
    classification_rules = [],
    transactions = [],
    transaction_tags = [],
    transaction_labels = [],
    budgets = [],
    goals = [],
    goal_contributions = [],
    bills = [],
    loans = [],
    plans = [],
    recurring_items = [],
    scenarios = [],
    alerts = [],
    alert_events = [],
    monthly_settlements = [],
    settlement_events = [],
    monthly_reports = [],
    report_exports = [],
    permissions = [],
    share_snapshots = [],
    tax_rules = [],
    app_settings = []
  } = payload;

  const tx = db.transaction(() => {
    for (const a of accounts) {
      db.prepare(`
        INSERT INTO accounts (id, name, type, currency, initial_balance, created_at)
        VALUES (@id, @name, @type, @currency, @initial_balance, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, type=@type, currency=@currency, initial_balance=@initial_balance, created_at=@created_at
      `).run(a);
    }

    for (const c of categories) {
      db.prepare(`
        INSERT INTO categories (id, name, type, color, icon, is_default)
        VALUES (@id, @name, @type, @color, @icon, @is_default)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, type=@type, color=@color, icon=@icon, is_default=@is_default
      `).run(c);
    }

    for (const s of subcategories) {
      db.prepare(`
        INSERT INTO subcategories (id, category_id, name, created_at)
        VALUES (@id, @category_id, @name, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          category_id=@category_id, name=@name, created_at=@created_at
      `).run(s);
    }

    for (const t of tags) {
      db.prepare(`
        INSERT INTO tags (id, name, color, created_at)
        VALUES (@id, @name, @color, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, color=@color, created_at=@created_at
      `).run(t);
    }

    for (const l of labels) {
      db.prepare(`
        INSERT INTO labels (id, name, type, color, locked_flag, created_at)
        VALUES (@id, @name, @type, @color, @locked_flag, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, type=@type, color=@color, locked_flag=@locked_flag, created_at=@created_at
      `).run(l);
    }

    for (const r of classification_rules) {
      db.prepare(`
        INSERT INTO classification_rules (id, name, enabled, priority, field, operator, value, action_json, created_at)
        VALUES (@id, @name, @enabled, @priority, @field, @operator, @value, @action_json, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, enabled=@enabled, priority=@priority, field=@field, operator=@operator, value=@value, action_json=@action_json, created_at=@created_at
      `).run(r);
    }

    for (const t of transactions) {
      db.prepare(`
        INSERT INTO transactions (
          id, account_id, to_account_id, category_id, subcategory_id, type, amount, date, merchant, notes, tags_json, attachment_path, tax_amount, dedupe_hash, settlement_month, locked_by_settlement, created_at
        )
        VALUES (
          @id, @account_id, @to_account_id, @category_id, @subcategory_id, @type, @amount, @date, @merchant, @notes, @tags_json, @attachment_path, @tax_amount, @dedupe_hash, @settlement_month, @locked_by_settlement, @created_at
        )
        ON CONFLICT(id) DO UPDATE SET
          account_id=@account_id, to_account_id=@to_account_id, category_id=@category_id, subcategory_id=@subcategory_id, type=@type, amount=@amount,
          date=@date, merchant=@merchant, notes=@notes, tags_json=@tags_json, attachment_path=@attachment_path, tax_amount=@tax_amount,
          dedupe_hash=@dedupe_hash, settlement_month=@settlement_month, locked_by_settlement=@locked_by_settlement, created_at=@created_at
      `).run(t);
    }

    for (const tt of transaction_tags) {
      db.prepare(`
        INSERT INTO transaction_tags (transaction_id, tag_id)
        VALUES (@transaction_id, @tag_id)
        ON CONFLICT(transaction_id, tag_id) DO NOTHING
      `).run(tt);
    }

    for (const tl of transaction_labels) {
      db.prepare(`
        INSERT INTO transaction_labels (transaction_id, label_id)
        VALUES (@transaction_id, @label_id)
        ON CONFLICT(transaction_id, label_id) DO NOTHING
      `).run(tl);
    }

    for (const b of budgets) {
      db.prepare(`
        INSERT INTO budgets (id, category_id, period, limit_amount)
        VALUES (@id, @category_id, @period, @limit_amount)
        ON CONFLICT(id) DO UPDATE SET category_id=@category_id, period=@period, limit_amount=@limit_amount
      `).run(b);
    }

    for (const g of goals) {
      db.prepare(`
        INSERT INTO goals (id, name, target_amount, target_date, linked_account_id, current_amount, goal_type, priority, funding_source, risk_status, protected_pool)
        VALUES (@id, @name, @target_amount, @target_date, @linked_account_id, @current_amount, @goal_type, @priority, @funding_source, @risk_status, @protected_pool)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, target_amount=@target_amount, target_date=@target_date, linked_account_id=@linked_account_id, current_amount=@current_amount,
          goal_type=@goal_type, priority=@priority, funding_source=@funding_source, risk_status=@risk_status, protected_pool=@protected_pool
      `).run(g);
    }

    for (const gc of goal_contributions) {
      db.prepare(`
        INSERT INTO goal_contributions (id, goal_id, transaction_id, amount, date, source_type, source_id, notes, created_at)
        VALUES (@id, @goal_id, @transaction_id, @amount, @date, @source_type, @source_id, @notes, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          goal_id=@goal_id, transaction_id=@transaction_id, amount=@amount, date=@date, source_type=@source_type, source_id=@source_id, notes=@notes, created_at=@created_at
      `).run(gc);
    }

    for (const b of bills) {
      db.prepare(`
        INSERT INTO bills (id, name, amount, next_due_date, recurrence, is_paid, auto_pay)
        VALUES (@id, @name, @amount, @next_due_date, @recurrence, @is_paid, @auto_pay)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, amount=@amount, next_due_date=@next_due_date, recurrence=@recurrence, is_paid=@is_paid, auto_pay=@auto_pay
      `).run(b);
    }

    for (const l of loans) {
      db.prepare(`
        INSERT INTO loans (id, name, principal_amount, current_balance, interest_rate, payment_amount, payment_frequency, start_date, end_date, lender, notes, next_due_date, due_status, created_at)
        VALUES (@id, @name, @principal_amount, @current_balance, @interest_rate, @payment_amount, @payment_frequency, @start_date, @end_date, @lender, @notes, @next_due_date, @due_status, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, principal_amount=@principal_amount, current_balance=@current_balance, interest_rate=@interest_rate,
          payment_amount=@payment_amount, payment_frequency=@payment_frequency, start_date=@start_date, end_date=@end_date, lender=@lender, notes=@notes, next_due_date=@next_due_date, due_status=@due_status, created_at=@created_at
      `).run(l);
    }

    for (const p of plans) {
      db.prepare(`
        INSERT INTO plans (id, item_type, item_id, title, scenario_if, scenario_else, what_if, outcome, months_overdue, created_at)
        VALUES (@id, @item_type, @item_id, @title, @scenario_if, @scenario_else, @what_if, @outcome, @months_overdue, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          item_type=@item_type, item_id=@item_id, title=@title, scenario_if=@scenario_if, scenario_else=@scenario_else,
          what_if=@what_if, outcome=@outcome, months_overdue=@months_overdue, created_at=@created_at
      `).run(p);
    }

    for (const r of recurring_items) {
      db.prepare(`
        INSERT INTO recurring_items (id, name, account_id, category_id, subcategory_id, type, amount, start_date, next_due_date, frequency, status, notes, last_applied_at, created_at, updated_at)
        VALUES (@id, @name, @account_id, @category_id, @subcategory_id, @type, @amount, @start_date, @next_due_date, @frequency, @status, @notes, @last_applied_at, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, account_id=@account_id, category_id=@category_id, subcategory_id=@subcategory_id, type=@type, amount=@amount,
          start_date=@start_date, next_due_date=@next_due_date, frequency=@frequency, status=@status, notes=@notes, last_applied_at=@last_applied_at, created_at=@created_at, updated_at=@updated_at
      `).run(r);
    }

    for (const s of scenarios) {
      db.prepare(`
        INSERT INTO scenarios (id, title, assumptions_json, duration_months, result_snapshot_json, risk_level, created_at, updated_at)
        VALUES (@id, @title, @assumptions_json, @duration_months, @result_snapshot_json, @risk_level, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          title=@title, assumptions_json=@assumptions_json, duration_months=@duration_months, result_snapshot_json=@result_snapshot_json, risk_level=@risk_level, created_at=@created_at, updated_at=@updated_at
      `).run(s);
    }

    for (const a of alerts) {
      db.prepare(`
        INSERT INTO alerts (id, source_type, source_id, trigger_type, condition_text, severity, message, recommended_action, status, snoozed_until, acknowledged_at, resolved_at, created_at, updated_at)
        VALUES (@id, @source_type, @source_id, @trigger_type, @condition_text, @severity, @message, @recommended_action, @status, @snoozed_until, @acknowledged_at, @resolved_at, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          source_type=@source_type, source_id=@source_id, trigger_type=@trigger_type, condition_text=@condition_text, severity=@severity, message=@message,
          recommended_action=@recommended_action, status=@status, snoozed_until=@snoozed_until, acknowledged_at=@acknowledged_at, resolved_at=@resolved_at, created_at=@created_at, updated_at=@updated_at
      `).run(a);
    }

    for (const ae of alert_events) {
      db.prepare(`
        INSERT INTO alert_events (id, alert_id, trigger_type, condition_text, severity, action, before_status, after_status, actor_subject_type, actor_subject_id, metadata_json, created_at)
        VALUES (@id, @alert_id, @trigger_type, @condition_text, @severity, @action, @before_status, @after_status, @actor_subject_type, @actor_subject_id, @metadata_json, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          alert_id=@alert_id, trigger_type=@trigger_type, condition_text=@condition_text, severity=@severity, action=@action,
          before_status=@before_status, after_status=@after_status, actor_subject_type=@actor_subject_type, actor_subject_id=@actor_subject_id, metadata_json=@metadata_json, created_at=@created_at
      `).run(ae);
    }

    for (const s of monthly_settlements) {
      db.prepare(`
        INSERT INTO monthly_settlements (id, month, status, reconciled_at, notes, checklist_json, unresolved_count, is_dirty, created_at, updated_at)
        VALUES (@id, @month, @status, @reconciled_at, @notes, @checklist_json, @unresolved_count, @is_dirty, @created_at, @updated_at)
        ON CONFLICT(month) DO UPDATE SET
          id=@id, status=@status, reconciled_at=@reconciled_at, notes=@notes, checklist_json=@checklist_json, unresolved_count=@unresolved_count, is_dirty=@is_dirty, created_at=@created_at, updated_at=@updated_at
      `).run(s);
    }

    for (const se of settlement_events) {
      db.prepare(`
        INSERT INTO settlement_events (id, settlement_id, month, action, before_status, after_status, actor_subject_type, actor_subject_id, notes, metadata_json, created_at)
        VALUES (@id, @settlement_id, @month, @action, @before_status, @after_status, @actor_subject_type, @actor_subject_id, @notes, @metadata_json, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          settlement_id=@settlement_id, month=@month, action=@action, before_status=@before_status, after_status=@after_status,
          actor_subject_type=@actor_subject_type, actor_subject_id=@actor_subject_id, notes=@notes, metadata_json=@metadata_json, created_at=@created_at
      `).run(se);
    }

    for (const r of monthly_reports) {
      db.prepare(`
        INSERT INTO monthly_reports (id, month, settlement_id, generated_at, snapshot_data_json, created_at)
        VALUES (@id, @month, @settlement_id, @generated_at, @snapshot_data_json, @created_at)
        ON CONFLICT(month) DO UPDATE SET
          id=@id, settlement_id=@settlement_id, generated_at=@generated_at, snapshot_data_json=@snapshot_data_json, created_at=@created_at
      `).run(r);
    }

    for (const re of report_exports) {
      db.prepare(`
        INSERT INTO report_exports (id, report_id, month, format, actor_subject_type, actor_subject_id, file_name, metadata_json, created_at)
        VALUES (@id, @report_id, @month, @format, @actor_subject_type, @actor_subject_id, @file_name, @metadata_json, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          report_id=@report_id, month=@month, format=@format, actor_subject_type=@actor_subject_type, actor_subject_id=@actor_subject_id,
          file_name=@file_name, metadata_json=@metadata_json, created_at=@created_at
      `).run(re);
    }

    for (const p of permissions) {
      db.prepare(`
        INSERT INTO permissions (id, scope_type, scope_id, role, visibility, subject_type, subject_id, created_at, updated_at)
        VALUES (@id, @scope_type, @scope_id, @role, @visibility, @subject_type, @subject_id, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          scope_type=@scope_type, scope_id=@scope_id, role=@role, visibility=@visibility, subject_type=@subject_type, subject_id=@subject_id, created_at=@created_at, updated_at=@updated_at
      `).run(p);
    }

    for (const s of share_snapshots) {
      db.prepare(`
        INSERT INTO share_snapshots (id, report_id, snapshot_name, payload_json, integrity_hash, status, expires_at, created_at, updated_at)
        VALUES (@id, @report_id, @snapshot_name, @payload_json, @integrity_hash, @status, @expires_at, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          report_id=@report_id, snapshot_name=@snapshot_name, payload_json=@payload_json, integrity_hash=@integrity_hash, status=@status, expires_at=@expires_at, created_at=@created_at, updated_at=@updated_at
      `).run(s);
    }

    for (const r of tax_rules) {
      db.prepare(`
        INSERT INTO tax_rules (id, category_id, rate, mode)
        VALUES (@id, @category_id, @rate, @mode)
        ON CONFLICT(id) DO UPDATE SET category_id=@category_id, rate=@rate, mode=@mode
      `).run(r);
    }

    for (const s of app_settings) {
      db.prepare(`
        INSERT INTO app_settings (key, value)
        VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value=@value
      `).run(s);
    }
  });

  tx();
  initializeSchemaVersioning();
  ensureDefaultOwnerPermission(db);
}
