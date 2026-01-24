import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface ExpenseCategory {
  category: string
  amount: number
  recurring: boolean
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA15E', '#BC6C25', '#9D84B7']

const DEFAULT_CATEGORIES = ['Housing', 'Food', 'Transportation', 'Utilities', 'Entertainment', 'Healthcare', 'Education', 'Other']

export default function ExpenseBreakdown() {
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([
    { category: 'Housing', amount: 1500, recurring: true },
    { category: 'Food', amount: 600, recurring: true },
    { category: 'Transportation', amount: 400, recurring: true },
    { category: 'Utilities', amount: 200, recurring: true },
    { category: 'Entertainment', amount: 300, recurring: false },
    { category: 'Healthcare', amount: 150, recurring: false },
  ])

  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)

  const addExpense = () => {
    if (!newCategory || !newAmount) return

    const amount = parseFloat(newAmount)
    const newExpense: ExpenseCategory = {
      category: newCategory,
      amount,
      recurring: isRecurring,
    }

    setExpenses([...expenses, newExpense])
    setNewCategory('')
    setNewAmount('')
  }

  const deleteExpense = (idx: number) => {
    setExpenses(expenses.filter((_, i) => i !== idx))
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const recurringExpenses = expenses.filter(e => e.recurring).reduce((sum, e) => sum + e.amount, 0)
  const oneTimeExpenses = totalExpenses - recurringExpenses

  const chartData = expenses.map(e => ({
    name: e.category,
    value: e.amount,
  }))

  return (
    <div className="tool-container">
      <h2>📋 Expense Breakdown by Category</h2>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">${totalExpenses.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Recurring Expenses</div>
          <div className="stat-value">${recurringExpenses.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">One-Time Expenses</div>
          <div className="stat-value">${oneTimeExpenses.toLocaleString()}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Expense Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Add Expense</h3>
        <div className="form-group">
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            <option value="">Select Category</option>
            {DEFAULT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recurring
          </label>
          <button onClick={addExpense}>Add Expense</button>
        </div>
      </div>

      <div className="data-table">
        <h3>Expenses</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense, idx) => (
              <tr key={idx}>
                <td>{expense.category}</td>
                <td className="negative">${expense.amount.toLocaleString()}</td>
                <td>{expense.recurring ? 'Recurring' : 'One-Time'}</td>
                <td>
                  <button className="delete-btn" onClick={() => deleteExpense(idx)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
