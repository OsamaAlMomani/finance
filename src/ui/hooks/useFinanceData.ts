import { useState, useEffect, useCallback } from 'react'
import type {
  Transaction,
  NetWorthEntry,
  Expense,
  IncomeSource,
  Forecast,
  CalendarEvent,
  TransactionFilter,
  Budget,
  Bill,
  Goal
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

const DEMO_BUDGETS: Budget[] = [
  { id: 'b1', name: 'Groceries', category: 'Food', period: 'monthly', limitAmount: 400, description: 'Monthly grocery shopping', createdAt: '', updatedAt: '' },
  { id: 'b2', name: 'Entertainment', category: 'Leisure', period: 'monthly', limitAmount: 200, description: 'Movies, games, outings', createdAt: '', updatedAt: '' },
  { id: 'b3', name: 'Transportation', category: 'Transport', period: 'monthly', limitAmount: 150, description: 'Fuel and public transport', createdAt: '', updatedAt: '' }
]

const DEMO_BILLS: Bill[] = [
  { id: 'bl1', name: 'Electricity', category: 'Utilities', amount: 85, nextDueDate: '2026-02-05', recurring: 'monthly', isPaid: false, description: 'Monthly electricity bill', createdAt: '', updatedAt: '' },
  { id: 'bl2', name: 'Netflix', category: 'Entertainment', amount: 15.99, nextDueDate: '2026-02-01', recurring: 'monthly', isPaid: false, description: 'Streaming subscription', createdAt: '', updatedAt: '' },
  { id: 'bl3', name: 'Rent', category: 'Housing', amount: 1200, nextDueDate: '2026-02-01', recurring: 'monthly', isPaid: false, description: 'Monthly rent', createdAt: '', updatedAt: '' }
]

const DEMO_GOALS: Goal[] = [
  { id: 'g1', name: 'New Laptop', category: 'Electronics', currentAmount: 800, targetAmount: 1500, targetDate: '2026-06-01', description: 'Save for a laptop upgrade', createdAt: '', updatedAt: '' },
  { id: 'g2', name: 'Vacation', category: 'Travel', currentAmount: 1200, targetAmount: 3000, targetDate: '2026-08-15', description: 'Summer trip', createdAt: '', updatedAt: '' },
  { id: 'g3', name: 'Emergency Fund', category: 'Savings', currentAmount: 5000, targetAmount: 10000, targetDate: '2026-12-31', description: 'Build emergency buffer', createdAt: '', updatedAt: '' }
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

// ============ BUDGETS HOOK ============

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBudgets = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setBudgets(DEMO_BUDGETS)
      } else {
        const data: Budget[] = await ipc.invoke('get-budgets')
        setBudgets((data && data.length) ? data : DEMO_BUDGETS)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch budgets')
    } finally {
      setLoading(false)
    }
  }, [])

  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await ipc?.invoke('add-budget', budget)
    setBudgets(prev => [created, ...prev])
    return created as Budget
  }, [])

  const updateBudget = useCallback(async (id: string, updates: Partial<Budget>) => {
    await ipc?.invoke('update-budget', id, updates)
    setBudgets(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)))
  }, [])

  const deleteBudget = useCallback(async (id: string) => {
    await ipc?.invoke('delete-budget', id)
    setBudgets(prev => prev.filter(b => b.id !== id))
  }, [])

  useEffect(() => {
    fetchBudgets()
    const unsubscribe = ipc?.on('budgets-updated', () => fetchBudgets())
    return () => unsubscribe?.()
  }, [fetchBudgets])

  return { budgets, loading, error, addBudget, updateBudget, deleteBudget, refetch: fetchBudgets }
}

// ============ BILLS HOOK ============

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setBills(DEMO_BILLS)
      } else {
        const data: Bill[] = await ipc.invoke('get-bills')
        setBills((data && data.length) ? data : DEMO_BILLS)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bills')
    } finally {
      setLoading(false)
    }
  }, [])

  const addBill = useCallback(async (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await ipc?.invoke('add-bill', bill)
    setBills(prev => [...prev, created].sort((a, b) => String(a.nextDueDate).localeCompare(String(b.nextDueDate))))
    return created as Bill
  }, [])

  const updateBill = useCallback(async (id: string, updates: Partial<Bill>) => {
    await ipc?.invoke('update-bill', id, updates)
    setBills(prev => prev.map(b => (b.id === id ? { ...b, ...updates } : b)))
  }, [])

  const deleteBill = useCallback(async (id: string) => {
    await ipc?.invoke('delete-bill', id)
    setBills(prev => prev.filter(b => b.id !== id))
  }, [])

  const payBill = useCallback(async (id: string, paidDate: string) => {
    await ipc?.invoke('pay-bill', id, paidDate)
    // Refresh to get updated due date / paid state
    await fetchBills()
  }, [fetchBills])

  useEffect(() => {
    fetchBills()
    const unsubscribe = ipc?.on('bills-updated', () => fetchBills())
    return () => unsubscribe?.()
  }, [fetchBills])

  return { bills, loading, error, addBill, updateBill, deleteBill, payBill, refetch: fetchBills }
}

// ============ GOALS HOOK ============

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true)
      if (!ipc) {
        setGoals(DEMO_GOALS)
      } else {
        const data: Goal[] = await ipc.invoke('get-goals')
        setGoals((data && data.length) ? data : DEMO_GOALS)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch goals')
    } finally {
      setLoading(false)
    }
  }, [])

  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await ipc?.invoke('add-goal', goal)
    setGoals(prev => [created, ...prev])
    return created as Goal
  }, [])

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    await ipc?.invoke('update-goal', id, updates)
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...updates } : g)))
  }, [])

  const deleteGoal = useCallback(async (id: string) => {
    await ipc?.invoke('delete-goal', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }, [])

  useEffect(() => {
    fetchGoals()
    const unsubscribe = ipc?.on('goals-updated', () => fetchGoals())
    return () => unsubscribe?.()
  }, [fetchGoals])

  return { goals, loading, error, addGoal, updateGoal, deleteGoal, refetch: fetchGoals }
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
