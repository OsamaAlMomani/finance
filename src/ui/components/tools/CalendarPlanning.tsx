import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  recurring: 'once' | 'weekly' | 'monthly' | 'yearly'
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPlanning() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 0, 1))
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', date: '2024-01-01', description: 'Salary', amount: 4000, type: 'income', recurring: 'monthly' },
    { id: '2', date: '2024-01-05', description: 'Rent', amount: -1500, type: 'expense', recurring: 'monthly' },
    { id: '3', date: '2024-01-10', description: 'Gym', amount: -50, type: 'expense', recurring: 'weekly' },
    { id: '4', date: '2024-01-15', description: 'Freelance', amount: 800, type: 'income', recurring: 'once' },
  ])

  const [newDesc, setNewDesc] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newType, setNewType] = useState<'income' | 'expense'>('expense')
  const [newRecurring, setNewRecurring] = useState<'once' | 'weekly' | 'monthly' | 'yearly'>('once')
  const [newDate, setNewDate] = useState('')

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getTransactionsForDate = (day: number) => {
    const dateStr = `2024-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return transactions.filter(t => t.date.includes(dateStr) || 
      (t.recurring === 'weekly' && new Date(dateStr).getDay() === new Date(t.date).getDay()) ||
      (t.recurring === 'monthly' && dateStr.slice(-2) === t.date.slice(-2)))
  }

  const addTransaction = () => {
    if (!newDesc || !newAmount || !newDate) return

    const transaction: Transaction = {
      id: Date.now().toString(),
      date: newDate,
      description: newDesc,
      amount: newType === 'income' ? parseFloat(newAmount) : -parseFloat(newAmount),
      type: newType,
      recurring: newRecurring,
    }

    setTransactions([...transactions, transaction])
    setNewDesc('')
    setNewAmount('')
    setNewDate('')
  }

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id))
  }

  const monthTotal = (type: 'income' | 'expense') => {
    const daysInMonth = getDaysInMonth(currentDate)
    let total = 0

    for (let day = 1; day <= daysInMonth; day++) {
      const dayTxns = getTransactionsForDate(day)
      dayTxns.forEach(t => {
        if ((type === 'income' && t.amount > 0) || (type === 'expense' && t.amount < 0)) {
          total += Math.abs(t.amount)
        }
      })
    }

    return total
  }

  const monthIncome = monthTotal('income')
  const monthExpense = monthTotal('expense')
  const monthNet = monthIncome - monthExpense

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const calendarDays = []

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="tool-container">
      <h2>📅 Calendar Planning</h2>

      <div className="tool-stats">
        <div className="stat-card positive">
          <div className="stat-label">Month Income</div>
          <div className="stat-value">${monthIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card negative">
          <div className="stat-label">Month Expenses</div>
          <div className="stat-value">${monthExpense.toLocaleString()}</div>
        </div>
        <div className={`stat-card ${monthNet >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Net This Month</div>
          <div className="stat-value">${monthNet.toLocaleString()}</div>
        </div>
      </div>

      <div className="calendar-section">
        <div className="calendar-header">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>
            <ChevronLeft size={20} />
          </button>
          <h3>{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="calendar-weekdays">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day, idx) => (
            <div key={idx} className={`calendar-day ${day ? 'has-day' : 'empty'}`}>
              {day && (
                <>
                  <div className="day-number">{day}</div>
                  <div className="day-transactions">
                    {getTransactionsForDate(day).map(t => (
                      <div
                        key={t.id}
                        className={`transaction-badge ${t.amount > 0 ? 'income' : 'expense'}`}
                        title={t.description}
                      >
                        {t.amount > 0 ? '+' : ''}${Math.abs(t.amount)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="input-section">
        <h3>Add Transaction</h3>
        <div className="form-group">
          <input
            type="text"
            placeholder="Description (e.g., Salary, Rent)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as 'income' | 'expense')}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={newRecurring} onChange={(e) => setNewRecurring(e.target.value as any)}>
            <option value="once">One-Time</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button onClick={addTransaction}>Add Transaction</button>
        </div>
      </div>

      <div className="data-table">
        <h3>All Transactions</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Recurring</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>{t.type}</td>
                <td className={t.amount > 0 ? 'positive' : 'negative'}>
                  {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toLocaleString()}
                </td>
                <td>{t.recurring}</td>
                <td>
                  <button className="delete-btn" onClick={() => deleteTransaction(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
