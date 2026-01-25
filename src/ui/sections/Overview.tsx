import { useTransactions } from '../hooks/useFinanceData'
import { TrendingDown, TrendingUp, AlertCircle, Plus } from 'lucide-react'
import '../styles/Overview.css'

export default function Overview() {
  const { transactions, loading } = useTransactions()

  // Calculate metrics
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const thisMonthTransactions = transactions.filter(
    t => t.date.startsWith(currentMonth)
  )

  const income = thisMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const expenses = thisMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const net = income - expenses

  // Current balance (sum of all income - all expenses)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const balance = totalIncome - totalExpenses

  // Calculate monthly burn rate
  const last3Months = transactions.filter(t => {
    const tDate = new Date(t.date)
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    return tDate >= threeMonthsAgo
  })

  const monthlyExpenses: { [key: string]: number } = {}
  last3Months.forEach(t => {
    if (t.type === 'expense') {
      const monthKey = t.date.slice(0, 7)
      monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + Math.abs(t.amount)
    }
  })

  const avgMonthlyExpense = Object.values(monthlyExpenses).length > 0
    ? Object.values(monthlyExpenses).reduce((a, b) => a + b, 0) / Object.values(monthlyExpenses).length
    : 0

  const runway = avgMonthlyExpense > 0 ? Math.round(balance / avgMonthlyExpense * 10) / 10 : Infinity

  // Top spending category
  const categoryExpenses: { [key: string]: number } = {}
  thisMonthTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const category = t.category || 'Uncategorized'
      categoryExpenses[category] = (categoryExpenses[category] || 0) + Math.abs(t.amount)
    })

  const topCategory = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="overview">
      <h1>Overview</h1>
      
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid">
            {/* Balance Card */}
            <div className="kpi-card balance-card">
              <div className="kpi-header">
                <h3>Current Balance</h3>
              </div>
              <div className="kpi-value">
                {Math.round(balance * 100) / 100} JOD
              </div>
              <div className="kpi-label">Total account balance</div>
            </div>

            {/* This Month Card */}
            <div className="kpi-card month-card">
              <div className="kpi-header">
                <h3>This Month</h3>
              </div>
              <div className="kpi-breakdown">
                <div className="breakdown-item income">
                  <span className="label">Income</span>
                  <span className="value">+{Math.round(income * 100) / 100}</span>
                </div>
                <div className="breakdown-item expense">
                  <span className="label">Expenses</span>
                  <span className="value">−{Math.round(expenses * 100) / 100}</span>
                </div>
                <div className="breakdown-item net">
                  <span className="label">Net</span>
                  <span className={`value ${net >= 0 ? 'positive' : 'negative'}`}>
                    {net >= 0 ? '+' : '−'}{Math.round(Math.abs(net) * 100) / 100}
                  </span>
                </div>
              </div>
            </div>

            {/* Runway Card */}
            <div className="kpi-card runway-card">
              <div className="kpi-header">
                <h3>Runway</h3>
              </div>
              <div className="kpi-value">
                {isFinite(runway) ? `${runway} months` : '∞'}
              </div>
              <div className="kpi-label">
                Based on {Math.round(avgMonthlyExpense * 100) / 100} JOD avg/month
              </div>
              <div className={`runway-status ${runway < 3 ? 'critical' : runway < 6 ? 'warning' : 'safe'}`}>
                {runway < 3 ? '🚨 Critical' : runway < 6 ? '⚠️ Warning' : '✓ Safe'}
              </div>
            </div>

            {/* Top Category */}
            <div className="kpi-card category-card">
              <div className="kpi-header">
                <h3>Top Category</h3>
              </div>
              {topCategory ? (
                <>
                  <div className="kpi-value">{topCategory[0]}</div>
                  <div className="kpi-label">
                    {Math.round(topCategory[1] * 100) / 100} JOD this month
                  </div>
                </>
              ) : (
                <div className="kpi-label">No expenses yet</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <button className="action-btn income-btn">
                <TrendingUp size={20} />
                <span>Add Income</span>
              </button>
              <button className="action-btn expense-btn">
                <TrendingDown size={20} />
                <span>Add Expense</span>
              </button>
              <button className="action-btn plan-btn">
                <Plus size={20} />
                <span>Add Plan Item</span>
              </button>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="recent-section">
            <h2>Recent Transactions</h2>
            {transactions.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={48} />
                <h3>No transactions yet</h3>
                <p>Start by adding your first income or expense</p>
              </div>
            ) : (
              <div className="recent-list">
                {transactions.slice(0, 10).map(t => (
                  <div key={t.id} className="recent-item">
                    <div className="recent-info">
                      <div className="recent-desc">{t.description}</div>
                      <div className="recent-date">{t.date}</div>
                    </div>
                    <div className={`recent-amount ${t.type}`}>
                      {t.type === 'income' ? '+' : '−'}{Math.round(t.amount * 100) / 100}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
