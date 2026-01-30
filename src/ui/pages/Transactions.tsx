import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Search, Filter, Trash2 } from 'lucide-react';
import { getCategoryColorClass } from '../utils/categoryColor';

interface Transaction {
  id: string;
  amount: number;
  date: string;
  merchant: string;
  notes: string;
  category_name: string;
  category_color?: string;
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Trans Form
  const [newTx, setNewTx] = useState({
    amount: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    account: '',
    type: 'expense' as TransactionType,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    const txToSave = {
      id: uuidv4(),
      amount: parseFloat(newTx.amount),
      date: newTx.date,
      merchant: newTx.merchant,
      notes: newTx.notes,
      category: newTx.category,
      accountId: newTx.account,
      type: newTx.type
    };

    await window.electron.invoke('db-add-transaction', txToSave);
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
        <button onClick={() => setShowAddModal(true)} className="btn bg-blue-500 text-white flex items-center gap-2">
          <PlusCircle size={20} /> Add New
        </button>
      </div>

      {/* Filter Bar (Visual Only for now) */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-4 flex gap-4 items-center">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search transactions..."
              className="pl-10 p-2 w-full border rounded-md"
              aria-label="Search transactions"
            />
        </div>
        <button className="btn bg-gray-100 flex items-center gap-2"><Filter size={18} /> Filter</button>
      </div>

      <div className="card flex-1 overflow-hidden flex flex-col p-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-4 border-b">Date</th>
                <th className="p-4 border-b">Merchant / Description</th>
                <th className="p-4 border-b">Category</th>
                <th className="p-4 border-b text-right">Amount</th>
                <th className="p-4 border-b w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {data.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 border-b last:border-0 border-dashed border-gray-200 group">
                  <td className="p-4 text-gray-600 font-hand text-lg">{tx.date}</td>
                  <td className="p-4">
                    <div className="font-bold">{tx.merchant}</div>
                    {tx.notes && <div className="text-sm text-gray-400 font-hand">{tx.notes}</div>}
                  </td>
                  <td className="p-4">
                    <span 
                      className={`px-3 py-1 rounded-full text-sm font-bold category-pill ${getCategoryColorClass(tx.category_color)}`}
                    >
                      {tx.category_name || 'Uncategorized'}
                    </span>
                  </td>
                  <td className={`p-4 text-right font-bold font-mono ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}${String(tx.amount.toFixed(2))}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                        onClick={() => handleDelete(tx.id)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Delete transaction ${tx.merchant}`}
                      title={`Delete transaction ${tx.merchant}`}
                    >
                        <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md border-2 border-gray-200">
            <h3 className="text-2xl font-bold mb-4 font-heading">Add Transaction</h3>
            <form onSubmit={handleSave} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label htmlFor="tx-type" className="block text-sm font-bold mb-1">Type</label>
                   <select 
                     id="tx-type"
                     className="w-full p-2 border rounded font-hand text-lg" 
                     value={newTx.type} 
                     onChange={e => setNewTx({...newTx, type: e.target.value as TransactionType})}
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

              <div>
                <label htmlFor="tx-category" className="block text-sm font-bold mb-1">Category</label>
                <select 
                  id="tx-category"
                    className="w-full p-2 border rounded font-hand text-lg"
                    value={newTx.category}
                    onChange={e => setNewTx({...newTx, category: e.target.value})}
                >
                    <option value="">Select Category...</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="tx-account" className="block text-sm font-bold mb-1">Account</label>
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
                <button type="submit" className="flex-1 btn bg-blue-500 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
