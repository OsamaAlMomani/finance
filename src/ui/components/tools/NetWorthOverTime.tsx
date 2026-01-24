import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface NetWorthData {
  month: string
  assets_total: number
  liabilities_total: number
  net_worth: number
}

export default function NetWorthOverTime() {
  const [data, setData] = useState<NetWorthData[]>([
    { month: 'Jan', assets_total: 50000, liabilities_total: 20000, net_worth: 30000 },
    { month: 'Feb', assets_total: 52000, liabilities_total: 19500, net_worth: 32500 },
    { month: 'Mar', assets_total: 55000, liabilities_total: 19000, net_worth: 36000 },
    { month: 'Apr', assets_total: 58000, liabilities_total: 18500, net_worth: 39500 },
    { month: 'May', assets_total: 61000, liabilities_total: 18000, net_worth: 43000 },
  ])

  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [month, setMonth] = useState('')

  const addEntry = () => {
    if (!month || !assets) return

    const assetsNum = parseFloat(assets)
    const liabilitiesNum = parseFloat(liabilities) || 0
    const netWorth = assetsNum - liabilitiesNum

    const newEntry: NetWorthData = {
      month,
      assets_total: assetsNum,
      liabilities_total: liabilitiesNum,
      net_worth: netWorth,
    }

    setData([...data, newEntry])
    setMonth('')
    setAssets('')
    setLiabilities('')
  }

  const currentNetWorth = data[data.length - 1].net_worth
  const startNetWorth = data[0].net_worth
  const growth = currentNetWorth - startNetWorth
  const growthPercent = ((growth / startNetWorth) * 100).toFixed(2)

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
          <div className="stat-value">${data[data.length - 1].assets_total.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Liabilities</div>
          <div className="stat-value">${data[data.length - 1].liabilities_total.toLocaleString()}</div>
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
            type="text"
            placeholder="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
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
