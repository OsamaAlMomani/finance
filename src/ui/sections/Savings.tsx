import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Savings.css'

const STORAGE_KEY = 'finance:savings:deposit'
const HISTORY_KEY = 'finance:savings:history'
const RATES_KEY = 'finance:savings:rates'
const ACCOUNTS_KEY = 'finance:cashflow:accounts'

const formatAmount = (value: number) => Math.round(value * 100) / 100

type HistoryEntry = {
  id: string
  amount: number
  date: string
}

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

export default function Savings() {
  const navigate = useNavigate()
  const [deposit, setDeposit] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [entryType, setEntryType] = useState<'add' | 'withdraw'>('add')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editType, setEditType] = useState<'add' | 'withdraw'>('add')
  const [historyEditing, setHistoryEditing] = useState(false)
  const [convertAmount, setConvertAmount] = useState('')
  const [usdRate, setUsdRate] = useState('0.701')
  const [eurRate, setEurRate] = useState('1.18')
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [transferAccountId, setTransferAccountId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferError, setTransferError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = Number(stored)
      if (!Number.isNaN(parsed)) {
        setDeposit(parsed)
      }
    }

    const storedHistory = localStorage.getItem(HISTORY_KEY)
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory) as HistoryEntry[]
        if (Array.isArray(parsedHistory)) {
          setHistory(parsedHistory)
        }
      } catch {
        setHistory([])
      }
    }

    const storedRates = localStorage.getItem(RATES_KEY)
    if (storedRates) {
      try {
        const parsedRates = JSON.parse(storedRates) as { usd: string; eur: string }
        if (parsedRates?.usd) setUsdRate(parsedRates.usd)
        if (parsedRates?.eur) setEurRate(parsedRates.eur)
      } catch {
        // keep defaults
      }
    }

    const storedAccounts = localStorage.getItem(ACCOUNTS_KEY)
    if (storedAccounts) {
      try {
        const parsedAccounts = JSON.parse(storedAccounts) as SavingsAccount[]
        if (Array.isArray(parsedAccounts)) {
          setAccounts(parsedAccounts)
          if (!transferAccountId && parsedAccounts.length > 0) {
            setTransferAccountId(parsedAccounts[0].id)
          }
        }
      } catch {
        setAccounts([])
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  }, [accounts])

  const handleSave = () => {
    const parsed = Number(inputValue)
    if (Number.isNaN(parsed) || parsed <= 0) {
      setSaved(false)
      setError('Enter a valid amount.')
      return
    }

    const signedAmount = entryType === 'withdraw' ? -parsed : parsed
    const updatedTotal = deposit + signedAmount
    if (updatedTotal < 0) {
      setSaved(false)
      setError('Withdrawal exceeds current deposit.')
      return
    }

    const entry: HistoryEntry = {
      id: createId(),
      amount: signedAmount,
      date: new Date().toISOString()
    }

    setError('')
    setDeposit(updatedTotal)
    setHistory(prev => {
      const next = [entry, ...prev]
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
    localStorage.setItem(STORAGE_KEY, updatedTotal.toString())
    setInputValue('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const startEdit = (entry: HistoryEntry) => {
    setEditingId(entry.id)
    setEditType(entry.amount < 0 ? 'withdraw' : 'add')
    setEditValue(Math.abs(entry.amount).toString())
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = (entry: HistoryEntry) => {
    const parsed = Number(editValue)
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount.')
      return
    }

    const newSignedAmount = editType === 'withdraw' ? -parsed : parsed
    const diff = newSignedAmount - entry.amount
    const updatedTotal = deposit + diff
    if (updatedTotal < 0) {
      setError('Edit would make deposit negative.')
      return
    }

    const updatedHistory = history.map(item =>
      item.id === entry.id ? { ...item, amount: newSignedAmount } : item
    )

    setDeposit(updatedTotal)
    setHistory(updatedHistory)
    localStorage.setItem(STORAGE_KEY, updatedTotal.toString())
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
    setEditingId(null)
    setEditValue('')
    setError('')
  }

  const deleteEntry = (entry: HistoryEntry) => {
    const updatedTotal = deposit - entry.amount
    if (updatedTotal < 0) {
      setError('Delete would make deposit negative.')
      return
    }

    const updatedHistory = history.filter(item => item.id !== entry.id)
    setDeposit(updatedTotal)
    setHistory(updatedHistory)
    localStorage.setItem(STORAGE_KEY, updatedTotal.toString())
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
    setError('')
  }

  const historyWithTotals = (() => {
    let runningTotal = deposit
    return history.map(entry => {
      const entryTotal = runningTotal
      runningTotal -= entry.amount
      return { ...entry, total: entryTotal }
    })
  })()

  const parsedConvertAmount = Number(convertAmount)
  const parsedUsdRate = Number(usdRate)
  const parsedEurRate = Number(eurRate)
  const usdValue = !Number.isNaN(parsedConvertAmount) && !Number.isNaN(parsedUsdRate)
    ? parsedConvertAmount * parsedUsdRate
    : 0
  const eurValue = !Number.isNaN(parsedConvertAmount) && !Number.isNaN(parsedEurRate)
    ? parsedConvertAmount * parsedEurRate
    : 0

  useEffect(() => {
    localStorage.setItem(RATES_KEY, JSON.stringify({ usd: usdRate, eur: eurRate }))
  }, [usdRate, eurRate])

  const totalMoney = deposit + accounts.reduce((sum, account) => sum + account.balance, 0)
  const spentMoney = history
    .filter(entry => entry.amount < 0)
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0)

  const handleTransfer = () => {
    const amount = Number(transferAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      setTransferError('Enter a valid transfer amount.')
      return
    }

    if (!transferAccountId) {
      setTransferError('Select a sub-account to transfer to.')
      return
    }

    if (deposit < amount) {
      setTransferError('Not enough in main savings to transfer.')
      return
    }

    setTransferError('')
    setDeposit(prev => prev - amount)
    setAccounts(prev => prev.map(account =>
      account.id === transferAccountId
        ? { ...account, balance: account.balance + amount }
        : account
    ))
    localStorage.setItem(STORAGE_KEY, (deposit - amount).toString())
    setTransferAmount('')
  }

  return (
    <div className="savings-page">
      <div className="savings-header">
        <h1>Savings</h1>
        <p>Track the manual value of your bank deposit.</p>
      </div>

      <div className="deposit-card">
        <div className="deposit-label">Saving Account</div>
        <div className="deposit-value">{formatAmount(deposit)} JOD</div>
      </div>

      <div className="mini-dashboard">
        <div className="mini-card">
          <div className="mini-label">Total Money</div>
          <div className="mini-value">{formatAmount(totalMoney)} JOD</div>
        </div>
        <div className="mini-card">
          <div className="mini-label">Spent Money</div>
          <div className="mini-value negative">{formatAmount(spentMoney)} JOD</div>
        </div>
      </div>

      <div className="accounts-panel">
        <div className="accounts-header">
          <h2>Sub-Accounts</h2>
          <button
            type="button"
            className="accounts-edit-btn"
            onClick={() => navigate('/savings/edit')}
          >
            Edit Layout
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="accounts-empty">No sub-accounts yet.</div>
        ) : (
          <div className="accounts-grid">
            {accounts.map(account => (
              <div key={account.id} className="account-tile">
                <div className="account-title">{account.name}</div>
                <div className="account-value">{formatAmount(account.balance)} JOD</div>
              </div>
            ))}
          </div>
        )}
        <div className="transfer-panel">
          <h3>Transfer from Saving Account</h3>
          <div className="transfer-row">
            <select
              value={transferAccountId}
              onChange={event => setTransferAccountId(event.target.value)}
            >
              <option value="">Select sub-account</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Transfer amount"
              value={transferAmount}
              onChange={event => setTransferAmount(event.target.value)}
            />
            <button type="button" onClick={handleTransfer}>Transfer</button>
          </div>
          {transferError && <div className="save-error">{transferError}</div>}
        </div>
      </div>

      <div className="savings-form">
        <label htmlFor="deposit-input">Update deposit</label>
        <div className="deposit-toggle">
          <button
            type="button"
            className={`toggle-btn ${entryType === 'add' ? 'active' : ''}`}
            onClick={() => setEntryType('add')}
          >
            Add
          </button>
          <button
            type="button"
            className={`toggle-btn ${entryType === 'withdraw' ? 'active' : ''}`}
            onClick={() => setEntryType('withdraw')}
          >
            Remove
          </button>
        </div>
        <div className="input-row">
          <input
            id="deposit-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
          />
          <button type="button" onClick={handleSave}>Save</button>
        </div>
        {error && <div className="save-error">{error}</div>}
        {saved && <div className="save-status">Saved</div>}
      </div>

      <div className="savings-history">
        <div className="history-header">
          <h2>Deposit History</h2>
          <button
            type="button"
            className={`history-edit-btn ${historyEditing ? 'active' : ''}`}
            onClick={() => setHistoryEditing(prev => !prev)}
          >
            Edit History
          </button>
        </div>
        {history.length === 0 ? (
          <div className="history-empty">No deposits yet.</div>
        ) : (
          <div className="history-list">
            {historyWithTotals.map(entry => (
              <div key={entry.id} className="history-item">
                {editingId === entry.id ? (
                  <div className="history-edit">
                    <div className="edit-controls">
                      <select
                        value={editType}
                        onChange={event => setEditType(event.target.value as 'add' | 'withdraw')}
                      >
                        <option value="add">Add</option>
                        <option value="withdraw">Remove</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValue}
                        onChange={event => setEditValue(event.target.value)}
                      />
                    </div>
                    <div className="edit-actions">
                      <button type="button" onClick={() => saveEdit(entry)}>Save</button>
                      <button type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="history-main">
                      <span className={`history-amount ${entry.amount < 0 ? 'negative' : 'positive'}`}>
                        {entry.amount < 0 ? '−' : '+'}{formatAmount(Math.abs(entry.amount))} JOD
                      </span>
                      <span className="history-total">Total: {formatAmount(entry.total)} JOD</span>
                    </div>
                    <div className="history-date">
                      {new Date(entry.date).toLocaleString()}
                    </div>
                    {historyEditing && (
                      <div className="history-actions">
                        <button type="button" onClick={() => startEdit(entry)}>Edit</button>
                        <button type="button" onClick={() => deleteEntry(entry)}>Delete</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="conversion-card">
        <h2>Money Conversion</h2>
        <div className="conversion-grid">
          <div className="conversion-input">
            <label htmlFor="conversion-jod">JOD Amount</label>
            <input
              id="conversion-jod"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={convertAmount}
              onChange={event => setConvertAmount(event.target.value)}
            />
          </div>
          <div className="conversion-input">
            <label htmlFor="usd-rate">USD Rate</label>
            <input
              id="usd-rate"
              type="number"
              min="0"
              step="0.0001"
              value={usdRate}
              onChange={event => setUsdRate(event.target.value)}
            />
          </div>
          <div className="conversion-input">
            <label htmlFor="eur-rate">EUR Rate</label>
            <input
              id="eur-rate"
              type="number"
              min="0"
              step="0.0001"
              value={eurRate}
              onChange={event => setEurRate(event.target.value)}
            />
          </div>
        </div>
        <div className="conversion-results">
          <div className="conversion-result">
            <span className="label">USD</span>
            <span className="value">{formatAmount(usdValue)} USD</span>
          </div>
          <div className="conversion-result">
            <span className="label">EUR</span>
            <span className="value">{formatAmount(eurValue)} EUR</span>
          </div>
        </div>
      </div>
    </div>
  )
}
