import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Trash2,
  Zap
} from 'lucide-react';
import { useI18n } from '../contexts/useI18n';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Bill {
  id: string;
  name: string;
  amount: number;
  next_due_date: string;
  recurrence: string;
  is_paid: boolean;
  auto_pay: boolean;
}

interface ElectricityDraft {
  amount: string;
  date: string;
  is_paid: boolean;
}

const ELECTRICITY_BILL_PREFIX = 'electricity-bill';
const ELECTRICITY_BILL_NAME = 'Electricity Bill';

const padNumber = (value: number) => value.toString().padStart(2, '0');

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  return `${year}-${month}-${day}`;
};

const createElectricityBillId = (year: number, monthIndex: number) =>
  `${ELECTRICITY_BILL_PREFIX}-${year}-${padNumber(monthIndex + 1)}`;

const createElectricityBillDate = (year: number, monthIndex: number) =>
  `${year}-${padNumber(monthIndex + 1)}-01`;

const createDefaultElectricityBill = (year: number, monthIndex: number): Bill => ({
  id: createElectricityBillId(year, monthIndex),
  name: ELECTRICITY_BILL_NAME,
  amount: 0,
  next_due_date: createElectricityBillDate(year, monthIndex),
  recurrence: 'monthly',
  is_paid: false,
  auto_pay: false
});

const isElectricityBill = (bill: Bill) => bill.id.startsWith(ELECTRICITY_BILL_PREFIX);

const normalizeBill = (bill: Bill): Bill => ({
  ...bill,
  is_paid: Boolean(bill.is_paid),
  auto_pay: Boolean(bill.auto_pay)
});

const createElectricityDraft = (bill: Bill): ElectricityDraft => ({
  amount: bill.amount > 0 ? bill.amount.toString() : '',
  date: bill.next_due_date,
  is_paid: bill.is_paid
});

const buildElectricityDrafts = (bills: Bill[], year: number) =>
  Array.from({ length: 12 }, (_, monthIndex) => {
    const bill =
      bills.find((entry) => entry.id === createElectricityBillId(year, monthIndex)) ??
      createDefaultElectricityBill(year, monthIndex);

    return [bill.id, createElectricityDraft(bill)] as const;
  }).reduce<Record<string, ElectricityDraft>>((drafts, [billId, draft]) => {
    drafts[billId] = draft;
    return drafts;
  }, {});

const resolveBillAmount = (draftAmount: string, fallbackAmount: number) => {
  const parsedAmount = Number.parseFloat(draftAmount);
  return Number.isNaN(parsedAmount) ? fallbackAmount : parsedAmount;
};

export const BillsPage = () => {
  const { t } = useI18n();
  const [bills, setBills] = useState<Bill[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingElectricityId, setSavingElectricityId] = useState<string | null>(null);
  const [pendingDeleteBillId, setPendingDeleteBillId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [selectedElectricityYear, setSelectedElectricityYear] = useState(() => new Date().getFullYear());
  const [today, setToday] = useState(() => new Date());
  const [electricityDrafts, setElectricityDrafts] = useState<Record<string, ElectricityDraft>>({});
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    date: toInputDate(new Date()),
    recur: 'monthly'
  });

  const formatDisplayDate = useCallback((dateValue: string) => {
    if (!dateValue) return '';

    const parsedDate = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return dateValue;
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(parsedDate);
  }, []);

  const formatMonthName = useCallback(
    (year: number, monthIndex: number) =>
      new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, monthIndex, 1)),
    []
  );

  const loadBills = useCallback(async (year: number) => {
    if (!window.electron) return;

    setLoading(true);

    try {
      const data = await window.electron.invoke('db-get-bills');
      const normalizedBills = (Array.isArray(data) ? data : []).map((bill: Bill) => normalizeBill(bill));
      const existingElectricityBillIds = new Set(
        normalizedBills.filter(isElectricityBill).map((bill) => bill.id)
      );

      const missingElectricityBills = Array.from({ length: 12 }, (_, monthIndex) =>
        createDefaultElectricityBill(year, monthIndex)
      ).filter((bill) => !existingElectricityBillIds.has(bill.id));

      let nextBills = normalizedBills;

      if (missingElectricityBills.length > 0) {
        await Promise.all(
          missingElectricityBills.map((bill) => window.electron!.invoke('db-save-bill', bill))
        );

        const refreshedData = await window.electron.invoke('db-get-bills');
        nextBills = (Array.isArray(refreshedData) ? refreshedData : []).map((bill: Bill) =>
          normalizeBill(bill)
        );
      }

      setBills(nextBills);
      setElectricityDrafts(buildElectricityDrafts(nextBills, year));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBills(selectedElectricityYear);
  }, [loadBills, selectedElectricityYear]);

  useEffect(() => {
    const onChanged = () => {
      void loadBills(selectedElectricityYear);
    };

    window.addEventListener('finance:data-changed', onChanged);
    return () => window.removeEventListener('finance:data-changed', onChanged);
  }, [loadBills, selectedElectricityYear]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const formatRecurrence = (recurrence: string) => {
    const key = `bills.recurrence.${recurrence}`;
    const translated = t(key);
    return translated === key ? recurrence : translated;
  };

  const handleOpenModal = (bill?: Bill) => {
    if (bill) {
      setEditingBill(bill);
      setNewBill({
        name: bill.name,
        amount: bill.amount.toString(),
        date: bill.next_due_date,
        recur: bill.recurrence
      });
    } else {
      setEditingBill(null);
      setNewBill({
        name: '',
        amount: '',
        date: toInputDate(today),
        recur: 'monthly'
      });
    }

    setFormError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electron) return;

    const amount = Number.parseFloat(newBill.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError(t('import.errors.invalidNumber', { field: t('bills.amount') }));
      return;
    }

    try {
      await window.electron.invoke('db-save-bill', {
        id: editingBill ? editingBill.id : uuidv4(),
        name: newBill.name.trim(),
        amount,
        next_due_date: newBill.date,
        recurrence: newBill.recur,
        is_paid: editingBill ? editingBill.is_paid : false,
        auto_pay: editingBill ? editingBill.auto_pay : false
      });

      setFormError('');
      setShowModal(false);
      await loadBills(selectedElectricityYear);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('import.errors.unknown'));
    }
  };

  const togglePaid = async (bill: Bill) => {
    if (!window.electron) return;

    await window.electron.invoke('db-save-bill', {
      ...bill,
      is_paid: !bill.is_paid
    });

    await loadBills(selectedElectricityYear);
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteBillId(id);
  };

  const confirmDeleteBill = async () => {
    const id = pendingDeleteBillId;
    if (!id || !window.electron) return;

    setPendingDeleteBillId(null);
    await window.electron.invoke('db-delete-bill', id);
    await loadBills(selectedElectricityYear);
  };

  const updateElectricityDraft = (billId: string, patch: Partial<ElectricityDraft>) => {
    setElectricityDrafts((currentDrafts) => ({
      ...currentDrafts,
      [billId]: {
        ...currentDrafts[billId],
        ...patch
      }
    }));
  };

  const saveElectricityBill = async (bill: Bill, draftOverride?: Partial<ElectricityDraft>) => {
    if (!window.electron) return;

    const currentDraft = electricityDrafts[bill.id] ?? createElectricityDraft(bill);
    const nextDraft = {
      ...currentDraft,
      ...draftOverride
    };

    setSavingElectricityId(bill.id);
    updateElectricityDraft(bill.id, nextDraft);

    try {
      await window.electron.invoke('db-save-bill', {
        ...bill,
        name: bill.name || ELECTRICITY_BILL_NAME,
        amount: resolveBillAmount(nextDraft.amount, bill.amount),
        next_due_date: nextDraft.date || bill.next_due_date,
        is_paid: nextDraft.is_paid
      });

      await loadBills(selectedElectricityYear);
    } finally {
      setSavingElectricityId(null);
    }
  };

  const electricityBills = Array.from({ length: 12 }, (_, monthIndex) => {
    const bill =
      bills.find((entry) => entry.id === createElectricityBillId(selectedElectricityYear, monthIndex)) ??
      createDefaultElectricityBill(selectedElectricityYear, monthIndex);

    return {
      bill,
      draft: electricityDrafts[bill.id] ?? createElectricityDraft(bill),
      monthIndex
    };
  });

  const regularBills = bills.filter((bill) => !isElectricityBill(bill));
  const paidElectricityCount = electricityBills.filter((entry) => entry.draft.is_paid).length;
  const pendingElectricityCount = electricityBills.length - paidElectricityCount;
  const electricityTotal = electricityBills.reduce((total, entry) => {
    const amount = resolveBillAmount(entry.draft.amount, entry.bill.amount);
    return total + amount;
  }, 0);
  const todayLabel = formatDisplayDate(toInputDate(today));

  if (loading && bills.length === 0) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="bills-page page-shell pb-6">
      <div className="page-hero">
        <div className="page-copy">
          <p className="page-eyebrow">{t('sidebar.domain.money')}</p>
          <h2 className="page-title heading-font">{t('bills.title')}</h2>
          <p className="page-subtitle">{t('bills.subtitle')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn bg-blue-500 text-white flex items-center gap-2"
        >
          <Calendar size={20} /> {t('bills.add')}
        </button>
      </div>

      <section className="card p-6 border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
              <Zap size={16} /> {t('bills.electricityTrackerTitle')}
            </div>
            <p className="text-sm text-gray-600">{t('bills.electricityTrackerDesc')}</p>
            <p className="text-xs text-gray-500">
              {t('bills.electricityAutoUpdated', { date: todayLabel })}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start">
            <button
              type="button"
              onClick={() => setSelectedElectricityYear((currentYear) => currentYear - 1)}
              className="btn bg-white border border-gray-200 px-3"
              aria-label={t('bills.previousYear')}
              title={t('bills.previousYear')}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="rounded-2xl bg-white/90 px-5 py-3 text-center shadow-sm border border-white">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                {t('bills.electricityYear')}
              </p>
              <p className="text-2xl font-bold text-gray-800">{selectedElectricityYear}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedElectricityYear((currentYear) => currentYear + 1)}
              className="btn bg-white border border-gray-200 px-3"
              aria-label={t('bills.nextYear')}
              title={t('bills.nextYear')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="rounded-2xl bg-white/90 p-4 border border-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
              {t('bills.electricitySummaryPaid')}
            </p>
            <p className="mt-2 text-3xl font-bold text-green-600">{paidElectricityCount}</p>
          </div>
          <div className="rounded-2xl bg-white/90 p-4 border border-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
              {t('bills.electricitySummaryPending')}
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{pendingElectricityCount}</p>
          </div>
          <div className="rounded-2xl bg-white/90 p-4 border border-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
              {t('bills.electricitySummaryTotal')}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-800">${electricityTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {electricityBills.map(({ bill, draft, monthIndex }) => {
            const isCurrentMonth =
              selectedElectricityYear === today.getFullYear() && monthIndex === today.getMonth();
            const isSaving = savingElectricityId === bill.id;

            return (
              <div
                key={bill.id}
                className={`rounded-2xl border p-4 shadow-sm transition-shadow ${
                  isCurrentMonth
                    ? 'border-amber-300 bg-white shadow-md'
                    : 'border-white bg-white/85'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {formatMonthName(selectedElectricityYear, monthIndex)}
                    </h3>
                    <p className="text-sm text-gray-500">{formatDisplayDate(draft.date)}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isCurrentMonth
                        ? 'bg-amber-100 text-amber-700'
                        : draft.is_paid
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {isCurrentMonth
                      ? t('bills.electricityCurrentMonth')
                      : draft.is_paid
                        ? t('bills.statusPaid')
                        : t('bills.statusPending')}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor={`electricity-amount-${bill.id}`} className="block text-sm font-bold mb-1">
                      {t('bills.amount')}
                    </label>
                    <input
                      id={`electricity-amount-${bill.id}`}
                      type="number"
                      step="0.01"
                      className="w-full p-2 border rounded font-hand text-lg"
                      placeholder={t('bills.amountPlaceholder')}
                      value={draft.amount}
                      onChange={(e) => updateElectricityDraft(bill.id, { amount: e.target.value })}
                    />
                  </div>

                  <div>
                    <label htmlFor={`electricity-date-${bill.id}`} className="block text-sm font-bold mb-1">
                      {t('bills.dueDate')}
                    </label>
                    <input
                      id={`electricity-date-${bill.id}`}
                      type="date"
                      className="w-full p-2 border rounded font-hand text-lg"
                      value={draft.date}
                      onChange={(e) => updateElectricityDraft(bill.id, { date: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void saveElectricityBill(bill)}
                      disabled={!draft.date || isSaving}
                      className="btn flex-1 bg-amber-400 text-white disabled:opacity-60"
                    >
                      {isSaving ? t('common.loading') : t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveElectricityBill(bill, { is_paid: !draft.is_paid })}
                      disabled={!draft.date || isSaving}
                      className={`btn flex-1 ${
                        draft.is_paid ? 'bg-gray-200 text-gray-700' : 'bg-green-500 text-white'
                      } disabled:opacity-60`}
                    >
                      {draft.is_paid ? t('bills.markUnpaid') : t('bills.markPaid')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex-1 min-h-0 overflow-hidden">
        <div className="mb-4">
          <h3 className="text-2xl font-bold font-heading">{t('bills.otherTitle')}</h3>
        </div>

        <div className="space-y-4 h-full overflow-y-auto pr-1">
          {regularBills.map((bill) => (
            <div
              key={bill.id}
              className={`card flex items-center justify-between p-4 group ${
                bill.is_paid ? 'opacity-60 bg-gray-50' : 'border-l-4 border-red-400'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-full ${
                    bill.is_paid ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {bill.is_paid ? <CheckCircle /> : <AlertCircle />}
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${bill.is_paid ? 'line-through text-gray-500' : ''}`}>
                    {bill.name}
                  </h3>
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <Clock size={14} /> {t('bills.due')}: {formatDisplayDate(bill.next_due_date)} (
                    {formatRecurrence(bill.recurrence)})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-xl">${bill.amount}</span>
                <button
                  onClick={() => void togglePaid(bill)}
                  className={`btn text-sm ${bill.is_paid ? 'bg-gray-200' : 'bg-green-500 text-white'}`}
                >
                  {bill.is_paid ? t('bills.markUnpaid') : t('bills.markPaid')}
                </button>
                <button
                  onClick={() => handleOpenModal(bill)}
                  className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${t('common.edit')} ${bill.name}`}
                  title={t('common.edit')}
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => void handleDelete(bill.id)}
                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`${t('common.delete')} ${bill.name}`}
                  title={t('common.delete')}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {regularBills.length === 0 && (
            <div className="card p-8 text-center text-gray-500 border border-dashed border-gray-200">
              {t('bills.otherEmpty')}
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h3 className="text-2xl font-bold mb-4 font-heading">
              {editingBill ? t('bills.edit') : t('bills.addTitle')}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              {formError && (
                <p className="text-sm text-red-600 font-semibold" role="alert">
                  {formError}
                </p>
              )}
              <label htmlFor="bill-name" className="block text-sm font-bold mb-1">
                {t('bills.billName')}
              </label>
              <input
                id="bill-name"
                className="w-full p-2 border rounded font-hand text-lg"
                placeholder={t('bills.billNamePlaceholder')}
                required
                value={newBill.name}
                onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
              />
              <label htmlFor="bill-amount" className="block text-sm font-bold mb-1">
                {t('bills.amount')}
              </label>
              <input
                id="bill-amount"
                className="w-full p-2 border rounded font-hand text-lg"
                type="number"
                step="0.01"
                placeholder={t('bills.amountPlaceholder')}
                required
                value={newBill.amount}
                onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
              />
              <label htmlFor="bill-date" className="block text-sm font-bold mb-1">
                {t('bills.dueDate')}
              </label>
              <input
                id="bill-date"
                className="w-full p-2 border rounded font-hand text-lg"
                type="date"
                required
                value={newBill.date}
                onChange={(e) => setNewBill({ ...newBill, date: e.target.value })}
              />
              <label htmlFor="bill-recurrence" className="block text-sm font-bold mb-1">
                {t('bills.recurrence')}
              </label>
              <select
                id="bill-recurrence"
                className="w-full p-2 border rounded font-hand text-lg"
                value={newBill.recur}
                onChange={(e) => setNewBill({ ...newBill, recur: e.target.value })}
              >
                <option value="weekly">{t('bills.recurrence.weekly')}</option>
                <option value="monthly">{t('bills.recurrence.monthly')}</option>
                <option value="yearly">{t('bills.recurrence.yearly')}</option>
              </select>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn bg-gray-100 flex-1"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn bg-red-400 text-white flex-1">
                  {editingBill ? t('common.update') : t('bills.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteBillId)}
        title={t('common.delete')}
        message={t('bills.deleteConfirm')}
        destructive
        onCancel={() => setPendingDeleteBillId(null)}
        onConfirm={() => {
          void confirmDeleteBill();
        }}
      />
    </div>
  );
};
