import { useState } from 'react'

interface BurnRateData {
  current_cash: number
  avg_monthly_burn: number
  runway_months: number
}

export default function BurnRateRunway() {
  const [data, setData] = useState<BurnRateData>({
    current_cash: 50000,
    avg_monthly_burn: 3000,
    runway_months: 16.67,
  })

  const [cash, setCash] = useState(data.current_cash.toString())
  const [expenses, setExpenses] = useState<number[]>([3200, 3000, 2800, 3100])

  const [newExpense, setNewExpense] = useState('')

  const calculateBurnRate = () => {
    if (expenses.length === 0) return 0
    return expenses.reduce((sum, e) => sum + e, 0) / expenses.length
  }

  const updateCash = (value: string) => {
    setCash(value)
    const cashNum = parseFloat(value) || 0
    const burnRate = calculateBurnRate()
    const runway = burnRate > 0 ? cashNum / burnRate : 0

    setData({
      current_cash: cashNum,
      avg_monthly_burn: burnRate,
      runway_months: runway,
    })
  }

  const addExpense = () => {
    if (!newExpense) return
    const expenseNum = parseFloat(newExpense)
    const newExpenses = [...expenses, expenseNum].slice(-12)
    setExpenses(newExpenses)

    const burnRate = newExpenses.reduce((sum, e) => sum + e, 0) / newExpenses.length
    const runway = data.current_cash / burnRate

    setData({
      current_cash: data.current_cash,
      avg_monthly_burn: burnRate,
      runway_months: runway,
    })

    setNewExpense('')
  }

  const removeExpense = (idx: number) => {
    const newExpenses = expenses.filter((_, i) => i !== idx)
    setExpenses(newExpenses)

    if (newExpenses.length > 0) {
      const burnRate = newExpenses.reduce((sum, e) => sum + e, 0) / newExpenses.length
      const runway = data.current_cash / burnRate

      setData({
        current_cash: data.current_cash,
        avg_monthly_burn: burnRate,
        runway_months: runway,
      })
    }
  }

  const runwayStatus = () => {
    if (data.runway_months > 12) return { text: 'Healthy', color: '#96CEB4' }
    if (data.runway_months > 6) return { text: 'Caution', color: '#FFEAA7' }
    return { text: 'Critical', color: '#FF6B6B' }
  }

  const status = runwayStatus()

  return (
    <div className="tool-container">
      <h2>🏦 Burn Rate & Runway</h2>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Current Cash</div>
          <div className="stat-value">${data.current_cash.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Monthly Burn</div>
          <div className="stat-value">${data.avg_monthly_burn.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="stat-card" style={{ borderColor: status.color }}>
          <div className="stat-label">Runway</div>
          <div className="stat-value" style={{ color: status.color }}>
            {data.runway_months.toFixed(1)} months
          </div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: status.color }}>
            {status.text}
          </div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Burn Rate Calculation</h3>
        <div className="burn-rate-info">
          <p><strong>Formula:</strong> Runway = Current Cash ÷ Average Monthly Burn</p>
          <p><strong>Current:</strong> ${data.current_cash.toLocaleString()} ÷ ${data.avg_monthly_burn.toLocaleString('en-US', { maximumFractionDigits: 0 })} = {data.runway_months.toFixed(1)} months</p>
          <p style={{ marginTop: '1rem', fontSize: '0.95rem', color: '#666' }}>
            💡 <strong>Note:</strong> This calculation intentionally ignores income to show how long funds will last at current burn rate only.
          </p>
        </div>
      </div>

      <div className="input-section">
        <h3>Update Cash & Expenses</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="Current Cash"
            value={cash}
            onChange={(e) => updateCash(e.target.value)}
          />
          <input
            type="number"
            placeholder="Monthly Expense"
            value={newExpense}
            onChange={(e) => setNewExpense(e.target.value)}
          />
          <button onClick={addExpense}>Add Monthly Expense</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Monthly Expenses History (Last 12 months)</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Expense</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense, idx) => (
              <tr key={idx}>
                <td>Month {idx + 1}</td>
                <td className="negative">${expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td>
                  <button className="delete-btn" onClick={() => removeExpense(idx)}>Delete</button>
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
              <td>Average</td>
              <td>${(expenses.length > 0 ? expenses.reduce((a, b) => a + b, 0) / expenses.length : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
