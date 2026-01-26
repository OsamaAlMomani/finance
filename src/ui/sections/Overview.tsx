import { useTransactions } from '../hooks/useFinanceData'
import { TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import '../styles/Overview.css'

const formatAmount = (value: number) => Math.round(value * 100) / 100

export default function Overview() {
  const { transactions, loading } = useTransactions()

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const totalNet = totalIncome - totalExpenses

  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setDate(now.getDate() - 13)

  const expensesLast14 = transactions.filter(t => {
    if (t.type !== 'expense') return false
    const date = new Date(t.date)
    return !Number.isNaN(date.getTime()) && date >= windowStart && date <= now
  })

  const dailyTotals: Record<string, number> = {}
  expensesLast14.forEach(t => {
    const key = t.date.slice(0, 10)
    dailyTotals[key] = (dailyTotals[key] || 0) + Math.abs(t.amount)
  })

  const totalDailyFees = expensesLast14.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const avgPerDay = totalDailyFees / 14

  const worstDayEntry = Object.entries(dailyTotals).sort((a, b) => b[1] - a[1])[0]

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - index)
    const key = date.toISOString().split('T')[0]
    return {
      date: key,
      amount: dailyTotals[key] || 0
    }
  })

  const monthsToAnalyze = 6
  const monthKeys = Array.from({ length: monthsToAnalyze }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    return date.toISOString().slice(0, 7)
  })

  const monthlyTotals = monthKeys.reduce((acc, key) => {
    acc[key] = { income: 0, expense: 0, count: 0 }
    return acc
  }, {} as Record<string, { income: number; expense: number; count: number }>)

  transactions.forEach(t => {
    const monthKey = t.date.slice(0, 7)
    if (!monthlyTotals[monthKey]) return
    monthlyTotals[monthKey].count += 1
    if (t.type === 'income') {
      monthlyTotals[monthKey].income += t.amount
    } else {
      monthlyTotals[monthKey].expense += Math.abs(t.amount)
    }
  })

  const monthlyNetValues = monthKeys
    .filter(key => monthlyTotals[key].count > 0)
    .map(key => monthlyTotals[key].income - monthlyTotals[key].expense)

  const avgMonthlyNet = monthlyNetValues.length > 0
    ? monthlyNetValues.reduce((sum, value) => sum + value, 0) / monthlyNetValues.length
    : 0

  const projection3 = totalNet + avgMonthlyNet * 3
  const projection6 = totalNet + avgMonthlyNet * 6
  const projection12 = totalNet + avgMonthlyNet * 12

  const openQuickAdd = (type: 'income' | 'expense') => {
    window.dispatchEvent(
      new CustomEvent('finance:quickAdd', { detail: { type } })
    )
  }

  return (
    <div className="overview">
      <h1>Overview</h1>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="totals-strip">
            <div className="total-card income-card">
              <div className="total-label">Total Income</div>
              <div className="total-value">+{formatAmount(totalIncome)} JOD</div>
            </div>
            <div className="total-card expense-card">
              <div className="total-label">Total Expenses</div>
              <div className="total-value">−{formatAmount(totalExpenses)} JOD</div>
            </div>
            <div className="total-card net-card">
              <div className="total-label">Total Savings / Net</div>
              <div className={`total-value ${totalNet >= 0 ? 'positive' : 'negative'}`}>
                {totalNet >= 0 ? '+' : '−'}{formatAmount(Math.abs(totalNet))} JOD
              </div>
            </div>
          </div>

          <div className="command-grid">
            <div className="panel-card actions-card">
              <h2>Quick Actions</h2>
              <div className="action-buttons">
                <button
                  className="action-btn income-btn"
                  onClick={() => openQuickAdd('income')}
                >
                  <TrendingUp size={20} />
                  <span>Add Income</span>
                </button>
                <button
                  className="action-btn expense-btn"
                  onClick={() => openQuickAdd('expense')}
                >
                  <TrendingDown size={20} />
                  <span>Add Expense</span>
                </button>
              </div>
              <div className="actions-hint">
                One-click add now opens the modal with the correct type selected.
              </div>
            </div>

            <div className="panel-card daily-fees-card">
              <h2>Daily Fees (Last 14 Days)</h2>
              {expensesLast14.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle size={32} />
                  <h3>No expenses recorded</h3>
                  <p>Start tracking daily fees to see your trends here.</p>
                </div>
              ) : (
                <>
                  <div className="daily-summary">
                    <div className="summary-item">
                      <span className="label">Total</span>
                      <span className="value">{formatAmount(totalDailyFees)} JOD</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Avg / Day</span>
                      <span className="value">{formatAmount(avgPerDay)} JOD</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Worst Day</span>
                      <span className="value">
                        {worstDayEntry ? `${worstDayEntry[0]} — ${formatAmount(worstDayEntry[1])} JOD` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="daily-list">
                    {last7Days.map(day => (
                      <div key={day.date} className="daily-item">
                        <span className="daily-date">{day.date}</span>
                        <span className={`daily-amount ${day.amount > 0 ? 'negative' : ''}`}>
                          {day.amount > 0 ? `−${formatAmount(day.amount)}` : '0'} JOD
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="panel-card projection-card">
              <h2>Future Snapshot</h2>
              <div className="projection-grid">
                <div className="projection-item">
                  <span className="label">3 Months</span>
                  <span className={`value ${projection3 >= 0 ? 'positive' : 'negative'}`}>
                    {projection3 >= 0 ? '+' : '−'}{formatAmount(Math.abs(projection3))} JOD
                  </span>
                </div>
                <div className="projection-item">
                  <span className="label">6 Months</span>
                  <span className={`value ${projection6 >= 0 ? 'positive' : 'negative'}`}>
                    {projection6 >= 0 ? '+' : '−'}{formatAmount(Math.abs(projection6))} JOD
                  </span>
                </div>
                <div className="projection-item">
                  <span className="label">12 Months</span>
                  <span className={`value ${projection12 >= 0 ? 'positive' : 'negative'}`}>
                    {projection12 >= 0 ? '+' : '−'}{formatAmount(Math.abs(projection12))} JOD
                  </span>
                </div>
              </div>
              <div className="projection-meta">
                Average monthly net (last {monthsToAnalyze} months): {formatAmount(avgMonthlyNet)} JOD
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
