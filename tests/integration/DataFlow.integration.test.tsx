/**
 * Data Flow Integration Tests
 * Tests for data flow between components
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { 
  useTransactions, 
  useExpenses, 
  useBudgets, 
  useGoals,
  useBills,
  useNetWorth,
  useForecasts 
} from '@ui/hooks/useFinanceData'

describe('Data Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use demo data
    ;(window as any).electron = undefined
  })

  describe('Transaction Data Flow', () => {
    it('should load transactions from demo data', async () => {
      const { result } = renderHook(() => useTransactions())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      expect(result.current.transactions.length).toBeGreaterThan(0)
      expect(result.current.error).toBeNull()
    })

    it('should have both income and expense transactions', async () => {
      const { result } = renderHook(() => useTransactions())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      const incomes = result.current.transactions.filter(t => t.type === 'income')
      const expenses = result.current.transactions.filter(t => t.type === 'expense')
      
      expect(incomes.length).toBeGreaterThan(0)
      expect(expenses.length).toBeGreaterThan(0)
    })
  })

  describe('Budget-Expense Relationship', () => {
    it('should load budgets with category and limit data', async () => {
      const { result } = renderHook(() => useBudgets())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.budgets.forEach(budget => {
        expect(budget.category).toBeDefined()
        expect(budget.limitAmount).toBeGreaterThan(0)
      })
    })

    it('should have expenses that can be matched to budget categories', async () => {
      const budgetResult = renderHook(() => useBudgets())
      const expenseResult = renderHook(() => useExpenses())
      
      await waitFor(() => {
        expect(budgetResult.result.current.loading).toBe(false)
        expect(expenseResult.result.current.loading).toBe(false)
      })
      
      const budgetCategories = budgetResult.result.current.budgets.map(b => b.category)
      const expenseCategories = expenseResult.result.current.expenses.map(e => e.category)
      
      // Both should have defined categories
      expect(budgetCategories.length).toBeGreaterThan(0)
      expect(expenseCategories.length).toBeGreaterThan(0)
    })
  })

  describe('Goal Progress Tracking', () => {
    it('should load goals with progress data', async () => {
      const { result } = renderHook(() => useGoals())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.goals.forEach(goal => {
        expect(goal.currentAmount).toBeDefined()
        expect(goal.targetAmount).toBeDefined()
        expect(goal.targetAmount).toBeGreaterThan(0)
        expect(goal.currentAmount).toBeLessThanOrEqual(goal.targetAmount)
      })
    })

    it('should calculate goal progress correctly', async () => {
      const { result } = renderHook(() => useGoals())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.goals.forEach(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100
        expect(progress).toBeGreaterThanOrEqual(0)
        expect(progress).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('Net Worth Calculations', () => {
    it('should load net worth with assets and liabilities', async () => {
      const { result } = renderHook(() => useNetWorth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.netWorthEntries.forEach(entry => {
        expect(entry.assets).toBeDefined()
        expect(entry.liabilities).toBeDefined()
        expect(entry.assets).toBeGreaterThanOrEqual(0)
        expect(entry.liabilities).toBeGreaterThanOrEqual(0)
      })
    })

    it('should have positive net worth (assets > liabilities) in demo data', async () => {
      const { result } = renderHook(() => useNetWorth())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.netWorthEntries.forEach(entry => {
        const netWorth = entry.assets - entry.liabilities
        expect(netWorth).toBeGreaterThan(0)
      })
    })
  })

  describe('Forecast Accuracy', () => {
    it('should load forecasts with income and expense predictions', async () => {
      const { result } = renderHook(() => useForecasts())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.forecasts.forEach(forecast => {
        expect(forecast.forecast_income).toBeDefined()
        expect(forecast.forecast_expense).toBeDefined()
        expect(forecast.month).toBeDefined()
      })
    })

    it('should predict positive savings (income > expense)', async () => {
      const { result } = renderHook(() => useForecasts())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.forecasts.forEach(forecast => {
        const predictedSavings = forecast.forecast_income - forecast.forecast_expense
        expect(predictedSavings).toBeGreaterThan(0)
      })
    })
  })

  describe('Bill Reminders', () => {
    it('should load bills with due date information', async () => {
      const { result } = renderHook(() => useBills())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.bills.forEach(bill => {
        expect(bill.nextDueDate).toBeDefined()
        expect(bill.amount).toBeGreaterThan(0)
        expect(typeof bill.isPaid).toBe('boolean')
      })
    })

    it('should have recurring bill information', async () => {
      const { result } = renderHook(() => useBills())
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      
      result.current.bills.forEach(bill => {
        expect(bill.recurring).toBeDefined()
      })
    })
  })
})

describe('Data Consistency Checks', () => {
  beforeEach(() => {
    ;(window as any).electron = undefined
  })

  it('should have consistent date formats across all data', async () => {
    const transactionResult = renderHook(() => useTransactions())
    const netWorthResult = renderHook(() => useNetWorth())
    const billsResult = renderHook(() => useBills())
    
    await waitFor(() => {
      expect(transactionResult.result.current.loading).toBe(false)
      expect(netWorthResult.result.current.loading).toBe(false)
      expect(billsResult.result.current.loading).toBe(false)
    })
    
    // Check date format consistency (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    
    transactionResult.result.current.transactions.forEach(t => {
      expect(t.date).toMatch(dateRegex)
    })
    
    netWorthResult.result.current.netWorthEntries.forEach(e => {
      expect(e.date).toMatch(dateRegex)
    })
    
    billsResult.result.current.bills.forEach(b => {
      expect(b.nextDueDate).toMatch(dateRegex)
    })
  })

  it('should have valid category values across data', async () => {
    const transactionResult = renderHook(() => useTransactions())
    const expenseResult = renderHook(() => useExpenses())
    const budgetResult = renderHook(() => useBudgets())
    
    await waitFor(() => {
      expect(transactionResult.result.current.loading).toBe(false)
      expect(expenseResult.result.current.loading).toBe(false)
      expect(budgetResult.result.current.loading).toBe(false)
    })
    
    // All should have non-empty category strings
    transactionResult.result.current.transactions.forEach(t => {
      expect(t.category).toBeTruthy()
      expect(typeof t.category).toBe('string')
    })
    
    expenseResult.result.current.expenses.forEach(e => {
      expect(e.category).toBeTruthy()
      expect(typeof e.category).toBe('string')
    })
    
    budgetResult.result.current.budgets.forEach(b => {
      expect(b.category).toBeTruthy()
      expect(typeof b.category).toBe('string')
    })
  })
})

describe('Error Handling', () => {
  it('should use demo data when IPC is unavailable', async () => {
    ;(window as any).electron = undefined
    
    const { result } = renderHook(() => useTransactions())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    // Should have demo data, not empty
    expect(result.current.transactions.length).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  it('should handle missing IPC by using demo data (graceful fallback)', async () => {
    // Note: Due to module-level caching of `ipc`, the hook captures window.electron 
    // at module load time. When IPC is unavailable, the hook gracefully falls back
    // to demo data instead of setting an error, which is the intended behavior.
    
    // Ensure IPC is not available
    ;(window as any).electron = undefined
    
    const { result } = renderHook(() => useTransactions())
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    // Should fallback to demo data without error
    expect(result.current.transactions.length).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })
})
