import { useState } from 'react'

interface SafetyMetrics {
  burnRate: number
  currentCash: number
  runway: number
  status: 'safe' | 'warning' | 'danger' | 'critical'
  riskLevel: number
}

export default function DangerSafetyMeter() {
  const [currentCash, setCurrentCash] = useState(50000)
  const [monthlyExpenses, setMonthlyExpenses] = useState<number[]>([2500, 2600, 2400, 2800, 2700, 2500])
  const [monthlyIncome, setMonthlyIncome] = useState(4000)
  const [newExpense, setNewExpense] = useState('')

  const calculateBurnRate = () => {
    if (monthlyExpenses.length === 0) return 0
    return monthlyExpenses.reduce((sum, e) => sum + e, 0) / monthlyExpenses.length
  }

  const burnRate = calculateBurnRate()
  const netMonthly = monthlyIncome - burnRate
  const adjustedRunway = burnRate > monthlyIncome ? currentCash / (burnRate - monthlyIncome) : Infinity

  const getStatus = (): SafetyMetrics['status'] => {
    if (adjustedRunway < 0) return 'critical'
    if (adjustedRunway < 3) return 'danger'
    if (adjustedRunway < 6) return 'warning'
    return 'safe'
  }

  const getRiskLevel = (): number => {
    if (status === 'critical') return 100
    if (status === 'danger') return 75
    if (status === 'warning') return 50
    return 25
  }

  const status = getStatus()
  const riskLevel = getRiskLevel()

  const metrics: SafetyMetrics = {
    burnRate,
    currentCash,
    runway: adjustedRunway,
    status,
    riskLevel,
  }

  const getStatusColor = () => {
    switch (status) {
      case 'safe': return '#96CEB4'
      case 'warning': return '#FFEAA7'
      case 'danger': return '#FF6B6B'
      case 'critical': return '#8B0000'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'safe': return '✅ SAFE - Your finances are healthy'
      case 'warning': return '⚠️ WARNING - Monitor your spending closely'
      case 'danger': return '🚨 DANGER - Urgent action needed'
      case 'critical': return '❌ CRITICAL - You are at immediate risk'
    }
  }

  const addExpense = () => {
    if (!newExpense) return
    const expense = parseFloat(newExpense)
    setMonthlyExpenses([...monthlyExpenses, expense])
    setNewExpense('')
  }

  const removeExpense = (idx: number) => {
    setMonthlyExpenses(monthlyExpenses.filter((_, i) => i !== idx))
  }

  const implications = {
    safe: [
      '✓ Your runway is 9+ months',
      '✓ You have breathing room for emergencies',
      '✓ You can invest or increase savings',
      '✓ Low financial stress',
    ],
    warning: [
      '• Your runway is 6-9 months',
      '• You should review your expenses',
      '• Build an emergency fund if you haven\'t',
      '• Start reducing fixed costs',
    ],
    danger: [
      '⚠️ Your runway is 3-6 months',
      '⚠️ You need to act THIS MONTH',
      '⚠️ Cut non-essential expenses immediately',
      '⚠️ Look for additional income sources',
    ],
    critical: [
      '❌ Your runway is less than 3 months',
      '❌ EMERGENCY: You must act NOW',
      '❌ Cut all non-essential spending',
      '❌ Seek emergency income immediately',
    ],
  }

  return (
    <div className="tool-container">
      <h2>🚨 Danger & Safety Meter</h2>

      <div className="safety-meter">
        <div className="meter-display">
          <div className="meter-arc" style={{ background: `conic-gradient(${getStatusColor()} 0deg ${riskLevel * 3.6}deg, #e0e0e0 ${riskLevel * 3.6}deg)` }}>
            <div className="meter-center">
              <div className="meter-value">{riskLevel}%</div>
              <div className="meter-label">{status.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div className="status-message" style={{ color: getStatusColor() }}>
          <h3>{getStatusText()}</h3>
        </div>
      </div>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Current Cash</div>
          <div className="stat-value">${currentCash.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Monthly Burn</div>
          <div className="stat-value">${burnRate.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Income</div>
          <div className="stat-value">${monthlyIncome.toLocaleString()}</div>
        </div>
        <div className={`stat-card ${netMonthly >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Net Monthly</div>
          <div className="stat-value">${netMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="stat-card" style={{ borderColor: getStatusColor() }}>
          <div className="stat-label">Runway (with income)</div>
          <div className="stat-value" style={{ color: getStatusColor() }}>
            {metrics.runway === Infinity ? '∞' : metrics.runway.toFixed(1)} months
          </div>
        </div>
      </div>

      <div className="implications-box">
        <h3>What This Means</h3>
        <div className="implications-list">
          {implications[status].map((implication, idx) => (
            <div key={idx} className="implication-item">
              {implication}
            </div>
          ))}
        </div>
      </div>

      <div className="input-section">
        <h3>Adjust Parameters</h3>
        <div className="form-group">
          <label>
            Current Cash: ${currentCash.toLocaleString()}
            <input
              type="range"
              min="0"
              max="100000"
              step="5000"
              value={currentCash}
              onChange={(e) => setCurrentCash(parseFloat(e.target.value))}
            />
          </label>
          <label>
            Monthly Income: ${monthlyIncome.toLocaleString()}
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="input-section">
        <h3>Add Expense Record</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="Monthly Expense Amount"
            value={newExpense}
            onChange={(e) => setNewExpense(e.target.value)}
          />
          <button onClick={addExpense}>Add Month</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Monthly Expenses (Last 6 Months)</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Expense</th>
              <th>vs Burn Rate</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {monthlyExpenses.map((expense, idx) => (
              <tr key={idx}>
                <td>Month {idx + 1}</td>
                <td className="negative">${expense.toLocaleString()}</td>
                <td className={expense > burnRate ? 'positive' : 'negative'}>
                  {expense > burnRate ? '▲' : '▼'} ${Math.abs(expense - burnRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td>
                  <button className="delete-btn" onClick={() => removeExpense(idx)}>Delete</button>
                </td>
              </tr>
            ))}
            <tr className="average-row">
              <td><strong>Average</strong></td>
              <td className="negative"><strong>${burnRate.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="danger-guide">
        <h3>📋 The Safety Scale</h3>
        <div className="scale-explanation">
          <div className="scale-item safe">
            <strong>SAFE (Green)</strong>
            <p>Runway: 9+ months | Risk: 0-25% | Action: Continue normal planning</p>
          </div>
          <div className="scale-item warning">
            <strong>WARNING (Yellow)</strong>
            <p>Runway: 6-9 months | Risk: 25-50% | Action: Review and optimize</p>
          </div>
          <div className="scale-item danger">
            <strong>DANGER (Orange)</strong>
            <p>Runway: 3-6 months | Risk: 50-75% | Action: Cut expenses NOW</p>
          </div>
          <div className="scale-item critical">
            <strong>CRITICAL (Red)</strong>
            <p>Runway: 0-3 months | Risk: 75-100% | Action: Emergency measures</p>
          </div>
        </div>
      </div>

      <div className="calculation-info">
        <h3>How It's Calculated</h3>
        <div className="calculation-formula">
          <p><strong>Burn Rate:</strong> Average of last 6 months expenses</p>
          <p><strong>Runway:</strong> Current Cash ÷ (Burn Rate - Monthly Income)</p>
          <p><strong>Status Levels:</strong></p>
          <ul>
            <li>Safe: Runway ≥ 9 months</li>
            <li>Warning: 6 ≤ Runway &lt; 9 months</li>
            <li>Danger: 3 ≤ Runway &lt; 6 months</li>
            <li>Critical: Runway &lt; 3 months</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
