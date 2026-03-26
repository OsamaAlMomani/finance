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
  createScenarioRiskAlert,
  evaluateAlertsForTransaction,
  evaluateCashCollisionAlerts,
  getAlerts,
  getCashCollisionForecast as buildCashCollisionForecast,
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
import {
  buildDashboardOptimizationPayload,
  normalizeOptimizationPeriod
} from './v2/dashboardOptimizationService.js';
import {
  ensureEnum,
  ensureIsoDate,
  ensureNumber,
  ensureString,
  toBooleanFlag
} from './v2/inputValidation.js';

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
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -20000');
  db.pragma('wal_autocheckpoint = 1000');

  createTables();
  seedInitialData();
  ensureDefaultOwnerPermission(db);
  initializeSchemaVersioning();
  refreshRealtimeState();

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

    CREATE TABLE IF NOT EXISTS entity_metadata (
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      metadata_key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      tags_json TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (scope_type, scope_id, metadata_key)
    );

    CREATE TABLE IF NOT EXISTS realtime_state (
      state_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL,
      expires_at TEXT
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
      linked_account_id TEXT,
      lender TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      paid_at TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE CASCADE
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
    addLoanColumnIfMissing('linked_account_id', 'linked_account_id TEXT REFERENCES accounts(id)');
  } catch (e) {
    safeError('Loans v2 migration error:', e);
  }

  try {
    // Legacy installs may have an older loan_payments shape (date/notes/principal/interest).
    // Normalize columns so payment logging and indexes work on both old and new profiles.
    const loanPaymentsInfo = db.prepare('PRAGMA table_info(loan_payments)').all();
    if (loanPaymentsInfo.length > 0) {
      const loanPaymentCols = new Set(loanPaymentsInfo.map((col) => col.name));
      const hasLegacyLoanPaymentShape =
        loanPaymentCols.has('date')
        || loanPaymentCols.has('notes')
        || loanPaymentCols.has('principal')
        || loanPaymentCols.has('interest')
        || loanPaymentCols.has('fees');

      if (hasLegacyLoanPaymentShape) {
        db.exec('DROP TABLE IF EXISTS loan_payments_legacy_backup');
        db.exec('ALTER TABLE loan_payments RENAME TO loan_payments_legacy_backup');

        db.exec(`
          CREATE TABLE loan_payments (
            id TEXT PRIMARY KEY,
            loan_id TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_before REAL NOT NULL,
            balance_after REAL NOT NULL,
            paid_at TEXT NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(loan_id) REFERENCES loans(id) ON DELETE CASCADE
          );
        `);

        const legacyInfo = db.prepare('PRAGMA table_info(loan_payments_legacy_backup)').all();
        const legacyCols = new Set(legacyInfo.map((col) => col.name));
        const paidAtExpr = legacyCols.has('paid_at')
          ? "NULLIF(TRIM(paid_at), '')"
          : legacyCols.has('date')
            ? "NULLIF(TRIM(date), '')"
            : 'NULL';
        const createdAtExpr = legacyCols.has('created_at') ? "NULLIF(TRIM(created_at), '')" : 'NULL';
        const noteExpr = legacyCols.has('note')
          ? "NULLIF(TRIM(note), '')"
          : legacyCols.has('notes')
            ? "NULLIF(TRIM(notes), '')"
            : 'NULL';
        const balanceBeforeExpr = legacyCols.has('balance_before') ? 'COALESCE(balance_before, 0)' : '0';
        const balanceAfterExpr = legacyCols.has('balance_after') ? 'COALESCE(balance_after, 0)' : '0';

        db.exec(`
          INSERT INTO loan_payments (id, loan_id, amount, balance_before, balance_after, paid_at, note, created_at)
          SELECT
            id,
            loan_id,
            COALESCE(amount, 0),
            ${balanceBeforeExpr},
            ${balanceAfterExpr},
            COALESCE(${paidAtExpr}, ${createdAtExpr}, datetime('now')),
            ${noteExpr},
            COALESCE(${createdAtExpr}, ${paidAtExpr}, datetime('now'))
          FROM loan_payments_legacy_backup;
        `);

        db.exec('DROP TABLE loan_payments_legacy_backup');
      } else {
        const addLoanPaymentColumnIfMissing = (name, ddl) => {
          if (!loanPaymentCols.has(name)) {
            db.exec(`ALTER TABLE loan_payments ADD COLUMN ${ddl}`);
            loanPaymentCols.add(name);
          }
        };

        addLoanPaymentColumnIfMissing('balance_before', 'balance_before REAL NOT NULL DEFAULT 0');
        addLoanPaymentColumnIfMissing('balance_after', 'balance_after REAL NOT NULL DEFAULT 0');
        addLoanPaymentColumnIfMissing('paid_at', 'paid_at TEXT');
        addLoanPaymentColumnIfMissing('note', 'note TEXT');
        addLoanPaymentColumnIfMissing('created_at', 'created_at TEXT');

        db.exec(`
          UPDATE loan_payments
          SET paid_at = COALESCE(NULLIF(TRIM(paid_at), ''), NULLIF(TRIM(created_at), ''), datetime('now'))
          WHERE paid_at IS NULL OR TRIM(paid_at) = '';
        `);

        db.exec(`
          UPDATE loan_payments
          SET created_at = COALESCE(NULLIF(TRIM(created_at), ''), NULLIF(TRIM(paid_at), ''), datetime('now'))
          WHERE created_at IS NULL OR TRIM(created_at) = '';
        `);
      }
    }
  } catch (e) {
    safeError('Loan payments migration error:', e);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_month ON transactions(category_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_settlement_month ON transactions(settlement_month);
    CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_to_account_date ON transactions(to_account_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_type_date ON transactions(category_id, type, date DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedupe_hash ON transactions(dedupe_hash) WHERE dedupe_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_budgets_category_period ON budgets(category_id, period);
    CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
    CREATE INDEX IF NOT EXISTS idx_bills_paid_due ON bills(is_paid, next_due_date);
    CREATE INDEX IF NOT EXISTS idx_loans_due_status_next_due ON loans(due_status, next_due_date);
    CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_date ON goal_contributions(goal_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_recurring_status_due ON recurring_items(status, next_due_date);
    CREATE INDEX IF NOT EXISTS idx_classification_rules_priority ON classification_rules(priority);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts(status, severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_updated ON alerts(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_permissions_scope_subject ON permissions(scope_type, scope_id, subject_type, subject_id);
    CREATE INDEX IF NOT EXISTS idx_share_snapshots_status ON share_snapshots(status);
    CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_settlement_events_month ON settlement_events(month, created_at);
    CREATE INDEX IF NOT EXISTS idx_report_exports_month ON report_exports(month, created_at);
    CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_paid_at ON loan_payments(loan_id, paid_at DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entity_metadata_scope ON entity_metadata(scope_type, scope_id, metadata_key);
    CREATE INDEX IF NOT EXISTS idx_entity_metadata_updated ON entity_metadata(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_realtime_state_updated ON realtime_state(updated_at DESC);
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

const parseJsonSafely = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeRealtimeStateRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    payload: parseJsonSafely(row.payload_json, {})
  };
};

const normalizeMetadataRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    value: parseJsonSafely(row.value_json, null),
    tags: parseJsonSafely(row.tags_json, [])
  };
};

const setRealtimeStateInternal = (stateKey, payload, options = {}) => {
  if (!db) return null;
  const normalizedKey = String(stateKey || '').trim();
  if (!normalizedKey) {
    throw new Error('stateKey is required.');
  }
  const updatedAtInput = String(options.updatedAt || options.updated_at || new Date().toISOString());
  const updatedAtDate = new Date(updatedAtInput);
  const updatedAt = Number.isNaN(updatedAtDate.getTime()) ? new Date().toISOString() : updatedAtDate.toISOString();
  const ttlSeconds = Math.max(0, Math.floor(sanitizeNumber(options.ttlSeconds ?? options.ttl_seconds, 0)));
  const expiresAt = ttlSeconds > 0
    ? new Date(new Date(updatedAt).getTime() + ttlSeconds * 1000).toISOString()
    : null;
  const payloadJson = JSON.stringify(payload ?? {});

  db.prepare(`
    INSERT INTO realtime_state (state_key, payload_json, version, updated_at, expires_at)
    VALUES (@stateKey, @payloadJson, 1, @updatedAt, @expiresAt)
    ON CONFLICT(state_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      version = realtime_state.version + 1,
      updated_at = excluded.updated_at,
      expires_at = excluded.expires_at
  `).run({
    stateKey: normalizedKey,
    payloadJson,
    updatedAt,
    expiresAt
  });

  return normalizeRealtimeStateRow(
    db.prepare('SELECT * FROM realtime_state WHERE state_key = ?').get(normalizedKey)
  );
};

const buildRealtimeSummaryPayload = () => {
  const row = db.prepare(`
    SELECT
      COALESCE((SELECT SUM(initial_balance) FROM accounts), 0) AS accounts_initial_balance,
      COALESCE((SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) FROM transactions), 0) AS total_income,
      COALESCE((SELECT SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) FROM transactions), 0) AS total_expense,
      COALESCE((SELECT COUNT(*) FROM transactions), 0) AS transaction_count,
      COALESCE((SELECT MAX(date) FROM transactions), NULL) AS last_transaction_date,
      COALESCE((SELECT COUNT(*) FROM alerts WHERE status IN ('active', 'acknowledged', 'snoozed')), 0) AS active_alerts,
      COALESCE((SELECT COUNT(*) FROM loans), 0) AS loan_count,
      COALESCE((SELECT SUM(current_balance) FROM loans), 0) AS total_loan_balance,
      COALESCE((SELECT COUNT(*) FROM loan_payments), 0) AS loan_payment_count,
      COALESCE((SELECT COUNT(*) FROM bills WHERE is_paid = 0), 0) AS unpaid_bills,
      COALESCE((SELECT COUNT(*) FROM goals), 0) AS goal_count,
      COALESCE((SELECT COUNT(*) FROM recurring_items WHERE status = 'active'), 0) AS active_recurring_count
  `).get();

  const totalBalance = sanitizeNumber(row.accounts_initial_balance) + sanitizeNumber(row.total_income) - sanitizeNumber(row.total_expense);
  return {
    totalBalance,
    totalIncome: sanitizeNumber(row.total_income),
    totalExpense: sanitizeNumber(row.total_expense),
    transactionCount: sanitizeNumber(row.transaction_count),
    lastTransactionDate: row.last_transaction_date || null,
    activeAlerts: sanitizeNumber(row.active_alerts),
    loanCount: sanitizeNumber(row.loan_count),
    totalLoanBalance: sanitizeNumber(row.total_loan_balance),
    loanPaymentCount: sanitizeNumber(row.loan_payment_count),
    unpaidBills: sanitizeNumber(row.unpaid_bills),
    goalCount: sanitizeNumber(row.goal_count),
    activeRecurringCount: sanitizeNumber(row.active_recurring_count),
    generatedAt: new Date().toISOString()
  };
};

const getScenarioMonthlyAverages = (database, monthCount = 3) => {
  const rows = database.prepare(`
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

  const monthlyIncome = rows.reduce((sum, row) => sum + sanitizeNumber(row.income, 0), 0) / rows.length;
  const monthlyExpense = rows.reduce((sum, row) => sum + sanitizeNumber(row.expense, 0), 0) / rows.length;

  return { monthlyIncome, monthlyExpense };
};

const runScenarioProjection = (database, assumptions = {}) => {
  const base = getScenarioMonthlyAverages(database);
  const months = Math.max(1, Math.round(sanitizeNumber(assumptions.duration_months || assumptions.months, 6)));
  const monthlyIncome = sanitizeNumber(assumptions.monthly_income ?? base.monthlyIncome, 0);
  const monthlyExpense = sanitizeNumber(assumptions.monthly_expense ?? base.monthlyExpense, 0);
  const extraMonthlyExpense = sanitizeNumber(assumptions.extra_monthly_expense, 0);
  const oneOffExpense = sanitizeNumber(assumptions.one_off_expense, 0);
  const incomeDelta = sanitizeNumber(assumptions.income_delta, 0);
  const expenseDelta = sanitizeNumber(assumptions.expense_delta, 0);

  const accountTotals = sanitizeNumber(
    database.prepare('SELECT COALESCE(SUM(initial_balance), 0) AS total FROM accounts').get()?.total,
    0
  );
  const historicalNet = sanitizeNumber(database.prepare(`
    SELECT COALESCE(SUM(
      CASE
        WHEN type = 'income' THEN amount
        WHEN type = 'expense' THEN -amount
        ELSE 0
      END
    ), 0) AS total
    FROM transactions
  `).get()?.total, 0);

  let runningBalance = sanitizeNumber(assumptions.start_balance, accountTotals + historicalNet);
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
    : Number(runningBalance.toFixed(2));
  const lowestBalance = timeline.reduce((min, item) => Math.min(min, item.projectedBalance), finalBalance);

  let riskLevel = 'low';
  const riskNotes = [];

  if (lowestBalance < 0 || finalBalance < 0) {
    riskLevel = 'high';
    riskNotes.push('Projection enters negative balance.');
  } else if (finalBalance < sanitizeNumber(assumptions.start_balance, accountTotals + historicalNet) * 0.75) {
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
      start_balance: Number(sanitizeNumber(assumptions.start_balance, accountTotals + historicalNet).toFixed(2))
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

const getScenarioById = (database, id) => {
  const row = database.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    assumptions: parseJsonSafely(row.assumptions_json, {}),
    result_snapshot: parseJsonSafely(row.result_snapshot_json, null)
  };
};

const getScenarios = (database) => {
  return database.prepare('SELECT * FROM scenarios ORDER BY updated_at DESC, created_at DESC').all().map((row) => ({
    ...row,
    assumptions: parseJsonSafely(row.assumptions_json, {}),
    result_snapshot: parseJsonSafely(row.result_snapshot_json, null)
  }));
};

const runScenario = (database, input = {}) => {
  const assumptions = input.assumptions || input;
  return runScenarioProjection(database, assumptions);
};

const saveScenario = (database, scenario) => {
  const assumptions = typeof scenario.assumptions_json === 'string'
    ? parseJsonSafely(scenario.assumptions_json, {})
    : (scenario.assumptions || {});

  const result = scenario.result_snapshot_json
    ? (typeof scenario.result_snapshot_json === 'string'
      ? parseJsonSafely(scenario.result_snapshot_json, null)
      : scenario.result_snapshot_json)
    : runScenarioProjection(database, assumptions);

  const riskLevel = result?.summary?.riskLevel || scenario.risk_level || 'low';

  database.prepare(`
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
    durationMonths: Math.max(1, Math.round(sanitizeNumber(
      assumptions.duration_months || assumptions.months || scenario.duration_months,
      6
    ))),
    resultSnapshotJson: JSON.stringify(result || {}),
    riskLevel
  });

  createScenarioRiskAlert(
    database,
    scenario.id,
    riskLevel,
    `Scenario "${scenario.title}" risk level is ${riskLevel}.`
  );

  return getScenarioById(database, scenario.id);
};

const deleteScenario = (database, id) => {
  database.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
};

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

const GOAL_MANUAL_SEED_SOURCE = 'manual_seed';
const getGoalManualSeedId = (goalId) => `goal_seed_${goalId}`;

const recalculateGoalCurrentAmount = (goalId) => {
  const normalizedGoalId = String(goalId || '').trim();
  if (!normalizedGoalId) return null;

  db.prepare(`
    UPDATE goals
    SET current_amount = COALESCE((
      SELECT SUM(amount)
      FROM goal_contributions
      WHERE goal_id = goals.id
    ), 0)
    WHERE id = ?
  `).run(normalizedGoalId);

  return db.prepare('SELECT * FROM goals WHERE id = ?').get(normalizedGoalId);
};

const syncGoalManualSeed = (goalId, desiredAmount, options = {}) => {
  const normalizedGoalId = String(goalId || '').trim();
  if (!normalizedGoalId) return null;

  const goalExists = db.prepare('SELECT id FROM goals WHERE id = ?').get(normalizedGoalId);
  if (!goalExists) return null;

  const desired = sanitizeNumber(desiredAmount, 0);
  const nonSeedTotal = sanitizeNumber(db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM goal_contributions
    WHERE goal_id = ? AND source_type <> ?
  `).get(normalizedGoalId, GOAL_MANUAL_SEED_SOURCE)?.total, 0);
  const seedAmount = Number((desired - nonSeedTotal).toFixed(2));
  const seedId = getGoalManualSeedId(normalizedGoalId);
  const seedDate = String(options.date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  if (Math.abs(seedAmount) < 0.005) {
    db.prepare('DELETE FROM goal_contributions WHERE id = ?').run(seedId);
    return recalculateGoalCurrentAmount(normalizedGoalId);
  }

  db.prepare(`
    INSERT INTO goal_contributions (id, goal_id, transaction_id, amount, date, source_type, source_id, notes)
    VALUES (@id, @goalId, NULL, @amount, @date, @sourceType, @sourceId, @notes)
    ON CONFLICT(id) DO UPDATE SET
      goal_id = @goalId,
      amount = @amount,
      date = @date,
      source_type = @sourceType,
      source_id = @sourceId,
      notes = @notes
  `).run({
    id: seedId,
    goalId: normalizedGoalId,
    amount: seedAmount,
    date: seedDate,
    sourceType: GOAL_MANUAL_SEED_SOURCE,
    sourceId: seedId,
    notes: options.notes || 'Manual goal baseline adjustment.'
  });

  return recalculateGoalCurrentAmount(normalizedGoalId);
};

const transactionToNormalized = (tx) => ({
  id: ensureString(tx.id, 'transaction.id', { maxLength: 120 }),
  accountId: ensureString(tx.accountId || tx.account_id, 'transaction.accountId', { maxLength: 120 }),
  toAccountId: tx.toAccountId || tx.to_account_id || null,
  categoryId: tx.category || tx.category_id || null,
  subcategoryId: tx.subcategory || tx.subcategory_id || null,
  type: ensureEnum(tx.type, 'transaction.type', ['income', 'expense', 'transfer']),
  amount: ensureNumber(tx.amount, 'transaction.amount', { min: 0.01 }),
  date: ensureIsoDate(tx.date, 'transaction.date'),
  merchant: ensureString(tx.merchant || '', 'transaction.merchant', { required: false, allowEmpty: true, maxLength: 200 }),
  notes: ensureString(tx.notes || '', 'transaction.notes', { required: false, allowEmpty: true, maxLength: 1000 }),
  tags: toArray(tx.tags),
  tagIds: toArray(tx.tagIds || tx.tag_ids),
  labelIds: toArray(tx.labelIds || tx.label_ids),
  goalId: tx.goalId || tx.goal_id || null,
  attachmentPath: tx.attachmentPath || tx.attachment_path || null,
  taxAmount: sanitizeNumber(tx.taxAmount || tx.tax_amount, 0)
});

const ensureGoalContribution = (tx) => {
  if (!tx.goalId) return;
  const goal = db.prepare('SELECT id, current_amount FROM goals WHERE id = ?').get(tx.goalId);
  if (!goal) return;

  syncGoalManualSeed(goal.id, sanitizeNumber(goal.current_amount, 0), {
    notes: 'Auto baseline sync before transaction-linked contribution.'
  });

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
  recalculateGoalCurrentAmount(tx.goalId);
};

const removeGoalContributionByTransaction = (transactionId) => {
  const rows = db.prepare('SELECT goal_id FROM goal_contributions WHERE transaction_id = ?').all(transactionId);
  db.prepare('DELETE FROM goal_contributions WHERE transaction_id = ?').run(transactionId);
  for (const row of rows) {
    recalculateGoalCurrentAmount(row.goal_id);
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
  evaluateCashCollisionAlerts(db);

  const month = getMonthFromDate(normalizedTx.date);
  if (month) {
    markSettlementDirty(db, month, `Transaction ${transactionId} changed.`);
  }
  refreshRealtimeState();
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
  const normalizedName = ensureString(account?.name, 'account.name', { maxLength: 120 });
  const normalizedType = ensureEnum(account?.type, 'account.type', ['checking', 'savings', 'credit', 'cash', 'investment']);
  const normalizedCurrency = ensureString(account?.currency || 'USD', 'account.currency', {
    maxLength: 12,
    defaultValue: 'USD'
  }).toUpperCase();
  const normalizedInitialBalance = ensureNumber(account?.initialBalance, 'account.initialBalance', {
    required: false,
    defaultValue: 0
  });

  const stmt = db.prepare(`
    INSERT INTO accounts (id, name, type, currency, initial_balance)
    VALUES (@id, @name, @type, @currency, @initialBalance)
  `);
  stmt.run({
    id: account.id,
    name: normalizedName,
    type: normalizedType,
    currency: normalizedCurrency,
    initialBalance: normalizedInitialBalance
  });
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();
  return {
    ...account,
    name: normalizedName,
    type: normalizedType,
    currency: normalizedCurrency,
    initialBalance: normalizedInitialBalance
  };
}

export function updateAccount(account) {
  const normalizedName = ensureString(account?.name, 'account.name', { maxLength: 120 });
  const normalizedType = ensureEnum(account?.type, 'account.type', ['checking', 'savings', 'credit', 'cash', 'investment']);
  const normalizedCurrency = ensureString(account?.currency || 'USD', 'account.currency', {
    maxLength: 12,
    defaultValue: 'USD'
  }).toUpperCase();
  const normalizedInitialBalance = ensureNumber(account?.initialBalance, 'account.initialBalance', {
    required: false,
    defaultValue: 0
  });

  const stmt = db.prepare(`
    UPDATE accounts SET name = @name, type = @type, currency = @currency, initial_balance = @initialBalance
    WHERE id = @id
  `);
  stmt.run({
    id: account.id,
    name: normalizedName,
    type: normalizedType,
    currency: normalizedCurrency,
    initialBalance: normalizedInitialBalance
  });
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();
  return {
    ...account,
    name: normalizedName,
    type: normalizedType,
    currency: normalizedCurrency,
    initialBalance: normalizedInitialBalance
  };
}

export function deleteAccount(id) {
  const tx = db.transaction(() => {
    const relatedTransactions = db.prepare(`
      SELECT id
      FROM transactions
      WHERE account_id = ? OR to_account_id = ?
    `).all(id, id);

    if (relatedTransactions.length > 0) {
      const deleteGoalContribution = db.prepare('DELETE FROM goal_contributions WHERE transaction_id = ?');
      for (const row of relatedTransactions) {
        deleteGoalContribution.run(row.id);
      }
      db.prepare('DELETE FROM transactions WHERE account_id = ? OR to_account_id = ?').run(id, id);
    }

    db.prepare('DELETE FROM recurring_items WHERE account_id = ?').run(id);
    db.prepare('UPDATE goals SET linked_account_id = NULL WHERE linked_account_id = ?').run(id);
    db.prepare('UPDATE loans SET linked_account_id = NULL WHERE linked_account_id = ?').run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  });
  tx();
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();
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
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    evaluateCashCollisionAlerts(db);
    if (existing?.date) {
      markSettlementDirty(db, getMonthFromDate(existing.date), `Transaction ${id} deleted.`);
    }
    refreshRealtimeState();
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
    refreshRealtimeState();
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
    refreshRealtimeState();
}

// -- Dashboard Stats --
export function getDashboardStats() {
    evaluateCashCollisionAlerts(db);
    refreshRealtimeState();
    const realtimeSummary = getRealtimeState({ stateKey: 'system.summary' });
    const summary = realtimeSummary?.payload || buildRealtimeSummaryPayload();
    const income = sanitizeNumber(summary.totalIncome, 0);
    const expense = sanitizeNumber(summary.totalExpense, 0);
    const totalBalance = sanitizeNumber(summary.totalBalance, 0);
    const activeAlerts = sanitizeNumber(summary.activeAlerts, 0);
    
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
        totalBalance,
        totalIncome: income,
        totalExpense: expense,
        chartData,
        activeAlerts
    };
}

export function getDashboardOptimization(options = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'dashboard',
    requiredRole: 'Viewer'
  }));

  const periodDays = normalizeOptimizationPeriod(options.periodDays ?? options.period_days);
  const windowStart = `-${Math.max(0, periodDays - 1)} days`;

  const spendRow = db.prepare(`
    SELECT
      COALESCE(SUM(amount), 0) AS total_spend
    FROM transactions
    WHERE type = 'expense'
      AND date(date) >= date('now', @windowStart)
      AND date(date) <= date('now')
  `).get({ windowStart });

  const dueSoonRow = db.prepare(`
    SELECT
      COALESCE(SUM(amount), 0) AS due_soon_total
    FROM bills
    WHERE COALESCE(is_paid, 0) <> 1
      AND date(next_due_date) >= date('now')
      AND date(next_due_date) <= date('now', '+7 days')
  `).get();

  const debtLoadRow = db.prepare(`
    SELECT
      COALESCE(SUM(current_balance), 0) AS debt_load_total
    FROM loans
    WHERE COALESCE(current_balance, 0) > 0
  `).get();

  const categoryRows = db.prepare(`
    SELECT
      COALESCE(t.category_id, 'uncategorized') AS category_id,
      COALESCE(c.name, 'Uncategorized') AS category_name,
      COUNT(*) AS tx_count,
      COALESCE(SUM(t.amount), 0) AS amount
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.type = 'expense'
      AND date(t.date) >= date('now', @windowStart)
      AND date(t.date) <= date('now')
    GROUP BY COALESCE(t.category_id, 'uncategorized'), COALESCE(c.name, 'Uncategorized')
    HAVING amount > 0
    ORDER BY amount DESC
    LIMIT 10
  `).all({ windowStart });

  const debtRows = db.prepare(`
    SELECT id, name, current_balance, interest_rate, payment_amount, due_status
    FROM loans
    WHERE COALESCE(current_balance, 0) > 0
    ORDER BY current_balance DESC, interest_rate DESC
    LIMIT 12
  `).all();

  const billRows = db.prepare(`
    SELECT id, name, amount, next_due_date, is_paid
    FROM bills
    WHERE COALESCE(is_paid, 0) <> 1
    ORDER BY date(next_due_date) ASC
    LIMIT 20
  `).all();

  return buildDashboardOptimizationPayload({
    asOf: new Date().toISOString(),
    periodDays,
    totalSpend: spendRow?.total_spend || 0,
    billsDue7d: dueSoonRow?.due_soon_total || 0,
    debtLoad: debtLoadRow?.debt_load_total || 0,
    categories: categoryRows,
    loans: debtRows,
    bills: billRows
  });
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
  const normalizedPeriod = ensureEnum(budget?.period, 'budget.period', ['weekly', 'monthly', 'yearly']);
  const normalizedLimit = ensureNumber(budget?.limit_amount, 'budget.limit_amount', { min: 0 });
  const normalizedCategoryId = ensureString(budget?.category_id, 'budget.category_id', { maxLength: 120 });

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
    categoryId: normalizedCategoryId,
    period: normalizedPeriod,
    limitAmount: normalizedLimit
  });
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Budget ${budget.id} updated.`);
  refreshRealtimeState();
  return {
    ...budget,
    category_id: normalizedCategoryId,
    period: normalizedPeriod,
    limit_amount: normalizedLimit
  };
}

export function deleteBudget(id) {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Budget ${id} deleted.`);
    refreshRealtimeState();
}

// -- Goals --
export function getGoals() {
  return db.prepare('SELECT * FROM goals').all();
}

export function saveGoal(goal) {
  const resolvedTargetAmount = ensureNumber(goal?.target_amount, 'goal.target_amount', { min: 0 });
  const resolvedCurrentAmount = ensureNumber(goal?.current_amount, 'goal.current_amount', {
    required: false,
    min: 0,
    defaultValue: 0
  });
  const normalizedName = ensureString(goal?.name, 'goal.name', { maxLength: 200 });
  const normalizedGoalType = ensureEnum(goal?.goal_type || 'standard', 'goal.goal_type', ['standard', 'sinking_fund', 'debt_payoff']);
  const normalizedPriority = ensureEnum(goal?.priority || 'medium', 'goal.priority', ['low', 'medium', 'high']);
  const normalizedRiskStatus = ensureEnum(goal?.risk_status || 'normal', 'goal.risk_status', ['normal', 'watch', 'at_risk', 'critical'], { fallback: 'normal' });
  const normalizedTargetDate = ensureIsoDate(goal?.target_date, 'goal.target_date', { required: false, allowEmpty: true }) || null;
  const normalizedFundingSource = ensureString(goal?.funding_source || '', 'goal.funding_source', {
    required: false,
    allowEmpty: true,
    maxLength: 120
  }) || null;
  const normalizedLinkedAccountId = goal?.linked_account_id ? ensureString(goal.linked_account_id, 'goal.linked_account_id', { maxLength: 120 }) : null;

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
    name: normalizedName,
    targetAmount: resolvedTargetAmount,
    targetDate: normalizedTargetDate,
    linkedAccountId: normalizedLinkedAccountId,
    currentAmount: resolvedCurrentAmount,
    goalType: normalizedGoalType,
    priority: normalizedPriority,
    fundingSource: normalizedFundingSource,
    riskStatus: normalizedRiskStatus,
    protectedPool: toBooleanFlag(goal.protected_pool)
  });

  syncGoalManualSeed(goal.id, resolvedCurrentAmount, {
    date: new Date().toISOString().slice(0, 10),
    notes: 'Manual goal baseline synced from goal editor.'
  });

  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Goal ${goal.id} updated.`);
  refreshRealtimeState();
  return db.prepare('SELECT * FROM goals WHERE id = ?').get(goal.id);
}

export function addGoalContribution(input = {}) {
  const goalId = String(input.goalId || input.goal_id || '').trim();
  if (!goalId) {
    throw new Error('goalId is required.');
  }

  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`);
  }
  syncGoalManualSeed(goalId, sanitizeNumber(goal.current_amount, 0), {
    notes: 'Auto baseline sync before manual contribution.'
  });

  const amount = sanitizeNumber(input.amount, Number.NaN);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('A non-zero amount is required.');
  }

  const contributionId = String(input.id || createAuditId('goal_contrib')).trim();
  const contributionDate = String(input.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const sourceType = String(input.sourceType || input.source_type || 'manual').trim() || 'manual';
  const sourceId = input.sourceId || input.source_id || null;
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';

  db.prepare(`
    INSERT INTO goal_contributions (id, goal_id, transaction_id, amount, date, source_type, source_id, notes)
    VALUES (@id, @goalId, @transactionId, @amount, @date, @sourceType, @sourceId, @notes)
    ON CONFLICT(id) DO UPDATE SET
      goal_id = @goalId,
      transaction_id = @transactionId,
      amount = @amount,
      date = @date,
      source_type = @sourceType,
      source_id = @sourceId,
      notes = @notes
  `).run({
    id: contributionId,
    goalId,
    transactionId: input.transactionId || input.transaction_id || null,
    amount,
    date: contributionDate,
    sourceType,
    sourceId,
    notes
  });

  const updatedGoal = recalculateGoalCurrentAmount(goalId);
  const month = getMonthFromDate(contributionDate) || new Date().toISOString().slice(0, 7);
  markSettlementDirty(db, month, `Goal contribution ${contributionId} posted.`);
  refreshRealtimeState();

  return {
    goal: updatedGoal,
    contribution: db.prepare('SELECT * FROM goal_contributions WHERE id = ?').get(contributionId)
  };
}

export function deleteGoal(id) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM goal_contributions WHERE goal_id = ?').run(id);
    db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  });
  tx();
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Goal ${id} deleted.`);
  refreshRealtimeState();
}

export function getGoalContributions() {
  return db.prepare(`
    SELECT gc.*, g.name as goal_name, t.merchant as transaction_merchant
    FROM goal_contributions gc
    LEFT JOIN goals g ON g.id = gc.goal_id
    LEFT JOIN transactions t ON t.id = gc.transaction_id
    WHERE gc.source_type <> ?
    ORDER BY gc.date DESC
  `).all(GOAL_MANUAL_SEED_SOURCE);
}

// -- Bills --
export function getBills() {
  return db.prepare('SELECT * FROM bills ORDER BY next_due_date ASC').all();
}

export function saveBill(bill) {
  const normalizedName = ensureString(bill?.name, 'bill.name', { maxLength: 160 });
  const normalizedAmount = ensureNumber(bill?.amount, 'bill.amount', { min: 0 });
  const normalizedDueDate = ensureIsoDate(bill?.next_due_date, 'bill.next_due_date');
  const normalizedRecurrence = ensureString(bill?.recurrence || 'monthly', 'bill.recurrence', {
    required: false,
    maxLength: 32,
    defaultValue: 'monthly'
  }).toLowerCase();

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
    name: normalizedName,
    amount: normalizedAmount,
    nextDueDate: normalizedDueDate,
    recurrence: normalizedRecurrence,
    isPaid: toBooleanFlag(bill.is_paid),
    autoPay: toBooleanFlag(bill.auto_pay)
  });
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();
  return {
    ...bill,
    name: normalizedName,
    amount: normalizedAmount,
    next_due_date: normalizedDueDate,
    recurrence: normalizedRecurrence,
    is_paid: toBooleanFlag(bill.is_paid),
    auto_pay: toBooleanFlag(bill.auto_pay)
  };
}

export function deleteBill(id) {
    db.prepare('DELETE FROM bills WHERE id = ?').run(id);
    evaluateCashCollisionAlerts(db);
    refreshRealtimeState();
}

// -- Loans --
export function getLoans() {
  return db.prepare('SELECT * FROM loans ORDER BY interest_rate DESC').all();
}

export function getLoanPayments(filter = {}) {
  const conditions = [];
  const params = [];
  let query = 'SELECT * FROM loan_payments';

  if (filter.loanId || filter.loan_id) {
    conditions.push('loan_id = ?');
    params.push(filter.loanId || filter.loan_id);
  }

  if (filter.fromDate || filter.from_date) {
    conditions.push('paid_at >= ?');
    params.push(filter.fromDate || filter.from_date);
  }

  if (filter.toDate || filter.to_date) {
    conditions.push('paid_at <= ?');
    params.push(filter.toDate || filter.to_date);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY paid_at DESC, created_at DESC';
  const limit = Math.max(1, Math.min(1000, Number(filter.limit) || 100));
  query += ` LIMIT ${limit}`;

  return db.prepare(query).all(...params);
}

export function getLoanPaymentStats() {
  return db.prepare(`
    SELECT
      lp.loan_id,
      COUNT(*) AS payment_count,
      COALESCE(SUM(lp.amount), 0) AS total_paid,
      MAX(lp.paid_at) AS last_paid_at,
      COALESCE((
        SELECT lp2.amount
        FROM loan_payments lp2
        WHERE lp2.loan_id = lp.loan_id
        ORDER BY lp2.paid_at DESC, lp2.created_at DESC
        LIMIT 1
      ), 0) AS last_amount
    FROM loan_payments lp
    GROUP BY lp.loan_id
  `).all();
}

export function payLoan(input = {}) {
  const loanId = String(input.loanId || input.loan_id || '').trim();
  if (!loanId) {
    throw new Error('loanId is required.');
  }

  const paidAtRaw = input.paidAt || input.paid_at || new Date().toISOString();
  const paidAt = String(paidAtRaw).trim() || new Date().toISOString();
  const paymentDate = paidAt.slice(0, 10);
  assertMonthEditableForDate(db, paymentDate);
  const note = typeof input.note === 'string' ? input.note.trim() : null;
  const requestedAmount = sanitizeNumber(input.amount, 0);
  const createLinkedTransaction = input.createLinkedTransaction !== false;

  const execute = db.transaction(() => {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
    if (!loan) {
      throw new Error(`Loan not found: ${loanId}`);
    }

    const balanceBefore = Math.max(0, sanitizeNumber(loan.current_balance, 0));
    const scheduledPayment = Math.max(0, sanitizeNumber(loan.payment_amount, 0));
    const paymentAmount = Math.max(
      0,
      Math.min(balanceBefore, requestedAmount > 0 ? requestedAmount : scheduledPayment)
    );
    const balanceAfter = Math.max(0, Number((balanceBefore - paymentAmount).toFixed(2)));

    if (paymentAmount <= 0) {
      return { loan, payment: null };
    }

    const paymentId = createAuditId('loan_payment');
    db.prepare(`
      INSERT INTO loan_payments (id, loan_id, amount, balance_before, balance_after, paid_at, note)
      VALUES (@id, @loanId, @amount, @balanceBefore, @balanceAfter, @paidAt, @note)
    `).run({
      id: paymentId,
      loanId,
      amount: paymentAmount,
      balanceBefore,
      balanceAfter,
      paidAt,
      note
    });

    db.prepare(`
      UPDATE loans
      SET current_balance = @currentBalance,
          due_status = @dueStatus
      WHERE id = @id
    `).run({
      id: loanId,
      currentBalance: balanceAfter,
      dueStatus: balanceAfter <= 0 ? 'upcoming' : (loan.due_status || 'upcoming')
    });

    const updatedLoan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
    const payment = db.prepare('SELECT * FROM loan_payments WHERE id = ?').get(paymentId);
    return { loan: updatedLoan, payment };
  });

  const result = execute();
  let linkedTransaction = null;

  if (createLinkedTransaction && result?.payment && result?.loan?.linked_account_id) {
    try {
      linkedTransaction = addTransaction({
        id: `loan_tx_${result.payment.id}`,
        accountId: result.loan.linked_account_id,
        category: input.categoryId || input.category_id || null,
        type: 'expense',
        amount: result.payment.amount,
        date: paymentDate,
        merchant: `Loan payment - ${result.loan.name || loanId}`,
        notes: note || `Loan payment entry linked to ${loanId}`,
        tags: ['loan-payment']
      });
    } catch (error) {
      safeError(`Unable to create linked transaction for loan payment ${loanId}:`, error?.message || error);
    }
  }

  evaluateCashCollisionAlerts(db);
  markSettlementDirty(db, getMonthFromDate(paymentDate) || new Date().toISOString().slice(0, 7), `Loan ${loanId} payment posted.`);
  refreshRealtimeState();
  return {
    ...result,
    linkedTransaction
  };
}

export function saveLoan(loan) {
  const normalizedName = ensureString(loan?.name, 'loan.name', { maxLength: 180 });
  const normalizedLender = ensureString(loan?.lender, 'loan.lender', { maxLength: 160 });
  const normalizedPrincipal = ensureNumber(loan?.principal_amount, 'loan.principal_amount', { min: 0 });
  const normalizedCurrent = ensureNumber(loan?.current_balance, 'loan.current_balance', { min: 0 });
  const normalizedRate = ensureNumber(loan?.interest_rate, 'loan.interest_rate', { min: 0, max: 1000 });
  const normalizedPayment = ensureNumber(loan?.payment_amount, 'loan.payment_amount', { min: 0 });
  const normalizedFrequency = ensureEnum(loan?.payment_frequency || 'monthly', 'loan.payment_frequency', ['monthly', 'biweekly', 'weekly']);
  const normalizedStartDate = ensureIsoDate(loan?.start_date, 'loan.start_date');
  const normalizedEndDate = ensureIsoDate(loan?.end_date, 'loan.end_date', { required: false, allowEmpty: true }) || null;
  const normalizedNextDueDate = ensureIsoDate(loan?.next_due_date || loan?.end_date, 'loan.next_due_date', { required: false, allowEmpty: true }) || normalizedEndDate;
  const normalizedDueStatus = ensureEnum(loan?.due_status || 'upcoming', 'loan.due_status', ['upcoming', 'due_soon', 'overdue']);
  const normalizedNotes = ensureString(loan?.notes || '', 'loan.notes', { required: false, allowEmpty: true, maxLength: 2000 }) || null;
  const normalizedLinkedAccountId = loan?.linked_account_id ? ensureString(loan.linked_account_id, 'loan.linked_account_id', { maxLength: 120 }) : null;

  const stmt = db.prepare(`
    INSERT INTO loans (id, name, principal_amount, current_balance, interest_rate, payment_amount, payment_frequency, start_date, end_date, linked_account_id, lender, notes, next_due_date, due_status)
    VALUES (@id, @name, @principalAmount, @currentBalance, @interestRate, @paymentAmount, @paymentFrequency, @startDate, @endDate, @linkedAccountId, @lender, @notes, @nextDueDate, @dueStatus)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      principal_amount = @principalAmount,
      current_balance = @currentBalance,
      interest_rate = @interestRate,
      payment_amount = @paymentAmount,
      payment_frequency = @paymentFrequency,
      start_date = @startDate,
      end_date = @endDate,
      linked_account_id = @linkedAccountId,
      lender = @lender,
      notes = @notes,
      next_due_date = @nextDueDate,
      due_status = @dueStatus
  `);
  stmt.run({
    id: loan.id,
    name: normalizedName,
    principalAmount: normalizedPrincipal,
    currentBalance: normalizedCurrent,
    interestRate: normalizedRate,
    paymentAmount: normalizedPayment,
    paymentFrequency: normalizedFrequency,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    linkedAccountId: normalizedLinkedAccountId,
    lender: normalizedLender,
    notes: normalizedNotes,
    nextDueDate: normalizedNextDueDate,
    dueStatus: normalizedDueStatus
  });
  evaluateCashCollisionAlerts(db);
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Loan ${loan.id} updated.`);
  refreshRealtimeState();
  return {
    ...loan,
    name: normalizedName,
    lender: normalizedLender,
    principal_amount: normalizedPrincipal,
    current_balance: normalizedCurrent,
    interest_rate: normalizedRate,
    payment_amount: normalizedPayment,
    payment_frequency: normalizedFrequency,
    start_date: normalizedStartDate,
    end_date: normalizedEndDate,
    linked_account_id: normalizedLinkedAccountId,
    notes: normalizedNotes,
    next_due_date: normalizedNextDueDate,
    due_status: normalizedDueStatus
  };
}

export function deleteLoan(id) {
  db.prepare('DELETE FROM loans WHERE id = ?').run(id);
  evaluateCashCollisionAlerts(db);
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Loan ${id} deleted.`);
  refreshRealtimeState();
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
  refreshRealtimeState();
  return plan;
}

export function deletePlan(id) {
  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  refreshRealtimeState();
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

export function getMetadata(filter = {}) {
  const conditions = [];
  const params = [];
  let query = 'SELECT * FROM entity_metadata';

  if (filter.scopeType || filter.scope_type) {
    conditions.push('scope_type = ?');
    params.push(filter.scopeType || filter.scope_type);
  }

  if (filter.scopeId || filter.scope_id) {
    conditions.push('scope_id = ?');
    params.push(filter.scopeId || filter.scope_id);
  }

  if (filter.metadataKey || filter.metadata_key || filter.key) {
    conditions.push('metadata_key = ?');
    params.push(filter.metadataKey || filter.metadata_key || filter.key);
  }

  if (filter.updatedAfter || filter.updated_after) {
    conditions.push('updated_at >= ?');
    params.push(filter.updatedAfter || filter.updated_after);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY updated_at DESC';
  const limit = Math.max(1, Math.min(5000, Number(filter.limit) || 200));
  query += ` LIMIT ${limit}`;

  return db.prepare(query).all(...params).map((row) => normalizeMetadataRow(row));
}

export function setMetadata(input = {}) {
  const scopeType = String(input.scopeType || input.scope_type || '').trim();
  const scopeId = String(input.scopeId || input.scope_id || '').trim();
  const metadataKey = String(input.metadataKey || input.metadata_key || input.key || '').trim();

  if (!scopeType || !scopeId || !metadataKey) {
    throw new Error('scopeType, scopeId, and metadataKey are required.');
  }

  const valueJson = JSON.stringify(input.value ?? null);
  const tagsJson = Array.isArray(input.tags) ? JSON.stringify(input.tags) : null;
  const updatedAt = String(input.updatedAt || input.updated_at || new Date().toISOString());

  db.prepare(`
    INSERT INTO entity_metadata (scope_type, scope_id, metadata_key, value_json, tags_json, updated_at)
    VALUES (@scopeType, @scopeId, @metadataKey, @valueJson, @tagsJson, @updatedAt)
    ON CONFLICT(scope_type, scope_id, metadata_key) DO UPDATE SET
      value_json = excluded.value_json,
      tags_json = excluded.tags_json,
      updated_at = excluded.updated_at
  `).run({
    scopeType,
    scopeId,
    metadataKey,
    valueJson,
    tagsJson,
    updatedAt
  });

  return normalizeMetadataRow(
    db.prepare(`
      SELECT * FROM entity_metadata
      WHERE scope_type = ? AND scope_id = ? AND metadata_key = ?
    `).get(scopeType, scopeId, metadataKey)
  );
}

export function deleteMetadata(input = {}) {
  const scopeType = String(input.scopeType || input.scope_type || '').trim();
  const scopeId = String(input.scopeId || input.scope_id || '').trim();
  const metadataKey = String(input.metadataKey || input.metadata_key || input.key || '').trim();

  if (!scopeType) {
    throw new Error('scopeType is required to delete metadata.');
  }

  if (scopeId && metadataKey) {
    const result = db.prepare(`
      DELETE FROM entity_metadata
      WHERE scope_type = ? AND scope_id = ? AND metadata_key = ?
    `).run(scopeType, scopeId, metadataKey);
    return { deleted: result.changes };
  }

  if (scopeId) {
    const result = db.prepare(`
      DELETE FROM entity_metadata
      WHERE scope_type = ? AND scope_id = ?
    `).run(scopeType, scopeId);
    return { deleted: result.changes };
  }

  const result = db.prepare('DELETE FROM entity_metadata WHERE scope_type = ?').run(scopeType);
  return { deleted: result.changes };
}

export function getRealtimeState(filter = {}) {
  const includeExpiredInput = filter.includeExpired ?? filter.include_expired;
  const includeExpired = includeExpiredInput === true || String(includeExpiredInput || '').toLowerCase() === 'true';
  const stateKey = String(filter.stateKey || filter.state_key || '').trim();
  const now = new Date().toISOString();

  if (stateKey) {
    const row = db.prepare('SELECT * FROM realtime_state WHERE state_key = ?').get(stateKey);
    if (!row) return null;
    if (!includeExpired && row.expires_at && row.expires_at <= now) return null;
    return normalizeRealtimeStateRow(row);
  }

  const conditions = [];
  const params = [];
  let query = 'SELECT * FROM realtime_state';

  if (!includeExpired) {
    conditions.push('(expires_at IS NULL OR expires_at > ?)');
    params.push(now);
  }

  if (filter.prefix) {
    conditions.push('state_key LIKE ?');
    params.push(`${String(filter.prefix)}%`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY updated_at DESC';
  const limit = Math.max(1, Math.min(5000, Number(filter.limit) || 200));
  query += ` LIMIT ${limit}`;

  return db.prepare(query).all(...params).map((row) => normalizeRealtimeStateRow(row));
}

export function setRealtimeState(input = {}) {
  const stateKey = String(input.stateKey || input.state_key || '').trim();
  if (!stateKey) {
    throw new Error('stateKey is required.');
  }

  return setRealtimeStateInternal(stateKey, input.payload ?? input.value ?? {}, {
    updatedAt: input.updatedAt || input.updated_at || new Date().toISOString(),
    ttlSeconds: input.ttlSeconds ?? input.ttl_seconds ?? 0
  });
}

export function refreshRealtimeState() {
  if (!db) return null;
  const payload = buildRealtimeSummaryPayload();
  return setRealtimeStateInternal('system.summary', payload, {
    updatedAt: payload.generatedAt,
    ttlSeconds: 120
  });
}

export function optimizeDatabase(options = {}) {
  if (!db) return { optimizedAt: null, skipped: true };

  db.pragma('analysis_limit = 400');
  db.pragma('optimize');

  const checkpointModeInput = String(options.checkpointMode || options.checkpoint_mode || 'PASSIVE').toUpperCase();
  const checkpointMode = ['PASSIVE', 'FULL', 'RESTART', 'TRUNCATE'].includes(checkpointModeInput)
    ? checkpointModeInput
    : 'PASSIVE';
  if (options.checkpoint !== false) {
    db.pragma(`wal_checkpoint(${checkpointMode})`);
  }

  if (options.vacuum === true) {
    db.exec('VACUUM');
  }

  const state = refreshRealtimeState();
  return {
    optimizedAt: new Date().toISOString(),
    realtimeStateVersion: state?.version || null
  };
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
  refreshRealtimeState();

  return db.prepare('SELECT * FROM recurring_items WHERE id = ?').get(item.id);
}

export function deleteRecurringItem(id) {
  db.prepare('DELETE FROM recurring_items WHERE id = ?').run(id);
  markSettlementDirty(db, new Date().toISOString().slice(0, 7), `Recurring item ${id} deleted.`);
  refreshRealtimeState();
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
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();
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
  refreshRealtimeState();
  return updated;
}

export function getAlertSummary(context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Viewer'
  }));
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();
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
  evaluateCashCollisionAlerts(db);
  refreshRealtimeState();

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

export function getCashCollisionForecast(options = {}, context = {}) {
  enforcePermission(db, withPermissionContext(context, {
    scopeType: 'module',
    scopeId: 'alerts',
    requiredRole: 'Viewer'
  }));
  return buildCashCollisionForecast(db, options || {});
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
    db.prepare('DELETE FROM goal_contributions').run();
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
    db.prepare('DELETE FROM realtime_state').run();
    db.prepare('DELETE FROM entity_metadata').run();
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
  refreshRealtimeState();
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
    loan_payments = [],
    realtime_state = [],
    metadata_entries = [],
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
        INSERT INTO loans (id, name, principal_amount, current_balance, interest_rate, payment_amount, payment_frequency, start_date, end_date, linked_account_id, lender, notes, next_due_date, due_status, created_at)
        VALUES (@id, @name, @principal_amount, @current_balance, @interest_rate, @payment_amount, @payment_frequency, @start_date, @end_date, @linked_account_id, @lender, @notes, @next_due_date, @due_status, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          name=@name, principal_amount=@principal_amount, current_balance=@current_balance, interest_rate=@interest_rate,
          payment_amount=@payment_amount, payment_frequency=@payment_frequency, start_date=@start_date, end_date=@end_date, linked_account_id=@linked_account_id, lender=@lender, notes=@notes, next_due_date=@next_due_date, due_status=@due_status, created_at=@created_at
      `).run(l);
    }

    for (const lp of loan_payments) {
      db.prepare(`
        INSERT INTO loan_payments (id, loan_id, amount, balance_before, balance_after, paid_at, note, created_at)
        VALUES (@id, @loan_id, @amount, @balance_before, @balance_after, @paid_at, @note, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          loan_id=@loan_id, amount=@amount, balance_before=@balance_before, balance_after=@balance_after,
          paid_at=@paid_at, note=@note, created_at=@created_at
      `).run(lp);
    }

    for (const rt of realtime_state) {
      db.prepare(`
        INSERT INTO realtime_state (state_key, payload_json, version, updated_at, expires_at)
        VALUES (@state_key, @payload_json, @version, @updated_at, @expires_at)
        ON CONFLICT(state_key) DO UPDATE SET
          payload_json=@payload_json, version=@version, updated_at=@updated_at, expires_at=@expires_at
      `).run(rt);
    }

    for (const meta of metadata_entries) {
      db.prepare(`
        INSERT INTO entity_metadata (scope_type, scope_id, metadata_key, value_json, tags_json, updated_at, created_at)
        VALUES (@scope_type, @scope_id, @metadata_key, @value_json, @tags_json, @updated_at, @created_at)
        ON CONFLICT(scope_type, scope_id, metadata_key) DO UPDATE SET
          value_json=@value_json, tags_json=@tags_json, updated_at=@updated_at, created_at=@created_at
      `).run(meta);
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
  refreshRealtimeState();
}

const BACKUP_TABLE_MAP = [
  ['accounts', 'accounts'],
  ['categories', 'categories'],
  ['subcategories', 'subcategories'],
  ['tags', 'tags'],
  ['labels', 'labels'],
  ['classification_rules', 'classification_rules'],
  ['transactions', 'transactions'],
  ['transaction_tags', 'transaction_tags'],
  ['transaction_labels', 'transaction_labels'],
  ['budgets', 'budgets'],
  ['goals', 'goals'],
  ['goal_contributions', 'goal_contributions'],
  ['bills', 'bills'],
  ['loans', 'loans'],
  ['loan_payments', 'loan_payments'],
  ['realtime_state', 'realtime_state'],
  ['metadata_entries', 'entity_metadata'],
  ['plans', 'plans'],
  ['recurring_items', 'recurring_items'],
  ['scenarios', 'scenarios'],
  ['alerts', 'alerts'],
  ['alert_events', 'alert_events'],
  ['monthly_settlements', 'monthly_settlements'],
  ['settlement_events', 'settlement_events'],
  ['monthly_reports', 'monthly_reports'],
  ['report_exports', 'report_exports'],
  ['permissions', 'permissions'],
  ['share_snapshots', 'share_snapshots'],
  ['tax_rules', 'tax_rules'],
  ['app_settings', 'app_settings']
];

const buildBackupPayloadSnapshot = () => {
  const payload = {};
  for (const [payloadKey, tableName] of BACKUP_TABLE_MAP) {
    payload[payloadKey] = db.prepare(`SELECT * FROM ${tableName}`).all();
  }
  return JSON.parse(JSON.stringify(payload));
};

export function replaceAllData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('A valid restore payload object is required.');
  }

  const backupBeforeReplace = buildBackupPayloadSnapshot();

  try {
    resetAllData();
    restoreAllData(payload);
    return {
      replaced: true,
      rollbackApplied: false
    };
  } catch (error) {
    safeError('replaceAllData failed. Attempting automatic rollback:', error);
    try {
      resetAllData();
      restoreAllData(backupBeforeReplace);
      throw new Error(
        `Restore failed and was rolled back to the previous state. Reason: ${error?.message || 'unknown error'}`
      );
    } catch (rollbackError) {
      throw new Error(
        `Restore failed and automatic rollback failed: ${rollbackError?.message || 'unknown rollback error'}`
      );
    }
  }
}
