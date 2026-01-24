import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTransactions } from '../../hooks/useFinanceData'
import { aggregateTransactionsByMonth } from '../../../utils/dataAggregation'

interface CashFlowData {
  month: string
  income_total: number
  expense_total: number
  net: number
}

export default function CashFlowTimeline() {
  const { transactions, loading, error, addTransaction } = useTransactions()
  const [data, setData] = useState<CashFlowData[]>([])

  const [income, setIncome] = useState('')
  const [expense, setExpense] = useState('')
  const [month, setMonth] = useState('')

  useEffect(() => {
    const aggregated = aggregateTransactionsByMonth(transactions)
    setData(aggregated)
  }, [transactions])

  const handleAddEntry = async () => {
    if (!month || !income) return

    const incomeNum = parseFloat(income)
    const expenseNum = parseFloat(expense) || 0

    try {
      // Add income transaction
      if (incomeNum > 0) {
        await addTransaction({
          type: 'income',
          description: `Income - ${month}`,
          amount: incomeNum,
          date: new Date().toISOString(),
          category: 'Income',
          recurring: 'once'
        })
      }

      // Add expense transaction
      if (expenseNum > 0) {
        await addTransaction({
          type: 'expense',
          description: `Expense - ${month}`,
          amount: expenseNum,
          date: new Date().toISOString(),
          category: 'General',
          recurring: 'once'
        })
      }

      setMonth('')
      setIncome('')
      setExpense('')
    } catch (err) {
      console.error('Error adding transaction:', err)
    }
  }

  const totalIncome = data.reduce((sum, d) => sum + d.income_total, 0)
  const totalExpense = data.reduce((sum, d) => sum + d.expense_total, 0)
  const totalNet = totalIncome + totalExpense

  if (loading) return <div className="tool-container"><p>Loading cash flow data...</p></div>
  if (error) return <div className="tool-container"><p className="error">Error: {error}</p></div>

  return (
    <div className="tool-container">
      <h2>💰 Cash Flow Timeline (Income vs Expenses)</h2>
      
      <div className="tool-stats">
        <div className="stat-card positive">
          <div className="stat-label">Total Income</div>
          <div className="stat-value">${totalIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card negative">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">${Math.abs(totalExpense).toLocaleString()}</div>
        </div>
        <div className={`stat-card ${totalNet >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Net</div>
          <div className="stat-value">${totalNet.toLocaleString()}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Cash Flow Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="income_total" fill="#4ECDC4" name="Income" />
            <Bar dataKey="expense_total" fill="#FF6B6B" name="Expenses" />
            <Bar dataKey="net" fill="#96CEB4" name="Net" />
          </BarChart>
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
            placeholder="Income"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
          <input
            type="number"
            placeholder="Expenses"
            value={expense}
            onChange={(e) => setExpense(e.target.value)}
          />
          <button onClick={handleAddEntry}>Add Entry</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Data</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.month}</td>
                  <td className="positive">${row.income_total.toLocaleString()}</td>
                  <td className="negative">${Math.abs(row.expense_total).toLocaleString()}</td>
                  <td className={row.net >= 0 ? 'positive' : 'negative'}>
                    ${row.net.toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>No data yet. Add entries to get started!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
