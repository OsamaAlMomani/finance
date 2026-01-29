import { useState } from 'react'
import { TrendingUp, PieChart, AlertTriangle, Activity } from 'lucide-react'
import '../styles/Settings.css'

/**
 * Insights - Reports, Forecasts, Risk Analysis, Scenarios
 * All computed from Timeline data - clicking drills into filtered Timeline
 */
export default function Insights() {
  const [activeView, setActiveView] = useState<'reports' | 'forecast' | 'risk' | 'scenarios'>('reports')

  return (
    <div className="section-container">
      <div className="section-header">
        <h1>Insights</h1>
        <p>Analyze your finances with reports, forecasts, and risk analysis</p>
      </div>

      <div className="insights-tabs">
        <button
          className={`tab ${activeView === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveView('reports')}
        >
          <PieChart size={18} />
          Reports
        </button>
        <button
          className={`tab ${activeView === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveView('forecast')}
        >
          <TrendingUp size={18} />
          Forecast
        </button>
        <button
          className={`tab ${activeView === 'risk' ? 'active' : ''}`}
          onClick={() => setActiveView('risk')}
        >
          <AlertTriangle size={18} />
          Risk Analysis
        </button>
        <button
          className={`tab ${activeView === 'scenarios' ? 'active' : ''}`}
          onClick={() => setActiveView('scenarios')}
        >
          <Activity size={18} />
          Scenarios
        </button>
      </div>

      <div className="insights-content">
        {activeView === 'reports' && (
          <div className="info-message">
            <h3>📊 Financial Reports</h3>
            <p>Visualizations of your spending, income, and savings computed from Timeline data.</p>
            <ul>
              <li>✓ Expense breakdown by category</li>
              <li>✓ Income distribution</li>
              <li>✓ Net worth over time</li>
              <li>✓ Spending trends</li>
            </ul>
            <p><strong>Click any chart slice</strong> to view those transactions in the Timeline.</p>
          </div>
        )}

        {activeView === 'forecast' && (
          <div className="info-message">
            <h3>🔮 Forecast vs Actual</h3>
            <p>Compare your planned budgets against actual spending from the Timeline.</p>
            <ul>
              <li>✓ Budget vs actual comparisons</li>
              <li>✓ Future projections based on history</li>
              <li>✓ Burn rate and runway estimates</li>
            </ul>
          </div>
        )}

        {activeView === 'risk' && (
          <div className="info-message">
            <h3>⚠️ Risk Analysis</h3>
            <p>Understand your financial risk level based on Timeline data.</p>
            <ul>
              <li>✓ Emergency fund adequacy</li>
              <li>✓ Spending volatility</li>
              <li>✓ Income stability</li>
              <li>✓ Debt-to-income ratio</li>
            </ul>
          </div>
        )}

        {activeView === 'scenarios' && (
          <div className="info-message">
            <h3>🎲 Scenario Planning</h3>
            <p>Simulate different financial futures (Plan A / B / C).</p>
            <ul>
              <li>✓ "What if" analyses</li>
              <li>✓ Compare different spending/saving strategies</li>
              <li>✓ Test major financial decisions</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
