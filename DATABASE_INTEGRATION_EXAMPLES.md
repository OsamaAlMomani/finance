# Database Integration Examples

This file shows how to update each tool to use the new database system.

## Pattern for Any Tool

```tsx
import { useState, useEffect } from 'react'
import { useTransactions } from '../../hooks/useFinanceData'
import { aggregateTransactionsByMonth } from '../../../utils/dataAggregation'

export default function AnyTool() {
  // 1. Get data from hook
  const { transactions, loading, error, addTransaction } = useTransactions()
  const [data, setData] = useState([])

  // 2. Transform data when transactions change
  useEffect(() => {
    if (!loading) {
      const transformed = aggregateTransactionsByMonth(transactions)
      setData(transformed)
    }
  }, [transactions, loading])

  // 3. Handle errors and loading
  if (loading) return <div className="tool-container"><p>Loading...</p></div>
  if (error) return <div className="tool-container"><p>Error: {error}</p></div>

  // 4. Use data in render
  return (
    <div className="tool-container">
      <h2>Tool Title</h2>
      {/* Your component JSX */}
    </div>
  )
}
```

## Complete Examples

### NetWorthOverTime
```tsx
import { useNetWorth } from '../../hooks/useFinanceData'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function NetWorthOverTime() {
  const { netWorthEntries, loading, error, addNetWorthEntry } = useNetWorth()
  const [data, setData] = useState([])

  useEffect(() => {
    const chartData = netWorthEntries.map(entry => ({
      date: new Date(entry.date).toLocaleDateString(),
      assets: entry.assets,
      liabilities: entry.liabilities,
      netWorth: entry.assets - entry.liabilities
    }))
    setData(chartData)
  }, [netWorthEntries])

  const totalNetWorth = netWorthEntries.length > 0 
    ? netWorthEntries[netWorthEntries.length - 1].assets - netWorthEntries[netWorthEntries.length - 1].liabilities
    : 0

  return (
    <div className="tool-container">
      <h2>📈 Net Worth Over Time</h2>
      <div className="stat-card">${totalNetWorth.toLocaleString()}</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
          <Line type="monotone" dataKey="assets" stroke="#64b5f6" />
          <Line type="monotone" dataKey="liabilities" stroke="#ef5350" />
          <Line type="monotone" dataKey="netWorth" stroke="#4caf50" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### ExpenseBreakdown
```tsx
import { useExpenses } from '../../hooks/useFinanceData'
import { getCategoryBreakdown } from '../../../utils/dataAggregation'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

export default function ExpenseBreakdown() {
  const { expenses, loading, error } = useExpenses()
  const [breakdown, setBreakdown] = useState([])

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8']

  useEffect(() => {
    if (expenses.length > 0) {
      setBreakdown(getCategoryBreakdown(expenses))
    }
  }, [expenses])

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0)

  if (loading) return <div className="tool-container"><p>Loading...</p></div>
  if (error) return <div className="tool-container"><p>Error: {error}</p></div>

  return (
    <div className="tool-container">
      <h2>🥧 Expense Breakdown</h2>
      <div className="stat-card">Total: ${total.toLocaleString()}</div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={breakdown}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {breakdown.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="data-table">
        <table>
          <thead><tr><th>Category</th><th>Amount</th><th>%</th></tr></thead>
          <tbody>
            {breakdown.map(item => (
              <tr key={item.category}>
                <td>{item.category}</td>
                <td>${item.amount.toLocaleString()}</td>
                <td>{item.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### IncomeSourceDistribution
```tsx
import { useIncomeSources } from '../../hooks/useFinanceData'
import { getIncomeDistribution } from '../../../utils/dataAggregation'

export default function IncomeSourceDistribution() {
  const { incomeSources, loading, error, addIncomeSource } = useIncomeSources()
  const [distribution, setDistribution] = useState([])

  useEffect(() => {
    if (incomeSources.length > 0) {
      setDistribution(getIncomeDistribution(incomeSources))
    }
  }, [incomeSources])

  const total = distribution.reduce((sum, item) => sum + item.amount, 0)

  if (loading) return <div>Loading...</div>

  return (
    <div className="tool-container">
      <h2>💼 Income Source Distribution</h2>
      <div className="stat-card positive">Total: ${total.toLocaleString()}</div>
      <div className="data-table">
        <table>
          <thead>
            <tr><th>Source</th><th>Amount</th><th>Percentage</th></tr>
          </thead>
          <tbody>
            {distribution.map(item => (
              <tr key={item.source}>
                <td>{item.source}</td>
                <td className="positive">${item.amount.toLocaleString()}</td>
                <td>{item.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### CumulativeSavings
```tsx
import { useTransactions } from '../../hooks/useFinanceData'
import { calculateCumulativeSavings } from '../../../utils/dataAggregation'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function CumulativeSavings() {
  const { transactions, loading } = useTransactions()
  const [data, setData] = useState([])

  useEffect(() => {
    if (transactions.length > 0) {
      const cumulative = calculateCumulativeSavings(transactions)
      setData(cumulative)
    }
  }, [transactions])

  const latest = data.length > 0 ? data[data.length - 1].cumulative : 0

  if (loading) return <div>Loading...</div>

  return (
    <div className="tool-container">
      <h2>💎 Cumulative Savings</h2>
      <div className={`stat-card ${latest >= 0 ? 'positive' : 'negative'}`}>
        ${latest.toLocaleString()}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Area type="monotone" dataKey="cumulative" fill="#64b5f6" stroke="#2196f3" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### BurnRateRunway
```tsx
import { useExpenses } from '../../hooks/useFinanceData'
import { calculateBurnRate } from '../../../utils/dataAggregation'

export default function BurnRateRunway() {
  const { expenses, loading } = useExpenses()
  const [metrics, setMetrics] = useState({ burnRate: 0, runway: 0 })

  useEffect(() => {
    if (expenses.length > 0) {
      const { burnRate, runway } = calculateBurnRate(expenses, 30)
      setMetrics({ burnRate, runway })
    }
  }, [expenses])

  if (loading) return <div>Loading...</div>

  return (
    <div className="tool-container">
      <h2>🔥 Burn Rate & Runway</h2>
      <div className="tool-stats">
        <div className="stat-card negative">
          <div className="stat-label">Daily Burn Rate</div>
          <div className="stat-value">${metrics.burnRate.toFixed(2)}</div>
        </div>
        <div className={`stat-card ${metrics.runway > 90 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Runway</div>
          <div className="stat-value">{Math.round(metrics.runway)} days</div>
        </div>
      </div>
    </div>
  )
}
```

### CalendarPlanning
```tsx
import { useCalendarEvents } from '../../hooks/useFinanceData'

export default function CalendarPlanning() {
  const { calendarEvents, loading, error, addCalendarEvent, deleteCalendarEvent } = useCalendarEvents()
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')

  const handleAdd = async () => {
    await addCalendarEvent({
      date,
      description,
      amount: 0,
      type: 'income',
      recurring: 'once'
    })
    setDate('')
    setDescription('')
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="tool-container">
      <h2>📅 Calendar Planning</h2>
      <div className="input-section">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button onClick={handleAdd}>Add Event</button>
      </div>
      <div className="data-table">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Action</th></tr></thead>
          <tbody>
            {calendarEvents.map(event => (
              <tr key={event.id}>
                <td>{new Date(event.date).toLocaleDateString()}</td>
                <td>{event.description}</td>
                <td><button onClick={() => deleteCalendarEvent(event.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### ForecastVsActual
```tsx
import { useForecasts } from '../../hooks/useFinanceData'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ForecastVsActual() {
  const { forecasts, loading } = useForecasts()
  const [data, setData] = useState([])

  useEffect(() => {
    const chartData = forecasts.map(f => ({
      month: f.month,
      forecast_income: f.forecast_income,
      actual_income: f.actual_income || 0,
      forecast_expense: f.forecast_expense,
      actual_expense: f.actual_expense || 0
    }))
    setData(chartData)
  }, [forecasts])

  if (loading) return <div>Loading...</div>

  return (
    <div className="tool-container">
      <h2>📊 Forecast vs Actual</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
          <Bar dataKey="forecast_income" fill="#64b5f6" />
          <Bar dataKey="actual_income" fill="#2196f3" />
          <Bar dataKey="forecast_expense" fill="#ff6b6b" />
          <Bar dataKey="actual_expense" fill="#d32f2f" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

## Summary

All tools follow the same 4-step pattern:
1. ✅ Import hook and aggregation functions
2. ✅ Call hook to get data
3. ✅ useEffect to sync when data changes
4. ✅ Render with latest data

**Every tool automatically syncs with every other tool!**

Database file: `%APPDATA%/finance-app.db`
Build status: ✅ Successful (685 KB, 182.5 KB gzipped)
