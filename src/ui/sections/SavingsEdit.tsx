import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/SavingsEdit.css'

const ACCOUNTS_KEY = 'finance:cashflow:accounts'
const MAIN_SAVINGS_KEY = 'finance:savings:deposit'

type SavingsAccount = {
  id: string
  name: string
  balance: number
}

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const formatAmount = (value: number) => Math.round(value * 100) / 100

export default function SavingsEdit() {
  const navigate = useNavigate()
  const [mainSavings, setMainSavings] = useState(0)
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const storedMain = localStorage.getItem(MAIN_SAVINGS_KEY)
    if (storedMain) {
      const parsed = Number(storedMain)
      if (!Number.isNaN(parsed)) {
        setMainSavings(parsed)
      }
    }

    const storedAccounts = localStorage.getItem(ACCOUNTS_KEY)
    if (storedAccounts) {
      try {
        const parsed = JSON.parse(storedAccounts) as SavingsAccount[]
        if (Array.isArray(parsed)) {
          setAccounts(parsed)
        }
      } catch {
        setAccounts([])
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  }, [accounts])

  const totalSubAccounts = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  )

  const addAccount = () => {
    const trimmed = name.trim()
    const parsed = Number(balance)
    if (!trimmed || Number.isNaN(parsed) || parsed < 0) {
      setError('Enter a valid account name and balance.')
      return
    }

    setAccounts(prev => [{ id: createId(), name: trimmed, balance: parsed }, ...prev])
    setName('')
    setBalance('')
    setError('')
  }

  const updateAccount = (id: string, updates: Partial<SavingsAccount>) => {
    setAccounts(prev => prev.map(account => account.id === id ? { ...account, ...updates } : account))
  }

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(account => account.id !== id))
  }

  const moveAccount = (id: string, direction: 'up' | 'down') => {
    const index = accounts.findIndex(account => account.id === id)
    if (index === -1) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= accounts.length) return
    const updated = [...accounts]
    const [item] = updated.splice(index, 1)
    updated.splice(nextIndex, 0, item)
    setAccounts(updated)
  }

  return (
    <div className="savings-edit-page">
      <div className="savings-edit-header">
        <div>
          <h1>Edit Savings Layout</h1>
          <p>Manage sub-accounts separately from your main savings.</p>
        </div>
        <button type="button" className="back-btn" onClick={() => navigate('/savings')}>
          Back to Savings
        </button>
      </div>

      <div className="edit-panels">
        <div className="edit-card">
          <h2>Main Savings (from Savings tab)</h2>
          <div className="main-saving-value">{formatAmount(mainSavings)} JOD</div>
          <p className="muted">This value is controlled from the Savings tab for security.</p>
        </div>

        <div className="edit-card">
          <h2>Sub-Accounts</h2>
          <div className="sub-summary">
            Total sub-accounts: {formatAmount(totalSubAccounts)} JOD
          </div>
          {accounts.length === 0 ? (
            <div className="empty-state">No sub-accounts yet.</div>
          ) : (
            <div className="edit-list">
              {accounts.map((account, index) => (
                <div key={account.id} className="edit-item">
                  <div className="edit-fields">
                    <input
                      type="text"
                      value={account.name}
                      onChange={event => updateAccount(account.id, { name: event.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={account.balance}
                      onChange={event => updateAccount(account.id, { balance: Number(event.target.value) || 0 })}
                    />
                  </div>
                  <div className="edit-actions">
                    <button type="button" onClick={() => moveAccount(account.id, 'up')} disabled={index === 0}>Up</button>
                    <button type="button" onClick={() => moveAccount(account.id, 'down')} disabled={index === accounts.length - 1}>Down</button>
                    <button type="button" onClick={() => deleteAccount(account.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="add-account">
            <input
              type="text"
              placeholder="Account name"
              value={name}
              onChange={event => setName(event.target.value)}
            />
            <input
              type="number"
              placeholder="Starting balance"
              value={balance}
              onChange={event => setBalance(event.target.value)}
            />
            <button type="button" onClick={addAccount}>Add Account</button>
          </div>
          {error && <div className="edit-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}
