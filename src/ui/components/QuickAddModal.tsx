import { useEffect, useState } from 'react'
import { useTransactions } from '../hooks/useFinanceData'
import { X } from 'lucide-react'
import '../styles/QuickAddModal.css'

interface QuickAddModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: 'income' | 'expense'
}

export default function QuickAddModal({ isOpen, onClose, initialType }: QuickAddModalProps) {
  const { addTransaction } = useTransactions()
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setType(initialType ?? 'expense')
    setError('')
  }, [isOpen, initialType])

  const commonCategories = type === 'expense'
    ? ['Food', 'Transport', 'Health', 'Entertainment', 'Utilities', 'Other']
    : ['Salary', 'Freelance', 'Investment', 'Bonus', 'Other']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim() || !amount) {
      setError('Description and amount are required')
      return
    }

    try {
      setLoading(true)
      setError('')

      await addTransaction({
        type,
        description: description.trim(),
        amount: parseFloat(amount),
        date,
        category: category || 'Uncategorized',
        recurring: 'once'
      })

      // Reset form
      setDescription('')
      setAmount('')
      setCategory('')
      setDate(new Date().toISOString().split('T')[0])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="quick-add-overlay" onClick={onClose}>
      <div className="quick-add-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Quick Add</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form className="quick-add-form" onSubmit={handleSubmit}>
          {/* Type Toggle */}
          <div className="type-toggle">
            <button
              type="button"
              className={`type-btn ${type === 'income' ? 'active' : ''}`}
              onClick={() => setType('income')}
            >
              + Income
            </button>
            <button
              type="button"
              className={`type-btn ${type === 'expense' ? 'active' : ''}`}
              onClick={() => setType('expense')}
            >
              − Expense
            </button>
          </div>

          {/* Form Fields */}
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="e.g., Grocery shopping"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Amount (JOD)</label>
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <div className="category-picker">
              <div className="category-buttons">
                {commonCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`category-btn ${category === cat ? 'selected' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or enter custom..."
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </div>
          </div>

          {/* Error */}
          {error && <div className="error-message">{error}</div>}

          {/* Submit */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
