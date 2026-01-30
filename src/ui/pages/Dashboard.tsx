import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardStats {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    chartData: { date: string; income: number; expense: number }[];
}

interface Account {
  id: string;
  name: string;
  initial_balance: number;
}

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
      totalBalance: 0,
      totalIncome: 0,
      totalExpense: 0, 
      chartData: []
  });
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (window.electron) {
        Promise.all([
            window.electron.invoke('db-get-dashboard-stats'),
            window.electron.invoke('db-get-accounts')
        ]).then(([statsData, accountsData]) => {
            setStats(statsData);
            setAccounts(accountsData);
        });
    }
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 heading-font">Dashboard</h2>
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card flex items-center gap-4 bg-gradient-to-br from-white to-blue-50 border-blue-200">
          <div className="p-4 rounded-full bg-blue-100 text-blue-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Total Balance</p>
            <p className="text-3xl font-bold text-gray-800">${stats.totalBalance.toFixed(2)}</p>
          </div>
        </div>

        <div className="card flex items-center gap-4 bg-gradient-to-br from-white to-green-50 border-green-200">
          <div className="p-4 rounded-full bg-green-100 text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Total Income</p>
            <p className="text-3xl font-bold text-green-600">+${stats.totalIncome.toFixed(2)}</p>
          </div>
        </div>

        <div className="card flex items-center gap-4 bg-gradient-to-br from-white to-red-50 border-red-200">
          <div className="p-4 rounded-full bg-red-100 text-red-600">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Total Expenses</p>
            <p className="text-3xl font-bold text-red-600">-${stats.totalExpense.toFixed(2)}</p>
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
                    {accounts.map(acc => (
                        <div key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <span className="font-bold text-gray-700">{acc.name}</span>
                            <span className="font-mono text-lg text-blue-600 font-bold">${acc.initial_balance}</span>
                        </div>
                    ))}
                </div>
            )}
            <button className="mt-4 w-full btn bg-blue-100 text-blue-600 text-sm">Manage Accounts</button>
        </div>
      </div>
    </div>
  );
};
