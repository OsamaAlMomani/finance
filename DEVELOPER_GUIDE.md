# Developer Guide - Extending Finance Tools

This guide shows how to add features to existing tools or create new ones.

## Adding Data Persistence (localStorage)

### Example: Persist Cash Flow Data

```typescript
// In CashFlowTimeline.tsx

import { useState, useEffect } from 'react'

export default function CashFlowTimeline() {
  const [data, setData] = useState<CashFlowData[]>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('cashflow-data')
    return saved ? JSON.parse(saved) : DEFAULT_DATA
  })

  // Save whenever data changes
  useEffect(() => {
    localStorage.setItem('cashflow-data', JSON.stringify(data))
  }, [data])

  // Rest of component...
}
```

### Create Helper Functions

```typescript
// src/ui/utils/storage.ts

export const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Storage error:', error)
    return false
  }
}

export const loadFromStorage = (key: string, defaultValue?: any) => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error('Storage error:', error)
    return defaultValue
  }
}

export const clearStorage = (key: string) => {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error('Storage error:', error)
    return false
  }
}
```

## Adding Export Functionality

### Export to CSV

```typescript
// src/ui/utils/export.ts

export const exportToCSV = (
  data: any[],
  headers: string[],
  filename: string
) => {
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header]
        // Escape quotes and wrap in quotes if needed
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value
      }).join(',')
    )
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  window.URL.revokeObjectURL(url)
}

// Usage in component
const handleExport = () => {
  exportToCSV(
    data,
    ['month', 'income_total', 'expense_total', 'net'],
    'cash-flow-report'
  )
}
```

### Export to PDF

```typescript
// Install: npm install jspdf

import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export const exportToPDF = (
  title: string,
  columns: string[],
  data: any[],
  filename: string
) => {
  const pdf = new jsPDF()
  
  pdf.text(title, 14, 10)
  
  pdf.autoTable({
    head: [columns],
    body: data.map(row => columns.map(col => row[col])),
    startY: 20,
  })

  pdf.save(`${filename}.pdf`)
}
```

## Adding New Calculations

### Example: Add Tax Impact to Forecast Tool

```typescript
interface ForecastData {
  month: string
  forecast_income: number
  forecast_expense: number
  actual_income?: number
  actual_expense?: number
  tax_rate?: number  // Add this
}

// Calculate after-tax income
const calculateAfterTaxIncome = (income: number, taxRate: number) => {
  return income * (1 - taxRate / 100)
}

// Add to component
const [taxRate, setTaxRate] = useState(15) // Default 15%

const afterTaxForecast = data.map(d => ({
  ...d,
  forecast_income_after_tax: calculateAfterTaxIncome(d.forecast_income, taxRate),
  actual_income_after_tax: d.actual_income 
    ? calculateAfterTaxIncome(d.actual_income, taxRate)
    : undefined
}))
```

## Adding Recurring Transactions

### Example: Auto-add Monthly Recurring Expenses

```typescript
// src/ui/utils/recurring.ts

interface RecurringTransaction {
  id: string
  name: string
  amount: number
  frequency: 'monthly' | 'yearly'
  startDate: string
  endDate?: string
}

export const getRecurringTransactions = (
  recurring: RecurringTransaction[],
  month: string
): RecurringTransaction[] => {
  return recurring.filter(txn => {
    const start = new Date(txn.startDate)
    const end = txn.endDate ? new Date(txn.endDate) : null
    const current = new Date(month)

    if (current < start) return false
    if (end && current > end) return false

    if (txn.frequency === 'monthly') return true
    if (txn.frequency === 'yearly') {
      return start.getMonth() === current.getMonth()
    }

    return false
  })
}

// Usage
const [recurring, setRecurring] = useState<RecurringTransaction[]>([])

// Add to expenses on month view
const handleMonthSelect = (month: string) => {
  const recurringItems = getRecurringTransactions(recurring, month)
  recurringItems.forEach(item => {
    addExpense({
      category: item.name,
      amount: item.amount,
      date: month,
      isRecurring: true
    })
  })
}
```

## Adding Real API Integration

### Example: Fetch Real Inflation Data

```typescript
// src/ui/utils/api.ts

export const fetchInflationData = async (category: string) => {
  try {
    // Example using World Bank API
    const response = await fetch(
      `https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL?format=json`
    )
    const data = await response.json()
    return data[1] // Return actual data
  } catch (error) {
    console.error('Failed to fetch inflation data:', error)
    return null
  }
}

// Usage in CostOfLiving.tsx
useEffect(() => {
  const loadInflation = async () => {
    const data = await fetchInflationData('US')
    if (data) {
      setInflationData(data)
    }
  }
  loadInflation()
}, [])
```

### Example: Fetch Stock Prices

```typescript
// Install: npm install axios

import axios from 'axios'

export const fetchStockPrice = async (symbol: string) => {
  try {
    // Example using Alpha Vantage (get free API key)
    const response = await axios.get(
      `https://www.alphavantage.co/query`,
      {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: process.env.REACT_APP_ALPHA_VANTAGE_KEY
        }
      }
    )
    return response.data['Global Quote']
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error)
    return null
  }
}
```

## Creating a New Tool

### Step 1: Create Component

```typescript
// src/ui/components/tools/InvestmentTracker.tsx

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Investment {
  id: string
  symbol: string
  shares: number
  buyPrice: number
  currentPrice: number
  date: string
}

export default function InvestmentTracker() {
  const [investments, setInvestments] = useState<Investment[]>([
    {
      id: '1',
      symbol: 'AAPL',
      shares: 10,
      buyPrice: 150,
      currentPrice: 170,
      date: '2024-01-15'
    }
  ])

  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')

  const addInvestment = () => {
    if (!symbol || !shares || !buyPrice || !currentPrice) return

    const investment: Investment = {
      id: Date.now().toString(),
      symbol,
      shares: parseFloat(shares),
      buyPrice: parseFloat(buyPrice),
      currentPrice: parseFloat(currentPrice),
      date: new Date().toISOString().split('T')[0]
    }

    setInvestments([...investments, investment])
    setSymbol('')
    setShares('')
    setBuyPrice('')
    setCurrentPrice('')
  }

  // Calculate metrics
  const totalInvested = investments.reduce(
    (sum, inv) => sum + (inv.shares * inv.buyPrice),
    0
  )

  const totalValue = investments.reduce(
    (sum, inv) => sum + (inv.shares * inv.currentPrice),
    0
  )

  const totalGain = totalValue - totalInvested
  const gainPercent = ((totalGain / totalInvested) * 100).toFixed(2)

  const chartData = investments.map(inv => ({
    symbol: inv.symbol,
    value: inv.shares * inv.currentPrice,
    gain: inv.shares * (inv.currentPrice - inv.buyPrice)
  }))

  return (
    <div className="tool-container">
      <h2>📈 Investment Tracker</h2>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Total Invested</div>
          <div className="stat-value">${totalInvested.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Value</div>
          <div className="stat-value">${totalValue.toLocaleString()}</div>
        </div>
        <div className={`stat-card ${totalGain >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Total Gain/Loss</div>
          <div className="stat-value">
            {totalGain >= 0 ? '+' : ''} ${totalGain.toLocaleString()}
            <span className="percent">({gainPercent}%)</span>
          </div>
        </div>
      </div>

      <div className="input-section">
        <h3>Add Investment</h3>
        <div className="form-group">
          <input
            type="text"
            placeholder="Symbol (e.g., AAPL)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
          <input
            type="number"
            placeholder="Shares"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
          <input
            type="number"
            placeholder="Buy Price"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
          />
          <input
            type="number"
            placeholder="Current Price"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
          />
          <button onClick={addInvestment}>Add Investment</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Portfolio</h3>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Shares</th>
              <th>Buy Price</th>
              <th>Current Price</th>
              <th>Value</th>
              <th>Gain/Loss</th>
              <th>Return %</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => {
              const value = inv.shares * inv.currentPrice
              const invested = inv.shares * inv.buyPrice
              const gain = value - invested
              const returnPercent = ((gain / invested) * 100).toFixed(2)

              return (
                <tr key={inv.id}>
                  <td>{inv.symbol}</td>
                  <td>{inv.shares}</td>
                  <td>${inv.buyPrice.toFixed(2)}</td>
                  <td>${inv.currentPrice.toFixed(2)}</td>
                  <td>${value.toLocaleString()}</td>
                  <td className={gain >= 0 ? 'positive' : 'negative'}>
                    {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                  </td>
                  <td className={Number(returnPercent) >= 0 ? 'positive' : 'negative'}>
                    {Number(returnPercent) >= 0 ? '+' : ''}{returnPercent}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### Step 2: Add to Dashboard

```typescript
// In Dashboard.tsx

import InvestmentTracker from './tools/InvestmentTracker'

// Add to tools array
{
  id: 'investment-tracker',
  title: 'Investment Tracker',
  description: 'Track your investments',
  icon: '📊',
  color: '#FF6B6B',
  component: InvestmentTracker
}
```

## Best Practices

### 1. Keep Components Pure
```typescript
// ✅ Good
const calculateTotal = (items) => items.reduce((sum, item) => sum + item.amount, 0)

// ❌ Avoid
let total = 0
items.forEach(item => { total += item.amount })
```

### 2. Type Safety
```typescript
// ✅ Good
interface Transaction {
  id: string
  amount: number
  date: string
  category: string
}

// ❌ Avoid
const transaction = { id: '1', amount: 100, date: '2024-01', cat: 'Food' }
```

### 3. Error Handling
```typescript
// ✅ Good
try {
  const data = await fetchData()
  setData(data)
} catch (error) {
  console.error('Failed to fetch:', error)
  setError('Failed to load data')
}

// ❌ Avoid
const data = await fetchData()
setData(data)
```

### 4. Memoization for Performance
```typescript
// ✅ Good
import { useMemo } from 'react'

const total = useMemo(() => {
  return data.reduce((sum, item) => sum + item.amount, 0)
}, [data])

// ❌ Avoid (recalculates every render)
const total = data.reduce((sum, item) => sum + item.amount, 0)
```

## Testing Example

```typescript
// src/ui/components/tools/__tests__/CashFlowTimeline.test.tsx

import { render, screen, fireEvent } from '@testing-library/react'
import CashFlowTimeline from '../CashFlowTimeline'

describe('CashFlowTimeline', () => {
  it('calculates net correctly', () => {
    render(<CashFlowTimeline />)
    
    const incomeInput = screen.getByPlaceholderText('Income')
    const expenseInput = screen.getByPlaceholderText('Expenses')
    const addButton = screen.getByText('Add Entry')

    fireEvent.change(incomeInput, { target: { value: '5000' } })
    fireEvent.change(expenseInput, { target: { value: '3000' } })
    fireEvent.click(addButton)

    expect(screen.getByText('$2000')).toBeInTheDocument()
  })
})
```

## Conclusion

You now have a solid foundation to:
- Add data persistence
- Export data
- Integrate real APIs
- Create new tools
- Add advanced features

Start small, test thoroughly, and expand gradually!

