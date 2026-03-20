import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Trash2, Edit2 } from 'lucide-react';
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

interface LoanPaymentStat {
  loan_id: string;
  payment_count: number;
  total_paid: number;
  last_paid_at: string | null;
  last_amount: number;
}

type DueStatus = 'upcoming' | 'due_soon' | 'overdue';

const statusLabelKey: Record<DueStatus, string> = {
  upcoming: 'loans.status.upcoming',
  due_soon: 'loans.status.dueSoon',
  overdue: 'loans.status.overdue'
};

const loanCardMotion = {
  hidden: { opacity: 0, y: 12 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, delay: index * 0.04 }
  }),
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } }
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const normalizeDueStatus = (status?: string): DueStatus => {
  if (status === 'overdue') return 'overdue';
  if (status === 'due_soon') return 'due_soon';
  return 'upcoming';
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) => `$${value.toFixed(2)}`;
const formatDate = (value: string | null | undefined) => {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

export const LoansPage = () => {
  const { t } = useI18n();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const [paymentStatsByLoanId, setPaymentStatsByLoanId] = useState<Record<string, LoanPaymentStat>>({});

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
      const [loansData, paymentStatsData] = await Promise.all([
        window.electron.invoke('db-get-loans'),
        window.electron.invoke('db-get-loan-payment-stats').catch(() => [])
      ]);
      setLoans(Array.isArray(loansData) ? loansData : []);
      const statsMap: Record<string, LoanPaymentStat> = {};
      if (Array.isArray(paymentStatsData)) {
        for (const stat of paymentStatsData) {
          if (!stat || !stat.loan_id) continue;
          statsMap[stat.loan_id] = {
            loan_id: stat.loan_id,
            payment_count: toNumber(stat.payment_count),
            total_paid: toNumber(stat.total_paid),
            last_paid_at: stat.last_paid_at || null,
            last_amount: toNumber(stat.last_amount)
          };
        }
      }
      setPaymentStatsByLoanId(statsMap);
    } catch (error) {
      console.error('Failed to load loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (loan: Loan) => {
    const principal = toNumber(loan.principal_amount);
    const balance = toNumber(loan.current_balance);
    if (principal <= 0) return 0;
    return clampPercent(((principal - balance) / principal) * 100);
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

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
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
    if (!window.confirm(t('loans.deleteConfirm'))) return;
    if (!window.electron) return;

    await window.electron.invoke('db-delete-loan', id);
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    loadData();
  };

  const handlePay = async (loan: Loan) => {
    if (!window.electron) return;
    if (payingLoanId === loan.id) return;

    const currentBalance = Math.max(0, toNumber(loan.current_balance));
    const paymentAmount = Math.max(0, toNumber(loan.payment_amount));
    if (currentBalance <= 0 || paymentAmount <= 0) return;

    setPayingLoanId(loan.id);
    try {
      await window.electron.invoke('db-pay-loan', {
        loanId: loan.id,
        amount: paymentAmount
      });
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      loadData();
    } catch (error) {
      console.error('Failed to apply payment:', error);
    } finally {
      setPayingLoanId(null);
    }
  };

  if (loading) return <div>{t('common.loading')}</div>;

  const totalDebt = loans.reduce((sum, loan) => sum + toNumber(loan.current_balance), 0);
  const totalOriginal = loans.reduce((sum, loan) => sum + Math.max(0, toNumber(loan.principal_amount)), 0);
  const totalPaid = loans.reduce(
    (sum, loan) => sum + Math.max(0, toNumber(loan.principal_amount) - toNumber(loan.current_balance)),
    0
  );
  const overallProgress = totalOriginal > 0 ? clampPercent((totalPaid / totalOriginal) * 100) : 0;

  return (
    <div className="loans-page h-full flex flex-col overflow-hidden">
      <motion.div
        className="flex flex-wrap justify-between items-center gap-3 mb-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div>
          <h2 className="text-3xl font-bold font-heading">{t('loans.title')}</h2>
          <p className="text-sm text-gray-500">{t('loans.quickHint')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn bg-red-500 text-white flex items-center gap-2"
        >
          <PlusCircle size={18} /> {t('loans.add')}
        </button>
      </motion.div>

      <section className="card mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs uppercase text-gray-400">{t('loans.totalDebt')}</p>
            <p className="text-2xl font-bold text-red-600">{formatMoney(totalDebt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">{t('loans.totalPaid')}</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-400">{t('loans.progress')}</p>
            <p className="text-2xl font-bold text-blue-600">{overallProgress.toFixed(1)}%</p>
          </div>
        </div>

        <div className="loan-progress-track">
          <motion.div
            className="loan-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {loans.map((loan, index) => {
            const currentBalance = Math.max(0, toNumber(loan.current_balance));
            const paymentAmount = Math.max(0, toNumber(loan.payment_amount));
            const principalAmount = Math.max(0, toNumber(loan.principal_amount));
            const progress = calculateProgress(loan);
            const paidAmount = Math.max(0, principalAmount - currentBalance);
            const nextBalance = Math.max(0, currentBalance - paymentAmount);
            const dueStatus = normalizeDueStatus(loan.due_status);
            const paymentStat = paymentStatsByLoanId[loan.id];
            const isPaidOff = currentBalance <= 0;
            const isPaying = payingLoanId === loan.id;

            return (
              <motion.article
                key={loan.id}
                layout
                className="card border border-theme bg-white/80"
                custom={index}
                variants={loanCardMotion}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-xl">{loan.name}</h3>
                    <p className="text-sm text-gray-500">{loan.lender}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border px-2.5 py-1 text-xs font-bold bg-blue-50 border-blue-200 text-blue-700">
                      {t(statusLabelKey[dueStatus])}
                    </span>
                    <button
                      onClick={() => handleOpenModal(loan)}
                      className="text-blue-500 hover:text-blue-700"
                      aria-label={`${t('common.edit')} ${loan.name}`}
                      title={t('common.edit')}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-red-500 hover:text-red-700"
                      aria-label={`${t('common.delete')} ${loan.name}`}
                      title={t('common.delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs uppercase text-gray-400">{t('loans.currentBalance')}</p>
                    <p className="text-xl font-bold text-red-600">{formatMoney(currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">{t('loans.payment')}</p>
                    <p className="text-xl font-bold text-gray-700">
                      {formatMoney(paymentAmount)}
                      <span className="text-xs text-gray-400 ml-1">/{loan.payment_frequency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">{t('loans.originalAmount')}</p>
                    <p className="text-lg font-semibold text-gray-700">{formatMoney(principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">{t('loans.interestRate')}</p>
                    <p className="text-lg font-semibold text-gray-700">{toNumber(loan.interest_rate).toFixed(2)}%</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{t('loans.progress')}</span>
                    <span className="font-bold text-green-600">{t('loans.paidOff', { percent: progress.toFixed(1) })}</span>
                  </div>
                  <div className="loan-progress-track">
                    <motion.div
                      className="loan-progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{t('loans.paidAmount', { amount: paidAmount.toFixed(2) })}</span>
                    <span>{t('loans.remainingAmount', { amount: currentBalance.toFixed(2) })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3 text-xs text-gray-500">
                  <span>
                    <span className="font-semibold">{t('loans.nextDue')}:</span> {loan.next_due_date || loan.end_date || 'n/a'}
                  </span>
                  {!isPaidOff && paymentAmount > 0 && (
                    <span>{t('loans.afterPayBalance', { amount: nextBalance.toFixed(2) })}</span>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 mb-3 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold uppercase tracking-wide text-gray-500">{t('loans.paymentHistory')}</p>
                  <p>{t('loans.paymentCount', { count: paymentStat?.payment_count || 0 })}</p>
                  <p>{t('loans.loggedPaidTotal', { amount: (paymentStat?.total_paid || 0).toFixed(2) })}</p>
                  <p>
                    {paymentStat?.last_paid_at
                      ? t('loans.lastPayment', {
                          amount: paymentStat.last_amount.toFixed(2),
                          date: formatDate(paymentStat.last_paid_at)
                        })
                      : t('loans.noPaymentsYet')}
                  </p>
                </div>

                <button
                  type="button"
                  className={`btn w-full ${
                    isPaidOff ? 'bg-gray-300 text-gray-700 cursor-not-allowed' : 'bg-emerald-600 text-white'
                  }`}
                  disabled={isPaidOff || paymentAmount <= 0 || isPaying}
                  onClick={() => handlePay(loan)}
                >
                  {isPaidOff
                    ? t('loans.paidInFull')
                    : isPaying
                    ? t('loans.processingPayment')
                    : t('loans.payAmount', { amount: paymentAmount.toFixed(2) })}
                </button>

                {loan.notes && <p className="text-sm text-gray-500 mt-2 italic">{loan.notes}</p>}
              </motion.article>
            );
          })}
        </AnimatePresence>

        {loans.length === 0 && (
          <motion.div
            className="lg:col-span-2 text-center py-12 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl bg-white/50"
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
                      onChange={(event) => setLoanForm({ ...loanForm, due_status: event.target.value as DueStatus })}
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
