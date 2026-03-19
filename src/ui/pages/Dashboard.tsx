import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../contexts/useI18n';

interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  chartData: { date: string; income: number; expense: number }[];
  activeAlerts?: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  initial_balance: number;
  current_balance?: number;
}

interface BudgetInsight {
  id: string;
  category_name?: string;
  limit_amount?: number;
  spent?: number;
}

interface PlanInsight {
  id: string;
  title?: string;
  scenario_if?: string | null;
  scenario_else?: string | null;
  what_if?: string | null;
  outcome?: string | null;
  months_overdue?: number | null;
}

type SuggestionTone = 'critical' | 'warning' | 'info' | 'positive';

interface SuggestionItem {
  id: string;
  tone: SuggestionTone;
  text: string;
  action?: {
    label: string;
    path: string;
  };
}

interface FeatureHealthItem {
  key: 'budgets' | 'plans';
  label: string;
  ok: boolean;
  message: string;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStats = (input: unknown): DashboardStats => {
  const raw = (input || {}) as Partial<DashboardStats>;
  const chartData = Array.isArray(raw.chartData) ? raw.chartData : [];

  return {
    totalBalance: toNumber(raw.totalBalance),
    totalIncome: toNumber(raw.totalIncome),
    totalExpense: toNumber(raw.totalExpense),
    activeAlerts: toNumber(raw.activeAlerts),
    chartData: chartData.map((point) => ({
      date: String(point?.date || ''),
      income: toNumber(point?.income),
      expense: toNumber(point?.expense)
    }))
  };
};

export const Dashboard = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    chartData: [],
    activeAlerts: 0
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [featureHealth, setFeatureHealth] = useState<FeatureHealthItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [advisorError, setAdvisorError] = useState('');
  const [advisorRefreshing, setAdvisorRefreshing] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'checking',
    initial_balance: ''
  });

  const buildFeatureHealth = (
    budgetsReady: boolean,
    plansReady: boolean,
    budgetCount: number,
    planCount: number
  ): FeatureHealthItem[] => [
    {
      key: 'budgets',
      label: t('dashboard.advisor.feature.budgets'),
      ok: budgetsReady,
      message: budgetsReady
        ? budgetCount > 0
          ? t('dashboard.advisor.feature.available', { count: budgetCount })
          : t('dashboard.advisor.feature.empty')
        : t('dashboard.advisor.feature.failed')
    },
    {
      key: 'plans',
      label: t('dashboard.advisor.feature.plans'),
      ok: plansReady,
      message: plansReady
        ? planCount > 0
          ? t('dashboard.advisor.feature.available', { count: planCount })
          : t('dashboard.advisor.feature.empty')
        : t('dashboard.advisor.feature.failed')
    }
  ];

  const buildSuggestions = (
    budgets: BudgetInsight[],
    plans: PlanInsight[],
    budgetsReady: boolean,
    plansReady: boolean
  ): SuggestionItem[] => {
    const budgetAction = { label: t('dashboard.advisor.action.openBudget'), path: '/budget' };
    const plansAction = { label: t('dashboard.advisor.action.openPlans'), path: '/plans' };
    const reportsAction = { label: t('dashboard.advisor.action.openReports'), path: '/reports' };
    const settingsAction = { label: t('dashboard.advisor.action.openSettings'), path: '/settings' };
    const next: SuggestionItem[] = [];

    if (!budgetsReady && !plansReady) {
      return [
        {
          id: 'data-unavailable',
          tone: 'warning',
          text: t('dashboard.advisor.item.dataUnavailable'),
          action: settingsAction
        }
      ];
    }

    if (budgetsReady) {
      if (budgets.length === 0) {
        next.push({
          id: 'no-budgets',
          tone: 'info',
          text: t('dashboard.advisor.item.noBudget'),
          action: budgetAction
        });
      } else {
        const overspent = budgets.filter((budget) => {
          const spent = toNumber(budget.spent);
          const limit = toNumber(budget.limit_amount);
          return limit > 0 && spent > limit;
        });

        if (overspent.length > 0) {
          const totalOver = overspent.reduce((sum, budget) => {
            const spent = toNumber(budget.spent);
            const limit = toNumber(budget.limit_amount);
            return sum + Math.max(spent - limit, 0);
          }, 0);

          next.push({
            id: 'overspent',
            tone: 'critical',
            text: t('dashboard.advisor.item.overspent', {
              count: overspent.length,
              amount: totalOver.toFixed(2)
            }),
            action: budgetAction
          });
        }

        const nearLimit = budgets.filter((budget) => {
          const spent = toNumber(budget.spent);
          const limit = toNumber(budget.limit_amount);
          if (limit <= 0) return false;
          const ratio = spent / limit;
          return ratio >= 0.9 && ratio <= 1;
        });

        if (nearLimit.length > 0) {
          next.push({
            id: 'near-limit',
            tone: 'warning',
            text: t('dashboard.advisor.item.nearLimit', { count: nearLimit.length }),
            action: budgetAction
          });
        }

        const underUsed = budgets.filter((budget) => {
          const spent = toNumber(budget.spent);
          const limit = toNumber(budget.limit_amount);
          if (limit <= 0) return false;
          return spent / limit < 0.35;
        });

        if (underUsed.length >= 2) {
          next.push({
            id: 'under-used',
            tone: 'info',
            text: t('dashboard.advisor.item.reallocate', { count: underUsed.length }),
            action: budgetAction
          });
        }
      }
    }

    if (plansReady) {
      if (plans.length === 0) {
        next.push({
          id: 'no-plans',
          tone: 'info',
          text: t('dashboard.advisor.item.noPlans'),
          action: plansAction
        });
      } else {
        const overduePlans = plans.filter((plan) => toNumber(plan.months_overdue) > 0);
        if (overduePlans.length > 0) {
          const maxMonths = overduePlans.reduce((max, plan) => Math.max(max, toNumber(plan.months_overdue)), 0);
          next.push({
            id: 'overdue-plans',
            tone: 'critical',
            text: t('dashboard.advisor.item.overduePlans', {
              count: overduePlans.length,
              months: maxMonths
            }),
            action: plansAction
          });
        }

        const incompletePlans = plans.filter((plan) => {
          const detailCount = [plan.scenario_if, plan.scenario_else, plan.what_if, plan.outcome]
            .map((field) => String(field || '').trim())
            .filter(Boolean).length;
          return detailCount < 2;
        });

        if (incompletePlans.length > 0) {
          next.push({
            id: 'incomplete-plans',
            tone: 'warning',
            text: t('dashboard.advisor.item.incompletePlans', { count: incompletePlans.length }),
            action: plansAction
          });
        }
      }
    }

    if (next.length === 0) {
      next.push({
        id: 'healthy',
        tone: 'positive',
        text: t('dashboard.advisor.item.healthy'),
        action: reportsAction
      });
    }

    return next.slice(0, 4);
  };

  const loadData = async () => {
    if (!window.electron) {
      setStats({
        totalBalance: 0,
        totalIncome: 0,
        totalExpense: 0,
        chartData: [],
        activeAlerts: 0
      });
      setAccounts([]);
      setAdvisorError(t('dashboard.advisor.noBackend'));
      setFeatureHealth(
        buildFeatureHealth(false, false, 0, 0).map((item) => ({
          ...item,
          message: t('dashboard.advisor.feature.unavailableBackend')
        }))
      );
      setSuggestions([
        {
          id: 'backend-unavailable',
          tone: 'warning',
          text: t('dashboard.advisor.item.noBackend'),
          action: {
            label: t('dashboard.advisor.action.openSettings'),
            path: '/settings'
          }
        }
      ]);
      return;
    }

    setAdvisorRefreshing(true);
    try {
      const [statsResult, accountsResult, budgetsResult, plansResult] = await Promise.allSettled([
        window.electron.invoke('db-get-dashboard-stats'),
        window.electron.invoke('db-get-accounts-with-balance'),
        window.electron.invoke('db-get-budgets'),
        window.electron.invoke('db-get-plans')
      ]);

      if (statsResult.status === 'fulfilled') {
        setStats(normalizeStats(statsResult.value));
      } else {
        setStats(normalizeStats(undefined));
      }

      if (accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)) {
        setAccounts(accountsResult.value as Account[]);
      } else {
        setAccounts([]);
      }

      const budgetsReady = budgetsResult.status === 'fulfilled' && Array.isArray(budgetsResult.value);
      const plansReady = plansResult.status === 'fulfilled' && Array.isArray(plansResult.value);

      const budgets = budgetsReady ? (budgetsResult.value as BudgetInsight[]) : [];
      const plans = plansReady ? (plansResult.value as PlanInsight[]) : [];

      setFeatureHealth(buildFeatureHealth(budgetsReady, plansReady, budgets.length, plans.length));
      setSuggestions(buildSuggestions(budgets, plans, budgetsReady, plansReady));
      setAdvisorError(!budgetsReady || !plansReady ? t('dashboard.advisor.partialData') : '');
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      setAdvisorError(t('dashboard.advisor.failedToLoad'));
      setFeatureHealth(buildFeatureHealth(false, false, 0, 0));
      setSuggestions([
        {
          id: 'load-failed',
          tone: 'warning',
          text: t('dashboard.advisor.item.dataUnavailable'),
          action: {
            label: t('dashboard.advisor.action.openSettings'),
            path: '/settings'
          }
        }
      ]);
    } finally {
      setAdvisorRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const onChanged = () => {
      void loadData();
    };
    window.addEventListener('finance:data-changed', onChanged);
    return () => window.removeEventListener('finance:data-changed', onChanged);
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
      await window.electron.invoke('db-update-account', {
        id: editingAccount.id,
        name: accountForm.name,
        type: accountForm.type,
        initialBalance: parseFloat(accountForm.initial_balance),
        currency: 'USD'
      });
    } else {
      await window.electron.invoke('db-create-account', {
        id: uuidv4(),
        name: accountForm.name,
        type: accountForm.type,
        initialBalance: parseFloat(accountForm.initial_balance),
        currency: 'USD'
      });
    }
    setShowAccountModal(false);
    void loadData();
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(t('dashboard.deleteConfirm'))) return;
    if (!window.electron) return;
    await window.electron.invoke('db-delete-account', id);
    void loadData();
  };

  const renderSuggestionIcon = (tone: SuggestionTone) => {
    if (tone === 'critical' || tone === 'warning') return <AlertTriangle size={16} />;
    if (tone === 'positive') return <CheckCircle2 size={16} />;
    return <Info size={16} />;
  };

  const suggestionToneClass: Record<SuggestionTone, string> = {
    critical: 'border-red-300 bg-red-50 text-red-700',
    warning: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    info: 'border-blue-300 bg-blue-50 text-blue-700',
    positive: 'border-green-300 bg-green-50 text-green-700'
  };

  const summaryCards = [
    {
      key: 'balance',
      title: t('dashboard.totalBalance'),
      icon: DollarSign,
      value: balanceVisible ? `$${stats.totalBalance.toFixed(2)}` : '••••••',
      tone: 'from-white via-blue-50 to-blue-100/70 border-blue-200',
      iconTone: 'bg-blue-100 text-blue-600'
    },
    {
      key: 'income',
      title: t('dashboard.totalIncome'),
      icon: TrendingUp,
      value: balanceVisible ? `$${stats.totalIncome.toFixed(2)}` : '••••••',
      tone: 'from-white via-emerald-50 to-emerald-100/70 border-emerald-200',
      iconTone: 'bg-emerald-100 text-emerald-600'
    },
    {
      key: 'expense',
      title: t('dashboard.totalExpenses'),
      icon: TrendingDown,
      value: balanceVisible ? `-$${stats.totalExpense.toFixed(2)}` : '••••••',
      tone: 'from-white via-rose-50 to-rose-100/70 border-rose-200',
      iconTone: 'bg-rose-100 text-rose-600',
      valueTone: 'text-rose-600'
    }
  ];

  return (
    <div className="dashboard-page h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold heading-font">{t('dashboard.title')}</h2>
        <motion.button
          onClick={() => setBalanceVisible(!balanceVisible)}
          className="btn bg-gray-100 flex items-center gap-2"
          title={balanceVisible ? t('dashboard.hideBalances') : t('dashboard.showBalances')}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          {balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          {balanceVisible ? t('dashboard.hide') : t('dashboard.show')}
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              className={`card relative flex items-center gap-4 bg-gradient-to-br ${card.tone} shadow-[0_16px_30px_-20px_rgba(15,23,42,0.45)]`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.07 }}
              whileHover={{ y: -6, scale: 1.01 }}
            >
              <div className={`p-4 rounded-full ring-2 ring-white/70 ${card.iconTone}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">{card.title}</p>
                <p className={`text-3xl font-bold ${card.valueTone || 'text-gray-800'}`}>{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        className="card mb-6 relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 border-indigo-200/60"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-indigo-200/35 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-cyan-200/30 blur-2xl" />
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={18} />
              {t('dashboard.advisor.title')}
            </h3>
            <p className="text-sm text-gray-500">{t('dashboard.advisor.subtitle')}</p>
          </div>
          <motion.button
            className="btn bg-gray-100 text-sm flex items-center gap-2"
            onClick={() => void loadData()}
            disabled={advisorRefreshing}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <RefreshCw size={15} className={advisorRefreshing ? 'animate-spin' : ''} />
            {t('dashboard.advisor.refresh')}
          </motion.button>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mb-4">
          <span className="text-sm text-blue-700 font-semibold">
            {t('dashboard.advisor.activeAlerts', { count: stats.activeAlerts || 0 })}
          </span>
        </div>

        {advisorError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4 text-sm text-red-700">
            {advisorError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {featureHealth.map((feature) => (
            <motion.div
              key={feature.key}
              className={`rounded-lg border px-3 py-2 ${feature.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              whileHover={{ scale: 1.01 }}
            >
              <div className={`text-sm font-bold ${feature.ok ? 'text-green-700' : 'text-red-700'}`}>{feature.label}</div>
              <div className={`text-xs mt-1 ${feature.ok ? 'text-green-700/90' : 'text-red-700/90'}`}>{feature.message}</div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {suggestions.map((item) => {
              const action = item.action;
              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`rounded-lg border px-3 py-2 flex items-start gap-2 text-sm ${suggestionToneClass[item.tone]}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  whileHover={{ x: 2, scale: 1.005 }}
                >
                  <span className="mt-0.5 shrink-0">{renderSuggestionIcon(item.tone)}</span>
                  <span className="flex-1">{item.text}</span>
                  {action && (
                    <motion.button
                      type="button"
                      className="shrink-0 rounded-md border border-current/30 bg-white/70 px-2 py-1 text-xs font-bold hover:bg-white transition-colors"
                      onClick={() => navigate(action.path)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {action.label}
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <motion.div
          className="card lg:col-span-2 min-h-0 flex flex-col"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.18 }}
        >
          <h3 className="text-xl font-bold mb-4">{t('dashboard.cashFlow')}</h3>
          <div className="flex-1 w-full h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-tone-b, #9aa2ae)" stopOpacity={0.82} />
                    <stop offset="95%" stopColor="var(--chart-tone-a, #626973)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-tone-a, #626973)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--chart-tone-b, #9aa2ae)" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="income" stroke="var(--chart-tone-b, #9aa2ae)" fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="var(--chart-tone-a, #626973)" fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          className="card flex flex-col min-h-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.24 }}
        >
          <h3 className="text-xl font-bold mb-4">{t('dashboard.accounts')}</h3>
          {accounts.length === 0 ? (
            <p className="text-gray-500">{t('dashboard.noAccounts')}</p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {accounts.map((acc) => {
                const balance = acc.current_balance !== undefined ? acc.current_balance : acc.initial_balance;
                const isNegative = balance < 0;
                return (
                  <motion.div
                    key={acc.id}
                    className={`flex justify-between items-center p-3 rounded-lg border group ${
                      isNegative ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-dashed border-gray-300'
                    }`}
                    whileHover={{ y: -2, scale: 1.005 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div>
                      <span className="font-bold text-gray-700">{acc.name}</span>
                      <span className="text-xs text-gray-400 ml-2">({acc.type})</span>
                      {isNegative && <span className="text-xs text-red-600 font-bold ml-2">⚠️ {t('dashboard.negative')}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <div
                          className={`font-mono text-lg font-bold ${
                            balanceVisible ? (isNegative ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'
                          }`}
                        >
                          {balanceVisible ? `$${balance.toFixed(2)}` : '••••••'}
                        </div>
                        {acc.current_balance !== undefined && acc.current_balance !== acc.initial_balance && (
                          <div className="text-xs text-gray-400">
                            {t('dashboard.initial')}: ${acc.initial_balance.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleOpenAccountModal(acc)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500"
                        aria-label={`${t('common.edit')} ${acc.name}`}
                        title={t('common.edit')}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                        aria-label={`${t('common.delete')} ${acc.name}`}
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          <motion.button
            onClick={() => handleOpenAccountModal()}
            className="mt-4 w-full btn bg-blue-100 text-blue-600 text-sm flex items-center justify-center gap-2"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={18} /> {t('dashboard.addAccount')}
          </motion.button>
        </motion.div>
      </div>

      {showAccountModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-4 font-heading">
              {editingAccount ? t('dashboard.editAccount') : t('dashboard.createAccount')}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label htmlFor="account-name" className="block text-sm font-bold mb-1">{t('dashboard.accountName')}</label>
                <input
                  id="account-name"
                  className="w-full p-2 border rounded font-hand text-lg"
                  placeholder={t('dashboard.accountName')}
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="account-type" className="block text-sm font-bold mb-1">{t('dashboard.accountType')}</label>
                <select
                  id="account-type"
                  className="w-full p-2 border rounded font-hand text-lg"
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                >
                  <option value="checking">{t('dashboard.accountType.checking')}</option>
                  <option value="savings">{t('dashboard.accountType.savings')}</option>
                  <option value="credit">{t('dashboard.accountType.credit')}</option>
                  <option value="cash">{t('dashboard.accountType.cash')}</option>
                  <option value="investment">{t('dashboard.accountType.investment')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="account-balance" className="block text-sm font-bold mb-1">{t('dashboard.initialBalance')}</label>
                <input
                  id="account-balance"
                  className="w-full p-2 border rounded font-hand text-lg"
                  type="number"
                  step="0.01"
                  placeholder={t('transactions.amountPlaceholder')}
                  required
                  value={accountForm.initial_balance}
                  onChange={(e) => setAccountForm({ ...accountForm, initial_balance: e.target.value })}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setShowAccountModal(false)} className="btn bg-gray-100 flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn bg-blue-500 text-white flex-1">
                  {editingAccount ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
