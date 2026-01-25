import Database from 'sqlite3'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'

const DB_PATH = path.join(process.env.APPDATA || '/tmp', 'finance-app.db')

// Initialize database connection
const db = new Database.Database(DB_PATH, (err) => {
  if (err) console.error('Database connection error:', err)
  else console.log('Connected to SQLite database:', DB_PATH)
})

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON')

// Initialize database schema
export function initializeDatabase() {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Transactions table (Cash Flow Timeline)
      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          category TEXT,
          recurring TEXT DEFAULT 'once',
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Assets & Liabilities (Net Worth)
      db.run(`
        CREATE TABLE IF NOT EXISTS net_worth_entries (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL UNIQUE,
          assets REAL NOT NULL,
          liabilities REAL NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Expenses with categories
      db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          recurring INTEGER DEFAULT 0,
          date TEXT NOT NULL,
          description TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Income sources
      db.run(`
        CREATE TABLE IF NOT EXISTS income_sources (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Forecasts
      db.run(`
        CREATE TABLE IF NOT EXISTS forecasts (
          id TEXT PRIMARY KEY,
          month TEXT NOT NULL,
          forecast_income REAL NOT NULL,
          forecast_expense REAL NOT NULL,
          actual_income REAL,
          actual_expense REAL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Calendar events
      db.run(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL,
          recurring TEXT DEFAULT 'once',
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // User settings
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Todo items
      db.run(`
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          dueDate TEXT NOT NULL,
          dueTime TEXT,
          priority TEXT DEFAULT 'medium',
          completed INTEGER DEFAULT 0,
          category TEXT DEFAULT 'General',
          estimatedHours REAL,
          actualHours REAL,
          subtasks TEXT DEFAULT '[]',
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Dashboard configuration
      db.run(`
        CREATE TABLE IF NOT EXISTS dashboard_config (
          id TEXT PRIMARY KEY,
          toolIds TEXT NOT NULL,
          toolSettings TEXT NOT NULL,
          theme TEXT DEFAULT 'dark',
          layout TEXT DEFAULT 'grid',
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Analytics data
      db.run(`
        CREATE TABLE IF NOT EXISTS analytics (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          metric TEXT NOT NULL,
          value REAL NOT NULL,
          category TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Alerts
      db.run(`
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          threshold REAL,
          metric TEXT,
          active INTEGER DEFAULT 1,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
}

// ============ TRANSACTION OPERATIONS ============

export interface Transaction {
  id: string
  type: 'income' | 'expense'
  description: string
  amount: number
  date: string
  category?: string
  recurring: 'once' | 'weekly' | 'monthly' | 'yearly'
  createdAt: string
  updatedAt: string
}

export function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  return new Promise<Transaction>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO transactions (id, type, description, amount, date, category, recurring, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, transaction.type, transaction.description, transaction.amount, transaction.date, transaction.category, transaction.recurring, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...transaction, id, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getTransactions() {
  return new Promise<Transaction[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM transactions ORDER BY date DESC`,
      (err, rows: Transaction[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

export function deleteTransaction(id: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(`DELETE FROM transactions WHERE id = ?`, [id], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export function updateTransaction(id: string, updates: Partial<Transaction>) {
  return new Promise<void>((resolve, reject) => {
    const now = new Date().toISOString()
    const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`)
    const values = Object.values(updates).filter((_, i) => Object.keys(updates)[i] !== 'id')

    db.run(
      `UPDATE transactions SET ${fields.join(', ')}, updatedAt = ? WHERE id = ?`,
      [...values, now, id],
      (err) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

export interface TransactionFilter {
  startDate?: string
  endDate?: string
  category?: string
  type?: 'income' | 'expense' | 'all'
  searchText?: string
  minAmount?: number
  maxAmount?: number
}

export function getTransactionsFiltered(filters: TransactionFilter = {}) {
  return new Promise<Transaction[]>((resolve, reject) => {
    let query = `SELECT * FROM transactions WHERE 1=1`
    const params: any[] = []

    if (filters.startDate) {
      query += ` AND date >= ?`
      params.push(filters.startDate)
    }

    if (filters.endDate) {
      query += ` AND date <= ?`
      params.push(filters.endDate)
    }

    if (filters.category && filters.category !== 'All') {
      query += ` AND category = ?`
      params.push(filters.category)
    }

    if (filters.type && filters.type !== 'all') {
      query += ` AND type = ?`
      params.push(filters.type)
    }

    if (filters.searchText) {
      query += ` AND (description LIKE ? OR category LIKE ?)`
      const searchTerm = `%${filters.searchText}%`
      params.push(searchTerm, searchTerm)
    }

    if (typeof filters.minAmount === 'number') {
      query += ` AND amount >= ?`
      params.push(filters.minAmount)
    }

    if (typeof filters.maxAmount === 'number') {
      query += ` AND amount <= ?`
      params.push(filters.maxAmount)
    }

    query += ` ORDER BY date DESC`

    db.all(query, params, (err, rows: Transaction[]) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

// ============ NET WORTH OPERATIONS ============

export interface NetWorthEntry {
  id: string
  date: string
  assets: number
  liabilities: number
  createdAt: string
  updatedAt: string
}

export function addNetWorthEntry(entry: Omit<NetWorthEntry, 'id' | 'createdAt' | 'updatedAt'>) {
  return new Promise<NetWorthEntry>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO net_worth_entries (id, date, assets, liabilities, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, entry.date, entry.assets, entry.liabilities, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...entry, id, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getNetWorthEntries() {
  return new Promise<NetWorthEntry[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM net_worth_entries ORDER BY date`,
      (err, rows: NetWorthEntry[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

// ============ EXPENSE OPERATIONS ============

export interface Expense {
  id: string
  category: string
  amount: number
  recurring: boolean
  date: string
  description?: string
  createdAt: string
  updatedAt: string
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) {
  return new Promise<Expense>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO expenses (id, category, amount, recurring, date, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, expense.category, expense.amount, expense.recurring ? 1 : 0, expense.date, expense.description, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...expense, id, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getExpenses() {
  return new Promise<Expense[]>((resolve, reject) => {
    db.all(
      `SELECT id, category, amount, recurring, date, description, createdAt, updatedAt FROM expenses ORDER BY date DESC`,
      (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const expenses = rows?.map(row => ({
            ...row,
            recurring: row.recurring === 1
          })) || []
          resolve(expenses)
        }
      }
    )
  })
}

export function deleteExpense(id: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(`DELETE FROM expenses WHERE id = ?`, [id], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

// ============ INCOME OPERATIONS ============

export interface IncomeSource {
  id: string
  source: string
  amount: number
  date: string
  createdAt: string
  updatedAt: string
}

export function addIncomeSource(income: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>) {
  return new Promise<IncomeSource>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO income_sources (id, source, amount, date, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, income.source, income.amount, income.date, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...income, id, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getIncomeSources() {
  return new Promise<IncomeSource[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM income_sources ORDER BY date DESC`,
      (err, rows: IncomeSource[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

export function deleteIncomeSource(id: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(`DELETE FROM income_sources WHERE id = ?`, [id], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

// ============ FORECAST OPERATIONS ============

export interface Forecast {
  id: string
  month: string
  forecast_income: number
  forecast_expense: number
  actual_income?: number
  actual_expense?: number
  createdAt: string
  updatedAt: string
}

export function addForecast(forecast: Omit<Forecast, 'id' | 'createdAt' | 'updatedAt'>) {
  return new Promise<Forecast>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO forecasts (id, month, forecast_income, forecast_expense, actual_income, actual_expense, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, forecast.month, forecast.forecast_income, forecast.forecast_expense, forecast.actual_income, forecast.actual_expense, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...forecast, id, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getForecasts() {
  return new Promise<Forecast[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM forecasts ORDER BY month`,
      (err, rows: Forecast[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

export function updateForecast(id: string, updates: Partial<Forecast>) {
  return new Promise<void>((resolve, reject) => {
    const now = new Date().toISOString()
    const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`)
    const values = Object.values(updates).filter((_, i) => Object.keys(updates)[i] !== 'id')

    db.run(
      `UPDATE forecasts SET ${fields.join(', ')}, updatedAt = ? WHERE id = ?`,
      [...values, now, id],
      (err) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

// ============ CALENDAR OPERATIONS ============

export interface CalendarEvent {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  recurring: 'once' | 'weekly' | 'monthly' | 'yearly'
  createdAt: string
  updatedAt: string
}

export interface TodoSubtask {
  id: string
  title: string
  completed: boolean
}

export interface TodoItem {
  id: string
  title: string
  description: string
  dueDate: string
  dueTime?: string
  priority: 'high' | 'medium' | 'low'
  category: 'General' | 'Work' | 'Personal' | 'Financial' | 'Health'
  completed: boolean
  estimatedHours: number
  actualHours?: number
  subtasks: TodoSubtask[]
  createdAt: string
  updatedAt: string
}

export interface DashboardConfig {
  id?: string
  toolIds: string[]
  toolSettings: Record<string, any>
  theme?: string
  layout?: 'grid' | 'list'
  updatedAt?: string
}

export interface AnalyticsData {
  id?: string
  date: string
  metric: string
  value: number
  category?: string
  createdAt?: string
}

export interface Alert {
  id: string
  type: 'threshold' | 'milestone' | 'reminder'
  title: string
  message: string
  threshold?: number
  metric: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export function addCalendarEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  return new Promise<CalendarEvent>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO calendar_events (id, date, description, amount, type, recurring, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, event.date, event.description, event.amount, event.type, event.recurring, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...event, id, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getCalendarEvents() {
  return new Promise<CalendarEvent[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM calendar_events ORDER BY date`,
      (err, rows: CalendarEvent[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      }
    )
  })
}

export function deleteCalendarEvent(id: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(`DELETE FROM calendar_events WHERE id = ?`, [id], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

// ============ SETTINGS OPERATIONS ============

export function setSetting(key: string, value: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)`,
      [key, value, new Date().toISOString()],
      (err) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

export function getSetting(key: string) {
  return new Promise<string | null>((resolve, reject) => {
    db.get(
      `SELECT value FROM settings WHERE key = ?`,
      [key],
      (err, row: any) => {
        if (err) reject(err)
        else resolve(row?.value || null)
      }
    )
  })
}

// ============ AGGREGATION OPERATIONS ============

export function getTotalIncome() {
  return new Promise<number>((resolve, reject) => {
    db.get(
      `SELECT SUM(amount) as total FROM transactions WHERE type = 'income'`,
      (err, row: any) => {
        if (err) reject(err)
        else resolve(row?.total || 0)
      }
    )
  })
}

export function getTotalExpenses() {
  return new Promise<number>((resolve, reject) => {
    db.get(
      `SELECT SUM(amount) as total FROM transactions WHERE type = 'expense'`,
      (err, row: any) => {
        if (err) reject(err)
        else resolve(Math.abs(row?.total || 0))
      }
    )
  })
}

export function closeDatabase() {
  return new Promise<void>((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err)
      else {
        console.log('Database connection closed')
        resolve()
      }
    })
  })
}

// ============ TODO OPERATIONS ============

export function addTodo(todo: any) {
  return new Promise<any>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    const subtasks = JSON.stringify(todo.subtasks || [])

    db.run(
      `INSERT INTO todos (id, title, description, dueDate, dueTime, priority, category, estimatedHours, subtasks, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, todo.title, todo.description, todo.dueDate, todo.dueTime, todo.priority, todo.category, todo.estimatedHours, subtasks, now, now],
      function (err) {
        if (err) reject(err)
        else resolve({ ...todo, id, completed: false, createdAt: now, updatedAt: now })
      }
    )
  })
}

export function getTodos() {
  return new Promise<any[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM todos ORDER BY dueDate ASC`,
      (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const todos = (rows || []).map(row => ({
            ...row,
            completed: row.completed === 1,
            subtasks: JSON.parse(row.subtasks || '[]')
          }))
          resolve(todos)
        }
      }
    )
  })
}

export function updateTodo(id: string, updates: any) {
  return new Promise<void>((resolve, reject) => {
    const now = new Date().toISOString()
    const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`)
    const values = Object.values(updates).map(v => {
      if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
        return JSON.stringify(v)
      }
      return v
    })

    db.run(
      `UPDATE todos SET ${fields.join(', ')}, updatedAt = ? WHERE id = ?`,
      [...values, now, id],
      (err) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

export function deleteTodo(id: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(`DELETE FROM todos WHERE id = ?`, [id], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

// ============ DASHBOARD CONFIG OPERATIONS ============

export function getDashboardConfig() {
  return new Promise<any>((resolve, reject) => {
    db.get(
      `SELECT * FROM dashboard_config ORDER BY updatedAt DESC LIMIT 1`,
      (err, row: any) => {
        if (err) reject(err)
        else {
          if (row) {
            resolve({
              ...row,
              toolIds: JSON.parse(row.toolIds),
              toolSettings: JSON.parse(row.toolSettings)
            })
          } else {
            resolve(null)
          }
        }
      }
    )
  })
}

export function saveDashboardConfig(config: any) {
  return new Promise<any>((resolve, reject) => {
    const id = config.id || uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT OR REPLACE INTO dashboard_config (id, toolIds, toolSettings, theme, layout, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, JSON.stringify(config.toolIds), JSON.stringify(config.toolSettings), config.theme, config.layout, now],
      (err) => {
        if (err) reject(err)
        else resolve({ ...config, id, updatedAt: now })
      }
    )
  })
}

// ============ ANALYTICS OPERATIONS ============

export function getAnalytics(metricType?: string, dateRange?: any) {
  return new Promise<any[]>((resolve, reject) => {
    let query = `SELECT * FROM analytics WHERE 1=1`
    const params: any[] = []

    if (metricType) {
      query += ` AND metric = ?`
      params.push(metricType)
    }
    if (dateRange) {
      query += ` AND date >= ? AND date <= ?`
      params.push(dateRange.start, dateRange.end)
    }

    query += ` ORDER BY date DESC`

    db.all(query, params, (err, rows: any[]) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

export function addAnalytics(metric: any) {
  return new Promise<any>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO analytics (id, date, metric, value, category, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, metric.date, metric.metric, metric.value, metric.category, now],
      (err) => {
        if (err) reject(err)
        else resolve({ ...metric, id, createdAt: now })
      }
    )
  })
}

// ============ ALERTS OPERATIONS ============

export function getAlerts() {
  return new Promise<any[]>((resolve, reject) => {
    db.all(
      `SELECT * FROM alerts WHERE active = 1 ORDER BY createdAt DESC`,
      (err, rows: any[]) => {
        if (err) reject(err)
        else {
          const alerts = (rows || []).map(row => ({
            ...row,
            active: row.active === 1
          }))
          resolve(alerts)
        }
      }
    )
  })
}

export function createAlert(alert: any) {
  return new Promise<any>((resolve, reject) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO alerts (id, type, title, message, threshold, metric, active, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, alert.type, alert.title, alert.message, alert.threshold, alert.metric, alert.active ? 1 : 0, now],
      (err) => {
        if (err) reject(err)
        else resolve({ ...alert, id, createdAt: now })
      }
    )
  })
}

export function updateAlert(id: string, updates: any) {
  return new Promise<void>((resolve, reject) => {
    const fields = Object.keys(updates).map(key => `${key} = ?`)
    const values = Object.values(updates).map(v => (typeof v === 'boolean' ? (v ? 1 : 0) : v))

    db.run(
      `UPDATE alerts SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id],
      (err) => {
        if (err) reject(err)
        else resolve()
      }
    )
  })
}

export function deleteAlert(id: string) {
  return new Promise<void>((resolve, reject) => {
    db.run(`DELETE FROM alerts WHERE id = ?`, [id], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export default db
