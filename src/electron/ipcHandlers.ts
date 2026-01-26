import { ipcMain, BrowserWindow } from 'electron'
import {
  initializeDatabase,
  addTransaction,
  getTransactions,
  getTransactionsFiltered,
  updateTransaction,
  deleteTransaction,
  addNetWorthEntry,
  getNetWorthEntries,
  addExpense,
  getExpenses,
  deleteExpense,
  addIncomeSource,
  getIncomeSources,
  deleteIncomeSource,
  addForecast,
  getForecasts,
  updateForecast,
  addCalendarEvent,
  getCalendarEvents,
  deleteCalendarEvent,
  getTotalIncome,
  getTotalExpenses,
  setSetting,
  getSetting,
  closeDatabase,
  // New advanced features
  addTodo,
  getTodos,
  updateTodo,
  deleteTodo,
  getDashboardConfig,
  saveDashboardConfig,
  getAnalytics,
  addAnalytics,
  getAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  type Transaction,
  type NetWorthEntry,
  type Expense,
  type IncomeSource,
  type Forecast,
  type CalendarEvent,
  type TodoItem,
  type DashboardConfig,
  type AnalyticsData,
  type Alert,
  type TransactionFilter
} from '../services/database.ts'

let mainWindow: BrowserWindow | null = null

export function registerIpcHandlers(window: BrowserWindow) {
  mainWindow = window

  // Initialize database on startup
  ipcMain.handle('init-database', async () => {
    try {
      await initializeDatabase()
      return { success: true }
    } catch (error) {
      console.error('Database initialization error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ============ TRANSACTION HANDLERS ============

  ipcMain.handle('get-transactions', async () => {
    try {
      return await getTransactions()
    } catch (error) {
      console.error('Error fetching transactions:', error)
      throw error
    }
  })

  ipcMain.handle('add-transaction', async (_event, transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTransaction = await addTransaction(transaction)
      broadcastUpdate('transactions-updated')
      return newTransaction
    } catch (error) {
      console.error('Error adding transaction:', error)
      throw error
    }
  })

  ipcMain.handle('delete-transaction', async (_event, id: string) => {
    try {
      await deleteTransaction(id)
      broadcastUpdate('transactions-updated')
    } catch (error) {
      console.error('Error deleting transaction:', error)
      throw error
    }
  })

  ipcMain.handle('update-transaction', async (_event, id: string, updates: Partial<Transaction>) => {
    try {
      await updateTransaction(id, updates)
      broadcastUpdate('transactions-updated')
      return updates
    } catch (error) {
      console.error('Error updating transaction:', error)
      throw error
    }
  })

  ipcMain.handle('get-transactions-filtered', async (_event, filters: TransactionFilter) => {
    try {
      return await getTransactionsFiltered(filters)
    } catch (error) {
      console.error('Error fetching filtered transactions:', error)
      throw error
    }
  })

  // ============ NET WORTH HANDLERS ============

  ipcMain.handle('get-net-worth', async () => {
    try {
      return await getNetWorthEntries()
    } catch (error) {
      console.error('Error fetching net worth:', error)
      throw error
    }
  })

  ipcMain.handle('add-net-worth', async (_event, entry: Omit<NetWorthEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newEntry = await addNetWorthEntry(entry)
      broadcastUpdate('net-worth-updated')
      return newEntry
    } catch (error) {
      console.error('Error adding net worth entry:', error)
      throw error
    }
  })

  // ============ EXPENSE HANDLERS ============

  ipcMain.handle('get-expenses', async () => {
    try {
      return await getExpenses()
    } catch (error) {
      console.error('Error fetching expenses:', error)
      throw error
    }
  })

  ipcMain.handle('add-expense', async (_event, expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newExpense = await addExpense(expense)
      broadcastUpdate('expenses-updated')
      return newExpense
    } catch (error) {
      console.error('Error adding expense:', error)
      throw error
    }
  })

  ipcMain.handle('delete-expense', async (_event, id: string) => {
    try {
      await deleteExpense(id)
      broadcastUpdate('expenses-updated')
    } catch (error) {
      console.error('Error deleting expense:', error)
      throw error
    }
  })

  // ============ INCOME HANDLERS ============

  ipcMain.handle('get-income-sources', async () => {
    try {
      return await getIncomeSources()
    } catch (error) {
      console.error('Error fetching income sources:', error)
      throw error
    }
  })

  ipcMain.handle('add-income-source', async (_event, income: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newIncome = await addIncomeSource(income)
      broadcastUpdate('income-sources-updated')
      return newIncome
    } catch (error) {
      console.error('Error adding income source:', error)
      throw error
    }
  })

  ipcMain.handle('delete-income-source', async (_event, id: string) => {
    try {
      await deleteIncomeSource(id)
      broadcastUpdate('income-sources-updated')
    } catch (error) {
      console.error('Error deleting income source:', error)
      throw error
    }
  })

  // ============ FORECAST HANDLERS ============

  ipcMain.handle('get-forecasts', async () => {
    try {
      return await getForecasts()
    } catch (error) {
      console.error('Error fetching forecasts:', error)
      throw error
    }
  })

  ipcMain.handle('add-forecast', async (_event, forecast: Omit<Forecast, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newForecast = await addForecast(forecast)
      broadcastUpdate('forecasts-updated')
      return newForecast
    } catch (error) {
      console.error('Error adding forecast:', error)
      throw error
    }
  })

  ipcMain.handle('update-forecast', async (_event, id: string, updates: Partial<Forecast>) => {
    try {
      await updateForecast(id, updates)
      broadcastUpdate('forecasts-updated')
    } catch (error) {
      console.error('Error updating forecast:', error)
      throw error
    }
  })

  // ============ CALENDAR HANDLERS ============

  ipcMain.handle('get-calendar-events', async () => {
    try {
      return await getCalendarEvents()
    } catch (error) {
      console.error('Error fetching calendar events:', error)
      throw error
    }
  })

  ipcMain.handle('add-calendar-event', async (_event, event_: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newEvent = await addCalendarEvent(event_)
      broadcastUpdate('calendar-events-updated')
      return newEvent
    } catch (error) {
      console.error('Error adding calendar event:', error)
      throw error
    }
  })

  ipcMain.handle('delete-calendar-event', async (_event, id: string) => {
    try {
      await deleteCalendarEvent(id)
      broadcastUpdate('calendar-events-updated')
    } catch (error) {
      console.error('Error deleting calendar event:', error)
      throw error
    }
  })

  // ============ AGGREGATION HANDLERS ============

  ipcMain.handle('get-total-income', async () => {
    try {
      return await getTotalIncome()
    } catch (error) {
      console.error('Error calculating total income:', error)
      throw error
    }
  })

  ipcMain.handle('get-total-expenses', async () => {
    try {
      return await getTotalExpenses()
    } catch (error) {
      console.error('Error calculating total expenses:', error)
      throw error
    }
  })

  // ============ SETTINGS HANDLERS ============

  ipcMain.handle('set-setting', async (_event, key: string, value: string) => {
    try {
      await setSetting(key, value)
      return true
    } catch (error) {
      console.error('Error setting:', error)
      throw error
    }
  })

  ipcMain.handle('get-setting', async (_event, key: string) => {
    try {
      return await getSetting(key)
    } catch (error) {
      console.error('Error getting setting:', error)
      throw error
    }
  })

  // ============ TODO HANDLERS ============

  ipcMain.handle('add-todo', async (_event, todo: Omit<TodoItem, 'id' | 'createdAt'>) => {
    try {
      const newTodo = await addTodo(todo)
      broadcastUpdate('todos-updated')
      return newTodo
    } catch (error) {
      console.error('Error adding todo:', error)
      throw error
    }
  })

  ipcMain.handle('get-todos', async () => {
    try {
      return await getTodos()
    } catch (error) {
      console.error('Error fetching todos:', error)
      throw error
    }
  })

  ipcMain.handle('update-todo', async (_event, id: string, updates: Partial<TodoItem>) => {
    try {
      await updateTodo(id, updates)
      broadcastUpdate('todos-updated')
    } catch (error) {
      console.error('Error updating todo:', error)
      throw error
    }
  })

  ipcMain.handle('delete-todo', async (_event, id: string) => {
    try {
      await deleteTodo(id)
      broadcastUpdate('todos-updated')
    } catch (error) {
      console.error('Error deleting todo:', error)
      throw error
    }
  })

  // ============ DASHBOARD CONFIG HANDLERS ============

  ipcMain.handle('get-dashboard-config', async () => {
    try {
      return await getDashboardConfig()
    } catch (error) {
      console.error('Error fetching dashboard config:', error)
      throw error
    }
  })

  ipcMain.handle('save-dashboard-config', async (_event, config: DashboardConfig) => {
    try {
      await saveDashboardConfig(config)
      broadcastUpdate('dashboard-config-updated')
      return { success: true }
    } catch (error) {
      console.error('Error saving dashboard config:', error)
      throw error
    }
  })

  // ============ ANALYTICS HANDLERS ============

  ipcMain.handle('get-analytics', async (_event, category?: string) => {
    try {
      return await getAnalytics(category)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      throw error
    }
  })

  ipcMain.handle('add-analytics', async (_event, data: AnalyticsData) => {
    try {
      const newEntry = await addAnalytics(data)
      broadcastUpdate('analytics-updated')
      return newEntry
    } catch (error) {
      console.error('Error adding analytics:', error)
      throw error
    }
  })

  // ============ ALERTS HANDLERS ============

  ipcMain.handle('get-alerts', async () => {
    try {
      return await getAlerts()
    } catch (error) {
      console.error('Error fetching alerts:', error)
      throw error
    }
  })

  ipcMain.handle('create-alert', async (_event, alert: Omit<Alert, 'id' | 'createdAt'>) => {
    try {
      const newAlert = await createAlert(alert)
      broadcastUpdate('alerts-updated')
      return newAlert
    } catch (error) {
      console.error('Error creating alert:', error)
      throw error
    }
  })

  ipcMain.handle('update-alert', async (_event, id: string, updates: Partial<Alert>) => {
    try {
      await updateAlert(id, updates)
      broadcastUpdate('alerts-updated')
    } catch (error) {
      console.error('Error updating alert:', error)
      throw error
    }
  })

  ipcMain.handle('delete-alert', async (_event, id: string) => {
    try {
      await deleteAlert(id)
      broadcastUpdate('alerts-updated')
    } catch (error) {
      console.error('Error deleting alert:', error)
      throw error
    }
  })

  // ============ CLEANUP ============

  ipcMain.handle('close-database', async () => {
    try {
      await closeDatabase()
      return { success: true }
    } catch (error) {
      console.error('Error closing database:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}

function broadcastUpdate(channel: string) {
  if (mainWindow) {
    mainWindow.webContents.send(channel)
  }
}
