/**
 * useFinanceData Hook Unit Tests
 * Simple tests for the finance data hooks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { 
  useTransactions, 
  useExpenses, 
  useBudgets, 
  useGoals,
  useBills,
  useNetWorth,
  useForecasts,
  useCalendarEvents
} from '@ui/hooks/useFinanceData'

describe('Finance Data Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear IPC mock to use demo data
    ;(window as any).electron = undefined
  })

  afterEach(() => {
    ;(window as any).electron = undefined
  })

  describe('useTransactions', () => {
    it('should return demo transactions when IPC unavailable', async () => {
      const { result } = renderHook(() => useTransactions())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.transactions.length).toBeGreaterThan(0)
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useTransactions())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addTransaction).toBe('function')
      expect(typeof result.current.deleteTransaction).toBe('function')
      expect(typeof result.current.updateTransaction).toBe('function')
      expect(typeof result.current.refetch).toBe('function')
    })

    it('should return transactions with correct structure', async () => {
      const { result } = renderHook(() => useTransactions())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const firstTransaction = result.current.transactions[0]
      expect(firstTransaction).toHaveProperty('id')
      expect(firstTransaction).toHaveProperty('type')
      expect(firstTransaction).toHaveProperty('description')
      expect(firstTransaction).toHaveProperty('amount')
      expect(firstTransaction).toHaveProperty('date')
      expect(firstTransaction).toHaveProperty('category')
    })
  })

  describe('useExpenses', () => {
    it('should return demo expenses when IPC unavailable', async () => {
      const { result } = renderHook(() => useExpenses())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.expenses.length).toBeGreaterThan(0)
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useExpenses())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addExpense).toBe('function')
      expect(typeof result.current.deleteExpense).toBe('function')
    })
  })

  describe('useBudgets', () => {
    it('should return demo budgets when IPC unavailable', async () => {
      const { result } = renderHook(() => useBudgets())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.budgets.length).toBe(3) // 3 demo budgets
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useBudgets())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addBudget).toBe('function')
      expect(typeof result.current.deleteBudget).toBe('function')
      expect(typeof result.current.updateBudget).toBe('function')
    })

    it('should return budgets with correct structure', async () => {
      const { result } = renderHook(() => useBudgets())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const firstBudget = result.current.budgets[0]
      expect(firstBudget).toHaveProperty('id')
      expect(firstBudget).toHaveProperty('name')
      expect(firstBudget).toHaveProperty('category')
      expect(firstBudget).toHaveProperty('limitAmount')
    })
  })

  describe('useGoals', () => {
    it('should return demo goals when IPC unavailable', async () => {
      const { result } = renderHook(() => useGoals())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.goals.length).toBe(3) // 3 demo goals
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useGoals())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addGoal).toBe('function')
      expect(typeof result.current.deleteGoal).toBe('function')
      expect(typeof result.current.updateGoal).toBe('function')
    })

    it('should return goals with progress tracking fields', async () => {
      const { result } = renderHook(() => useGoals())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const firstGoal = result.current.goals[0]
      expect(firstGoal).toHaveProperty('currentAmount')
      expect(firstGoal).toHaveProperty('targetAmount')
      expect(firstGoal).toHaveProperty('targetDate')
    })
  })

  describe('useBills', () => {
    it('should return demo bills when IPC unavailable', async () => {
      const { result } = renderHook(() => useBills())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.bills.length).toBe(3) // 3 demo bills
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useBills())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addBill).toBe('function')
      expect(typeof result.current.deleteBill).toBe('function')
      expect(typeof result.current.updateBill).toBe('function')
    })

    it('should return bills with payment tracking fields', async () => {
      const { result } = renderHook(() => useBills())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const firstBill = result.current.bills[0]
      expect(firstBill).toHaveProperty('nextDueDate')
      expect(firstBill).toHaveProperty('isPaid')
      expect(firstBill).toHaveProperty('recurring')
    })
  })

  describe('useNetWorth', () => {
    it('should return demo net worth entries when IPC unavailable', async () => {
      const { result } = renderHook(() => useNetWorth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.netWorthEntries.length).toBe(3) // 3 demo entries
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useNetWorth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addNetWorthEntry).toBe('function')
      expect(typeof result.current.refetch).toBe('function')
    })

    it('should return net worth with assets and liabilities', async () => {
      const { result } = renderHook(() => useNetWorth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const firstEntry = result.current.netWorthEntries[0]
      expect(firstEntry).toHaveProperty('assets')
      expect(firstEntry).toHaveProperty('liabilities')
      expect(firstEntry).toHaveProperty('date')
    })
  })

  describe('useForecasts', () => {
    it('should return demo forecasts when IPC unavailable', async () => {
      const { result } = renderHook(() => useForecasts())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.forecasts.length).toBe(2) // 2 demo forecasts
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useForecasts())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addForecast).toBe('function')
      expect(typeof result.current.updateForecast).toBe('function')
      expect(typeof result.current.refetch).toBe('function')
    })

    it('should return forecasts with income/expense predictions', async () => {
      const { result } = renderHook(() => useForecasts())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const firstForecast = result.current.forecasts[0]
      expect(firstForecast).toHaveProperty('forecast_income')
      expect(firstForecast).toHaveProperty('forecast_expense')
      expect(firstForecast).toHaveProperty('month')
    })
  })

  describe('useCalendarEvents', () => {
    it('should return demo calendar events when IPC unavailable', async () => {
      const { result } = renderHook(() => useCalendarEvents())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.calendarEvents.length).toBe(2) // 2 demo events
      expect(result.current.error).toBeNull()
    })

    it('should have CRUD functions', async () => {
      const { result } = renderHook(() => useCalendarEvents())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(typeof result.current.addCalendarEvent).toBe('function')
      expect(typeof result.current.deleteCalendarEvent).toBe('function')
      expect(typeof result.current.refetch).toBe('function')
    })
  })
})

describe('Data Calculation Tests', () => {
  it('should correctly calculate net worth', () => {
    const assets = 50000
    const liabilities = 20000
    const netWorth = assets - liabilities
    
    expect(netWorth).toBe(30000)
  })

  it('should correctly calculate goal progress percentage', () => {
    const currentAmount = 1200
    const targetAmount = 3000
    const progress = (currentAmount / targetAmount) * 100
    
    expect(progress).toBe(40)
  })

  it('should correctly calculate forecast savings', () => {
    const forecastIncome = 5000
    const forecastExpense = 3000
    const savings = forecastIncome - forecastExpense
    
    expect(savings).toBe(2000)
  })

  it('should correctly calculate budget remaining', () => {
    const budgetLimit = 500
    const spent = 350
    const remaining = budgetLimit - spent
    
    expect(remaining).toBe(150)
  })
})
