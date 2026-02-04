import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Search, Filter, Trash2, Edit2, X } from 'lucide-react';
import { getCategoryColorClass } from '../utils/categoryColor';

interface Transaction {
  id: string;
  amount: number;
  date: string;
  merchant: string;
  notes: string;
  category_name: string;
  category_color?: string;
  category_id: string;
  account_id: string;
  account_name: string;
  to_account_id?: string;
  to_account_name?: string;
  type: 'income' | 'expense' | 'transfer';
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
}

type TransactionType = Transaction['type'];

export const Transactions = () => {
  const [data, setData] = useState<Transaction[]>([]);
  const [filteredData, setFilteredData] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [importNotice, setImportNotice] = useState<{ ids: string[]; success: number; updated: number; failed: number; type: string; at: string } | null>(null);

  // New Trans Form
  const [newTx, setNewTx] = useState({
    amount: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    account: '',
    toAccount: '',
    type: 'expense' as TransactionType,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('lastImport');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.ids)) {
          setImportNotice(parsed);
        }
      } catch {
        setImportNotice(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!importNotice) return;
    const timer = setTimeout(() => {
      localStorage.removeItem('lastImport');
      setImportNotice(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [importNotice]);

  useEffect(() => {
    // Apply filters
    let result = [...data];
    
    if (filterAccount) {
      result = result.filter(tx => tx.account_id === filterAccount);
    }
    
    if (filterType) {
      result = result.filter(tx => tx.type === filterType);
    }
    
    if (filterStartDate) {
      result = result.filter(tx => tx.date >= filterStartDate);
    }
    
    if (filterEndDate) {
      result = result.filter(tx => tx.date <= filterEndDate);
    }
    
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(tx => 
        tx.merchant.toLowerCase().includes(search) ||
        tx.notes?.toLowerCase().includes(search) ||
        tx.category_name?.toLowerCase().includes(search)
      );
    }
    
    setFilteredData(result);
  }, [data, filterAccount, filterType, filterStartDate, filterEndDate, searchText]);

  const loadData = async () => {
    if (!window.electron) return;
    try {
      const txs = await window.electron.invoke('db-get-transactions', {});
      const accs = await window.electron.invoke('db-get-accounts');
      const cats = await window.electron.invoke('db-get-categories');
      
      setData(txs);
      setAccounts(accs);
      setCategories(cats);
      
      // Defaults
      if (accs.length > 0) setNewTx(prev => ({...prev, account: accs[0].id}));
      if (cats.length > 0) setNewTx(prev => ({...prev, category: cats[0].id}));
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (tx?: Transaction) => {
    if (tx) {
      setEditingTx(tx);
      setNewTx({
        amount: tx.amount.toString(),
        merchant: tx.merchant,
        date: tx.date,
        category: tx.category_id,
        account: tx.account_id,
        toAccount: tx.to_account_id || '',
        type: tx.type,
        notes: tx.notes || ''
      });
    } else {
      setEditingTx(null);
      const defaultType = 'expense';
      const defaultCategory = categories.find(c => c.type === defaultType)?.id || '';
      setNewTx({
        amount: '',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        category: defaultCategory,
        account: accounts.length > 0 ? accounts[0].id : '',
        toAccount: '',
        type: defaultType,
        notes: ''
      });
    }
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    const txToSave = {
      id: editingTx ? editingTx.id : uuidv4(),
      amount: parseFloat(newTx.amount),
      date: newTx.date,
      merchant: newTx.merchant,
      notes: newTx.notes,
      category: newTx.category,
      accountId: newTx.account,
      toAccountId: newTx.type === 'transfer' ? newTx.toAccount : null,
      type: newTx.type
    };

    if (editingTx) {
      await window.electron.invoke('db-update-transaction', txToSave);
    } else {
      await window.electron.invoke('db-add-transaction', txToSave);
    }
    setShowAddModal(false);
    loadData(); // Refresh
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    if (!window.electron) return;
    await window.electron.invoke('db-delete-transaction', id);
    loadData();
  };

  if (loading) return <div className="p-4">Loading transactions...</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-heading">Transactions</h2>
        <button onClick={() => handleOpenModal()} className="btn bg-blue-500 text-white flex items-center gap-2">
          <PlusCircle size={20} /> Add New
        </button>
      </div>

      {importNotice && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <div className="text-sm text-red-700">
              Import update: {importNotice.success} added, {importNotice.updated} updated, {importNotice.failed} failed
              {importNotice.type === 'transactions' ? '' : ' (non-transaction import)'}
            </div>
          </div>
          <button
            className="text-xs text-red-700 hover:text-red-900"
            onClick={() => {
              localStorage.removeItem('lastImport');
              setImportNotice(null);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-4 flex gap-4 items-center">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search transactions..."
              className="pl-10 p-2 w-full border rounded-md"
              aria-label="Search transactions"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
        </div>
        <button 
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className={`btn flex items-center gap-2 ${showFilterPanel ? 'bg-blue-100 border-blue-300' : 'bg-gray-100'}`}
        >
          <Filter size={18} /> Filter
        </button>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm">Filter Options</h3>
            <button 
              onClick={() => setShowFilterPanel(false)} 
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close filter panel"
              title="Close filter panel"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="filter-account" className="block text-xs font-bold mb-1">Account</label>
              <select
                id="filter-account"
                className="w-full p-2 border rounded"
                value={filterAccount}
                onChange={e => setFilterAccount(e.target.value)}
              >
                <option value="">All Accounts</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-type" className="block text-xs font-bold mb-1">Transaction Type</label>
              <select
                id="filter-type"
                className="w-full p-2 border rounded"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-start-date" className="block text-xs font-bold mb-1">Start Date</label>
              <input
                id="filter-start-date"
                type="date"
                className="w-full p-2 border rounded"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="filter-end-date" className="block text-xs font-bold mb-1">End Date</label>
              <input
                id="filter-end-date"
                type="date"
                className="w-full p-2 border rounded"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end md:col-span-2">
              <button
                onClick={() => {
                  setFilterAccount('');
                  setFilterType('');
                  setFilterStartDate('');
                  setFilterEndDate('');
                  setSearchText('');
                }}
                className="btn bg-white w-full"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card flex-1 overflow-hidden flex flex-col p-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-4 border-b">Date</th>
                <th className="p-4 border-b">Merchant / Description</th>
                <th className="p-4 border-b">Account</th>
                <th className="p-4 border-b">Category</th>
                <th className="p-4 border-b text-right">Amount</th>
                <th className="p-4 border-b w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(tx => (
                <tr key={tx.id} className={`hover:bg-gray-50 border-b last:border-0 border-dashed border-gray-200 group ${
                  importNotice?.ids?.includes(tx.id) ? 'bg-red-50' : ''
                }`}>
                  <td className="p-4 text-gray-600 font-hand text-lg">{tx.date}</td>
                  <td className="p-4">
                    <div className="font-bold">{tx.merchant}</div>
                    {tx.notes && <div className="text-sm text-gray-400 font-hand">{tx.notes}</div>}
                  </td>
                  <td className="p-4">
                    {tx.type === 'transfer' ? (
                      <div className="text-sm">
                        <span className="text-gray-600">{tx.account_name}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="text-gray-600">{tx.to_account_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600">{tx.account_name}</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span 
                      className={`px-3 py-1 rounded-full text-sm font-bold category-pill ${getCategoryColorClass(tx.category_color)}`}
                    >
                      {tx.category_name || 'Uncategorized'}
                    </span>
                  </td>
                  <td className={`p-4 text-right font-bold font-mono ${tx.type === 'income' ? 'text-green-600' : tx.type === 'transfer' ? 'text-blue-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}${String(tx.amount.toFixed(2))}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                          onClick={() => handleOpenModal(tx)}
                          className="text-blue-400 hover:text-blue-600"
                        aria-label={`Edit transaction ${tx.merchant}`}
                        title="Edit transaction"
                      >
                          <Edit2 size={18} />
                      </button>
                      <button 
                          onClick={() => handleDelete(tx.id)}
                          className="text-red-400 hover:text-red-600"
                        aria-label={`Delete transaction ${tx.merchant}`}
                        title="Delete transaction"
                      >
                          <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      {data.length === 0 ? 'No transactions found.' : 'No transactions match your filters.'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md border-2 border-gray-200">
            <h3 className="text-2xl font-bold mb-4 font-heading">
              {editingTx ? 'Edit Transaction' : 'Add Transaction'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label htmlFor="tx-type" className="block text-sm font-bold mb-1">Type</label>
                   <select 
                     id="tx-type"
                     className="w-full p-2 border rounded font-hand text-lg" 
                     value={newTx.type} 
                     onChange={e => {
                       const newType = e.target.value as TransactionType;
                       const matchingCategory = categories.find(c => c.type === newType)?.id || '';
                       setNewTx({...newTx, type: newType, category: matchingCategory});
                     }}
                   >
                     <option value="expense">Expense</option>
                     <option value="income">Income</option>
                     <option value="transfer">Transfer</option>
                   </select>
                </div>
                <div>
                  <label htmlFor="tx-date" className="block text-sm font-bold mb-1">Date</label>
                  <input 
                    id="tx-date"
                    type="date" 
                    required
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={newTx.date}
                    onChange={e => setNewTx({...newTx, date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tx-amount" className="block text-sm font-bold mb-1">Amount</label>
                <input 
                  id="tx-amount"
                  type="number" 
                  step="0.01" 
                  required
                  placeholder="0.00"
                  className="w-full p-2 border rounded font-hand text-xl"
                  value={newTx.amount}
                  onChange={e => setNewTx({...newTx, amount: e.target.value})}
                />
              </div>

              <div>
                <label htmlFor="tx-merchant" className="block text-sm font-bold mb-1">Merchant / Payee</label>
                <input 
                  id="tx-merchant"
                  type="text" 
                  required
                  className="w-full p-2 border rounded font-hand text-lg"
                  placeholder="e.g. Starbucks, Salary"
                  value={newTx.merchant}
                  onChange={e => setNewTx({...newTx, merchant: e.target.value})}
                />
              </div>

              {newTx.type !== 'transfer' && (
                <div>
                  <label htmlFor="tx-category" className="block text-sm font-bold mb-1">Category</label>
                  <select 
                    id="tx-category"
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={newTx.category}
                    onChange={e => setNewTx({...newTx, category: e.target.value})}
                    required
                  >
                    {categories
                      .filter(c => c.type === newTx.type)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                  {categories.filter(c => c.type === newTx.type).length === 0 && (
                    <p className="text-sm text-red-500 mt-1">No {newTx.type} categories available. Please create one first.</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="tx-account" className="block text-sm font-bold mb-1">
                  {newTx.type === 'transfer' ? 'From Account' : 'Account'}
                </label>
                 <select 
                  id="tx-account"
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={newTx.account}
                    onChange={e => setNewTx({...newTx, account: e.target.value})}
                >
                    <option value="">Select Account...</option>
                    {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
              </div>

              {newTx.type === 'transfer' && (
                <div>
                  <label htmlFor="tx-to-account" className="block text-sm font-bold mb-1">To Account</label>
                  <select 
                    id="tx-to-account"
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={newTx.toAccount}
                    onChange={e => setNewTx({...newTx, toAccount: e.target.value})}
                    required
                  >
                    <option value="">Select Destination Account...</option>
                    {accounts.filter(a => a.id !== newTx.account).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="tx-notes" className="block text-sm font-bold mb-1">Notes</label>
                <textarea 
                  id="tx-notes"
                  className="w-full p-2 border rounded font-hand text-lg"
                  rows={2}
                  placeholder="Optional notes"
                  value={newTx.notes}
                  onChange={e => setNewTx({...newTx, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 btn bg-gray-100">Cancel</button>
                <button type="submit" className="flex-1 btn bg-blue-500 text-white">
                  {editingTx ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
