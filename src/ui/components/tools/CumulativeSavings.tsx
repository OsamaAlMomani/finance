import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTransactions } from '../../hooks/useFinanceData'
import { aggregateTransactionsByMonth } from '../../../utils/dataAggregation'

export default function CumulativeSavings() {
  const { transactions, loading, error } = useTransactions()
  const [manualStart, setManualStart] = useState<number | ''>('')

  const data = useMemo(() => {
    const monthly = aggregateTransactionsByMonth(transactions)
    let cumulative = typeof manualStart === 'number' ? manualStart : 0
    return monthly.map(m => {
      cumulative += m.net
      return {
        month: m.month,
        net: m.net,
        cumulative_savings: cumulative
      }
    })
  }, [transactions, manualStart])

  const totalSavings = data.length ? data[data.length - 1].cumulative_savings : 0
  const averageMonthlySavings = data.length ? (totalSavings / data.length).toFixed(2) : '0'
  const maxMonth = data.length ? data.reduce((max, d) => d.net > max.net ? d : max) : { net: 0, month: '-' }

  if (loading) return <div className="tool-container"><p>Loading savings...</p></div>
  if (error) return <div className="tool-container"><p className="error">{error}</p></div>

  return (
    <div className="tool-container">
      <h2>🎯 Cumulative Savings Curve</h2>

      <div className="tool-stats">
        <div className="stat-card positive">
          <div className="stat-label">Total Savings</div>
          <div className="stat-value">${totalSavings.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Monthly</div>
          <div className="stat-value">${Number(averageMonthlySavings).toLocaleString()}</div>
        </div>
        <div className="stat-card positive">
          <div className="stat-label">Best Month</div>
          <div className="stat-value">${maxMonth.net.toLocaleString()} ({maxMonth.month})</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Months Tracked</div>
          <div className="stat-value">{data.length}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Savings Growth Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#96CEB4" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#96CEB4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
            <Area type="monotone" dataKey="cumulative_savings" stroke="#96CEB4" fillOpacity={1} fill="url(#colorSavings)" name="Cumulative Savings" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Starting Balance (optional)</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="Starting savings"
            value={manualStart === '' ? '' : manualStart}
            onChange={(e) => setManualStart(e.target.value === '' ? '' : parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="data-table">
        <h3>Monthly Savings Data</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Monthly Net</th>
              <th>Cumulative Savings</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td>{row.month}</td>
                <td className={row.net >= 0 ? 'positive' : 'negative'}>
                  {row.net >= 0 ? '+' : '-'}${Math.abs(row.net).toLocaleString()}
                </td>
                <td className="positive">${row.cumulative_savings.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note">
        <strong>Note:</strong> Cumulative savings is derived data and should never be reset without user intent. Each month's entry is calculated as: cumulative_savings[n] = cumulative_savings[n-1] + net
      </div>
    </div>
  )
}
