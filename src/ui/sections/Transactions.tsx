import { useState, useMemo } from 'react'
import { useTransactions } from '../hooks/useFinanceData'
import { Trash2, Edit2, Plus, Filter } from 'lucide-react'
import '../styles/Transactions.css'

export default function Transactions() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: 'All',
    type: 'all' as const,
    searchText: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const { transactions, loading, updateTransaction, deleteTransaction } = useTransactions(
    filters.startDate || filters.endDate || filters.category !== 'All' || filters.type !== 'all' || filters.searchText
      ? filters
      : undefined
  )

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [transactions])

  // Date preset helpers
  const setDatePreset = (preset: string) => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    switch (preset) {
      case 'this-week': {
        const firstDay = new Date(now)
        firstDay.setDate(now.getDate() - now.getDay())
        setFilters(f => ({ ...f, startDate: firstDay.toISOString().split('T')[0], endDate: today }))
        break
      }
      case 'this-month': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        setFilters(f => ({ ...f, startDate: firstDay.toISOString().split('T')[0], endDate: today }))
        break
      }
      case 'last-3-months': {
        const start = new Date(now)
        start.setMonth(now.getMonth() - 3)
        setFilters(f => ({ ...f, startDate: start.toISOString().split('T')[0], endDate: today }))
        break
      }
      case 'clear':
        setFilters(f => ({ ...f, startDate: '', endDate: '' }))
        break
    }
  }

  const handleEdit = (transaction: any) => {
    setEditingId(transaction.id)
    setEditForm(transaction)
  }

  const handleSaveEdit = async () => {
    if (editingId) {
      try {
        await updateTransaction(editingId, editForm)
        setEditingId(null)
        setEditForm({})
      } catch (err) {
        console.error('Error updating transaction:', err)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteTransaction(id)
      } catch (err) {
        console.error('Error deleting transaction:', err)
      }
    }
  }

  return (
    <div className="transactions-page">
      <h1>Transactions</h1>

      {/* Filters Bar */}
      <div className="filters-bar">
        <button
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} />
          Filters
        </button>

        {/* Filter Presets */}
        <div className="filter-presets">
          <button
            className="preset-btn"
            onClick={() => setDatePreset('this-week')}
          >
            This Week
          </button>
          <button
            className="preset-btn"
            onClick={() => setDatePreset('this-month')}
          >
            This Month
          </button>
          <button
            className="preset-btn"
            onClick={() => setDatePreset('last-3-months')}
          >
            Last 3 Months
          </button>
          {(filters.startDate || filters.endDate) && (
            <button
              className="preset-btn clear"
              onClick={() => setDatePreset('clear')}
            >
              Clear Dates
            </button>
          )}
        </div>

        <div className="filter-summary">
          {filters.searchText && <span>{filters.searchText}</span>}
          {filters.category !== 'All' && <span>{filters.category}</span>}
          {filters.type !== 'all' && <span>{filters.type}</span>}
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="filters-expanded">
          <div className="filter-row">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search description..."
                value={filters.searchText}
                onChange={e => setFilters(f => ({ ...f, searchText: e.target.value }))}
              />
            </div>

            <div className="filter-group">
              <label>Category</label>
              <select
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option>All</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Type</label>
              <select
                value={filters.type}
                onChange={e => setFilters(f => ({ ...f, type: e.target.value as any }))}
              >
                <option value="all">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>

            <div className="filter-group">
              <label>End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <button
            className="close-filters-btn"
            onClick={() => setShowFilters(false)}
          >
            Done
          </button>
        </div>
      )}

      {/* Transactions Table */}
      {loading ? (
        <div className="loading">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <Plus size={48} />
          <h3>No transactions found</h3>
          <p>Start by adding your first transaction using the quick add button</p>
        </div>
      ) : (
        <div className="transactions-list">
          <div className="list-header">
            <div className="col-date">Date</div>
            <div className="col-desc">Description</div>
            <div className="col-category">Category</div>
            <div className="col-amount">Amount</div>
            <div className="col-actions">Actions</div>
          </div>

          {transactions.map(transaction => (
            <div key={transaction.id} className="list-row">
              {editingId === transaction.id ? (
                <>
                  <input
                    type="date"
                    className="edit-input"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  />
                  <input
                    type="text"
                    className="edit-input"
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  />
                  <input
                    type="text"
                    className="edit-input"
                    value={editForm.category || ''}
                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  />
                  <input
                    type="number"
                    className="edit-input"
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                  />
                  <div className="col-actions">
                    <button className="action-btn save" onClick={handleSaveEdit}>Save</button>
                    <button className="action-btn cancel" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-date">{transaction.date}</div>
                  <div className="col-desc">{transaction.description}</div>
                  <div className="col-category">{transaction.category || '—'}</div>
                  <div className={`col-amount ${transaction.type}`}>
                    {transaction.type === 'income' ? '+' : '−'}
                    {Math.round(transaction.amount * 100) / 100}
                  </div>
                  <div className="col-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => handleEdit(transaction)}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(transaction.id)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
