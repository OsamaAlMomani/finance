import { useState, useEffect, useCallback } from 'react'
import type {
  Transaction,
  NetWorthEntry,
  Expense,
  IncomeSource,
  Forecast,
  CalendarEvent,
  TransactionFilter
} from '../../services/database'

// Lightweight demo data so UI is populated when IPC/database are unavailable
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 't1', type: 'income', description: 'Salary', amount: 3200, date: '2026-01-05', category: 'Salary', recurring: 'monthly', createdAt: '', updatedAt: '' },
  { id: 't2', type: 'expense', description: 'Rent', amount: 900, date: '2026-01-02', category: 'Housing', recurring: 'monthly', createdAt: '', updatedAt: '' },
  { id: 't3', type: 'expense', description: 'Groceries', amount: 180, date: '2026-01-08', category: 'Food', recurring: 'weekly', createdAt: '', updatedAt: '' },
  { id: 't4', type: 'income', description: 'Freelance', amount: 600, date: '2026-01-12', category: 'Side Hustle', recurring: 'once', createdAt: '', updatedAt: '' },
  { id: 't5', type: 'expense', description: 'Utilities', amount: 140, date: '2026-01-10', category: 'Utilities', recurring: 'monthly', createdAt: '', updatedAt: '' }
]

const DEMO_NET_WORTH: NetWorthEntry[] = [
  { id: 'nw1', date: '2025-11-01', assets: 24000, liabilities: 8000, createdAt: '', updatedAt: '' },
  { id: 'nw2', date: '2025-12-01', assets: 25200, liabilities: 7600, createdAt: '', updatedAt: '' },
  { id: 'nw3', date: '2026-01-01', assets: 26800, liabilities: 7400, createdAt: '', updatedAt: '' }
]

const DEMO_EXPENSES: Expense[] = [
  { id: 'e1', category: 'Housing', amount: 900, recurring: true, date: '2026-01-02', description: 'Rent', createdAt: '', updatedAt: '' },
  { id: 'e2', category: 'Food', amount: 180, recurring: true, date: '2026-01-08', description: 'Groceries', createdAt: '', updatedAt: '' }
]

const DEMO_INCOME: IncomeSource[] = [
  { id: 'i1', source: 'Salary', amount: 3200, date: '2026-01-05', createdAt: '', updatedAt: '' },
  { id: 'i2', source: 'Freelance', amount: 600, date: '2026-01-12', createdAt: '', updatedAt: '' }
]

const DEMO_FORECASTS: Forecast[] = [
  { id: 'f1', month: '2026-01', forecast_income: 3800, forecast_expense: 1900, actual_income: 0, actual_expense: 0, createdAt: '', updatedAt: '' },
  { id: 'f2', month: '2026-02', forecast_income: 3800, forecast_expense: 1850, actual_income: 0, actual_expense: 0, createdAt: '', updatedAt: '' }
]

const DEMO_EVENTS: CalendarEvent[] = [
  { id: 'c1', date: '2026-01-02', description: 'Rent due', amount: -900, type: 'expense', recurring: 'monthly', createdAt: '', updatedAt: '' },
  { id: 'c2', date: '2026-01-15', description: 'Salary payday', amount: 3200, type: 'income', recurring: 'monthly', createdAt: '', updatedAt: '' }
]

// Get the electron ipcRenderer from window.electron (exposed by preload script)
const ipc = (window as any).electron?.ipcRenderer

if (!ipc) {
  console.warn('Electron IPC not available')
}

// ============ TRANSACTIONS HOOK ============

export function useTransactions(filters?: TransactionFilter) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        // Renderer running without Electron/IPC: show demo data
        setTransactions(DEMO_TRANSACTIONS)
      } else {
        const raw: Transaction[] = filters
          ? await ipc.invoke('get-transactions-filtered', filters)
          : await ipc.invoke('get-transactions')
        const cleaned = (raw || []).filter(t => t && typeof t.amount === 'number' && typeof t.date === 'string')
        const hydrated = (!filters && cleaned.length === 0) ? DEMO_TRANSACTIONS : cleaned
        setTransactions(hydrated)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTransaction = await ipc?.invoke('add-transaction', transaction)
      setTransactions(prev => [newTransaction, ...prev])
      return newTransaction
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add transaction')
    }
  }, [])

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    try {
      await ipc?.invoke('update-transaction', id, updates)
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, ...updates } : t)
      )
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update transaction')
    }
  }, [])

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      await ipc?.invoke('delete-transaction', id)
      setTransactions(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete transaction')
    }
  }, [])

  useEffect(() => {
    fetchTransactions()
    const unsubscribe = ipc?.on('transactions-updated', () => {
      fetchTransactions()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchTransactions])

  return { transactions, loading, error, addTransaction, updateTransaction, deleteTransaction, refetch: fetchTransactions }
}

// ============ NET WORTH HOOK ============

export function useNetWorth() {
  const [netWorthEntries, setNetWorthEntries] = useState<NetWorthEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNetWorth = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setNetWorthEntries(DEMO_NET_WORTH)
      } else {
        const data = await ipc.invoke('get-net-worth')
        setNetWorthEntries(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch net worth')
    } finally {
      setLoading(false)
    }
  }, [])

  const addNetWorthEntry = useCallback(async (entry: Omit<NetWorthEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newEntry = await ipc?.invoke('add-net-worth', entry)
      setNetWorthEntries(prev => [...prev, newEntry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      return newEntry
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add net worth entry')
    }
  }, [])

  useEffect(() => {
    fetchNetWorth()
    const unsubscribe = ipc?.on('net-worth-updated', () => {
      fetchNetWorth()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchNetWorth])

  return { netWorthEntries, loading, error, addNetWorthEntry, refetch: fetchNetWorth }
}

// ============ EXPENSES HOOK ============

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setExpenses(DEMO_EXPENSES)
      } else {
        const data = await ipc.invoke('get-expenses')
        setExpenses(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses')
    } finally {
      setLoading(false)
    }
  }, [])

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newExpense = await ipc?.invoke('add-expense', expense)
      setExpenses(prev => [newExpense, ...prev])
      return newExpense
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add expense')
    }
  }, [])

  const deleteExpense = useCallback(async (id: string) => {
    try {
      await ipc?.invoke('delete-expense', id)
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete expense')
    }
  }, [])

  useEffect(() => {
    fetchExpenses()
    const unsubscribe = ipc?.on('expenses-updated', () => {
      fetchExpenses()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchExpenses])

  return { expenses, loading, error, addExpense, deleteExpense, refetch: fetchExpenses }
}

// ============ INCOME SOURCES HOOK ============

export function useIncomeSources() {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIncomeSources = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setIncomeSources(DEMO_INCOME)
      } else {
        const data = await ipc.invoke('get-income-sources')
        setIncomeSources(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch income sources')
    } finally {
      setLoading(false)
    }
  }, [])

  const addIncomeSource = useCallback(async (income: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newIncome = await ipc?.invoke('add-income-source', income)
      setIncomeSources(prev => [newIncome, ...prev])
      return newIncome
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add income source')
    }
  }, [])

  const deleteIncomeSource = useCallback(async (id: string) => {
    try {
      await ipc?.invoke('delete-income-source', id)
      setIncomeSources(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete income source')
    }
  }, [])

  useEffect(() => {
    fetchIncomeSources()
    const unsubscribe = ipc?.on('income-sources-updated', () => {
      fetchIncomeSources()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchIncomeSources])

  return { incomeSources, loading, error, addIncomeSource, deleteIncomeSource, refetch: fetchIncomeSources }
}

// ============ FORECASTS HOOK ============

export function useForecasts() {
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchForecasts = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setForecasts(DEMO_FORECASTS)
      } else {
        const data = await ipc.invoke('get-forecasts')
        setForecasts(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch forecasts')
    } finally {
      setLoading(false)
    }
  }, [])

  const addForecast = useCallback(async (forecast: Omit<Forecast, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newForecast = await ipc?.invoke('add-forecast', forecast)
      setForecasts(prev => [...prev, newForecast].sort((a, b) => a.month.localeCompare(b.month)))
      return newForecast
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add forecast')
    }
  }, [])

  const updateForecast = useCallback(async (id: string, updates: Partial<Forecast>) => {
    try {
      if (!ipc) throw new Error('IPC not available')
      await ipc.invoke('update-forecast', id, updates)
      setForecasts(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update forecast')
    }
  }, [])

  useEffect(() => {
    fetchForecasts()
    const unsubscribe = ipc?.on('forecasts-updated', () => {
      fetchForecasts()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchForecasts])

  return { forecasts, loading, error, addForecast, updateForecast, refetch: fetchForecasts }
}

// ============ CALENDAR EVENTS HOOK ============

export function useCalendarEvents() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCalendarEvents = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setCalendarEvents(DEMO_EVENTS)
      } else {
        const data = await ipc.invoke('get-calendar-events')
        setCalendarEvents(data)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar events')
    } finally {
      setLoading(false)
    }
  }, [])

  const addCalendarEvent = useCallback(async (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newEvent = await ipc?.invoke('add-calendar-event', event)
      setCalendarEvents(prev => [...prev, newEvent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      return newEvent
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add calendar event')
    }
  }, [])

  const deleteCalendarEvent = useCallback(async (id: string) => {
    try {
      await ipc?.invoke('delete-calendar-event', id)
      setCalendarEvents(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete calendar event')
    }
  }, [])

  useEffect(() => {
    fetchCalendarEvents()
    const unsubscribe = ipc?.on('calendar-events-updated', () => {
      fetchCalendarEvents()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchCalendarEvents])

  return { calendarEvents, loading, error, addCalendarEvent, deleteCalendarEvent, refetch: fetchCalendarEvents }
}
