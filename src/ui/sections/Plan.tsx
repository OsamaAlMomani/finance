import { useState } from 'react'
import { Target, DollarSign, Calendar } from 'lucide-react'
import '../styles/Settings.css'

/**
 * Plan - Budgets, Bills, and Goals
 * Everything here creates/updates events in the Timeline
 */
export default function Plan() {
  const [activeTab, setActiveTab] = useState<'budgets' | 'bills' | 'goals'>('budgets')

  return (
    <div className="section-container">
      <div className="section-header">
        <h1>Plan</h1>
        <p>Manage your budgets, bills, and financial goals</p>
      </div>

      <div className="plan-tabs">
        <button
          className={`tab ${activeTab === 'budgets' ? 'active' : ''}`}
          onClick={() => setActiveTab('budgets')}
        >
          <DollarSign size={18} />
          Budgets
        </button>
        <button
          className={`tab ${activeTab === 'bills' ? 'active' : ''}`}
          onClick={() => setActiveTab('bills')}
        >
          <Calendar size={18} />
          Bills & Reminders
        </button>
        <button
          className={`tab ${activeTab === 'goals' ? 'active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          <Target size={18} />
          Goals
        </button>
      </div>

      <div className="plan-content">
        {activeTab === 'budgets' && (
          <div className="info-message">
            <h3>💰 Budgets</h3>
            <p>Set spending limits for different categories. Budgets will track against your transactions in the Timeline.</p>
          </div>
        )}

        {activeTab === 'bills' && (
          <div className="info-message">
            <h3>📅 Bills & Reminders</h3>
            <p>Scheduled expenses that appear in your Timeline. When you pay a bill, it creates a transaction.</p>
            <ul>
              <li>✓ Set recurring bills (rent, subscriptions, etc.)</li>
              <li>✓ Get reminders before due dates</li>
              <li>✓ Mark as paid → creates transaction in Timeline</li>
            </ul>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="info-message">
            <h3>🎯 Financial Goals</h3>
            <p>Track savings targets and progress. Contributions can automatically create transactions.</p>
            <ul>
              <li>✓ Set target amount and deadline</li>
              <li>✓ Track progress over time</li>
              <li>✓ Contributions can create Timeline events</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
