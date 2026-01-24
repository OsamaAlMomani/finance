// Utility functions for aggregating financial data

export interface MonthlyData {
  month: string
  income_total: number
  expense_total: number
  net: number
}

export function getMonthKey(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('default', { month: 'short', year: 'numeric' })
}

export function aggregateTransactionsByMonth(transactions: any[]): MonthlyData[] {
  const monthMap = new Map<string, { income: number; expense: number }>()

  transactions.forEach(tx => {
    const monthKey = getMonthKey(tx.date)
    const current = monthMap.get(monthKey) || { income: 0, expense: 0 }

    if (tx.type === 'income') {
      current.income += tx.amount
    } else {
      current.expense += tx.amount
    }

    monthMap.set(monthKey, current)
  })

  // Sort by date
  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => {
    return new Date(a[0]).getTime() - new Date(b[0]).getTime()
  })

  return sortedMonths.map(([month, data]) => ({
    month,
    income_total: data.income,
    expense_total: -data.expense,
    net: data.income - data.expense
  }))
}

export function getCategoryBreakdown(expenses: any[]): { category: string; amount: number; percentage: number }[] {
  const categoryMap = new Map<string, number>()
  let total = 0

  expenses.forEach(expense => {
    const current = categoryMap.get(expense.category) || 0
    categoryMap.set(expense.category, current + expense.amount)
    total += expense.amount
  })

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / total) * 100
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function getIncomeDistribution(incomeSources: any[]): { source: string; amount: number; percentage: number }[] {
  const sourceMap = new Map<string, number>()
  let total = 0

  incomeSources.forEach(income => {
    const current = sourceMap.get(income.source) || 0
    sourceMap.set(income.source, current + income.amount)
    total += income.amount
  })

  return Array.from(sourceMap.entries())
    .map(([source, amount]) => ({
      source,
      amount,
      percentage: (amount / total) * 100
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calculateCumulativeSavings(transactions: any[]): any[] {
  const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  let cumulative = 0
  return sortedTx.map(tx => {
    const amount = tx.type === 'income' ? tx.amount : -tx.amount
    cumulative += amount
    return {
      date: getMonthKey(tx.date),
      cumulative,
      amount
    }
  })
}

export function calculateBurnRate(expenses: any[], timeframeDays: number = 30): { burnRate: number; runway: number } {
  const now = new Date()
  const cutoffDate = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000)

  const recentExpenses = expenses.filter(exp => new Date(exp.date) >= cutoffDate)
  const totalExpense = recentExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const dailyBurnRate = totalExpense / timeframeDays

  // Assume average savings (this would need to be calculated from net worth)
  const estimatedSavings = 10000 // This should come from user's actual savings
  const runway = estimatedSavings / dailyBurnRate

  return {
    burnRate: dailyBurnRate,
    runway: Math.max(0, runway)
  }
}
