import { useMemo, useState } from 'react'
import { Target, Wallet, CalendarDays, Plus, Pencil, Trash2, CheckCircle, X } from 'lucide-react'
import type { Budget, Bill, Goal, Transaction } from '../../services/database'
import { useBudgets, useBills, useGoals, useTransactions } from '../hooks/useFinanceData'

type TabKey = 'budgets' | 'bills' | 'goals'
type ModalMode = 'add' | 'edit'
type ModalType = 'budget' | 'bill' | 'goal'

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function currency(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: toIsoDate(start), end: toIsoDate(end) }
}

const BUDGET_CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Housing', 'Healthcare', 'Education', 'Other']
const BILL_CATEGORIES = ['Utilities', 'Housing', 'Insurance', 'Entertainment', 'Transportation', 'Healthcare', 'Subscription', 'Other']
const GOAL_CATEGORIES = ['Savings', 'Travel', 'Electronics', 'Home', 'Vehicle', 'Education', 'Investment', 'Other']

export default function Plan() {
  const [activeTab, setActiveTab] = useState<TabKey>('budgets')
  const { budgets, addBudget, updateBudget, deleteBudget } = useBudgets()
  const { bills, addBill, updateBill, deleteBill, payBill } = useBills()
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals()
  const { transactions } = useTransactions()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('add')
  const [modalType, setModalType] = useState<ModalType>('budget')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [limitOrTarget, setLimitOrTarget] = useState<number>(0)
  const [dateValue, setDateValue] = useState<string>(toIsoDate(new Date()))
  const [recurring, setRecurring] = useState<Bill['recurring']>('monthly')
  const [description, setDescription] = useState('')

  const month = useMemo(() => currentMonthRange(), [])

  const spentByCategoryThisMonth = useMemo(() => {
    const map = new Map<string, number>()
    const start = new Date(month.start)
    const end = new Date(month.end)
    for (const t of transactions) {
      const tx = t as Transaction
      if (tx.type !== 'expense') continue
      const d = new Date(tx.date)
      if (Number.isNaN(d.getTime())) continue
      if (d < start || d > end) continue
      const cat = (tx.category || 'Other').trim() || 'Other'
      map.set(cat, (map.get(cat) || 0) + Math.abs(tx.amount))
    }
    return map
  }, [transactions, month.end, month.start])

  function openAdd(type: ModalType) {
    setModalOpen(true)
    setModalMode('add')
    setModalType(type)
    setEditingId(null)
    setName('')
    setCategory('')
    setAmount(0)
    setLimitOrTarget(0)
    setDateValue(toIsoDate(new Date()))
    setRecurring('monthly')
    setDescription('')
  }

  function openEdit(type: ModalType, id: string) {
    setModalOpen(true)
    setModalMode('edit')
    setModalType(type)
    setEditingId(id)

    if (type === 'budget') {
      const b = budgets.find(x => x.id === id)
      if (!b) return
      setName(b.name)
      setCategory(b.category)
      setLimitOrTarget(b.limitAmount)
      setDescription(b.description || '')
    }
    if (type === 'bill') {
      const bl = bills.find(x => x.id === id)
      if (!bl) return
      setName(bl.name)
      setCategory(bl.category)
      setAmount(bl.amount)
      setDateValue(bl.nextDueDate)
      setRecurring(bl.recurring)
      setDescription(bl.description || '')
    }
    if (type === 'goal') {
      const g = goals.find(x => x.id === id)
      if (!g) return
      setName(g.name)
      setCategory(g.category)
      setAmount(g.currentAmount)
      setLimitOrTarget(g.targetAmount)
      setDateValue(g.targetDate || toIsoDate(new Date()))
      setDescription(g.description || '')
    }
  }

  function closeModal() {
    setModalOpen(false)
  }

  const modalTitle = `${modalMode === 'add' ? 'Add New' : 'Edit'} ${modalType === 'budget' ? 'Budget' : modalType === 'bill' ? 'Bill' : 'Goal'}`

  const modalCategories = useMemo(() => {
    const base = modalType === 'budget' ? BUDGET_CATEGORIES : modalType === 'bill' ? BILL_CATEGORIES : GOAL_CATEGORIES
    const normalized = (category || '').trim()
    if (!normalized) return base
    return base.includes(normalized) ? base : [normalized, ...base]
  }, [category, modalType])

  async function submitModal() {
    const trimmedName = name.trim()
    const trimmedCategory = category.trim()
    if (!trimmedName || !trimmedCategory) return

    if (modalType === 'budget') {
      const payload: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> = {
        name: trimmedName,
        category: trimmedCategory,
        period: 'monthly',
        limitAmount: Number(limitOrTarget) || 0,
        description: description.trim() || undefined
      }

      if (modalMode === 'add') await addBudget(payload)
      else if (editingId) await updateBudget(editingId, payload)
    }

    if (modalType === 'bill') {
      const payload: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'> = {
        name: trimmedName,
        category: trimmedCategory,
        amount: Number(amount) || 0,
        nextDueDate: dateValue,
        recurring,
        isPaid: false,
        description: description.trim() || undefined
      }

      if (modalMode === 'add') await addBill(payload)
      else if (editingId) await updateBill(editingId, payload)
    }

    if (modalType === 'goal') {
      const payload: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> = {
        name: trimmedName,
        category: trimmedCategory,
        currentAmount: Number(amount) || 0,
        targetAmount: Number(limitOrTarget) || 0,
        targetDate: dateValue,
        description: description.trim() || undefined
      }

      if (modalMode === 'add') await addGoal(payload)
      else if (editingId) await updateGoal(editingId, payload)
    }

    setModalOpen(false)
  }

  const tabOrder: TabKey[] = ['budgets', 'bills', 'goals']
  const navIndex = tabOrder.indexOf(activeTab)
  const navTransform = `translateX(${navIndex * 100}%)`

  const tabMeta = {
    budgets: { label: 'Budgets', icon: Wallet, addLabel: 'Add Budget', add: () => openAdd('budget') },
    bills: { label: 'Bills & Reminders', icon: CalendarDays, addLabel: 'Add Bill', add: () => openAdd('bill') },
    goals: { label: 'Goals', icon: Target, addLabel: 'Add Goal', add: () => openAdd('goal') }
  } as const

  return (
    <div className="section-container plan-page">
      <div className="app-container">
        <div className="plan-system">
          <div className="plan-nav" role="tablist" aria-label="Plan navigation">
            <div className="nav-slider" style={{ transform: navTransform }} />

            <button className={`nav-item ${activeTab === 'budgets' ? 'active' : ''}`} onClick={() => setActiveTab('budgets')} role="tab" aria-selected={activeTab === 'budgets'}>
              <Wallet size={18} />
              <span>Budgets</span>
            </button>
            <button className={`nav-item ${activeTab === 'bills' ? 'active' : ''}`} onClick={() => setActiveTab('bills')} role="tab" aria-selected={activeTab === 'bills'}>
              <CalendarDays size={18} />
              <span>Bills & Reminders</span>
            </button>
            <button className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')} role="tab" aria-selected={activeTab === 'goals'}>
              <Target size={18} />
              <span>Goals</span>
            </button>
          </div>

          {/* Budgets */}
          <div className={`plan-content ${activeTab === 'budgets' ? 'active' : ''}`} id="budgets-content">
            <div className="content-header">
              <h2>Manage Your Budgets</h2>
              <button className="btn btn-primary" onClick={tabMeta.budgets.add}>
                <Plus size={16} />
                {tabMeta.budgets.addLabel}
              </button>
            </div>
            <p className="content-description">Set spending limits for different categories. Budgets track against your transactions in the Timeline.</p>

            <div className="cards-grid" id="budgetsGrid">
              {budgets.length === 0 && (
                <div className="empty-state">
                  <Wallet size={42} />
                  <h3>No budgets yet</h3>
                  <p>Create your first budget to start tracking your spending.</p>
                  <button className="btn btn-outline" style={{ marginTop: 15 }} onClick={tabMeta.budgets.add}>
                    <Plus size={16} />
                    Add Budget
                  </button>
                </div>
              )}

              {budgets.map(b => {
                const spent = spentByCategoryThisMonth.get(b.category) || 0
                const progress = b.limitAmount > 0 ? clamp(0, (spent / b.limitAmount) * 100, 100) : 0
                const left = b.limitAmount - spent
                return (
                  <div key={b.id} className="card">
                    <div className="card-header">
                      <h3 className="card-title">{b.name}</h3>
                      <div className="card-icon budget-icon">
                        <Wallet size={20} />
                      </div>
                    </div>
                    <p className="card-description">{b.description || '—'}</p>
                    <div className="progress-container">
                      <div className="progress-label">
                        <span>{b.category}</span>
                        <span>{currency(spent)} / {currency(b.limitAmount)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill budget-progress" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="card-footer">
                      <span>{progress.toFixed(1)}% spent</span>
                      <span>{currency(left)} left</span>
                    </div>
                    <div className="card-actions">
                      <button className="card-action-btn" data-action="edit" onClick={() => openEdit('budget', b.id)}>
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button className="card-action-btn danger" data-action="delete" onClick={() => deleteBudget(b.id)}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="theme-demo">
              <h4>Current Theme Colors</h4>
              <p className="theme-demo-text">This section shows the active theme colors being used throughout the app.</p>
              <div className="theme-demo-colors">
                <div className="theme-color" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="theme-color" style={{ backgroundColor: 'var(--secondary)' }} />
                <div className="theme-color" style={{ backgroundColor: 'var(--accent-1)' }} />
                <div className="theme-color" style={{ backgroundColor: 'var(--accent-2)' }} />
                <div className="theme-color" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--light-gray)' }} />
              </div>
            </div>
          </div>

          {/* Bills */}
          <div className={`plan-content ${activeTab === 'bills' ? 'active' : ''}`} id="bills-content">
            <div className="content-header">
              <h2>Bills & Reminders</h2>
              <button className="btn btn-primary" onClick={tabMeta.bills.add}>
                <Plus size={16} />
                {tabMeta.bills.addLabel}
              </button>
            </div>
            <p className="content-description">Track your recurring bills and set reminders for due dates.</p>

            <div className="cards-grid" id="billsGrid">
              {bills.length === 0 && (
                <div className="empty-state">
                  <CalendarDays size={42} />
                  <h3>No bills yet</h3>
                  <p>Add your first bill to start tracking payments.</p>
                  <button className="btn btn-outline" style={{ marginTop: 15 }} onClick={tabMeta.bills.add}>
                    <Plus size={16} />
                    Add Bill
                  </button>
                </div>
              )}

              {bills.map(b => {
                const dueDate = new Date(b.nextDueDate)
                const today = new Date()
                const daysUntilDue = Number.isNaN(dueDate.getTime()) ? null : Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                let dueStatus = ''
                let statusColor = 'var(--text-secondary)'

                if (b.isPaid) {
                  dueStatus = 'Paid'
                  statusColor = 'rgba(76, 201, 240, 1)'
                } else if (daysUntilDue !== null && daysUntilDue < 0) {
                  dueStatus = 'Overdue'
                  statusColor = 'rgba(247, 37, 133, 1)'
                } else if (daysUntilDue !== null && daysUntilDue <= 7) {
                  dueStatus = `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`
                  statusColor = 'rgba(248, 150, 30, 1)'
                } else if (daysUntilDue !== null) {
                  dueStatus = `Due in ${daysUntilDue} days`
                } else {
                  dueStatus = 'Due date unknown'
                }

                return (
                  <div key={b.id} className="card">
                    <div className="card-header">
                      <h3 className="card-title">{b.name}</h3>
                      <div className="card-icon bills-icon">
                        <CalendarDays size={20} />
                      </div>
                    </div>
                    <p className="card-description">{b.description || '—'}</p>
                    <div className="bill-metrics">
                      <div>
                        <p className="bill-metric-label">Amount</p>
                        <p className="bill-metric-value">{currency(b.amount)}</p>
                      </div>
                      <div className="bill-metric-right">
                        <p className="bill-metric-label">Due Date</p>
                        <p className="bill-metric-due" style={{ color: statusColor }}>{b.nextDueDate}</p>
                      </div>
                    </div>
                    <div className="card-footer">
                      <span>{b.category}</span>
                      <span style={{ color: statusColor, fontWeight: 600 }}>{dueStatus}</span>
                    </div>
                    <div className="card-actions">
                      <button className="card-action-btn" onClick={() => openEdit('bill', b.id)}>
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        className={`card-action-btn ${b.isPaid ? 'danger' : 'paid'}`}
                        onClick={() => (b.isPaid ? updateBill(b.id, { isPaid: false }) : payBill(b.id, toIsoDate(new Date())))}
                      >
                        {b.isPaid ? <X size={14} /> : <CheckCircle size={14} />}
                        {b.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                      </button>
                      <button className="card-action-btn danger" onClick={() => deleteBill(b.id)}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Goals */}
          <div className={`plan-content ${activeTab === 'goals' ? 'active' : ''}`} id="goals-content">
            <div className="content-header">
              <h2>Financial Goals</h2>
              <button className="btn btn-primary" onClick={tabMeta.goals.add}>
                <Plus size={16} />
                {tabMeta.goals.addLabel}
              </button>
            </div>
            <p className="content-description">Set and track your financial goals with progress monitoring.</p>

            <div className="cards-grid" id="goalsGrid">
              {goals.length === 0 && (
                <div className="empty-state">
                  <Target size={42} />
                  <h3>No goals yet</h3>
                  <p>Set your first financial goal to start saving.</p>
                  <button className="btn btn-outline" style={{ marginTop: 15 }} onClick={tabMeta.goals.add}>
                    <Plus size={16} />
                    Add Goal
                  </button>
                </div>
              )}

              {goals.map(g => {
                const progress = g.targetAmount > 0 ? clamp(0, (g.currentAmount / g.targetAmount) * 100, 100) : 0
                const daysUntilTarget = g.targetDate ? Math.ceil((new Date(g.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
                return (
                  <div key={g.id} className="card">
                    <div className="card-header">
                      <h3 className="card-title">{g.name}</h3>
                      <div className="card-icon goals-icon">
                        <Target size={20} />
                      </div>
                    </div>
                    <p className="card-description">{g.description || '—'}</p>
                    <div className="progress-container">
                      <div className="progress-label">
                        <span>{g.category}</span>
                        <span>{currency(g.currentAmount)} / {currency(g.targetAmount)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill goals-progress" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div className="card-footer">
                      <span>{progress.toFixed(1)}% achieved</span>
                      <span>{daysUntilTarget === null ? '—' : (daysUntilTarget > 0 ? `${daysUntilTarget} days left` : 'Target reached!')}</span>
                    </div>
                    <div className="card-actions">
                      <button className="card-action-btn" onClick={() => openEdit('goal', g.id)}>
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button className="card-action-btn danger" onClick={() => deleteGoal(g.id)}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="footer">
          <p>FlexPlan-style Plan System</p>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal-overlay ${modalOpen ? 'active' : ''}`} onClick={closeModal}>
        <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="modal-header">
            <h3 className="modal-title">{modalTitle}</h3>
            <button className="close-btn" onClick={closeModal} aria-label="Close">
              ×
            </button>
          </div>

          <form
            id="modalForm"
            onSubmit={(e) => {
              e.preventDefault()
              submitModal()
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="itemName">Name</label>
              <input id="itemName" type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name" required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="itemCategory">Category</label>
              <select id="itemCategory" className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Select category</option>
                {modalCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="itemAmount">Amount</label>
                <input
                  id="itemAmount"
                  type="number"
                  className="form-control"
                  min={0}
                  step={0.01}
                  value={modalType === 'budget' ? (spentByCategoryThisMonth.get(category) || 0) : amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0.00"
                  disabled={modalType === 'budget'}
                />
              </div>

              <div className="form-group" style={{ display: modalType === 'bill' ? 'none' : 'block' }}>
                <label className="form-label" htmlFor="itemLimit">Limit / Target</label>
                <input
                  id="itemLimit"
                  type="number"
                  className="form-control"
                  min={0}
                  step={0.01}
                  value={limitOrTarget}
                  onChange={(e) => setLimitOrTarget(Number(e.target.value))}
                  placeholder="0.00"
                  required={modalType !== 'bill'}
                />
              </div>
            </div>

            <div className="form-group" style={{ display: modalType === 'bill' ? 'block' : 'none' }}>
              <label className="form-label" htmlFor="itemDueDate">Due Date</label>
              <input id="itemDueDate" type="date" className="form-control" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>

            <div className="form-group" style={{ display: modalType === 'goal' ? 'block' : 'none' }}>
              <label className="form-label" htmlFor="itemTargetDate">Target Date</label>
              <input id="itemTargetDate" type="date" className="form-control" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>

            <div className="form-group" style={{ display: modalType === 'bill' ? 'block' : 'none' }}>
              <label className="form-label" htmlFor="itemRecurring">Recurring</label>
              <select id="itemRecurring" className="form-control" value={recurring} onChange={(e) => setRecurring(e.target.value as Bill['recurring'])}>
                <option value="once">Once</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="itemDescription">Description</label>
              <textarea id="itemDescription" className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add description (optional)" />
            </div>

            <div className="form-group" style={{ marginTop: 30 }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <CheckCircle size={16} />
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
