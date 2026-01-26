import { useMemo, useState } from 'react'
import { useTransactions } from '../../hooks/useFinanceData'
import { aggregateTransactionsByMonth } from '../../../utils/dataAggregation'

export default function BurnRateRunway() {
  const { transactions, loading, error } = useTransactions()
  const [overrideCash, setOverrideCash] = useState<string>('')

  const { avgMonthlyBurn, runwayMonths, currentCash, monthlyExpenses } = useMemo(() => {
    const monthly = aggregateTransactionsByMonth(transactions)
    const expenseSeries = monthly.map(m => Math.abs(m.expense_total))
    const avgMonthlyBurn = expenseSeries.length ? expenseSeries.reduce((a, b) => a + b, 0) / expenseSeries.length : 0
    const cashFromFlow = transactions.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
    const cash = overrideCash ? parseFloat(overrideCash) || 0 : cashFromFlow
    const runwayMonths = avgMonthlyBurn > 0 ? cash / avgMonthlyBurn : 0
    return { avgMonthlyBurn, runwayMonths, currentCash: cash, monthlyExpenses: expenseSeries }
  }, [transactions, overrideCash])

  const status = runwayMonths > 12
    ? { text: 'Healthy', color: '#96CEB4' }
    : runwayMonths > 6
      ? { text: 'Caution', color: '#FFEAA7' }
      : { text: 'Critical', color: '#FF6B6B' }

  if (loading) return <div className="tool-container"><p>Loading burn rate...</p></div>
  if (error) return <div className="tool-container"><p className="error">{error}</p></div>

  return (
    <div className="tool-container">
      <h2>🏦 Burn Rate & Runway</h2>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Current Cash</div>
          <div className="stat-value">${currentCash.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Monthly Burn</div>
          <div className="stat-value">${avgMonthlyBurn.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="stat-card" style={{ borderColor: status.color }}>
          <div className="stat-label">Runway</div>
          <div className="stat-value" style={{ color: status.color }}>
            {runwayMonths.toFixed(1)} months
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
          <p><strong>Current:</strong> ${currentCash.toLocaleString()} ÷ ${avgMonthlyBurn.toLocaleString('en-US', { maximumFractionDigits: 0 })} = {runwayMonths.toFixed(1)} months</p>
          <p style={{ marginTop: '1rem', fontSize: '0.95rem', color: '#666' }}>
            💡 <strong>Note:</strong> This calculation intentionally ignores income to show how long funds will last at current burn rate only.
          </p>
        </div>
      </div>

      <div className="input-section">
        <h3>Override Cash (optional)</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="Current Cash"
            value={overrideCash}
            onChange={(e) => setOverrideCash(e.target.value)}
          />
        </div>
      </div>

      <div className="data-table">
        <h3>Monthly Expenses (from transactions)</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Expense</th>
            </tr>
          </thead>
          <tbody>
            {monthlyExpenses.map((expense, idx) => (
              <tr key={idx}>
                <td>Month {idx + 1}</td>
                <td className="negative">${expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
              <td>Average</td>
              <td>${(monthlyExpenses.length > 0 ? monthlyExpenses.reduce((a, b) => a + b, 0) / monthlyExpenses.length : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
