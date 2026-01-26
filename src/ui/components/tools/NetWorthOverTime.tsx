import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useNetWorth } from '../../hooks/useFinanceData'
import { getMonthKey } from '../../../utils/dataAggregation'

export default function NetWorthOverTime() {
  const { netWorthEntries, loading, error, addNetWorthEntry } = useNetWorth()
  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [date, setDate] = useState('')

  const data = useMemo(() => {
    const sorted = [...netWorthEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return sorted.map(entry => ({
      month: getMonthKey(entry.date),
      assets_total: entry.assets,
      liabilities_total: entry.liabilities,
      net_worth: entry.assets - entry.liabilities
    }))
  }, [netWorthEntries])

  const addEntry = async () => {
    if (!date || !assets) return

    const assetsNum = parseFloat(assets)
    const liabilitiesNum = parseFloat(liabilities) || 0
    try {
      await addNetWorthEntry({ date, assets: assetsNum, liabilities: liabilitiesNum })
      setDate('')
      setAssets('')
      setLiabilities('')
    } catch (err) {
      console.error('Error saving net worth entry', err)
    }
  }

  const latest = data[data.length - 1]
  const first = data[0]
  const currentNetWorth = latest ? latest.net_worth : 0
  const startNetWorth = first ? first.net_worth : 0
  const growth = currentNetWorth - startNetWorth
  const growthPercent = startNetWorth ? ((growth / startNetWorth) * 100).toFixed(2) : '0.00'

  if (loading) return <div className="tool-container"><p>Loading net worth...</p></div>
  if (error) return <div className="tool-container"><p className="error">{error}</p></div>

  return (
    <div className="tool-container">
      <h2>📊 Net Worth Over Time</h2>
      
      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Current Net Worth</div>
          <div className="stat-value">${currentNetWorth.toLocaleString()}</div>
        </div>
        <div className={`stat-card ${growth >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Growth</div>
          <div className="stat-value">
            {growth >= 0 ? '+' : '-'}${Math.abs(growth).toLocaleString()}
            <span className="percent">({growthPercent}%)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value">${latest ? latest.assets_total.toLocaleString() : 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Liabilities</div>
          <div className="stat-value">${latest ? latest.liabilities_total.toLocaleString() : 0}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Net Worth Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
            <Line type="monotone" dataKey="net_worth" stroke="#9D84B7" strokeWidth={2} name="Net Worth" />
            <Line type="monotone" dataKey="assets_total" stroke="#4ECDC4" strokeWidth={2} name="Assets" />
            <Line type="monotone" dataKey="liabilities_total" stroke="#FF6B6B" strokeWidth={2} name="Liabilities" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Add Entry</h3>
        <div className="form-group">
          <input
            type="date"
            placeholder="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            type="number"
            placeholder="Total Assets"
            value={assets}
            onChange={(e) => setAssets(e.target.value)}
          />
          <input
            type="number"
            placeholder="Total Liabilities"
            value={liabilities}
            onChange={(e) => setLiabilities(e.target.value)}
          />
          <button onClick={addEntry}>Add Entry</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Data</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Assets</th>
              <th>Liabilities</th>
              <th>Net Worth</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td>{row.month}</td>
                <td className="positive">${row.assets_total.toLocaleString()}</td>
                <td className="negative">${row.liabilities_total.toLocaleString()}</td>
                <td className="positive">${row.net_worth.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
