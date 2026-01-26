import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTransactions } from '../../hooks/useFinanceData'
import { aggregateTransactionsByMonth } from '../../../utils/dataAggregation'

interface CashFlowData {
  month: string
  income_total: number
  expense_total: number
  net: number
}

interface SavingsAccount {
  id: string
  name: string
  balance: number
}

const ACCOUNTS_KEY = 'finance:cashflow:accounts'
const MAIN_SAVINGS_KEY = 'finance:savings:deposit'
const MAIN_ACCOUNT_ID = 'main-savings'
const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function CashFlowTimeline() {
  const { transactions, loading, error, addTransaction } = useTransactions()
  const [data, setData] = useState<CashFlowData[]>([])

  const [income, setIncome] = useState('')
  const [expense, setExpense] = useState('')
  const [month, setMonth] = useState('')
  const [mainSavings, setMainSavings] = useState(0)
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [accountName, setAccountName] = useState('')
  const [accountBalance, setAccountBalance] = useState('')
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [accountError, setAccountError] = useState('')

  useEffect(() => {
    const aggregated = aggregateTransactionsByMonth(transactions)
    setData(aggregated)
  }, [transactions])

  useEffect(() => {
    const storedMain = localStorage.getItem(MAIN_SAVINGS_KEY)
    if (storedMain) {
      const parsedMain = Number(storedMain)
      if (!Number.isNaN(parsedMain)) {
        setMainSavings(parsedMain)
      }
    }

    const stored = localStorage.getItem(ACCOUNTS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SavingsAccount[]
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(account => account.id !== MAIN_ACCOUNT_ID)
          setAccounts(filtered)
          if (!expenseAccountId) {
            setExpenseAccountId(MAIN_ACCOUNT_ID)
          }
          return
        }
      } catch {
        // ignore
      }
    }

    setAccounts([])
    setExpenseAccountId(MAIN_ACCOUNT_ID)
  }, [])

  useEffect(() => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  }, [accounts])

  useEffect(() => {
    localStorage.setItem(MAIN_SAVINGS_KEY, mainSavings.toString())
  }, [mainSavings])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MAIN_SAVINGS_KEY && event.newValue) {
        const parsed = Number(event.newValue)
        if (!Number.isNaN(parsed)) {
          setMainSavings(parsed)
        }
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const mainAccount: SavingsAccount = { id: MAIN_ACCOUNT_ID, name: 'Main Savings', balance: mainSavings }
  const allAccounts: SavingsAccount[] = [mainAccount, ...accounts]

  const totalSavings = allAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  const addAccount = () => {
    const name = accountName.trim()
    const balance = Number(accountBalance)
    if (!name || Number.isNaN(balance) || balance < 0) {
      setAccountError('Enter a valid account name and balance.')
      return
    }

    const next: SavingsAccount = { id: createId(), name, balance }
    setAccounts(prev => [next, ...prev])
    setAccountName('')
    setAccountBalance('')
    setAccountError('')
    if (!expenseAccountId) {
      setExpenseAccountId(next.id)
    }
  }

  const updateAccountBalance = (id: string, delta: number) => {
    if (id === MAIN_ACCOUNT_ID) {
      setMainSavings(prev => Math.max(0, prev + delta))
      return
    }

    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, balance: acc.balance + delta } : acc))
  }

  const handleAddEntry = async () => {
    if (!month || !income) return

    const incomeNum = parseFloat(income)
    const expenseNum = parseFloat(expense) || 0

    if (expenseNum > 0 && !expenseAccountId) {
      setAccountError('Select an account for expenses.')
      return
    }

    const selectedAccount = allAccounts.find(acc => acc.id === expenseAccountId)
    if (expenseNum > 0 && selectedAccount && selectedAccount.balance < expenseNum) {
      setAccountError('Selected account has insufficient balance.')
      return
    }

    try {
      setAccountError('')
      // Add income transaction
      if (incomeNum > 0) {
        await addTransaction({
          type: 'income',
          description: `Income - ${month}`,
          amount: incomeNum,
          date: new Date().toISOString(),
          category: 'Income',
          recurring: 'once'
        })
      }

      // Add expense transaction
      if (expenseNum > 0) {
        await addTransaction({
          type: 'expense',
          description: `Expense - ${month}`,
          amount: expenseNum,
          date: new Date().toISOString(),
          category: 'General',
          recurring: 'once'
        })

        if (expenseAccountId) {
          updateAccountBalance(expenseAccountId, -expenseNum)
        }
      }

      setMonth('')
      setIncome('')
      setExpense('')
    } catch (err) {
      console.error('Error adding transaction:', err)
    }
  }

  const totalIncome = data.reduce((sum, d) => sum + d.income_total, 0)
  const totalExpense = data.reduce((sum, d) => sum + d.expense_total, 0)
  const totalNet = totalIncome + totalExpense

  if (loading) return <div className="tool-container"><p>Loading cash flow data...</p></div>
  if (error) return <div className="tool-container"><p className="error">Error: {error}</p></div>

  return (
    <div className="tool-container">
      <h2>💰 Cash Flow Timeline (Income vs Expenses)</h2>
      
      <div className="tool-stats">
        <div className="stat-card positive">
          <div className="stat-label">Total Income</div>
          <div className="stat-value">${totalIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card negative">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">${Math.abs(totalExpense).toLocaleString()}</div>
        </div>
        <div className={`stat-card ${totalNet >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Net</div>
          <div className="stat-value">${totalNet.toLocaleString()}</div>
        </div>
      </div>

      <div className="input-section">
        <h3>Current Savings & Accounts</h3>
        <div className="tool-stats">
          <div className="stat-card">
            <div className="stat-label">Current Savings</div>
            <div className="stat-value">${totalSavings.toLocaleString()}</div>
          </div>
        </div>
        <div className="accounts-list">
          <div className="account-card main-account">
            <div className="account-name">{mainAccount.name}</div>
            <div className="account-balance">${mainAccount.balance.toLocaleString()}</div>
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="accounts-list sub-accounts">
            {accounts.map(account => (
              <div key={account.id} className="account-card">
                <div className="account-name">{account.name}</div>
                <div className="account-balance">${account.balance.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
        <div className="account-form">
          <input
            type="text"
            placeholder="Account name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Starting balance"
            value={accountBalance}
            onChange={(e) => setAccountBalance(e.target.value)}
          />
          <button onClick={addAccount}>Add Account</button>
        </div>
        {accountError && <div className="tool-error">{accountError}</div>}
      </div>

      <div className="chart-container">
        <h3>Cash Flow Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="income_total" fill="#4ECDC4" name="Income" />
            <Bar dataKey="expense_total" fill="#FF6B6B" name="Expenses" />
            <Bar dataKey="net" fill="#96CEB4" name="Net" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Add Entry</h3>
        <div className="form-group">
          <input
            type="text"
            placeholder="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <input
            type="number"
            placeholder="Income"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
          <input
            type="number"
            placeholder="Expenses"
            value={expense}
            onChange={(e) => setExpense(e.target.value)}
          />
          <select
            value={expenseAccountId}
            onChange={(e) => setExpenseAccountId(e.target.value)}
          >
            <option value="">Select expense account</option>
            {allAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <button onClick={handleAddEntry}>Add Entry</button>
        </div>
        {accountError && <div className="tool-error">{accountError}</div>}
      </div>

      <div className="data-table">
        <h3>Data</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.month}</td>
                  <td className="positive">${row.income_total.toLocaleString()}</td>
                  <td className="negative">${Math.abs(row.expense_total).toLocaleString()}</td>
                  <td className={row.net >= 0 ? 'positive' : 'negative'}>
                    ${row.net.toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>No data yet. Add entries to get started!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
