import { useState, useEffect, useCallback } from 'react'
import type {
  Transaction,
  NetWorthEntry,
  Expense,
  IncomeSource,
  Forecast,
  CalendarEvent
} from '../../services/database'

// Get the electron ipcRenderer from window.electron (exposed by preload script)
const ipc = (window as any).electron?.ipcRenderer

if (!ipc) {
  console.warn('Electron IPC not available')
}

// ============ TRANSACTIONS HOOK ============

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-transactions')
      setTransactions(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions')
    } finally {
      setLoading(false)
    }
  }, [])

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTransaction = await ipc?.invoke('add-transaction', transaction)
      setTransactions(prev => [newTransaction, ...prev])
      return newTransaction
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add transaction')
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

  return { transactions, loading, error, addTransaction, deleteTransaction, refetch: fetchTransactions }
}

// ============ NET WORTH HOOK ============

export function useNetWorth() {
  const [netWorthEntries, setNetWorthEntries] = useState<NetWorthEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNetWorth = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-net-worth')
      setNetWorthEntries(data)
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
      const data = await ipc?.invoke('get-expenses')
      setExpenses(data)
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
      const data = await ipc?.invoke('get-income-sources')
      setIncomeSources(data)
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
      const data = await ipc?.invoke('get-forecasts')
      setForecasts(data)
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

  useEffect(() => {
    fetchForecasts()
    const unsubscribe = ipc?.on('forecasts-updated', () => {
      fetchForecasts()
    })
    return () => {
      unsubscribe?.()
    }
  }, [fetchForecasts])

  return { forecasts, loading, error, addForecast, refetch: fetchForecasts }
}

// ============ CALENDAR EVENTS HOOK ============

export function useCalendarEvents() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCalendarEvents = useCallback(async () => {
    try {
      setLoading(true)
      const data = await ipc?.invoke('get-calendar-events')
      setCalendarEvents(data)
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
