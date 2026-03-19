import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Trash2, Edit2, AlertTriangle, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../contexts/useI18n';

interface Loan {
  id: string;
  name: string;
  principal_amount: number;
  current_balance: number;
  interest_rate: number;
  payment_amount: number;
  payment_frequency: 'monthly' | 'biweekly' | 'weekly';
  start_date: string;
  end_date: string;
  lender: string;
  notes?: string;
  next_due_date?: string;
  due_status?: 'upcoming' | 'due_soon' | 'overdue' | string;
}

interface AlertItem {
  id: string;
  source_type: string;
  source_id: string;
  message: string;
  status: string;
  severity: string;
}

interface BudgetItem {
  id: string;
  limit_amount: number;
  spent?: number;
}

type DueStatus = 'upcoming' | 'due_soon' | 'overdue';

interface SummaryCardItem {
  key: string;
  label: string;
  value: string;
  tone: string;
  valueTone: string;
}

const statusLabelKey: Record<DueStatus, string> = {
  upcoming: 'loans.status.upcoming',
  due_soon: 'loans.status.dueSoon',
  overdue: 'loans.status.overdue'
};

const summaryCardMotion = {
  hidden: { opacity: 0, y: 16 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, delay: index * 0.06 }
  })
};

const loanCardMotion = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, delay: index * 0.05 }
  }),
  exit: { opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.2 } }
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const normalizeDueStatus = (status?: string): DueStatus => {
  if (status === 'overdue') return 'overdue';
  if (status === 'due_soon') return 'due_soon';
  return 'upcoming';
};

const getDueToneClasses = (status: DueStatus) => {
  if (status === 'overdue') {
    return {
      card: 'from-rose-50 via-white to-red-100/70 border-rose-300',
      badge: 'border-rose-300 bg-rose-100 text-rose-700',
      progressGlow: 'loan-progress-glow-danger'
    };
  }

  if (status === 'due_soon') {
    return {
      card: 'from-amber-50 via-white to-orange-100/60 border-amber-300',
      badge: 'border-amber-300 bg-amber-100 text-amber-800',
      progressGlow: 'loan-progress-glow-warn'
    };
  }

  return {
    card: 'from-emerald-50 via-white to-cyan-100/70 border-emerald-200',
    badge: 'border-emerald-300 bg-emerald-100 text-emerald-700',
    progressGlow: 'loan-progress-glow-safe'
  };
};

export const LoansPage = () => {
  const { t } = useI18n();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [hoveredProgress, setHoveredProgress] = useState<{ loanId: string; percent: number } | null>(null);

  const [loanForm, setLoanForm] = useState<{
    name: string;
    principal_amount: string;
    current_balance: string;
    interest_rate: string;
    payment_amount: string;
    payment_frequency: 'monthly' | 'biweekly' | 'weekly';
    start_date: string;
    end_date: string;
    lender: string;
    notes: string;
    next_due_date: string;
    due_status: DueStatus;
  }>({
    name: '',
    principal_amount: '',
    current_balance: '',
    interest_rate: '',
    payment_amount: '',
    payment_frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    lender: '',
    notes: '',
    next_due_date: new Date().toISOString().split('T')[0],
    due_status: 'upcoming'
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
    if (!window.electron) {
      setLoading(false);
      return;
    }
    try {
      const [loansData, alertsData, budgetsData] = await Promise.all([
        window.electron.invoke('db-get-loans'),
        window.electron.invoke('db-get-alerts', { includeResolved: false }).catch(() => []),
        window.electron.invoke('db-get-budgets').catch(() => [])
      ]);
      setLoans(loansData || []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setBudgets(Array.isArray(budgetsData) ? budgetsData : []);
    } catch (e) {
      console.error('Failed to load loans:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (loan?: Loan) => {
    if (loan) {
      const dueStatus = normalizeDueStatus(loan.due_status);
      setEditingLoan(loan);
      setLoanForm({
        name: loan.name,
        principal_amount: loan.principal_amount.toString(),
        current_balance: loan.current_balance.toString(),
        interest_rate: loan.interest_rate.toString(),
        payment_amount: loan.payment_amount.toString(),
        payment_frequency: loan.payment_frequency,
        start_date: loan.start_date,
        end_date: loan.end_date,
        lender: loan.lender,
        notes: loan.notes || '',
        next_due_date: loan.next_due_date || loan.end_date || new Date().toISOString().split('T')[0],
        due_status: dueStatus
      });
    } else {
      setEditingLoan(null);
      setLoanForm({
        name: '',
        principal_amount: '',
        current_balance: '',
        interest_rate: '',
        payment_amount: '',
        payment_frequency: 'monthly',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        lender: '',
        notes: '',
        next_due_date: new Date().toISOString().split('T')[0],
        due_status: 'upcoming'
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    await window.electron.invoke('db-save-loan', {
      id: editingLoan ? editingLoan.id : uuidv4(),
      name: loanForm.name,
      principal_amount: parseFloat(loanForm.principal_amount),
      current_balance: parseFloat(loanForm.current_balance),
      interest_rate: parseFloat(loanForm.interest_rate),
      payment_amount: parseFloat(loanForm.payment_amount),
      payment_frequency: loanForm.payment_frequency,
      start_date: loanForm.start_date,
      end_date: loanForm.end_date,
      lender: loanForm.lender,
      notes: loanForm.notes,
      next_due_date: loanForm.next_due_date,
      due_status: loanForm.due_status
    });

    setShowModal(false);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('loans.deleteConfirm'))) return;
    if (!window.electron) return;
    await window.electron.invoke('db-delete-loan', id);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    loadData();
  };

  const calculateMonthlyInterest = (balance: number, annualRate: number) => {
    return (balance * (annualRate / 100)) / 12;
  };

  const calculateProgress = (loan: Loan) => {
    if (!Number.isFinite(loan.principal_amount) || loan.principal_amount <= 0) return 0;
    const rawPercent = ((loan.principal_amount - loan.current_balance) / loan.principal_amount) * 100;
    return clampPercent(rawPercent);
  };

  const updateCrosshair = (loanId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    setHoveredProgress({ loanId, percent });
  };

  const clearCrosshair = (loanId: string) => {
    setHoveredProgress((prev) => (prev?.loanId === loanId ? null : prev));
  };

  if (loading) return <div>{t('common.loading')}</div>;

  const totalDebt = loans.reduce((sum, loan) => sum + loan.current_balance, 0);
  const monthlyInterest = loans.reduce(
    (sum, loan) => sum + calculateMonthlyInterest(loan.current_balance, loan.interest_rate),
    0
  );
  const highInterestLoans = loans.filter((loan) => loan.interest_rate > 7).length;
  const monthlyBudgetLeft = budgets.reduce(
    (sum, budget) => sum + (Number(budget.limit_amount || 0) - Number(budget.spent || 0)),
    0
  );

  const summaryCards: SummaryCardItem[] = [
    {
      key: 'total-debt',
      label: t('loans.totalDebt'),
      value: `$${totalDebt.toFixed(2)}`,
      tone: 'from-red-50 via-white to-rose-100/70 border-red-200',
      valueTone: 'text-red-600'
    },
    {
      key: 'monthly-interest',
      label: t('loans.monthlyInterest'),
      value: `$${monthlyInterest.toFixed(2)}`,
      tone: 'from-yellow-50 via-white to-amber-100/70 border-amber-200',
      valueTone: 'text-amber-600'
    },
    {
      key: 'high-interest',
      label: t('loans.highInterest'),
      value: `${highInterestLoans}`,
      tone: 'from-orange-50 via-white to-orange-100/70 border-orange-200',
      valueTone: 'text-orange-600'
    }
  ];

  return (
    <div className="loans-page h-full flex flex-col overflow-hidden">
      <motion.div
        className="flex flex-wrap justify-between items-center gap-3 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <h2 className="text-3xl font-bold font-heading">{t('loans.title')}</h2>
        <motion.button
          onClick={() => handleOpenModal()}
          className="btn bg-red-500 text-white flex items-center gap-2 shadow-lg shadow-red-300/30"
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
        >
          <PlusCircle size={20} /> {t('loans.add')}
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.key}
            className={`card bg-gradient-to-br ${card.tone} shadow-[0_14px_26px_-18px_rgba(15,23,42,0.55)]`}
            custom={index}
            variants={summaryCardMotion}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -4, scale: 1.01 }}
          >
            <p className="text-sm text-gray-500 font-bold uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.valueTone}`}>{card.value}</p>
            {card.key === 'high-interest' && <p className="text-xs text-gray-400 mt-1">{t('loans.aprHint')}</p>}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {loans.map((loan, index) => {
            const progress = calculateProgress(loan);
            const monthlyInt = calculateMonthlyInterest(loan.current_balance, loan.interest_rate);
            const isHighInterest = loan.interest_rate > 7;
            const relatedAlerts = alerts.filter((alert) => alert.source_type === 'loan' && alert.source_id === loan.id);
            const dueStatus = normalizeDueStatus(loan.due_status);
            const tone = getDueToneClasses(dueStatus);
            const cursorValue = hoveredProgress?.loanId === loan.id ? hoveredProgress.percent : null;
            const paidAmount = Math.max(loan.principal_amount - loan.current_balance, 0);

            return (
              <motion.article
                key={loan.id}
                layout
                className={`card relative group border bg-gradient-to-br ${tone.card}`}
                custom={index}
                variants={loanCardMotion}
                initial="hidden"
                animate="visible"
                exit="exit"
                whileHover={{ y: -5, scale: 1.005 }}
              >
                <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-white/50 blur-2xl" />
                <div className="pointer-events-none absolute -left-10 bottom-0 h-20 w-20 rounded-full bg-blue-200/20 blur-2xl" />

                <div className="relative z-[1] flex justify-between items-start mb-4 gap-3">
                  <div>
                    <h3 className="font-bold text-xl flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-500" />
                      {loan.name}
                    </h3>
                    <p className="text-sm text-gray-500">{loan.lender}</p>
                  </div>

                  <div className="flex gap-2 items-center">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${tone.badge}`}>
                      {t(statusLabelKey[dueStatus])}
                    </span>
                    <button
                      onClick={() => handleOpenModal(loan)}
                      className="text-blue-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${t('common.edit')} ${loan.name}`}
                      title={t('common.edit')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`${t('common.delete')} ${loan.name}`}
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isHighInterest && (
                  <motion.div
                    className="relative z-[1] mb-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-md"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <AlertTriangle size={12} /> {t('loans.highRate')}
                  </motion.div>
                )}

                <div className="relative z-[1] grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">{t('loans.currentBalance')}</p>
                    <p className="text-2xl font-bold text-red-600">${loan.current_balance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">{t('loans.interestRate')}</p>
                    <p className={`text-2xl font-bold ${isHighInterest ? 'text-orange-600' : 'text-gray-700'}`}>
                      {loan.interest_rate.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">{t('loans.payment')}</p>
                    <p className="text-lg font-bold text-gray-700">
                      ${loan.payment_amount.toFixed(2)}
                      <span className="text-xs text-gray-400 ml-1">/{loan.payment_frequency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">{t('loans.monthlyInterest')}</p>
                    <p className="text-lg font-bold text-yellow-600">${monthlyInt.toFixed(2)}</p>
                  </div>
                </div>

                <div className="relative z-[1] mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{t('loans.progress')}</span>
                    <span className="font-bold text-green-600">{t('loans.paidOff', { percent: progress.toFixed(1) })}</span>
                  </div>

                  <div
                    className={`loan-progress-zone ${tone.progressGlow}`}
                    onMouseMove={(event) => updateCrosshair(loan.id, event)}
                    onMouseEnter={(event) => updateCrosshair(loan.id, event)}
                    onMouseLeave={() => clearCrosshair(loan.id)}
                  >
                    <div className="loan-progress-track">
                      <motion.div
                        className="loan-progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />

                      <AnimatePresence>
                        {cursorValue !== null && (
                          <motion.div
                            className="loan-progress-crosshair"
                            style={{ left: `${cursorValue}%` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.14 }}
                          >
                            <span className="loan-progress-crosshair-dot" />
                            <span className="loan-progress-crosshair-label">
                              {t('loans.cursorPosition', { percent: cursorValue.toFixed(1) })}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex justify-between mt-2 text-[11px] font-semibold text-gray-500">
                    <span>{t('loans.paidAmount', { amount: paidAmount.toFixed(2) })}</span>
                    <span>
                      {cursorValue !== null
                        ? t('loans.cursorBalanceHint', {
                            amount: (loan.principal_amount * (1 - cursorValue / 100)).toFixed(2)
                          })
                        : t('loans.hoverProgressHint')}
                    </span>
                  </div>
                </div>

                <div className="relative z-[1] mt-3 text-xs text-gray-600 space-y-1">
                  <p>
                    <span className="font-semibold">{t('loans.nextDue')}:</span> {loan.next_due_date || loan.end_date || 'n/a'}
                  </p>
                  <p>
                    <span className="font-semibold">{t('loans.dueStatus')}:</span> {t(statusLabelKey[dueStatus])}
                  </p>
                  <p>
                    <span className="font-semibold">{t('loans.relatedAlerts')}:</span> {relatedAlerts.length}
                  </p>
                  <p>
                    <span className="font-semibold">{t('loans.budgetImpact')}:</span> {t('loans.budgetImpactText', {
                      payment: loan.payment_amount.toFixed(2),
                      budget: monthlyBudgetLeft.toFixed(2)
                    })}
                  </p>
                </div>

                {loan.notes && <p className="relative z-[1] text-sm text-gray-500 mt-2 italic">{loan.notes}</p>}
              </motion.article>
            );
          })}
        </AnimatePresence>

        {loans.length === 0 && (
          <motion.div
            className="md:col-span-2 text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl bg-white/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-xl font-hand">{t('loans.none')}</p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 px-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl border-2 border-gray-200 max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, y: 22, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-4 font-heading">
                {editingLoan ? t('loans.edit') : t('loans.addTitle')}
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="loan-name" className="block text-sm font-bold mb-1">
                      {t('loans.name')}
                    </label>
                    <input
                      id="loan-name"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('loans.namePlaceholder')}
                      required
                      value={loanForm.name}
                      onChange={(event) => setLoanForm({ ...loanForm, name: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="loan-lender" className="block text-sm font-bold mb-1">
                      {t('loans.lender')}
                    </label>
                    <input
                      id="loan-lender"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('loans.lenderPlaceholder')}
                      required
                      value={loanForm.lender}
                      onChange={(event) => setLoanForm({ ...loanForm, lender: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="loan-principal" className="block text-sm font-bold mb-1">
                      {t('loans.originalAmount')}
                    </label>
                    <input
                      id="loan-principal"
                      type="number"
                      step="0.01"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('loans.amountPlaceholder')}
                      required
                      value={loanForm.principal_amount}
                      onChange={(event) => setLoanForm({ ...loanForm, principal_amount: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="loan-balance" className="block text-sm font-bold mb-1">
                      {t('loans.currentBalanceLabel')}
                    </label>
                    <input
                      id="loan-balance"
                      type="number"
                      step="0.01"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('loans.amountPlaceholder')}
                      required
                      value={loanForm.current_balance}
                      onChange={(event) => setLoanForm({ ...loanForm, current_balance: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="loan-rate" className="block text-sm font-bold mb-1">
                      {t('loans.interestRateLabel')}
                    </label>
                    <input
                      id="loan-rate"
                      type="number"
                      step="0.01"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('loans.ratePlaceholder')}
                      required
                      value={loanForm.interest_rate}
                      onChange={(event) => setLoanForm({ ...loanForm, interest_rate: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="loan-payment" className="block text-sm font-bold mb-1">
                      {t('loans.paymentAmount')}
                    </label>
                    <input
                      id="loan-payment"
                      type="number"
                      step="0.01"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('loans.amountPlaceholder')}
                      required
                      value={loanForm.payment_amount}
                      onChange={(event) => setLoanForm({ ...loanForm, payment_amount: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label htmlFor="loan-frequency" className="block text-sm font-bold mb-1">
                      {t('loans.paymentFrequency')}
                    </label>
                    <select
                      id="loan-frequency"
                      className="w-full p-2 border rounded font-hand text-lg"
                      value={loanForm.payment_frequency}
                      onChange={(event) =>
                        setLoanForm({
                          ...loanForm,
                          payment_frequency: event.target.value as 'monthly' | 'biweekly' | 'weekly'
                        })
                      }
                    >
                      <option value="monthly">{t('loans.paymentFrequency.monthly')}</option>
                      <option value="biweekly">{t('loans.paymentFrequency.biweekly')}</option>
                      <option value="weekly">{t('loans.paymentFrequency.weekly')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="loan-start" className="block text-sm font-bold mb-1">
                      {t('loans.startDate')}
                    </label>
                    <input
                      id="loan-start"
                      type="date"
                      className="w-full p-2 border rounded font-hand text-lg"
                      required
                      value={loanForm.start_date}
                      onChange={(event) => setLoanForm({ ...loanForm, start_date: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="loan-end" className="block text-sm font-bold mb-1">
                      {t('loans.endDate')}
                    </label>
                    <input
                      id="loan-end"
                      type="date"
                      className="w-full p-2 border rounded font-hand text-lg"
                      value={loanForm.end_date}
                      onChange={(event) => setLoanForm({ ...loanForm, end_date: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="loan-next-due" className="block text-sm font-bold mb-1">
                      {t('loans.nextDueDateLabel')}
                    </label>
                    <input
                      id="loan-next-due"
                      type="date"
                      className="w-full p-2 border rounded font-hand text-lg"
                      value={loanForm.next_due_date}
                      onChange={(event) => setLoanForm({ ...loanForm, next_due_date: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="loan-due-status" className="block text-sm font-bold mb-1">
                      {t('loans.dueStatus')}
                    </label>
                    <select
                      id="loan-due-status"
                      className="w-full p-2 border rounded font-hand text-lg"
                      value={loanForm.due_status}
                      onChange={(event) =>
                        setLoanForm({ ...loanForm, due_status: event.target.value as DueStatus })
                      }
                    >
                      <option value="upcoming">{t('loans.status.upcoming')}</option>
                      <option value="due_soon">{t('loans.status.dueSoon')}</option>
                      <option value="overdue">{t('loans.status.overdue')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="loan-notes" className="block text-sm font-bold mb-1">
                    {t('loans.notes')}
                  </label>
                  <textarea
                    id="loan-notes"
                    className="w-full p-2 border rounded font-hand text-lg"
                    rows={2}
                    placeholder={t('loans.notesPlaceholder')}
                    value={loanForm.notes}
                    onChange={(event) => setLoanForm({ ...loanForm, notes: event.target.value })}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn bg-gray-100">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="flex-1 btn bg-red-500 text-white">
                    {editingLoan ? t('common.update') : t('loans.add')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
