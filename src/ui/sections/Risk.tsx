import { useMemo, useState } from 'react'
import { useTransactions } from '../hooks/useFinanceData'
import '../styles/Risk.css'

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))
  return sorted[idx]
}

export default function Risk() {
  const { transactions, loading, error } = useTransactions()
  const [shockPct, setShockPct] = useState(-10) // negative means expenses up / income down

  const metrics = useMemo(() => {
    const dailyMap = new Map<string, number>()
    let balance = 0

    transactions.forEach(tx => {
      const day = tx.date
      const net = tx.type === 'income' ? tx.amount : -Math.abs(tx.amount)
      balance += net
      dailyMap.set(day, (dailyMap.get(day) || 0) + net)
    })

    const dailyNet = Array.from(dailyMap.values())
    const var30 = -percentile(dailyNet, 0.05) // very rough 5th percentile

    const monthlyExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const monthsObserved = Math.max(1, new Set(transactions.map(t => t.date.slice(0, 7))).size)
    const avgMonthlyBurn = monthlyExpense / monthsObserved
    const runwayMonths = avgMonthlyBurn > 0 ? balance / avgMonthlyBurn : Infinity

    // Very rough probability of hitting zero in 180 days using daily volatility
    const dailyStd = (() => {
      if (dailyNet.length < 2) return 0
      const mean = dailyNet.reduce((s, v) => s + v, 0) / dailyNet.length
      const variance = dailyNet.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (dailyNet.length - 1)
      return Math.sqrt(variance)
    })()
    const probZero180 = balance <= 0 ? 1 : Math.min(1, Math.max(0, (dailyStd === 0 ? 0 : (dailyStd * Math.sqrt(180)) / (balance + 1))))

    return { balance, var30, avgMonthlyBurn, runwayMonths, probZero180 }
  }, [transactions])

  const scenario = useMemo(() => {
    const shock = shockPct / 100
    const shockedIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount * (1 + shock), 0)
    const shockedExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + Math.abs(t.amount) * (1 - shock), 0)
    const shockedNet = shockedIncome - shockedExpense
    return { shockedIncome, shockedExpense, shockedNet }
  }, [transactions, shockPct])

  const positions = useMemo(() => ([
    { name: 'Checking', balance: metrics.balance * 0.6, vol: 'Low', shocked: metrics.balance * 0.6 + scenario.shockedNet * 0.1 },
    { name: 'Savings', balance: metrics.balance * 0.3, vol: 'Low', shocked: metrics.balance * 0.3 + scenario.shockedNet * 0.05 },
    { name: 'Cards', balance: -metrics.balance * 0.1, vol: 'Medium', shocked: -metrics.balance * 0.1 - scenario.shockedNet * 0.05 }
  ]), [metrics.balance, scenario.shockedNet])

  if (loading) return <div className="section-page"><p>Loading risk data...</p></div>
  if (error) return <div className="section-page"><p className="error">{error}</p></div>

  return (
    <div className="section-page risk-page">
      <div className="risk-header">
        <div>
          <p className="eyebrow">Risk & Resilience</p>
          <h1>Risk Dashboard</h1>
          <p className="subtext">Cashflow-at-risk, runway, and probability of running out.</p>
        </div>
      </div>

      <div className="grid summary-grid">
        <div className="card">
          <p className="label">Balance</p>
          <h3>{metrics.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          <p className="muted">Current net cash</p>
        </div>
        <div className="card">
          <p className="label">30d Cashflow VaR (p5)</p>
          <h3 className="negative">-{Math.abs(metrics.var30).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          <p className="muted">Worst 5% daily outcome</p>
        </div>
        <div className="card">
          <p className="label">Runway</p>
          <h3>{Number.isFinite(metrics.runwayMonths) ? metrics.runwayMonths.toFixed(1) + ' mo' : '∞'}</h3>
          <p className="muted">At current burn</p>
        </div>
        <div className="card">
          <p className="label">Prob. hit zero (180d)</p>
          <h3>{(metrics.probZero180 * 100).toFixed(1)}%</h3>
          <p className="muted">Rough volatility estimate</p>
        </div>
      </div>

      <div className="grid dual">
        <div className="card">
          <div className="card-header">
            <div>
              <p className="label">Stress Scenario</p>
              <h4>Shock income/expense</h4>
            </div>
            <input
              type="range"
              min={-30}
              max={20}
              value={shockPct}
              onChange={e => setShockPct(parseInt(e.target.value, 10))}
            />
          </div>
          <p className="muted">Apply % shock to income (down) and expenses (up). Value shown: {shockPct}%.</p>
          <div className="grid trio">
            <div>
              <p className="label">Shocked Income</p>
              <h4>{scenario.shockedIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
            </div>
            <div>
              <p className="label">Shocked Expenses</p>
              <h4 className="negative">-{scenario.shockedExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
            </div>
            <div>
              <p className="label">Shocked Net</p>
              <h4 className={scenario.shockedNet >= 0 ? 'positive' : 'negative'}>{scenario.shockedNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="label">Probability of Zero (sim)</p>
          <div className="chart-placeholder">
            <span>Curve: P(balance ≤ 0) over 180 days (placeholder)</span>
          </div>
          <p className="muted">Add Monte Carlo later; currently rough volatility proxy.</p>
        </div>
      </div>

      <div className="card">
        <p className="label">Cashflow-at-Risk Timeline</p>
        <div className="chart-placeholder large">
          <span>p10 / p50 / p90 band placeholder</span>
        </div>
        <p className="muted">Hook to forecast service when ready.</p>
      </div>

      <div className="card">
        <p className="label">Positions</p>
        <div className="table">
          <div className="table-head">
            <span>Account</span>
            <span>Balance</span>
            <span>Vol</span>
            <span>Shocked</span>
          </div>
          {positions.map((p, idx) => (
            <div className="table-row" key={idx}>
              <span>{p.name}</span>
              <span>{p.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>{p.vol}</span>
              <span>{p.shocked.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
