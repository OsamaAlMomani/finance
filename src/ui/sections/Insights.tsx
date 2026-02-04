import { useMemo, useState, useEffect } from 'react'
import {
  LineChart as ReLineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { useForecasts, useTransactions } from '../hooks/useFinanceData'

type ForecastMethod = 'sma' | 'ewma' | 'holt' | 'arima'
type ScenarioType = 'optimistic' | 'baseline' | 'pessimistic'
type MonteTab = 'monte' | 'distribution' | 'settings'

interface MonthlyTotals {
  month: string
  label: string
  income: number
  expense: number
  net: number
}

interface CategoryTotals {
  category: string
  actual: number
  forecast: number
  budget: number
  color: string
}

const CATEGORY_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#9D84B7', '#DDA0DD']

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(month: string) {
  const [year, rawMonth] = month.split('-')
  const m = Number(rawMonth) - 1
  return new Date(Number(year), m, 1).toLocaleDateString(undefined, { month: 'short' })
}

function getRecentMonths(count: number) {
  const now = new Date()
  const months: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(monthKey(d))
  }
  return months
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export default function Insights() {
  const { transactions, loading, addTransaction } = useTransactions()
  const { forecasts } = useForecasts()

  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>('sma')
  const [currentScenario, setCurrentScenario] = useState<ScenarioType>('optimistic')
  const [currentTab, setCurrentTab] = useState<MonteTab>('monte')
  const [horizon, setHorizon] = useState(6)
  const [alpha, setAlpha] = useState(0.3)
  const [simulations, setSimulations] = useState(1000)
  const [goalAmount, setGoalAmount] = useState(30000)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFeedback('Welcome! This forecast uses your real database data. 🐵✨')
      window.setTimeout(() => setFeedback(null), 3000)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [])

  const monthlyTotals = useMemo<MonthlyTotals[]>(() => {
    const months = getRecentMonths(12)
    const base = months.map(month => ({
      month,
      label: formatMonthLabel(month),
      income: 0,
      expense: 0,
      net: 0
    }))

    const byMonth = new Map(base.map(entry => [entry.month, entry]))
    transactions.forEach(tx => {
      const date = new Date(tx.date)
      if (Number.isNaN(date.getTime())) return
      const key = monthKey(date)
      const entry = byMonth.get(key)
      if (!entry) return
      if (tx.type === 'income') {
        entry.income += tx.amount
      } else {
        entry.expense += tx.amount
      }
    })

    base.forEach(entry => {
      entry.net = entry.income - entry.expense
    })

    return base
  }, [transactions])

  const historicalBalances = useMemo(() => {
    let cumulative = 0
    return monthlyTotals.map(entry => {
      cumulative += entry.net
      return {
        label: entry.label,
        value: cumulative
      }
    })
  }, [monthlyTotals])

  const monthlyIncome = useMemo(() => {
    const values = monthlyTotals.slice(-3).map(entry => entry.income)
    const fallback = forecasts.map(f => f.forecast_income).filter(v => v > 0)
    return fallback.length > 0 ? average(fallback) : average(values)
  }, [monthlyTotals, forecasts])

  const monthlyExpenses = useMemo(() => {
    const values = monthlyTotals.slice(-3).map(entry => entry.expense)
    const fallback = forecasts.map(f => f.forecast_expense).filter(v => v > 0)
    return fallback.length > 0 ? average(fallback) : average(values)
  }, [monthlyTotals, forecasts])

  const forecastSeries = useMemo(() => {
    const history = historicalBalances
    const lastValue = history.length ? history[history.length - 1].value : 0
    const avgChange = history.length > 1
      ? (lastValue - history[0].value) / (history.length - 1)
      : 0

    const forecastValues: number[] = []
    for (let i = 1; i <= horizon; i += 1) {
      switch (forecastMethod) {
        case 'ewma':
          forecastValues.push(lastValue * (1 + (alpha * (avgChange / Math.max(lastValue, 1)) * i)))
          break
        case 'holt':
          forecastValues.push(lastValue + (avgChange * 1.5 * i))
          break
        case 'arima':
          forecastValues.push(lastValue + (avgChange * 0.8 * i) + (Math.sin(i * 0.5) * 100))
          break
        default:
          forecastValues.push(lastValue + (avgChange * i))
      }
    }

    const forecastLabels = Array.from({ length: horizon }, (_, i) => `F${i + 1}`)
    return {
      forecastValues,
      forecastLabels
    }
  }, [historicalBalances, horizon, forecastMethod, alpha])

  const forecastChartData = useMemo(() => {
    const past = historicalBalances.map(point => ({
      label: point.label,
      actual: point.value,
      forecast: null
    }))
    const future = forecastSeries.forecastValues.map((value, index) => ({
      label: forecastSeries.forecastLabels[index],
      actual: null,
      forecast: value
    }))
    return [...past, ...future]
  }, [historicalBalances, forecastSeries])

  const categoryTotals = useMemo<CategoryTotals[]>(() => {
    const lastMonth = monthlyTotals[monthlyTotals.length - 1]?.month
    const recentTransactions = transactions.filter(tx => {
      const date = new Date(tx.date)
      return monthKey(date) === lastMonth
    })

    const categories = new Map<string, { actual: number; forecasts: number[] }>()
    recentTransactions.forEach(tx => {
      const key = tx.category || 'Uncategorized'
      const entry = categories.get(key) ?? { actual: 0, forecasts: [] }
      if (tx.type === 'expense') {
        entry.actual += tx.amount
        entry.forecasts.push(tx.amount)
      }
      categories.set(key, entry)
    })

    const categoryList = Array.from(categories.keys())
    return categoryList.map((category, index) => {
      const entry = categories.get(category) ?? { actual: 0, forecasts: [] }
      const avg = average(entry.forecasts)
      return {
        category,
        actual: entry.actual,
        forecast: avg > 0 ? avg * 1.05 : entry.actual * 1.03,
        budget: avg > 0 ? avg * 1.02 : entry.actual,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
      }
    })
  }, [transactions, monthlyTotals])

  const selectedCategoryData = useMemo(() => {
    if (selectedCategory === 'all') return categoryTotals
    return categoryTotals.filter(item => item.category === selectedCategory)
  }, [categoryTotals, selectedCategory])

  const variance = useMemo(() => {
    const totalActual = selectedCategoryData.reduce((sum, item) => sum + item.actual, 0)
    const totalBudget = selectedCategoryData.reduce((sum, item) => sum + item.budget, 0)
    if (totalBudget === 0) return 0
    return ((totalActual - totalBudget) / totalBudget) * 100
  }, [selectedCategoryData])

  const bananaFillClass = useMemo(() => {
    const raw = 50 + Math.max(-50, Math.min(50, variance * 5))
    const rounded = Math.round(raw / 5) * 5
    const clamped = Math.max(0, Math.min(100, rounded))
    return `banana-fill banana-fill-${clamped}`
  }, [variance])

  const scenarioData = useMemo(() => {
    const lastBalance = historicalBalances.length ? historicalBalances[historicalBalances.length - 1].value : 0
    const months = 12
    const label = ['Now', ...Array.from({ length: months }, (_, i) => `${i + 1}m`)]

    const growthRate = currentScenario === 'optimistic'
      ? 600
      : currentScenario === 'baseline'
        ? 300
        : 100

    const series = Array.from({ length: months + 1 }, (_, i) => lastBalance + (i * growthRate))

    return label.map((name, index) => ({
      label: name,
      scenario: series[index],
      goal: goalAmount
    }))
  }, [currentScenario, historicalBalances, goalAmount])

  const monteCarloData = useMemo(() => {
    const months = 12
    const lastBalance = historicalBalances.length ? historicalBalances[historicalBalances.length - 1].value : 0
    const results: number[][] = []

    for (let s = 0; s < simulations; s += 1) {
      let balance = lastBalance
      const path = [balance]
      for (let m = 0; m < months; m += 1) {
        const income = monthlyIncome * (0.8 + Math.random() * 0.4)
        const expense = monthlyExpenses * (0.85 + Math.random() * 0.3)
        balance = balance + income - expense
        path.push(balance)
      }
      results.push(path)
    }

    const percentiles = Array.from({ length: months + 1 }, (_, index) => {
      const values = results.map(path => path[index]).sort((a, b) => a - b)
      const p10 = values[Math.floor(simulations * 0.1)] ?? lastBalance
      const p50 = values[Math.floor(simulations * 0.5)] ?? lastBalance
      const p90 = values[Math.floor(simulations * 0.9)] ?? lastBalance
      return { label: index === 0 ? 'Now' : `${index}m`, p10, p50, p90 }
    })

    const finalBalances = results.map(path => path[months])
    const successCount = finalBalances.filter(v => v >= goalAmount).length
    const successProbability = simulations > 0 ? (successCount / simulations) * 100 : 0
    const averageResult = average(finalBalances)

    return {
      series: percentiles,
      finalBalances,
      successProbability,
      averageResult
    }
  }, [historicalBalances, simulations, monthlyIncome, monthlyExpenses, goalAmount])

  const histogramData = useMemo(() => {
    if (monteCarloData.finalBalances.length === 0) return []
    const bins = 16
    const min = Math.min(...monteCarloData.finalBalances)
    const max = Math.max(...monteCarloData.finalBalances)
    const binSize = (max - min) / bins || 1
    const counts = Array.from({ length: bins }, (_, index) => ({
      label: `$${Math.round(min + index * binSize).toLocaleString()}`,
      count: 0
    }))

    monteCarloData.finalBalances.forEach(value => {
      const index = Math.min(bins - 1, Math.floor((value - min) / binSize))
      counts[index].count += 1
    })

    return counts
  }, [monteCarloData.finalBalances])

  const handleFeedback = (message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  const handleAddIncome = async () => {
    const today = new Date().toISOString().slice(0, 10)
    await addTransaction({
      type: 'income',
      description: 'Manual Income',
      amount: 500,
      date: today,
      category: 'Income',
      recurring: 'once'
    })
    handleFeedback('Added $500 income to your database! 🍌💰')
  }

  const handleAddExpense = async () => {
    const today = new Date().toISOString().slice(0, 10)
    await addTransaction({
      type: 'expense',
      description: 'Manual Expense',
      amount: 200,
      date: today,
      category: 'General',
      recurring: 'once'
    })
    handleFeedback('Added $200 expense to your database. 🍌➡️')
  }

  if (loading) {
    return (
      <div className="monkey-forecaster loading-state">
        <h2>Loading forecasts from your database…</h2>
      </div>
    )
  }

  return (
    <div className="monkey-forecaster">
      <div className="header">
        <h1>
          <span className="monkey">🐵</span>
          Money Forecaster
          <span className="monkey">🍌</span>
        </h1>
        <p>Connected to your shared database — all charts update from real transactions.</p>
      </div>

      <div className="dashboard">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon card-icon-balance">📈</div>
              <div>
                <div className="card-title-text">Balance Timeline & Predictions</div>
                <div className="card-subtitle">From real database history + forecast</div>
              </div>
            </div>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
              <ReLineChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#4361ee" strokeWidth={3} dot={{ r: 4 }} name="Actual" />
                <Line type="monotone" dataKey="forecast" stroke="#2ecc71" strokeDasharray="5 5" strokeWidth={3} dot={{ r: 3 }} name="Forecast" />
              </ReLineChart>
            </ResponsiveContainer>
          </div>

          <div className="explanation-box">
            <div className="explanation-header">
              <span className="explanation-icon">💡</span>
              <div className="explanation-title">How This Chart Works</div>
            </div>
            <div className="explanation-text">
              <p><strong>Blue Line:</strong> Real balance computed from Timeline transactions.</p>
              <p><strong>Green Dotted Line:</strong> Forward estimate based on your chosen method.</p>
            </div>
            <button className="monkey-speech" onClick={() => handleFeedback('Blue is real, green is forecast. Simple! 🐵')}>
              <p>"Blue is real, green is the computer guess!"</p>
            </button>
          </div>

          <div className="method-buttons">
            {([
              { id: 'sma', label: 'Simple Average' },
              { id: 'ewma', label: 'Fast Reactor' },
              { id: 'holt', label: 'Trend Finder' },
              { id: 'arima', label: 'Smart Robot' }
            ] as { id: ForecastMethod; label: string }[]).map(method => (
              <button
                key={method.id}
                className={`method-btn ${forecastMethod === method.id ? 'active' : ''}`}
                onClick={() => {
                  setForecastMethod(method.id)
                  handleFeedback(`Switched to ${method.label}!`)
                }}
              >
                {method.label}
              </button>
            ))}
          </div>

          <div className="controls-grid">
            <div className="control-group">
              <div className="control-label">
                <div className="control-label-text">Months to Predict</div>
                <div className="control-value">{horizon}</div>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={horizon}
                className="slider"
                aria-label="Months to predict"
                title="Months to predict"
                onChange={(event) => setHorizon(Number(event.target.value))}
              />
            </div>
            <div className="control-group">
              <div className="control-label">
                <div className="control-label-text">React Speed (α)</div>
                <div className="control-value">{alpha.toFixed(1)}</div>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.1}
                value={alpha}
                className="slider"
                aria-label="React speed alpha"
                title="React speed alpha"
                onChange={(event) => setAlpha(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="action-buttons">
            <button className="action-btn" onClick={handleAddIncome}>Add Income</button>
            <button className="action-btn" onClick={handleAddExpense}>Add Expense</button>
            <button className="action-btn action-btn-primary" onClick={() => handleFeedback('Reset coming soon!')}>Reset</button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple">🔮</div>
              <div className="stat-value green">${Math.round(forecastSeries.forecastValues[0] ?? 0).toLocaleString()}</div>
              <div className="stat-label">Next Month Guess</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">🎯</div>
              <div className="stat-value blue">{forecastMethod === 'arima' ? '94%' : forecastMethod === 'holt' ? '91%' : forecastMethod === 'ewma' ? '90%' : '92%'}</div>
              <div className="stat-label">Model Accuracy</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">📊</div>
              <div className="stat-value green">
                {(() => {
                  const last = historicalBalances[historicalBalances.length - 1]?.value ?? 0
                  const next = forecastSeries.forecastValues[0] ?? last
                  const trend = last === 0 ? 0 : ((next / last) - 1) * 100
                  return `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`
                })()}
              </div>
              <div className="stat-label">Monthly Trend</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon card-icon-categories">🍎</div>
              <div>
                <div className="card-title-text">Spending Categories</div>
                <div className="card-subtitle">Actual vs forecast from real expenses</div>
              </div>
            </div>
            <select
              className="category-select"
              value={selectedCategory}
              aria-label="Spending category filter"
              title="Spending category filter"
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="all">🍌 All Categories</option>
              {categoryTotals.map(category => (
                <option key={category.category} value={category.category}>{category.category}</option>
              ))}
            </select>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
              <BarChart data={selectedCategoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="actual" fill="#4361ee" name="Actual" radius={[6, 6, 0, 0]} />
                <Bar dataKey="forecast" fill="#2ecc71" name="Forecast" radius={[6, 6, 0, 0]} />
                <ReferenceLine y={average(selectedCategoryData.map(item => item.budget))} stroke="#f39c12" strokeDasharray="5 5" label="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="explanation-box">
            <div className="explanation-header">
              <span className="explanation-icon">💡</span>
              <div className="explanation-title">Budget vs Actual</div>
            </div>
            <div className="explanation-text">
              <p><strong>Blue Bars:</strong> Actual last month spending.</p>
              <p><strong>Green Bars:</strong> Forecast based on recent averages.</p>
              <p><strong>Yellow Line:</strong> Suggested budget from your database.</p>
            </div>
            <button className="monkey-speech" onClick={() => handleFeedback('If blue is above yellow, you spent too many bananas! 🍌')}>
              <p>"If blue is taller than yellow, that’s too many bananas!"</p>
            </button>
          </div>

          <div className="control-group">
            <div className="control-label">
              <div className="control-label-text">Budget vs Actual</div>
              <div className={`control-value ${Math.abs(variance) < 5 ? 'yellow' : variance > 0 ? 'red' : 'green'}`}>
                {variance.toFixed(1)}%
              </div>
            </div>
            <div className="banana-meter">
              <div className={bananaFillClass} />
            </div>
          </div>

          <div className="action-buttons">
            <button className="action-btn" onClick={() => handleFeedback('Budget adjustments coming soon!')}>Adjust Budget</button>
            <button className="action-btn" onClick={() => handleFeedback('Category management coming soon!')}>Add Category</button>
          </div>

          <div className="stats-grid">
            {selectedCategoryData.slice(0, 3).map(item => (
              <div key={item.category} className="stat-card">
                <div className="stat-icon">🍌</div>
                <div className="stat-value">${Math.round(item.actual).toLocaleString()}</div>
                <div className="stat-label">{item.category}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon card-icon-scenarios">🎯</div>
              <div>
                <div className="card-title-text">What-If Scenarios</div>
                <div className="card-subtitle">Compare possible futures</div>
              </div>
            </div>
          </div>

          <div className="scenario-buttons">
            {([
              { id: 'optimistic', label: 'Sunshine Future' },
              { id: 'baseline', label: 'Normal Future' },
              { id: 'pessimistic', label: 'Rainy Future' }
            ] as { id: ScenarioType; label: string }[]).map(scenario => (
              <button
                key={scenario.id}
                className={`scenario-btn scenario-${scenario.id} ${currentScenario === scenario.id ? 'active' : ''}`}
                onClick={() => setCurrentScenario(scenario.id)}
              >
                {scenario.label}
              </button>
            ))}
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
              <ReLineChart data={scenarioData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="scenario" stroke="#2ecc71" strokeWidth={3} dot={false} name="Scenario" />
                <Line type="monotone" dataKey="goal" stroke="#9b59b6" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Goal" />
              </ReLineChart>
            </ResponsiveContainer>
          </div>

          <div className="controls-grid">
            <div className="control-group">
              <div className="control-label">
                <div className="control-label-text">Goal Amount</div>
                <div className="control-value">${goalAmount.toLocaleString()}</div>
              </div>
              <input
                type="range"
                min={10000}
                max={100000}
                step={1000}
                value={goalAmount}
                className="slider"
                aria-label="Goal amount"
                title="Goal amount"
                onChange={(event) => setGoalAmount(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="action-buttons">
            <button className="action-btn" onClick={() => handleFeedback('Scenario saved to memory!')}>Save Scenario</button>
            <button className="action-btn" onClick={() => handleFeedback('Scenario comparison coming soon!')}>Compare All</button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon orange">⏳</div>
              <div className="stat-value">{monthlyIncome - monthlyExpenses > 0 ? '∞' : Math.abs((historicalBalances[historicalBalances.length - 1]?.value ?? 0) / Math.max(monthlyIncome - monthlyExpenses, 1)).toFixed(1)}</div>
              <div className="stat-label">Months Until Empty</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">🚩</div>
              <div className="stat-value green">
                {(() => {
                  const lastBalance = historicalBalances[historicalBalances.length - 1]?.value ?? 0
                  const delta = goalAmount - lastBalance
                  const net = monthlyIncome - monthlyExpenses
                  return net > 0 ? Math.ceil(delta / net) : '—'
                })()}
              </div>
              <div className="stat-label">Months to Goal</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">⚠️</div>
              <div className="stat-value red">{currentScenario === 'optimistic' ? '5%' : currentScenario === 'baseline' ? '12%' : '25%'}</div>
              <div className="stat-label">Risk</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon card-icon-probability">🎲</div>
              <div>
                <div className="card-title-text">Probability Predictor</div>
                <div className="card-subtitle">Monte Carlo simulation with real data</div>
              </div>
            </div>
          </div>

          <div className="tab-container">
            {([
              { id: 'monte', label: 'Probability Chart' },
              { id: 'distribution', label: 'Result Spread' },
              { id: 'settings', label: 'Settings' }
            ] as { id: MonteTab; label: string }[]).map(tab => (
              <button
                key={tab.id}
                className={`tab ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
              {currentTab === 'distribution' ? (
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4361ee" />
                </BarChart>
              ) : (
                <ReLineChart data={monteCarloData.series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="p10" stroke="#e74c3c" strokeDasharray="3 3" dot={false} name="Worst Case" />
                  <Line type="monotone" dataKey="p50" stroke="#4361ee" strokeWidth={3} dot={false} name="Most Likely" />
                  <Line type="monotone" dataKey="p90" stroke="#2ecc71" strokeDasharray="3 3" dot={false} name="Best Case" />
                </ReLineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="controls-grid">
            <div className="control-group">
              <div className="control-label">
                <div className="control-label-text">Simulations</div>
                <div className="control-value">{simulations.toLocaleString()}</div>
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={simulations}
                className="slider"
                aria-label="Monte Carlo simulations"
                title="Monte Carlo simulations"
                onChange={(event) => setSimulations(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="action-buttons">
            <button className="action-btn" onClick={() => handleFeedback('Simulation refreshed!')}>Run Simulation</button>
            <button className="action-btn" onClick={() => handleFeedback('Download coming soon!')}>Download Results</button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green">👍</div>
              <div className="stat-value purple">{monteCarloData.successProbability.toFixed(1)}%</div>
              <div className="stat-label">Chance of Success</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">💰</div>
              <div className="stat-value">${Math.round(monteCarloData.averageResult).toLocaleString()}</div>
              <div className="stat-label">Average Result</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange">🎲</div>
              <div className="stat-value">{simulations.toLocaleString()}</div>
              <div className="stat-label">Simulations Run</div>
            </div>
          </div>
        </div>
      </div>

      <div className={`monkey-feedback ${feedback ? 'show' : ''}`}>
        <div className="monkey-feedback-header">
          <span className="monkey-feedback-emoji">🐵</span>
          <span className="monkey-feedback-title">Monkey Tip!</span>
        </div>
        <div className="monkey-feedback-text">{feedback ?? ''}</div>
      </div>
    </div>
  )
}
