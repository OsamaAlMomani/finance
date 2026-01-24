import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ScenarioPlan {
  name: string
  incomeAdjustment: number // percentage
  expenseAdjustment: number // percentage
  color: string
}

interface ForecastData {
  month: string
  planA: number
  planB: number
  planC: number
}

export default function ScenarioPlanner() {
  const [baseBalance, setBaseBalance] = useState(10000)
  const [baseIncome, setBaseIncome] = useState(4000)
  const [baseExpense, setBaseExpense] = useState(2500)

  const plans: ScenarioPlan[] = [
    { name: 'Plan A - Expected', incomeAdjustment: 0, expenseAdjustment: 0, color: '#4ECDC4' },
    { name: 'Plan B - Things Go Bad', incomeAdjustment: -20, expenseAdjustment: 20, color: '#FF6B6B' },
    { name: 'Plan C - Things Go Well', incomeAdjustment: 20, expenseAdjustment: -10, color: '#96CEB4' },
  ]

  const calculateForecast = (months: number = 12) => {
    const data: ForecastData[] = []

    for (let i = 0; i < months; i++) {
      const monthName = `Month ${i + 1}`

      // Plan A: Expected scenario (no changes)
      const planABalance = baseBalance + (i + 1) * (baseIncome - baseExpense)

      // Plan B: Bad scenario (20% less income, 20% more expenses)
      const planBIncome = baseIncome * (1 + plans[1].incomeAdjustment / 100)
      const planBExpense = baseExpense * (1 + plans[1].expenseAdjustment / 100)
      const planBBalance = baseBalance + (i + 1) * (planBIncome - planBExpense)

      // Plan C: Good scenario (20% more income, 10% less expenses)
      const planCIncome = baseIncome * (1 + plans[2].incomeAdjustment / 100)
      const planCExpense = baseExpense * (1 + plans[2].expenseAdjustment / 100)
      const planCBalance = baseBalance + (i + 1) * (planCIncome - planCExpense)

      data.push({
        month: monthName,
        planA: Math.max(0, planABalance),
        planB: Math.max(0, planBBalance),
        planC: Math.max(0, planCBalance),
      })
    }

    return data
  }

  const forecastData = calculateForecast(12)

  const getScenarioMetrics = () => {
    const metrics = []

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]
      const income = baseIncome * (1 + plan.incomeAdjustment / 100)
      const expense = baseExpense * (1 + plan.expenseAdjustment / 100)
      const monthlyNet = income - expense
      const months = baseBalance / Math.abs(monthlyNet)

      const final12Month = baseBalance + 12 * monthlyNet

      metrics.push({
        name: plan.name,
        income,
        expense,
        monthlyNet,
        runwayMonths: monthlyNet < 0 ? months.toFixed(1) : '∞',
        balance12Month: final12Month.toFixed(0),
        status: final12Month > baseBalance ? 'Growing' : final12Month < 0 ? 'Danger' : 'Stable',
      })
    }

    return metrics
  }

  const metrics = getScenarioMetrics()

  return (
    <div className="tool-container">
      <h2>🎯 Scenario Planner (Plan A / B / C)</h2>

      <div className="scenario-intro">
        <p><strong>Why multiple plans?</strong> The future is uncertain. Instead of guessing one future, we simulate three outcomes:</p>
        <ul>
          <li><strong>Plan A:</strong> Everything goes as expected</li>
          <li><strong>Plan B:</strong> Things go bad (less income, more expenses)</li>
          <li><strong>Plan C:</strong> Things go well (more income, fewer expenses)</li>
        </ul>
      </div>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Current Balance</div>
          <div className="stat-value">${baseBalance.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Income</div>
          <div className="stat-value">${baseIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Expense</div>
          <div className="stat-value">${baseExpense.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Net</div>
          <div className="stat-value">${(baseIncome - baseExpense).toLocaleString()}</div>
        </div>
      </div>

      <div className="scenario-adjustments">
        <h3>Adjust Base Numbers</h3>
        <div className="form-group">
          <label>
            Current Balance: ${baseBalance.toLocaleString()}
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={baseBalance}
              onChange={(e) => setBaseBalance(parseFloat(e.target.value))}
            />
          </label>
          <label>
            Monthly Income: ${baseIncome.toLocaleString()}
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={baseIncome}
              onChange={(e) => setBaseIncome(parseFloat(e.target.value))}
            />
          </label>
          <label>
            Monthly Expense: ${baseExpense.toLocaleString()}
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={baseExpense}
              onChange={(e) => setBaseExpense(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="chart-container">
        <h3>12-Month Balance Projection</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="planA" stroke="#4ECDC4" strokeWidth={2} name="Plan A - Expected" />
            <Line type="monotone" dataKey="planB" stroke="#FF6B6B" strokeWidth={2} name="Plan B - Bad" />
            <Line type="monotone" dataKey="planC" stroke="#96CEB4" strokeWidth={2} name="Plan C - Good" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="scenarios-comparison">
        <h3>Scenario Comparison</h3>
        <table className="scenario-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Income</th>
              <th>Expense</th>
              <th>Monthly Net</th>
              <th>Runway</th>
              <th>Balance (12mo)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, idx) => (
              <tr key={idx} className={`scenario-row ${m.status.toLowerCase()}`}>
                <td><strong>{m.name}</strong></td>
                <td className="positive">${m.income.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="negative">${m.expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className={m.monthlyNet >= 0 ? 'positive' : 'negative'}>
                  {m.monthlyNet >= 0 ? '+' : '-'}${Math.abs(m.monthlyNet).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td>{m.runwayMonths} months</td>
                <td className={parseFloat(m.balance12Month) >= baseBalance ? 'positive' : 'negative'}>
                  ${m.balance12Month}
                </td>
                <td>
                  <span className={`status-badge ${m.status.toLowerCase()}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="scenario-explanation">
        <h3>What This Tells You</h3>
        <div className="explanation-grid">
          <div className="explanation-card">
            <h4>🎯 Plan A (Expected)</h4>
            <p>Most likely outcome if nothing changes. Use this for normal planning.</p>
          </div>
          <div className="explanation-card">
            <h4>⚠️ Plan B (Bad Scenario)</h4>
            <p>Income drops 20%, expenses rise 20%. Prepare for this - it's real possibility.</p>
          </div>
          <div className="explanation-card">
            <h4>✅ Plan C (Good Scenario)</h4>
            <p>Income rises 20%, expenses drop 10%. This is your upside potential.</p>
          </div>
        </div>
      </div>

      <div className="pro-tips">
        <h3>💡 Pro Tips</h3>
        <ul>
          <li><strong>If Plan B shows danger:</strong> You're taking too much risk. Cut expenses NOW.</li>
          <li><strong>If all plans show growth:</strong> You're safe. Consider investing or saving more.</li>
          <li><strong>If Plan A shows negative runway:</strong> Your baseline is unsustainable - urgent action needed.</li>
          <li><strong>The gap between plans:</strong> Larger gaps mean higher risk. Diversify income or reduce fixed costs.</li>
        </ul>
      </div>
    </div>
  )
}
