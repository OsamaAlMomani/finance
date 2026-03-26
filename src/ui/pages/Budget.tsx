import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Wallet, Trash2, Edit2 } from 'lucide-react';
import { getCategoryColorClass } from '../utils/categoryColor';
import { useI18n } from '../contexts/useI18n';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Budget {
  id: string;
  category_id: string;
  period: 'weekly' | 'monthly' | 'yearly';
  limit_amount: number;
  category_name: string;
  category_color: string;
  spent?: number; // Need to calculate this eventually
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: string;
}

interface TransactionItem {
  id: string;
  category_id: string;
  amount: number;
  merchant: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
}

interface AlertItem {
  id: string;
  source_type: string;
  source_id: string;
  message: string;
  severity: string;
  status: string;
}

export const BudgetPage = () => {
  const { t } = useI18n();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [pendingDeleteBudgetId, setPendingDeleteBudgetId] = useState<string | null>(null);

  const [newBudget, setNewBudget] = useState({
    categoryId: '',
    period: 'monthly',
    limit: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onChanged = () => loadData();
    window.addEventListener('finance:data-changed', onChanged);
    return () => window.removeEventListener('finance:data-changed', onChanged);
  }, []);

  const loadData = async () => {
    if(!window.electron) return;
    try {
        // Parallel fetch
        const [buds, cats, txs, alertsData] = await Promise.all([
            window.electron.invoke('db-get-budgets'),
            window.electron.invoke('db-get-categories'),
            window.electron.invoke('db-get-transactions', {}),
            window.electron.invoke('db-get-alerts', { includeResolved: false }).catch(() => [])
        ]);
        setBudgets(buds);
        setCategories(cats);
        setTransactions(Array.isArray(txs) ? txs : []);
        setAlerts(Array.isArray(alertsData) ? alertsData : []);
        if(cats.length > 0) setNewBudget(p => ({...p, categoryId: cats[0].id}));
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setNewBudget({
        categoryId: budget.category_id,
        period: budget.period,
        limit: budget.limit_amount.toString()
      });
    } else {
      setEditingBudget(null);
      setNewBudget({
        categoryId: categories.length > 0 ? categories[0].id : '',
        period: 'monthly',
        limit: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    await window.electron.invoke('db-save-budget', {
      id: editingBudget ? editingBudget.id : uuidv4(),
      category_id: newBudget.categoryId,
      period: newBudget.period,
      limit_amount: parseFloat(newBudget.limit)
    });
    
    setShowModal(false);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    loadData();
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteBudgetId(id);
  };

  const confirmDeleteBudget = async () => {
    const id = pendingDeleteBudgetId;
    if (!id) return;
    setPendingDeleteBudgetId(null);
    if (!window.electron) return;
    await window.electron.invoke('db-delete-budget', id);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    loadData();
  };

  if (loading) return <div>{t('budget.loading')}</div>;

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-heading">{t('budget.title')}</h2>
        <button onClick={() => handleOpenModal()} className="btn bg-green-500 text-white flex items-center gap-2">
            <PlusCircle size={20} /> {t('budget.create')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
        {budgets.map(b => {
             const spent = b.spent || 0;
             const percentage = Math.min((spent / b.limit_amount) * 100, 100);
             const isExceeded = spent > b.limit_amount;
             const isNearLimit = spent > b.limit_amount * 0.9 && !isExceeded;
             const topTransactions = transactions
               .filter((tx) => tx.type === 'expense' && tx.category_id === b.category_id)
               .sort((a, c) => c.amount - a.amount)
               .slice(0, 3);
             const relatedAlerts = alerts.filter((alert) => alert.source_type === 'budget' && String(alert.source_id || '').includes(b.id));
             return (
                <div key={b.id} className={`card relative overflow-hidden group ${
                  isExceeded ? 'border-2 border-red-500 bg-red-50' : 
                  isNearLimit ? 'border-2 border-yellow-500 bg-yellow-50' : ''
                }`}>
                  {isExceeded && (
                    <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full absolute top-2 right-2 z-10">
                      ⚠️ {t('budget.exceeded')}
                    </div>
                  )}
                  {isNearLimit && (
                    <div className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full absolute top-2 right-2 z-10">
                      ⚠️ {t('budget.nearLimit')}
                    </div>
                  )}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white category-color-bg ${getCategoryColorClass(b.category_color)}`}>
                                <Wallet size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl">{b.category_name}</h3>
                                <p className="text-sm text-gray-500 capitalize">{b.period}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-xl">${b.limit_amount}</p>
                            <div className="flex gap-2 justify-end items-center">
                                <p className="text-sm text-gray-400">{t('budget.limit')}</p>
                                <button
                                  onClick={() => handleOpenModal(b)}
                                  className="text-blue-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label={`${t('common.edit')} ${b.category_name}`}
                                  title={t('common.edit')}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(b.id)}
                                  className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label={`${t('common.delete')} ${b.category_name}`}
                                  title={t('common.delete')}
                                >
                                  <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-2 flex justify-between text-sm font-bold">
                      <span className={isExceeded ? 'text-red-600' : `category-color-text ${getCategoryColorClass(b.category_color)}`}>
                        {t('budget.spent', { amount: `$${spent.toFixed(0)}` })}
                      </span>
                      <span className={isExceeded ? 'text-red-600' : 'text-gray-400'}>
                        {isExceeded
                          ? t('budget.over', { amount: `$${(spent - b.limit_amount).toFixed(0)}` })
                          : t('budget.left', { amount: `$${(b.limit_amount - spent).toFixed(0)}` })}
                      </span>
                    </div>

                          <progress
                            className={`progress-bar ${getCategoryColorClass(b.category_color)}`}
                            value={percentage}
                            max={100}
                          />

                    <div className="mt-3 text-xs text-gray-600">
                      <p className="font-bold mb-1">Connected Details</p>
                      <p>Top transactions:</p>
                      <ul className="ml-4 list-disc">
                        {topTransactions.map((tx) => (
                          <li key={tx.id}>{tx.merchant || 'Expense'} - ${Number(tx.amount).toFixed(2)} ({tx.date})</li>
                        ))}
                        {topTransactions.length === 0 && <li>No matching expenses</li>}
                      </ul>
                      <p className="mt-2">Related alerts: {relatedAlerts.length}</p>
                    </div>
                </div>
             );
        })}
        {budgets.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
            <p className="text-xl font-hand">{t('budget.empty')}</p>
            </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border-2 border-gray-200">
                <h3 className="text-2xl font-bold mb-4 font-heading">
                {editingBudget ? t('budget.edit') : t('budget.new')}
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                  <label htmlFor="budget-category" className="block text-sm font-bold mb-1">{t('budget.category')}</label>
                        <select 
                          id="budget-category"
                            className="w-full p-2 border rounded font-hand text-lg"
                            value={newBudget.categoryId}
                            onChange={e => setNewBudget({...newBudget, categoryId: e.target.value})}
                        >
                            {categories.filter(c => c.type === 'expense').map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                      <label htmlFor="budget-period" className="block text-sm font-bold mb-1">{t('budget.period')}</label>
                         <select 
                          id="budget-period"
                            className="w-full p-2 border rounded font-hand text-lg"
                            value={newBudget.period}
                            onChange={e => setNewBudget({...newBudget, period: e.target.value})}
                        >
                            <option value="weekly">{t('budget.period.weekly')}</option>
                            <option value="monthly">{t('budget.period.monthly')}</option>
                            <option value="yearly">{t('budget.period.yearly')}</option>
                        </select>
                    </div>

                    <div>
                          <label htmlFor="budget-limit" className="block text-sm font-bold mb-1">{t('budget.limitAmount')}</label>
                        <input 
                          id="budget-limit"
                            type="number" required placeholder={t('budget.limitPlaceholder')}
                            className="w-full p-2 border rounded font-hand text-lg"
                            value={newBudget.limit}
                            onChange={e => setNewBudget({...newBudget, limit: e.target.value})}
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                          <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn bg-gray-100">{t('common.cancel')}</button>
                        <button type="submit" className="flex-1 btn bg-green-500 text-white">
                            {editingBudget ? t('common.update') : t('budget.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteBudgetId)}
        title={t('common.delete')}
        message={t('budget.deleteConfirm')}
        destructive
        onCancel={() => setPendingDeleteBudgetId(null)}
        onConfirm={() => {
          void confirmDeleteBudget();
        }}
      />
    </div>
  );
};
