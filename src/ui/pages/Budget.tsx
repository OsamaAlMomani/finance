import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertTriangle,
  CalendarDays,
  Edit2,
  PiggyBank,
  PlusCircle,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
  Wallet
} from 'lucide-react';
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
  spent?: number;
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

interface BillItem {
  id: string;
  name: string;
  amount: number;
  next_due_date: string;
  is_paid?: number;
}

interface BudgetViewModel extends Budget {
  spentNow: number;
  usagePct: number;
  remaining: number;
  status: 'overspent' | 'near_limit' | 'on_track';
  topTransactions: TransactionItem[];
  relatedAlerts: AlertItem[];
}

type SummaryCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCurrencyCode = (value: unknown, fallback = 'USD') => {
  const normalized = String(value || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
};

const getAppCurrency = () => {
  if (typeof window === 'undefined') return 'USD';
  const raw = window.localStorage.getItem('appSettings');
  if (!raw) return 'USD';

  try {
    const parsed = JSON.parse(raw) as { currency?: string };
    return toCurrencyCode(parsed.currency, 'USD');
  } catch {
    return 'USD';
  }
};

const toDateKey = (value: string) => String(value || '').slice(0, 10);

const parseDateKey = (value: string) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;

  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-').map(Number);
  if (!yearRaw || !monthRaw || !dayRaw) return null;

  const parsed = new Date(yearRaw, monthRaw - 1, dayRaw, 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonth = (candidate: Date, reference: Date) =>
  candidate.getFullYear() === reference.getFullYear() && candidate.getMonth() === reference.getMonth();

const isDateInBudgetWindow = (dateValue: string, period: Budget['period'], referenceDate: Date) => {
  const candidate = parseDateKey(dateValue);
  if (!candidate) return false;

  const current = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0, 0);

  if (period === 'weekly') {
    const start = new Date(current);
    start.setDate(current.getDate() - 6);
    return candidate >= start && candidate <= current;
  }

  if (period === 'yearly') {
    return candidate.getFullYear() === current.getFullYear();
  }

  return isSameMonth(candidate, current);
};

const getDaysBetween = (fromDate: Date, toDate: Date) => {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / dayMs);
};

const formatMoneyAmount = (formatter: Intl.NumberFormat, value: number) => formatter.format(Math.abs(value));

const SummaryStatCard = ({ card }: { card: SummaryCard }) => {
  const Icon = card.icon;

  return (
    <div className={`card border ${card.tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-2 text-slate-700 shadow-sm">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{card.detail}</p>
    </div>
  );
};

export const BudgetPage = () => {
  const { t } = useI18n();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [pendingDeleteBudgetId, setPendingDeleteBudgetId] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState({
    categoryId: '',
    period: 'monthly' as Budget['period'],
    limit: ''
  });

  const today = useMemo(() => new Date(), []);
  const currency = useMemo(() => getAppCurrency(), []);
  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }),
    [currency]
  );

  const loadData = useCallback(async () => {
    if (!window.electron) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [buds, cats, txs, alertsData, billsData] = await Promise.all([
        window.electron.invoke('db-get-budgets'),
        window.electron.invoke('db-get-categories'),
        window.electron.invoke('db-get-transactions', {}),
        window.electron.invoke('db-get-alerts', { includeResolved: false }).catch(() => []),
        window.electron.invoke('db-get-bills').catch(() => [])
      ]);

      const normalizedCategories = Array.isArray(cats) ? cats : [];
      const firstExpenseCategory = normalizedCategories.find((category) => category.type === 'expense');

      setBudgets(Array.isArray(buds) ? buds : []);
      setCategories(normalizedCategories);
      setTransactions(Array.isArray(txs) ? txs : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setBills(Array.isArray(billsData) ? billsData : []);
      setNewBudget((previous) => ({
        ...previous,
        categoryId: previous.categoryId || firstExpenseCategory?.id || ''
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onChanged = () => {
      void loadData();
    };

    window.addEventListener('finance:data-changed', onChanged);
    return () => window.removeEventListener('finance:data-changed', onChanged);
  }, [loadData]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const budgetCards = useMemo<BudgetViewModel[]>(() => {
    return budgets.map((budget) => {
      const spentNow = Math.max(0, toNumber(budget.spent));
      const usageRaw = budget.limit_amount > 0 ? (spentNow / budget.limit_amount) * 100 : 0;
      const relatedAlerts = alerts.filter(
        (alert) => alert.source_type === 'budget' && String(alert.source_id || '').includes(budget.id)
      );
      const topTransactions = transactions
        .filter(
          (transaction) =>
            transaction.type === 'expense' &&
            transaction.category_id === budget.category_id &&
            isDateInBudgetWindow(transaction.date, budget.period, today)
        )
        .sort((left, right) => Number(right.amount) - Number(left.amount))
        .slice(0, 3);

      return {
        ...budget,
        spentNow,
        usagePct: Math.max(0, Math.min(usageRaw, 100)),
        remaining: budget.limit_amount - spentNow,
        status: spentNow > budget.limit_amount ? 'overspent' : usageRaw >= 90 ? 'near_limit' : 'on_track',
        topTransactions,
        relatedAlerts
      };
    });
  }, [alerts, budgets, today, transactions]);

  const sortedBudgetCards = useMemo(() => {
    const rankByStatus: Record<BudgetViewModel['status'], number> = {
      overspent: 0,
      near_limit: 1,
      on_track: 2
    };

    return [...budgetCards].sort((left, right) => {
      const statusDelta = rankByStatus[left.status] - rankByStatus[right.status];
      if (statusDelta !== 0) return statusDelta;
      return right.usagePct - left.usagePct;
    });
  }, [budgetCards]);

  const monthlyBudgetCards = useMemo(
    () => budgetCards.filter((budget) => budget.period === 'monthly'),
    [budgetCards]
  );

  const daysInMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    [today]
  );

  const daysRemainingInMonth = useMemo(
    () => Math.max(1, daysInMonth - today.getDate() + 1),
    [daysInMonth, today]
  );

  const dueSoonBills = useMemo(() => {
    return bills
      .filter((bill) => !Number(bill.is_paid))
      .map((bill) => {
        const dueDate = parseDateKey(bill.next_due_date);
        const daysToDue = dueDate ? getDaysBetween(today, dueDate) : 9999;

        return {
          ...bill,
          dueDate,
          daysToDue
        };
      })
      .filter((bill) => bill.dueDate && bill.daysToDue <= 14)
      .sort((left, right) => left.daysToDue - right.daysToDue);
  }, [bills, today]);

  const dueThisMonthTotal = useMemo(() => {
    return bills.reduce((sum, bill) => {
      if (Number(bill.is_paid)) return sum;
      const dueDate = parseDateKey(bill.next_due_date);
      if (!dueDate || !isSameMonth(dueDate, today)) return sum;
      return sum + toNumber(bill.amount);
    }, 0);
  }, [bills, today]);

  const budgetSummary = useMemo(() => {
    const monthlyPlanned = monthlyBudgetCards.reduce((sum, budget) => sum + toNumber(budget.limit_amount), 0);
    const monthlySpent = monthlyBudgetCards.reduce((sum, budget) => sum + budget.spentNow, 0);
    const monthlyRemaining = monthlyPlanned - monthlySpent;
    const safePool = monthlyRemaining - dueThisMonthTotal;
    const safeToSpendPerDay = monthlyBudgetCards.length > 0 ? safePool / daysRemainingInMonth : 0;
    const expectedSpendByNow = monthlyPlanned * (today.getDate() / daysInMonth);
    const paceDelta = monthlySpent - expectedSpendByNow;
    const overspentCount = budgetCards.filter((budget) => budget.status === 'overspent').length;
    const nearLimitCount = budgetCards.filter((budget) => budget.status === 'near_limit').length;
    const onTrackCount = budgetCards.filter((budget) => budget.status === 'on_track').length;
    const pressureBudgets = sortedBudgetCards.filter((budget) => budget.status !== 'on_track').slice(0, 3);

    return {
      monthlyPlanned,
      monthlySpent,
      monthlyRemaining,
      safeToSpendPerDay,
      expectedSpendByNow,
      paceDelta,
      overspentCount,
      nearLimitCount,
      onTrackCount,
      pressureBudgets
    };
  }, [budgetCards, daysInMonth, daysRemainingInMonth, dueThisMonthTotal, monthlyBudgetCards, sortedBudgetCards, today]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const safeValue = monthlyBudgetCards.length > 0 ? moneyFormatter.format(budgetSummary.safeToSpendPerDay) : '--';
    const safeDetail = monthlyBudgetCards.length === 0
      ? t('budget.safeNoMonthly')
      : budgetSummary.safeToSpendPerDay >= 0
        ? t('budget.safePositive', { amount: moneyFormatter.format(budgetSummary.safeToSpendPerDay) })
        : t('budget.safeNegative', { amount: formatMoneyAmount(moneyFormatter, budgetSummary.safeToSpendPerDay) });

    return [
      {
        id: 'monthly-planned',
        label: t('budget.metric.monthlyPlanned'),
        value: moneyFormatter.format(budgetSummary.monthlyPlanned),
        detail: t('budget.detail.monthlyBudgets', { count: monthlyBudgetCards.length }),
        icon: PiggyBank,
        tone: 'border-slate-200 bg-slate-50/80'
      },
      {
        id: 'monthly-spent',
        label: t('budget.metric.monthlySpent'),
        value: moneyFormatter.format(budgetSummary.monthlySpent),
        detail: t('budget.detail.overspentCount', { count: budgetSummary.overspentCount }),
        icon: TrendingDown,
        tone: 'border-rose-200 bg-rose-50/80'
      },
      {
        id: 'monthly-remaining',
        label: t('budget.metric.monthlyRemaining'),
        value: moneyFormatter.format(budgetSummary.monthlyRemaining),
        detail: t('budget.detail.billsThisMonth', { amount: moneyFormatter.format(dueThisMonthTotal) }),
        icon: Wallet,
        tone: 'border-emerald-200 bg-emerald-50/80'
      },
      {
        id: 'safe-to-spend',
        label: t('budget.metric.safeToSpend'),
        value: safeValue,
        detail: safeDetail,
        icon: Target,
        tone: 'border-amber-200 bg-amber-50/80'
      }
    ];
  }, [
    budgetSummary.monthlyPlanned,
    budgetSummary.monthlyRemaining,
    budgetSummary.monthlySpent,
    budgetSummary.overspentCount,
    budgetSummary.safeToSpendPerDay,
    dueThisMonthTotal,
    monthlyBudgetCards.length,
    moneyFormatter,
    t
  ]);

  const handleOpenModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setNewBudget({
        categoryId: budget.category_id,
        period: budget.period,
        limit: budget.limit_amount.toString()
      });
      setShowModal(true);
      return;
    }

    setEditingBudget(null);
    setNewBudget({
      categoryId: expenseCategories[0]?.id || '',
      period: 'monthly',
      limit: ''
    });
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.electron) return;

    await window.electron.invoke('db-save-budget', {
      id: editingBudget ? editingBudget.id : uuidv4(),
      category_id: newBudget.categoryId,
      period: newBudget.period,
      limit_amount: parseFloat(newBudget.limit)
    });

    setShowModal(false);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    void loadData();
  };

  const handleDelete = (id: string) => {
    setPendingDeleteBudgetId(id);
  };

  const confirmDeleteBudget = async () => {
    const id = pendingDeleteBudgetId;
    if (!id || !window.electron) return;

    setPendingDeleteBudgetId(null);
    await window.electron.invoke('db-delete-budget', id);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    void loadData();
  };

  if (loading) return <div>{t('budget.loading')}</div>;

  return (
    <div className="budget-page page-shell pb-6">
      <div className="page-hero">
        <div className="page-copy">
          <p className="page-eyebrow">{t('sidebar.domain.money')}</p>
          <h2 className="page-title heading-font">{t('budget.title')}</h2>
          <p className="page-subtitle">{t('budget.subtitle')}</p>
        </div>

        <button onClick={() => handleOpenModal()} className="btn bg-blue-500 text-white flex items-center gap-2">
          <PlusCircle size={20} /> {t('budget.create')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card) => (
          <SummaryStatCard key={card.id} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="card xl:col-span-2 border-slate-200 bg-white/95">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('budget.healthTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('budget.healthSubtitle')}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2 text-slate-700">
              <PiggyBank size={18} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-500">{t('budget.health.overspent')}</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{budgetSummary.overspentCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600">{t('budget.health.nearLimit')}</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{budgetSummary.nearLimitCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">{t('budget.health.onTrack')}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{budgetSummary.onTrackCount}</p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{t('budget.healthTitle')}</p>
                <p className="mt-1 text-sm text-slate-600">{t('budget.safeToSpendHint', { days: daysRemainingInMonth })}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                {budgetSummary.paceDelta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>
                  {budgetSummary.paceDelta > 0
                    ? t('budget.health.overPace', { amount: moneyFormatter.format(budgetSummary.paceDelta) })
                    : budgetSummary.paceDelta < 0
                      ? t('budget.health.underPace', { amount: formatMoneyAmount(moneyFormatter, budgetSummary.paceDelta) })
                      : t('budget.health.onPace')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t('budget.health.monthlyBudgeted')}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{moneyFormatter.format(budgetSummary.monthlyPlanned)}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t('budget.health.monthlySpent')}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{moneyFormatter.format(budgetSummary.monthlySpent)}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t('budget.health.expectedByNow')}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{moneyFormatter.format(budgetSummary.expectedSpendByNow)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 text-slate-900">
              <AlertTriangle size={16} className="text-amber-500" />
              <h4 className="font-bold">{t('budget.pressureTitle')}</h4>
            </div>

            <div className="mt-3 space-y-3">
              {budgetSummary.pressureBudgets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  {t('budget.pressureEmpty')}
                </div>
              )}

              {budgetSummary.pressureBudgets.map((budget) => (
                <div key={budget.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{budget.category_name}</p>
                      <p className="text-xs text-slate-500">{t(`budget.period.${budget.period}`)}</p>
                    </div>
                    <p className={`text-sm font-bold ${budget.status === 'overspent' ? 'text-rose-600' : 'text-amber-600'}`}>
                      {t('budget.usage', { percent: budget.usagePct.toFixed(0) })}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                    <span>{t('budget.spent', { amount: moneyFormatter.format(budget.spentNow) })}</span>
                    <span>
                      {budget.remaining < 0
                        ? t('budget.over', { amount: formatMoneyAmount(moneyFormatter, budget.remaining) })
                        : t('budget.left', { amount: moneyFormatter.format(budget.remaining) })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card border-slate-200 bg-white/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('budget.billsTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('budget.billsSubtitle', { count: dueSoonBills.length })}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2 text-slate-700">
              <CalendarDays size={18} />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {dueSoonBills.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                {t('budget.billsEmpty')}
              </div>
            )}

            {dueSoonBills.map((bill) => {
              const dueDateLabel = bill.dueDate ? bill.dueDate.toLocaleDateString() : '--';
              const timingCopy = bill.daysToDue < 0
                ? t('budget.billTiming.overdue', { count: Math.abs(bill.daysToDue) })
                : bill.daysToDue === 0
                  ? t('budget.billTiming.today')
                  : t('budget.billTiming.inDays', { count: bill.daysToDue });

              return (
                <div key={bill.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{bill.name}</p>
                      <p className="text-xs text-slate-500">{t('budget.billsDueDate', { date: dueDateLabel })}</p>
                    </div>
                    <p className="font-bold text-slate-900">{moneyFormatter.format(toNumber(bill.amount))}</p>
                  </div>

                  <p className={`mt-2 text-sm font-medium ${bill.daysToDue < 0 ? 'text-rose-600' : bill.daysToDue <= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                    {timingCopy}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
        {sortedBudgetCards.map((budget) => {
          const isExceeded = budget.status === 'overspent';
          const isNearLimit = budget.status === 'near_limit';
          const remainingCopy = budget.remaining < 0
            ? t('budget.over', { amount: formatMoneyAmount(moneyFormatter, budget.remaining) })
            : t('budget.left', { amount: moneyFormatter.format(budget.remaining) });

          return (
            <div
              key={budget.id}
              className={`card relative overflow-hidden group ${
                isExceeded
                  ? 'border-2 border-red-500 bg-red-50'
                  : isNearLimit
                    ? 'border-2 border-yellow-500 bg-yellow-50'
                    : 'border border-slate-200 bg-white'
              }`}
            >
              <div
                className={`absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-bold ${
                  isExceeded
                    ? 'bg-red-500 text-white'
                    : isNearLimit
                      ? 'bg-yellow-500 text-white'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isExceeded ? t('budget.exceeded') : isNearLimit ? t('budget.nearLimit') : t('budget.onTrack')}
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white category-color-bg ${getCategoryColorClass(budget.category_color)}`}>
                    <Wallet size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-900">{budget.category_name}</h3>
                    <p className="text-sm text-slate-500 capitalize">{t(`budget.period.${budget.period}`)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-xl text-slate-900">{moneyFormatter.format(budget.limit_amount)}</p>
                  <div className="flex gap-2 justify-end items-center">
                    <p className="text-sm text-slate-400">{t('budget.limit')}</p>
                    <button
                      onClick={() => handleOpenModal(budget)}
                      className="text-blue-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${t('common.edit')} ${budget.category_name}`}
                      title={t('common.edit')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${t('common.delete')} ${budget.category_name}`}
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-2 flex justify-between text-sm font-bold">
                <span className={isExceeded ? 'text-red-600' : `category-color-text ${getCategoryColorClass(budget.category_color)}`}>
                  {t('budget.spent', { amount: moneyFormatter.format(budget.spentNow) })}
                </span>
                <span className={isExceeded ? 'text-red-600' : 'text-slate-500'}>{remainingCopy}</span>
              </div>

              <progress
                className={`progress-bar ${getCategoryColorClass(budget.category_color)}`}
                value={budget.usagePct}
                max={100}
              />

              <div className="mt-3 text-xs text-slate-600">
                <p className="font-bold mb-1">{t('budget.connectedDetails')}</p>
                <p className="font-semibold">{t('budget.topTransactions')}</p>
                <ul className="ml-4 list-disc">
                  {budget.topTransactions.map((transaction) => (
                    <li key={transaction.id}>
                      {transaction.merchant || 'Expense'} - {moneyFormatter.format(toNumber(transaction.amount))} ({new Date(transaction.date).toLocaleDateString()})
                    </li>
                  ))}
                  {budget.topTransactions.length === 0 && <li>{t('budget.noMatchingExpenses')}</li>}
                </ul>
                <p className="mt-2">{t('budget.relatedAlerts', { count: budget.relatedAlerts.length })}</p>
              </div>
            </div>
          );
        })}

        {sortedBudgetCards.length === 0 && (
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
                  onChange={(event) => setNewBudget({ ...newBudget, categoryId: event.target.value })}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="budget-period" className="block text-sm font-bold mb-1">{t('budget.period')}</label>
                <select
                  id="budget-period"
                  className="w-full p-2 border rounded font-hand text-lg"
                  value={newBudget.period}
                  onChange={(event) => setNewBudget({ ...newBudget, period: event.target.value as Budget['period'] })}
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
                  type="number"
                  required
                  placeholder={t('budget.limitPlaceholder')}
                  className="w-full p-2 border rounded font-hand text-lg"
                  value={newBudget.limit}
                  onChange={(event) => setNewBudget({ ...newBudget, limit: event.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn bg-gray-100">
                  {t('common.cancel')}
                </button>
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
