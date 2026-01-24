import { useState } from 'react'
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line } from 'recharts'

interface ForecastData {
  month: string
  forecast_income: number
  forecast_expense: number
  actual_income?: number
  actual_expense?: number
}

export default function ForecastVsActual() {
  const [data, setData] = useState<ForecastData[]>([
    { month: 'Jan', forecast_income: 5000, forecast_expense: 3000, actual_income: 5200, actual_expense: 3100 },
    { month: 'Feb', forecast_income: 5000, forecast_expense: 3000, actual_income: 4800, actual_expense: 3300 },
    { month: 'Mar', forecast_income: 5200, forecast_expense: 3200, actual_income: 5000, actual_expense: 3500 },
    { month: 'Apr', forecast_income: 5200, forecast_expense: 3200, actual_income: undefined, actual_expense: undefined },
    { month: 'May', forecast_income: 5300, forecast_expense: 3300, actual_income: undefined, actual_expense: undefined },
  ])

  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [forecastIncome, setForecastIncome] = useState('')
  const [forecastExpense, setForecastExpense] = useState('')
  const [actualIncome, setActualIncome] = useState('')
  const [actualExpense, setActualExpense] = useState('')

  const updateEntry = () => {
    if (!selectedMonth) return

    const month = data.find(d => d.month === selectedMonth)
    if (!month) return

    const updated = {
      ...month,
      forecast_income: forecastIncome ? parseFloat(forecastIncome) : month.forecast_income,
      forecast_expense: forecastExpense ? parseFloat(forecastExpense) : month.forecast_expense,
      actual_income: actualIncome ? parseFloat(actualIncome) : month.actual_income,
      actual_expense: actualExpense ? parseFloat(actualExpense) : month.actual_expense,
    }

    setData(data.map(d => d.month === selectedMonth ? updated : d))
    setSelectedMonth('')
    setForecastIncome('')
    setForecastExpense('')
    setActualIncome('')
    setActualExpense('')
  }

  // Calculate variance for completed months
  const completedMonths = data.filter(d => d.actual_income !== undefined)
  const avgIncomeVariance = completedMonths.length > 0
    ? (completedMonths.reduce((sum, d) => sum + ((d.actual_income! - d.forecast_income) / d.forecast_income), 0) / completedMonths.length * 100).toFixed(2)
    : 0

  const avgExpenseVariance = completedMonths.length > 0
    ? (completedMonths.reduce((sum, d) => sum + ((d.actual_expense! - d.forecast_expense) / d.forecast_expense), 0) / completedMonths.length * 100).toFixed(2)
    : 0

  const chartData = data.map(d => ({
    month: d.month,
    forecast_income: d.forecast_income,
    forecast_expense: d.forecast_expense,
    actual_income: d.actual_income || null,
    actual_expense: d.actual_expense || null,
  }))

  return (
    <div className="tool-container">
      <h2>📈 Forecast vs Actual</h2>

      <div className="tool-stats">
        <div className={`stat-card ${Number(avgIncomeVariance) > 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Avg Income Variance</div>
          <div className="stat-value">{Number(avgIncomeVariance) > 0 ? '+' : ''}{avgIncomeVariance}%</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>Actual vs Forecast</div>
        </div>
        <div className={`stat-card ${Number(avgExpenseVariance) > 0 ? 'negative' : 'positive'}`}>
          <div className="stat-label">Avg Expense Variance</div>
          <div className="stat-value">{Number(avgExpenseVariance) > 0 ? '+' : ''}{avgExpenseVariance}%</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>Actual vs Forecast</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed Months</div>
          <div className="stat-value">{completedMonths.length}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Income Forecast vs Actual</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value?.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="forecast_income" fill="#4ECDC4" name="Forecast Income" />
            <Line type="monotone" dataKey="actual_income" stroke="#FF6B6B" strokeWidth={2} name="Actual Income" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Expense Forecast vs Actual</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value?.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="forecast_expense" fill="#96CEB4" name="Forecast Expense" />
            <Line type="monotone" dataKey="actual_expense" stroke="#FF6B6B" strokeWidth={2} name="Actual Expense" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Update Forecast & Actual</h3>
        <div className="form-group">
          <select value={selectedMonth} onChange={(e) => {
            const month = data.find(d => d.month === e.target.value)
            if (month) {
              setSelectedMonth(e.target.value)
              setForecastIncome(month.forecast_income.toString())
              setForecastExpense(month.forecast_expense.toString())
              setActualIncome(month.actual_income?.toString() || '')
              setActualExpense(month.actual_expense?.toString() || '')
            }
          }}>
            <option value="">Select Month</option>
            {data.map(d => (
              <option key={d.month} value={d.month}>{d.month}</option>
            ))}
          </select>
          {selectedMonth && (
            <>
              <input
                type="number"
                placeholder="Forecast Income"
                value={forecastIncome}
                onChange={(e) => setForecastIncome(e.target.value)}
              />
              <input
                type="number"
                placeholder="Forecast Expense"
                value={forecastExpense}
                onChange={(e) => setForecastExpense(e.target.value)}
              />
              <input
                type="number"
                placeholder="Actual Income"
                value={actualIncome}
                onChange={(e) => setActualIncome(e.target.value)}
              />
              <input
                type="number"
                placeholder="Actual Expense"
                value={actualExpense}
                onChange={(e) => setActualExpense(e.target.value)}
              />
              <button onClick={updateEntry}>Update Entry</button>
            </>
          )}
        </div>
      </div>

      <div className="data-table">
        <h3>Data</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Forecast Income</th>
              <th>Actual Income</th>
              <th>Variance</th>
              <th>Forecast Expense</th>
              <th>Actual Expense</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const incomeVar = row.actual_income ? ((row.actual_income - row.forecast_income) / row.forecast_income * 100).toFixed(1) : '-'
              const expenseVar = row.actual_expense ? ((row.actual_expense - row.forecast_expense) / row.forecast_expense * 100).toFixed(1) : '-'
              return (
                <tr key={idx}>
                  <td>{row.month}</td>
                  <td>${row.forecast_income.toLocaleString()}</td>
                  <td>{row.actual_income ? `$${row.actual_income.toLocaleString()}` : '-'}</td>
                  <td style={{ color: incomeVar !== '-' && Number(incomeVar) > 0 ? '#96CEB4' : '#FF6B6B' }}>
                    {incomeVar !== '-' ? `${Number(incomeVar) > 0 ? '+' : ''}${incomeVar}%` : '-'}
                  </td>
                  <td>${row.forecast_expense.toLocaleString()}</td>
                  <td>{row.actual_expense ? `$${row.actual_expense.toLocaleString()}` : '-'}</td>
                  <td style={{ color: expenseVar !== '-' && Number(expenseVar) < 0 ? '#96CEB4' : '#FF6B6B' }}>
                    {expenseVar !== '-' ? `${Number(expenseVar) > 0 ? '+' : ''}${expenseVar}%` : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="note">
        <strong>Note:</strong> Lock past months (no editing actual values). Allow forecast edits for future periods only. Variance shows how actual compares to forecast.
      </div>
    </div>
  )
}
