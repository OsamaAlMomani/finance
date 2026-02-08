import { useTransactions, useAccounts } from '../hooks/useFinanceData'
import { 
  TrendingDown, 
  TrendingUp, 
  AlertCircle, 
  Wallet,
  PiggyBank,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Target,
  Clock
} from 'lucide-react'
import Card, { StatCard } from '../components/common/Card'
import AnimatedNumber, { CurrencyDisplay, TrendIndicator } from '../components/common/AnimatedNumber'
import '../styles/OverviewEnhanced.css'
import { useI18n } from '../contexts/useI18n'

/* ============================================
   FINANCE APP - ENHANCED OVERVIEW PAGE
   ============================================ */

const formatAmount = (value: number) => Math.round(value * 100) / 100

// Calculate percentage change
const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

// Get day name from date
const getDayName = (dateStr: string, locale: string, t: (key: string) => string): string => {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  
  if (dateStr === today.toISOString().split('T')[0]) return t('overview.today')
  if (dateStr === yesterday.toISOString().split('T')[0]) return t('overview.yesterday')
  
  return date.toLocaleDateString(locale, { weekday: 'short' })
}

const clampPercent = (value: number, step = 5): number => {
  const safe = Math.max(0, Math.min(100, value))
  return Math.round(safe / step) * step
}

const getBarHeightClass = (percentage: number): string => {
  const stepped = clampPercent(Math.max(percentage, 5))
  return `bar-height-${stepped}`
}

const getAverageLineClass = (percentage: number): string => {
  const stepped = clampPercent(percentage)
  return `avg-line-${stepped}`
}

export default function Overview() {
  const { t, language } = useI18n()
  const { transactions, loading: loadingTransactions } = useTransactions()
  const { accounts, loading: loadingAccounts } = useAccounts()
  
  const loading = loadingTransactions || loadingAccounts
  const locale = language === 'ar' ? 'ar-JO' : 'en-US'

  // Calculate totals (Net Worth from Accounts)
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance ?? 0), 0)

  // Get current month data
  const now = new Date()
  const currentMonthKey = now.toISOString().slice(0, 7)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = lastMonthDate.toISOString().slice(0, 7)

  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(currentMonthKey))
  const lastMonthTransactions = transactions.filter(t => t.date.startsWith(lastMonthKey))

  const currentMonthIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const currentMonthExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Calculate savings rate based on MONTHLY data
  const monthlyNet = currentMonthIncome - currentMonthExpenses
  const savingsRate = currentMonthIncome > 0 ? (monthlyNet / currentMonthIncome) * 100 : 0

  const lastMonthIncome = lastMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const lastMonthExpenses = lastMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Calculate month-over-month changes
  const incomeChange = calculateChange(currentMonthIncome, lastMonthIncome)
  const expenseChange = calculateChange(currentMonthExpenses, lastMonthExpenses)

  // Last 14 days analysis
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
  const maxDailyAmount = worstDayEntry ? worstDayEntry[1] : 0

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - index)
    const key = date.toISOString().split('T')[0]
    return {
      date: key,
      dayName: getDayName(key, locale, t),
      amount: dailyTotals[key] || 0,
      percentage: maxDailyAmount > 0 ? ((dailyTotals[key] || 0) / maxDailyAmount) * 100 : 0
    }
  }).reverse()

  // Monthly projections
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

  const projection3 = totalBalance + avgMonthlyNet * 3
  const projection6 = totalBalance + avgMonthlyNet * 6
  const projection12 = totalBalance + avgMonthlyNet * 12

  const openQuickAdd = (type: 'income' | 'expense') => {
    window.dispatchEvent(
      new CustomEvent('finance:quickAdd', { detail: { type } })
    )
  }

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = now.getHours()
    if (hour < 12) return t('overview.greeting.morning')
    if (hour < 18) return t('overview.greeting.afternoon')
    return t('overview.greeting.evening')
  }

  return (
    <div className="overview-enhanced">
      {/* Header */}
      <header className="overview-header">
        <div className="header-content">
          <h1 className="greeting">{getGreeting()}! 👋</h1>
          <p className="header-subtitle">{t('overview.summary')}</p>
        </div>
        <div className="header-date">
          <Calendar size={16} />
          <span>{now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('overview.loading')}</p>
        </div>
      ) : (
        <>
          {/* Main Stats Grid */}
          <section className="stats-grid">
            <StatCard
              icon={<Wallet size={24} />}
              label={t('overview.netWorth')}
              value={<CurrencyDisplay amount={totalBalance} currency="USD" type={totalBalance >= 0 ? 'income' : 'expense'} />}
              color="primary"
              variant="gradient"
            />
            
            <StatCard
              icon={<TrendingUp size={24} />}
              label={t('overview.monthlyIncome')}
              value={<CurrencyDisplay amount={currentMonthIncome} currency="USD" type="income" />}
              trend={incomeChange !== 0 ? { value: Math.abs(incomeChange), direction: incomeChange >= 0 ? 'up' : 'down' } : undefined}
              color="success"
              variant="glass"
            />
            
            <StatCard
              icon={<TrendingDown size={24} />}
              label={t('overview.monthlyExpenses')}
              value={<CurrencyDisplay amount={currentMonthExpenses} currency="USD" type="expense" />}
              trend={expenseChange !== 0 ? { value: Math.abs(expenseChange), direction: expenseChange >= 0 ? 'up' : 'down' } : undefined}
              color="danger"
              variant="glass"
            />
            
            <StatCard
              icon={<PiggyBank size={24} />}
              label={t('overview.savingsRate')}
              value={
                <span className={`savings-rate ${savingsRate >= 20 ? 'good' : savingsRate >= 10 ? 'moderate' : 'low'}`}>
                  <AnimatedNumber value={savingsRate} suffix="%" decimals={1} />
                </span>
              }
              color={savingsRate >= 20 ? 'success' : savingsRate >= 10 ? 'warning' : 'danger'}
              variant="glass"
            />
          </section>

          {/* Quick Actions */}
          <section className="quick-actions-section">
            <Card variant="glass" className="quick-actions-card">
              <div className="card-header-with-icon">
                <Sparkles size={20} />
                <h2>{t('overview.quickActions')}</h2>
              </div>
              <div className="action-buttons-grid">
                <button
                  className="action-btn income-action"
                  onClick={() => openQuickAdd('income')}
                >
                  <ArrowUpRight size={22} />
                  <span>{t('overview.addIncome')}</span>
                </button>
                <button
                  className="action-btn expense-action"
                  onClick={() => openQuickAdd('expense')}
                >
                  <ArrowDownRight size={22} />
                  <span>{t('overview.addExpense')}</span>
                </button>
              </div>
              <p className="action-hint">
                {t('overview.shortcuts')}
              </p>
            </Card>
          </section>

          {/* Two Column Layout */}
          <section className="overview-columns">
            {/* Daily Spending Chart */}
            <Card variant="elevated" className="daily-spending-card">
              <div className="card-header-with-icon">
                <Clock size={20} />
                <h2>{t('overview.dailySpending')}</h2>
              </div>
              
              {expensesLast14.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle size={40} className="empty-icon" />
                  <h3>{t('overview.noExpenses')}</h3>
                  <p>{t('overview.noExpensesHint')}</p>
                </div>
              ) : (
                <>
                  <div className="mini-stats-row">
                    <div className="mini-stat">
                      <span className="mini-label">{t('overview.total14Days')}</span>
                      <CurrencyDisplay amount={totalDailyFees} currency="JOD" type="expense" />
                    </div>
                    <div className="mini-stat">
                      <span className="mini-label">{t('overview.dailyAvg')}</span>
                      <CurrencyDisplay amount={avgPerDay} currency="JOD" type="neutral" />
                    </div>
                    <div className="mini-stat worst">
                      <span className="mini-label">{t('overview.worstDay')}</span>
                      <span className="worst-value">{worstDayEntry ? formatAmount(worstDayEntry[1]) : '0'} JOD</span>
                    </div>
                  </div>
                  
                  <div className="daily-bars-chart">
                    {last7Days.map(day => (
                      <div key={day.date} className="bar-item">
                        <div className="bar-wrapper">
                          <div 
                            className={`bar ${day.amount > avgPerDay ? 'over-average' : ''} ${getBarHeightClass(day.percentage)}`}
                          >
                            {day.amount > 0 && (
                              <span className="bar-value">{formatAmount(day.amount)}</span>
                            )}
                          </div>
                        </div>
                        <span className="bar-label">{day.dayName}</span>
                      </div>
                    ))}
                    <div className={`average-line ${getAverageLineClass((avgPerDay / maxDailyAmount) * 100)}`}>
                      <span>{t('overview.avg')}</span>
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* Projections */}
            <Card variant="gradient" color="primary" className="projections-card">
              <div className="card-header-with-icon">
                <Target size={20} />
                <h2>{t('overview.futureProjections')}</h2>
              </div>
              
              <div className="projection-list">
                <div className="projection-item">
                  <div className="projection-label">
                    <span className="timeframe">{t('overview.months3')}</span>
                    <span className="date-range">
                      {new Date(now.getFullYear(), now.getMonth() + 3, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className={`projection-value ${projection3 >= 0 ? 'positive' : 'negative'}`}>
                    <CurrencyDisplay amount={projection3} currency="JOD" type={projection3 >= 0 ? 'income' : 'expense'} showSign />
                  </div>
                </div>
                
                <div className="projection-item">
                  <div className="projection-label">
                    <span className="timeframe">{t('overview.months6')}</span>
                    <span className="date-range">
                      {new Date(now.getFullYear(), now.getMonth() + 6, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className={`projection-value ${projection6 >= 0 ? 'positive' : 'negative'}`}>
                    <CurrencyDisplay amount={projection6} currency="JOD" type={projection6 >= 0 ? 'income' : 'expense'} showSign />
                  </div>
                </div>
                
                <div className="projection-item highlight">
                  <div className="projection-label">
                    <span className="timeframe">{t('overview.months12')}</span>
                    <span className="date-range">
                      {new Date(now.getFullYear(), now.getMonth() + 12, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className={`projection-value ${projection12 >= 0 ? 'positive' : 'negative'}`}>
                    <CurrencyDisplay amount={projection12} currency="JOD" type={projection12 >= 0 ? 'income' : 'expense'} showSign />
                  </div>
                </div>
              </div>
              
              <div className="projection-footer">
                <TrendIndicator value={avgMonthlyNet} label={t('overview.monthlyAvgNet')} showArrow />
              </div>
            </Card>
          </section>

          {/* This Month Summary */}
          <section className="month-summary">
            <Card variant="outline" className="month-card">
              <h3>{t('overview.monthSummary')}</h3>
              <div className="month-stats">
                <div className="month-stat">
                  <span className="stat-label">{t('overview.income')}</span>
                  <CurrencyDisplay amount={currentMonthIncome} currency="JOD" type="income" />
                </div>
                <div className="month-stat">
                  <span className="stat-label">{t('overview.expenses')}</span>
                  <CurrencyDisplay amount={currentMonthExpenses} currency="JOD" type="expense" />
                </div>
                <div className="month-stat net">
                  <span className="stat-label">{t('overview.net')}</span>
                  <CurrencyDisplay 
                    amount={currentMonthIncome - currentMonthExpenses} 
                    currency="JOD" 
                    type={(currentMonthIncome - currentMonthExpenses) >= 0 ? 'income' : 'expense'} 
                    showSign 
                  />
                </div>
                <div className="month-stat transactions">
                  <span className="stat-label">{t('overview.transactions')}</span>
                  <AnimatedNumber value={currentMonthTransactions.length} />
                </div>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
