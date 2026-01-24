import { ipcMain, BrowserWindow } from 'electron'
import {
  initializeDatabase,
  addTransaction,
  getTransactions,
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
  type Transaction,
  type NetWorthEntry,
  type Expense,
  type IncomeSource,
  type Forecast,
  type CalendarEvent
} from '../services/database'

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
