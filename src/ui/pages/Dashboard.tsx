import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface DashboardStats {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    chartData: { date: string; income: number; expense: number }[];
}

interface Account {
  id: string;
  name: string;
  type: string;
  initial_balance: number;
  current_balance?: number;
}

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
      totalBalance: 0,
      totalIncome: 0,
      totalExpense: 0, 
      chartData: []
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'checking',
    initial_balance: ''
  });

  const loadData = () => {
    if (window.electron) {
        Promise.all([
            window.electron.invoke('db-get-dashboard-stats'),
            window.electron.invoke('db-get-accounts-with-balance')
        ]).then(([statsData, accountsData]) => {
            setStats(statsData);
            setAccounts(accountsData);
        });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAccountModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        name: account.name,
        type: account.type,
        initial_balance: account.initial_balance.toString()
      });
    } else {
      setEditingAccount(null);
      setAccountForm({ name: '', type: 'checking', initial_balance: '' });
    }
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    if (editingAccount) {
      // Update existing account
      await window.electron.invoke('db-update-account', {
        id: editingAccount.id,
        name: accountForm.name,
        type: accountForm.type,
        initialBalance: parseFloat(accountForm.initial_balance),
        currency: 'USD'
      });
    } else {
      // Create new account
      await window.electron.invoke('db-create-account', {
        id: uuidv4(),
        name: accountForm.name,
        type: accountForm.type,
        initialBalance: parseFloat(accountForm.initial_balance),
        currency: 'USD'
      });
    }
    setShowAccountModal(false);
    loadData();
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Delete this account? All related transactions will be removed.")) return;
    if (!window.electron) return;
    await window.electron.invoke('db-delete-account', id);
    loadData();
  };

  return (
    <div className="dashboard-page">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold heading-font">Dashboard</h2>
        <button
          onClick={() => setBalanceVisible(!balanceVisible)}
          className="btn bg-gray-100 flex items-center gap-2"
          title={balanceVisible ? 'Hide balances' : 'Show balances'}
        >
          {balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          {balanceVisible ? 'Hide' : 'Show'}
        </button>
      </div>
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card flex items-center gap-4 bg-gradient-to-br from-white to-blue-50 border-blue-200">
          <div className="p-4 rounded-full bg-blue-100 text-blue-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Total Balance</p>
            <p className="text-3xl font-bold text-gray-800">
              {balanceVisible ? `$${stats.totalBalance.toFixed(2)}` : '••••••'}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4 bg-gradient-to-br from-white to-green-50 border-green-200">
          <div className="p-4 rounded-full bg-green-100 text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Total Income</p>
            <p className="text-3xl font-bold text-gray-800">
              {balanceVisible ? `$${stats.totalIncome.toFixed(2)}` : '••••••'}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4 bg-gradient-to-br from-white to-red-50 border-red-200">
          <div className="p-4 rounded-full bg-red-100 text-red-600">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Total Expenses</p>
            <p className="text-3xl font-bold text-red-600">
              {balanceVisible ? `-$${stats.totalExpense.toFixed(2)}` : '••••••'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="card lg:col-span-2 min-h-[400px] flex flex-col">
            <h3 className="text-xl font-bold mb-4">Cash Flow (Last 30 Days)</h3>
            <div className="flex-1 w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                        <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="income" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" />
                        <Area type="monotone" dataKey="expense" stroke="#EF4444" fillOpacity={1} fill="url(#colorExpense)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Account List */}
        <div className="card">
            <h3 className="text-xl font-bold mb-4">Your Accounts</h3>
            {accounts.length === 0 ? (
                <p className="text-gray-500">No accounts yet.</p>
            ) : (
                <div className="space-y-3">
                    {accounts.map(acc => {
                        const balance = acc.current_balance !== undefined ? acc.current_balance : acc.initial_balance;
                        const isNegative = balance < 0;
                        return (
                        <div key={acc.id} className={`flex justify-between items-center p-3 rounded-lg border group ${
                            isNegative ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-dashed border-gray-300'
                        }`}>
                            <div>
                                <span className="font-bold text-gray-700">{acc.name}</span>
                                <span className="text-xs text-gray-400 ml-2">({acc.type})</span>
                                {isNegative && <span className="text-xs text-red-600 font-bold ml-2">⚠️ Negative</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right mr-2">
                                    <div className={`font-mono text-lg font-bold ${
                                        balanceVisible ? (isNegative ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'
                                    }`}>
                                        {balanceVisible ? `$${balance.toFixed(2)}` : '••••••'}
                                    </div>
                                    {acc.current_balance !== undefined && acc.current_balance !== acc.initial_balance && (
                                        <div className="text-xs text-gray-400">
                                            Initial: ${acc.initial_balance.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleOpenAccountModal(acc)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500"
                                    aria-label={`Edit account ${acc.name}`}
                                    title="Edit account"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteAccount(acc.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                                    aria-label={`Delete account ${acc.name}`}
                                    title="Delete account"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
            <button 
                onClick={() => handleOpenAccountModal()}
                className="mt-4 w-full btn bg-blue-100 text-blue-600 text-sm flex items-center justify-center gap-2"
            >
                <Plus size={18} /> Add Account
            </button>
        </div>
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-4 font-heading">
              {editingAccount ? 'Edit Account' : 'Create Account'}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label htmlFor="account-name" className="block text-sm font-bold mb-1">Account Name</label>
                <input
                  id="account-name"
                  className="w-full p-2 border rounded font-hand text-lg"
                  placeholder="e.g. Main Checking"
                  required
                  value={accountForm.name}
                  onChange={e => setAccountForm({...accountForm, name: e.target.value})}
                />
              </div>
              <div>
                <label htmlFor="account-type" className="block text-sm font-bold mb-1">Account Type</label>
                <select
                  id="account-type"
                  className="w-full p-2 border rounded font-hand text-lg"
                  value={accountForm.type}
                  onChange={e => setAccountForm({...accountForm, type: e.target.value})}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit Card</option>
                  <option value="cash">Cash</option>
                  <option value="investment">Investment</option>
                </select>
              </div>
              <div>
                <label htmlFor="account-balance" className="block text-sm font-bold mb-1">Initial Balance</label>
                <input
                  id="account-balance"
                  className="w-full p-2 border rounded font-hand text-lg"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                  value={accountForm.initial_balance}
                  onChange={e => setAccountForm({...accountForm, initial_balance: e.target.value})}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="btn bg-gray-100 flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn bg-blue-500 text-white flex-1">
                  {editingAccount ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
