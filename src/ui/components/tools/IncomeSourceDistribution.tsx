import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface IncomeSource {
  source: string
  amount: number
  date: string
}

const COLORS = ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA15E', '#BC6C25', '#9D84B7', '#FF6B6B']

export default function IncomeSourceDistribution() {
  const [incomes, setIncomes] = useState<IncomeSource[]>([
    { source: 'Salary', amount: 4000, date: '2024-01-15' },
    { source: 'Freelance', amount: 1000, date: '2024-01-20' },
    { source: 'Investment', amount: 500, date: '2024-01-25' },
    { source: 'Salary', amount: 4000, date: '2024-02-15' },
    { source: 'Freelance', amount: 800, date: '2024-02-20' },
    { source: 'Bonus', amount: 1500, date: '2024-02-28' },
  ])

  const [newSource, setNewSource] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDate, setNewDate] = useState('')

  const addIncome = () => {
    if (!newSource || !newAmount || !newDate) return

    const newIncome: IncomeSource = {
      source: newSource,
      amount: parseFloat(newAmount),
      date: newDate,
    }

    setIncomes([...incomes, newIncome])
    setNewSource('')
    setNewAmount('')
    setNewDate('')
  }

  const deleteIncome = (idx: number) => {
    setIncomes(incomes.filter((_, i) => i !== idx))
  }

  // Group by source
  const groupedBySource = incomes.reduce((acc, income) => {
    const existing = acc.find(g => g.source === income.source)
    if (existing) {
      existing.amount += income.amount
      existing.count += 1
    } else {
      acc.push({ source: income.source, amount: income.amount, count: 1 })
    }
    return acc
  }, [] as Array<{ source: string; amount: number; count: number }>)

  // Group by month
  const groupedByMonth: Array<{ month: string; total: number }> = []
  incomes.forEach(income => {
    const month = income.date.substring(0, 7) // YYYY-MM
    const existing = groupedByMonth.find(g => g.month === month)
    if (existing) {
      existing.total += income.amount
    } else {
      groupedByMonth.push({ month, total: income.amount })
    }
  })

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0)
  const avgPerSource = (totalIncome / groupedBySource.length).toFixed(0)
  const sources = groupedBySource.length
  const diversification = sources > 2 ? 'Well Diversified' : sources === 2 ? 'Somewhat Diversified' : 'Limited'

  return (
    <div className="tool-container">
      <h2>💱 Income Source Distribution</h2>

      <div className="tool-stats">
        <div className="stat-card positive">
          <div className="stat-label">Total Income</div>
          <div className="stat-value">${totalIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Income Sources</div>
          <div className="stat-value">{sources}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average per Source</div>
          <div className="stat-value">${Number(avgPerSource).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Diversification</div>
          <div className="stat-value">{diversification}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Income by Source (Total)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={groupedBySource}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ source, percent }: { source: string; percent: number }) => `${source} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="amount"
            >
              {groupedBySource.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Income Over Time by Month</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={groupedByMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
            <Bar dataKey="total" fill="#4ECDC4" name="Total Income" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Add Income Entry</h3>
        <div className="form-group">
          <input
            type="text"
            placeholder="Income Source"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button onClick={addIncome}>Add Income</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Income Summary by Source</h3>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Total</th>
              <th>Count</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedBySource.map((source, idx) => (
              <tr key={idx}>
                <td>{source.source}</td>
                <td className="positive">${source.amount.toLocaleString()}</td>
                <td>{source.count}</td>
                <td>{((source.amount / totalIncome) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
              <td>Total</td>
              <td className="positive">${totalIncome.toLocaleString()}</td>
              <td>{incomes.length}</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="data-table">
        <h3>All Income Entries</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {incomes.map((income, idx) => (
              <tr key={idx}>
                <td>{income.date}</td>
                <td>{income.source}</td>
                <td className="positive">${income.amount.toLocaleString()}</td>
                <td>
                  <button className="delete-btn" onClick={() => deleteIncome(idx)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note">
        <strong>Note:</strong> Never mix expenses here. This tool prepares data for tax logic expansion.
      </div>
    </div>
  )
}
