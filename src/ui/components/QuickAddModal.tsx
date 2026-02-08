import { useEffect, useState } from 'react'
import { useTransactions, useAccounts } from '../hooks/useFinanceData'
import { X } from 'lucide-react'
import '../styles/QuickAddModal.css'
import { useI18n } from '../contexts/useI18n'

interface QuickAddModalProps {
  isOpen: boolean
  onClose: () => void
  initialType?: 'income' | 'expense'
}

export default function QuickAddModal({ isOpen, onClose, initialType }: QuickAddModalProps) {
  const { t } = useI18n()
  const { addTransaction } = useTransactions()
  const { accounts } = useAccounts()
  
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setType(initialType ?? 'expense')
    setError('')
    
    // Default to first account if none selected
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id)
    }
  }, [isOpen, initialType, accounts, accountId])

  const commonCategories = type === 'expense'
    ? [
        { value: 'Food', label: t('quickAdd.categoryFood') },
        { value: 'Transport', label: t('quickAdd.categoryTransport') },
        { value: 'Health', label: t('quickAdd.categoryHealth') },
        { value: 'Entertainment', label: t('quickAdd.categoryEntertainment') },
        { value: 'Utilities', label: t('quickAdd.categoryUtilities') },
        { value: 'Other', label: t('quickAdd.categoryOther') }
      ]
    : [
        { value: 'Salary', label: t('quickAdd.categorySalary') },
        { value: 'Freelance', label: t('quickAdd.categoryFreelance') },
        { value: 'Investment', label: t('quickAdd.categoryInvestment') },
        { value: 'Bonus', label: t('quickAdd.categoryBonus') },
        { value: 'Other', label: t('quickAdd.categoryOther') }
      ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim() || !amount) {
      setError(t('quickAdd.error.required'))
      return
    }

    if (!accountId) {
      setError(t('quickAdd.error.accountRequired'))
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
        accountId, // Link to account
        recurring: 'once'
      })

      // Reset form
      setDescription('')
      setAmount('')
      setCategory('')
      setDate(new Date().toISOString().split('T')[0])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quickAdd.error.failed'))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="quick-add-overlay" onClick={onClose}>
      <div className="quick-add-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('quickAdd.title')}</h3>
          <button className="close-btn" onClick={onClose} aria-label={t('quickAdd.close')} title={t('common.close')}>
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
              {t('quickAdd.type.income')}
            </button>
            <button
              type="button"
              className={`type-btn ${type === 'expense' ? 'active' : ''}`}
              onClick={() => setType('expense')}
            >
              {t('quickAdd.type.expense')}
            </button>
          </div>

          {/* Form Fields */}
          <div className="form-group">
            <label htmlFor="quick-add-date">{t('quickAdd.date')}</label>
            <input
              id="quick-add-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quick-add-account">{t('quickAdd.account')}</label>
            <div className="select-wrapper">
              <select 
                id="quick-add-account"
                value={accountId} 
                onChange={e => setAccountId(e.target.value)}
                required
              >
                <option value="" disabled>{t('quickAdd.selectAccount')}</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency ?? 'USD'} {(acc.currentBalance ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="quick-add-description">{t('quickAdd.description')}</label>
            <input
              id="quick-add-description"
              type="text"
              placeholder={t('quickAdd.descriptionPlaceholder')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quick-add-amount">{t('quickAdd.amount')}</label>
            <input
              id="quick-add-amount"
              type="number"
              placeholder={t('quickAdd.amountPlaceholder')}
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quick-add-category">{t('quickAdd.category')}</label>
            <div className="category-picker">
              <div className="category-buttons">
                {commonCategories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`category-btn ${category === cat.value ? 'selected' : ''}`}
                    onClick={() => setCategory(cat.value)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <input
                id="quick-add-category"
                type="text"
                placeholder={t('quickAdd.customCategoryPlaceholder')}
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
              {t('quickAdd.cancel')}
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? t('quickAdd.adding') : t('quickAdd.addTransaction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
