import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface SavingsData {
  month: string
  net: number
  cumulative_savings: number
}

export default function CumulativeSavings() {
  const [data, setData] = useState<SavingsData[]>([
    { month: 'Jan', net: 2000, cumulative_savings: 2000 },
    { month: 'Feb', net: 2200, cumulative_savings: 4200 },
    { month: 'Mar', net: 1800, cumulative_savings: 6000 },
    { month: 'Apr', net: 2500, cumulative_savings: 8500 },
    { month: 'May', net: 1900, cumulative_savings: 10400 },
    { month: 'Jun', net: 2300, cumulative_savings: 12700 },
  ])

  const [monthInput, setMonthInput] = useState('')
  const [netInput, setNetInput] = useState('')

  const addEntry = () => {
    if (!monthInput || !netInput) return

    const netNum = parseFloat(netInput)
    const prevCumulative = data.length > 0 ? data[data.length - 1].cumulative_savings : 0
    const newCumulative = prevCumulative + netNum

    const newEntry: SavingsData = {
      month: monthInput,
      net: netNum,
      cumulative_savings: newCumulative,
    }

    setData([...data, newEntry])
    setMonthInput('')
    setNetInput('')
  }

  const totalSavings = data[data.length - 1].cumulative_savings
  const averageMonthlySavings = (totalSavings / data.length).toFixed(2)
  const maxMonth = data.reduce((max, d) => d.net > max.net ? d : max)

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
        <h3>Add Monthly Entry</h3>
        <div className="form-group">
          <input
            type="text"
            placeholder="Month"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
          />
          <input
            type="number"
            placeholder="Net (Income - Expenses)"
            value={netInput}
            onChange={(e) => setNetInput(e.target.value)}
          />
          <button onClick={addEntry}>Add Entry</button>
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
