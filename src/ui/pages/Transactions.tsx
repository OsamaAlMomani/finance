import { useEffect, useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PlusCircle, Search, Filter, Trash2, Edit2, X, Tag, ChevronDown, ChevronUp, Minimize2, Maximize2 } from 'lucide-react';
import { getCategoryColorClass } from '../utils/categoryColor';
import { useI18n } from '../contexts/useI18n';

// ---------- Types ----------
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
  tags?: string[];
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

interface TransactionFormState {
  amount: string;
  merchant: string;
  date: string;
  category: string;
  account: string;
  toAccount: string;
  type: TransactionType;
  notes: string;
  tags: string;
}

interface TransactionSavePayload {
  id: string;
  amount: number;
  date: string;
  merchant: string;
  notes: string;
  tags: string[];
  category: string;
  accountId: string;
  toAccountId: string | null;
  type: TransactionType;
}

interface ImportNotice {
  ids: string[];
  success: number;
  updated: number;
  failed: number;
  type: string;
}

// Helper to parse tags from comma‑separated string
const parseTags = (input: string): string[] =>
  input.split(',').map(t => t.trim()).filter(t => t.length > 0);

// Helper to join tags into a display string
const joinTags = (tags: string[]): string => tags.join(', ');

// ---------- Subcomponents ----------

// Filter Panel (simplified but same as before)
const FilterPanel = ({
  show,
  onClose,
  accounts,
  filterAccount,
  setFilterAccount,
  filterType,
  setFilterType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  onClear,
}: {
  show: boolean;
  onClose: () => void;
  accounts: Account[];
  filterAccount: string;
  setFilterAccount: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterStartDate: string;
  setFilterStartDate: (v: string) => void;
  filterEndDate: string;
  setFilterEndDate: (v: string) => void;
  onClear: () => void;
}) => {
  const { t } = useI18n();
  if (!show) return null;

  return (
    <div className="bg-theme-info-soft border border-theme-info rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm text-ink">{t('transactions.filterOptions')}</h3>
        <button onClick={onClose} className="text-muted hover:text-ink" aria-label={t('transactions.closeFilter')}>
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="filter-account" className="block text-xs font-bold mb-1 text-ink">
            {t('common.account')}
          </label>
          <select
            id="filter-account"
            className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
          >
            <option value="">{t('transactions.allAccounts')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-type" className="block text-xs font-bold mb-1 text-ink">
            {t('transactions.transactionType')}
          </label>
          <select
            id="filter-type"
            className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">{t('transactions.allTypes')}</option>
            <option value="expense">{t('transactions.expense')}</option>
            <option value="income">{t('transactions.income')}</option>
            <option value="transfer">{t('transactions.transfer')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-start-date" className="block text-xs font-bold mb-1 text-ink">
            {t('transactions.startDate')}
          </label>
          <input
            id="filter-start-date"
            type="date"
            className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="filter-end-date" className="block text-xs font-bold mb-1 text-ink">
            {t('transactions.endDate')}
          </label>
          <input
            id="filter-end-date"
            type="date"
            className="w-full p-2 border-theme rounded bg-theme-surface text-ink"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>
        <div className="flex items-end md:col-span-2">
          <button onClick={onClear} className="btn btn-secondary w-full">
            {t('transactions.clearFilters')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Transaction Row (supports compact mode)
const TransactionRow = ({
  tx,
  onEdit,
  onDelete,
  isHighlighted,
  compact,
}: {
  tx: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  isHighlighted: boolean;
  compact: boolean;
}) => {
  const { t } = useI18n();

  const amountClass =
    tx.type === 'income' ? 'text-income' : tx.type === 'transfer' ? 'text-transfer' : 'text-expense';

  if (compact) {
    // Compact row: less padding, only merchant, amount, and a minimal category indicator
    return (
      <tr className={`transaction-row border-b border-dashed border-theme last:border-0 group ${isHighlighted ? 'bg-theme-info-soft' : ''}`}>
        <td className="p-2 text-muted font-hand text-sm">{tx.date}</td>
        <td className="p-2">
          <div className="font-bold text-ink text-sm">{tx.merchant}</div>
        </td>
        <td className="p-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${getCategoryColorClass(tx.category_color)}`}
            title={tx.category_name}
          />
        </td>
        <td className={`p-2 text-right font-bold font-mono text-sm ${amountClass}`}>
          {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}$
          {tx.amount.toFixed(2)}
        </td>
        <td className="p-2 text-right">
          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(tx)} className="text-theme-primary hover:text-theme-primary-dark" title={t('common.edit')}>
              <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(tx.id)} className="text-theme-error hover:text-theme-error-dark" title={t('common.delete')}>
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Normal row (original)
  return (
    <tr className={`transaction-row border-b border-dashed border-theme last:border-0 group ${isHighlighted ? 'bg-theme-info-soft' : ''}`}>
      <td className="p-4 text-muted font-hand text-lg">{tx.date}</td>
      <td className="p-4">
        <div className="font-bold text-ink">{tx.merchant}</div>
        {tx.notes && <div className="text-sm text-muted font-hand">{tx.notes}</div>}
        {tx.tags && tx.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tx.tags.map((tag, idx) => (
              <span key={idx} className="tag-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-theme-primary-soft text-theme-primary-dark border border-theme-primary">
                <Tag size={12} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="p-4 text-muted">
        {tx.type === 'transfer' ? (
          <div className="text-sm">
            <span>{tx.account_name}</span>
            <span className="text-muted mx-1">→</span>
            <span>{tx.to_account_name}</span>
          </div>
        ) : (
          <span className="text-sm">{tx.account_name}</span>
        )}
      </td>
      <td className="p-4">
        <span className={`px-3 py-1 rounded-full text-sm font-bold category-pill ${getCategoryColorClass(tx.category_color)}`}>
          {tx.category_name || t('transactions.uncategorized')}
        </span>
      </td>
      <td className={`p-4 text-right font-bold font-mono ${amountClass}`}>
        {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '→' : '-'}$
        {tx.amount.toFixed(2)}
      </td>
      <td className="p-4 text-right">
        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(tx)} className="text-theme-primary hover:text-theme-primary-dark" title={t('common.edit')}>
            <Edit2 size={18} />
          </button>
          <button onClick={() => onDelete(tx.id)} className="text-theme-error hover:text-theme-error-dark" title={t('common.delete')}>
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// Add/Edit Modal (with advanced toggle and merchant suggestions)
const buildInitialForm = (
  editingTx: Transaction | null,
  accounts: Account[],
  categories: Category[]
): TransactionFormState => {
  if (editingTx) {
    return {
      amount: editingTx.amount.toString(),
      merchant: editingTx.merchant,
      date: editingTx.date,
      category: editingTx.category_id,
      account: editingTx.account_id,
      toAccount: editingTx.to_account_id || '',
      type: editingTx.type,
      notes: editingTx.notes || '',
      tags: editingTx.tags ? joinTags(editingTx.tags) : ''
    };
  }

  const defaultType: TransactionType = 'expense';
  const defaultCategory = categories.find((c) => c.type === defaultType)?.id || '';
  const defaultAccount = accounts[0]?.id || '';

  return {
    amount: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    category: defaultCategory,
    account: defaultAccount,
    toAccount: '',
    type: defaultType,
    notes: '',
    tags: ''
  };
};

const TransactionModal = ({
  onClose,
  editingTx,
  accounts,
  categories,
  onSave,
  merchantSuggestions,
}: {
  onClose: () => void;
  editingTx: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSave: (txData: TransactionSavePayload) => Promise<void>;
  merchantSuggestions: string[]; // list of past merchants for autocomplete
}) => {
  const { t } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(Boolean(editingTx));
  const [form, setForm] = useState<TransactionFormState>(() => buildInitialForm(editingTx, accounts, categories));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure required fields: amount, merchant, date, type, and for transfers: toAccount
    if (!form.amount || !form.merchant || !form.date) return;

    const payload: TransactionSavePayload = {
      id: editingTx ? editingTx.id : uuidv4(),
      amount: parseFloat(form.amount),
      date: form.date,
      merchant: form.merchant,
      notes: form.notes,
      tags: parseTags(form.tags),
      category: form.category,
      accountId: form.account,
      toAccountId: form.type === 'transfer' ? form.toAccount : null,
      type: form.type,
    };

    await onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-theme-surface p-6 rounded-xl shadow-theme w-full max-w-md border-2 border-theme">
        <h3 className="text-2xl font-bold mb-4 font-heading text-ink">
          {editingTx ? t('transactions.editTitle') : t('transactions.addTitle')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Essential fields always visible */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-type" className="block text-sm font-bold mb-1 text-ink">
                {t('transactions.type')}
              </label>
              <select
                id="tx-type"
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                value={form.type}
                onChange={(e) => {
                  const newType = e.target.value as TransactionType;
                  const matchingCategory = categories.find((c) => c.type === newType)?.id || '';
                  setForm({ ...form, type: newType, category: matchingCategory });
                }}
              >
                <option value="expense">{t('transactions.expense')}</option>
                <option value="income">{t('transactions.income')}</option>
                <option value="transfer">{t('transactions.transfer')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="tx-date" className="block text-sm font-bold mb-1 text-ink">
                {t('transactions.date')}
              </label>
              <input
                id="tx-date"
                type="date"
                required
                className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tx-amount" className="block text-sm font-bold mb-1 text-ink">
              {t('transactions.amount')}
            </label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              required
              placeholder={t('transactions.amountPlaceholder')}
              className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-xl"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="tx-merchant" className="block text-sm font-bold mb-1 text-ink">
              {t('transactions.merchant')}
            </label>
            <input
              id="tx-merchant"
              type="text"
              required
              list="merchant-suggestions"
              className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
              placeholder={t('transactions.merchantPlaceholder')}
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            />
            <datalist id="merchant-suggestions">
              {merchantSuggestions.map((m, idx) => (
                <option key={idx} value={m} />
              ))}
            </datalist>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-theme-primary hover:text-theme-primary-dark"
          >
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showAdvanced ? t('transactions.hideAdvanced') : t('transactions.showAdvanced')}
          </button>

          {showAdvanced && (
            <>
              {/* Tags input */}
              <div>
                <label htmlFor="tx-tags" className="block text-sm font-bold mb-1 text-ink">
                  {t('transactions.tags')} <span className="font-normal text-muted text-xs">({t('transactions.tagsHint')})</span>
                </label>
                <input
                  id="tx-tags"
                  type="text"
                  className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                  placeholder={t('transactions.tagsPlaceholder')}
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>

              {form.type !== 'transfer' && (
                <div>
                  <label htmlFor="tx-category" className="block text-sm font-bold mb-1 text-ink">
                    {t('common.category')}
                  </label>
                  <select
                    id="tx-category"
                    className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {categories
                      .filter((c) => c.type === form.type)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="tx-account" className="block text-sm font-bold mb-1 text-ink">
                  {form.type === 'transfer' ? t('transactions.fromAccount') : t('common.account')}
                </label>
                <select
                  id="tx-account"
                  className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                >
                  <option value="">{t('common.selectAccount')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {form.type === 'transfer' && (
                <div>
                  <label htmlFor="tx-to-account" className="block text-sm font-bold mb-1 text-ink">
                    {t('common.toAccount')}
                  </label>
                  <select
                    id="tx-to-account"
                    className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                    value={form.toAccount}
                    onChange={(e) => setForm({ ...form, toAccount: e.target.value })}
                    required
                  >
                    <option value="">{t('common.selectDestinationAccount')}</option>
                    {accounts
                      .filter((a) => a.id !== form.account)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="tx-notes" className="block text-sm font-bold mb-1 text-ink">
                  {t('transactions.notes')}
                </label>
                <textarea
                  id="tx-notes"
                  className="w-full p-2 border-theme rounded bg-theme-surface text-ink font-hand text-lg"
                  rows={2}
                  placeholder={t('transactions.notesPlaceholder')}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn flex-1">
              {editingTx ? t('common.update') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Main Component ----------
export const Transactions = () => {
  const { t } = useI18n();
  const [data, setData] = useState<Transaction[]>([]);
  const [filteredData, setFilteredData] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);
  const [compactView, setCompactView] = useState(false); // new state for compact mode

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Load import notice (same as before)
  useEffect(() => {
    const raw = localStorage.getItem('lastImport');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.ids)) setImportNotice(parsed as ImportNotice);
      } catch { setImportNotice(null); }
    }
  }, []);

  // Auto‑dismiss import notice
  useEffect(() => {
    if (!importNotice) return;
    const timer = setTimeout(() => {
      localStorage.removeItem('lastImport');
      setImportNotice(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [importNotice]);

  // Apply filters
  useEffect(() => {
    let result = [...data];
    if (filterAccount) result = result.filter((tx) => tx.account_id === filterAccount);
    if (filterType) result = result.filter((tx) => tx.type === filterType);
    if (filterStartDate) result = result.filter((tx) => tx.date >= filterStartDate);
    if (filterEndDate) result = result.filter((tx) => tx.date <= filterEndDate);
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.merchant.toLowerCase().includes(search) ||
          tx.notes?.toLowerCase().includes(search) ||
          tx.category_name?.toLowerCase().includes(search) ||
          tx.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }
    setFilteredData(result);
  }, [data, filterAccount, filterType, filterStartDate, filterEndDate, searchText]);

  const loadData = async () => {
    if (!window.electron) return;
    try {
      const txs = await window.electron.invoke('db-get-transactions', {}) as Transaction[];
      const accs = await window.electron.invoke('db-get-accounts') as Account[];
      const cats = await window.electron.invoke('db-get-categories') as Category[];
      const processedTxs: Transaction[] = txs.map((tx) => ({
        ...tx,
        tags: tx.tags ? (Array.isArray(tx.tags) ? tx.tags : JSON.parse(tx.tags)) : [],
      }));
      setData(processedTxs);
      setAccounts(accs);
      setCategories(cats);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async (txData: TransactionSavePayload) => {
    if (!window.electron) return;
    const payload = { ...txData, tags: JSON.stringify(txData.tags) };
    if (editingTx) await window.electron.invoke('db-update-transaction', payload);
    else await window.electron.invoke('db-add-transaction', payload);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('transactions.deleteConfirm'))) return;
    if (!window.electron) return;
    await window.electron.invoke('db-delete-transaction', id);
    await loadData();
  };

  // Build merchant suggestions from existing transactions
  const merchantSuggestions = useMemo(() => {
    const merchants = data.map(tx => tx.merchant).filter(Boolean);
    return Array.from(new Set(merchants)).sort();
  }, [data]);

  if (loading) return <div className="p-4 text-ink">{t('transactions.loading')}</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header with compact toggle */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-heading text-ink">{t('transactions.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCompactView(!compactView)}
            className="btn btn-secondary flex items-center gap-2"
            title={compactView ? t('transactions.normalView') : t('transactions.compactView')}
          >
            {compactView ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn flex items-center gap-2">
            <PlusCircle size={20} /> {t('transactions.addNew')}
          </button>
        </div>
      </div>

      {/* Import notice (unchanged) */}
      {importNotice && (
        <div className="mb-4 p-3 rounded-lg border border-theme-error bg-theme-error-soft flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-theme-error"></span>
            </span>
            <div className="text-sm text-theme-error">
              {t('transactions.importUpdate', {
                success: importNotice.success,
                updated: importNotice.updated,
                failed: importNotice.failed,
              })}
              {importNotice.type === 'transactions' ? '' : t('transactions.importNonTx')}
            </div>
          </div>
          <button className="text-xs text-theme-error hover:text-theme-error-dark" onClick={() => { localStorage.removeItem('lastImport'); setImportNotice(null); }}>
            {t('transactions.dismiss')}
          </button>
        </div>
      )}

      {/* Search & filter bar */}
      <div className="bg-theme-surface p-4 rounded-lg border border-theme shadow-sm mb-4 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder={t('transactions.searchPlaceholder')}
            className="pl-10 p-2 w-full border-theme rounded bg-theme-surface text-ink"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className={`btn flex items-center gap-2 ${showFilterPanel ? 'bg-theme-primary-soft border-theme-primary' : 'bg-theme-surface'}`}
        >
          <Filter size={18} /> {t('common.filter')}
        </button>
      </div>

      {/* Filter panel */}
      <FilterPanel
        show={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        accounts={accounts}
        filterAccount={filterAccount}
        setFilterAccount={setFilterAccount}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        onClear={() => {
          setFilterAccount('');
          setFilterType('');
          setFilterStartDate('');
          setFilterEndDate('');
          setSearchText('');
        }}
      />

      {/* Transaction table */}
      <div className="card flex-1 overflow-hidden flex flex-col p-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="table-header sticky top-0">
              <tr>
                <th className={compactView ? 'p-2' : 'p-4'}>{t('transactions.table.date')}</th>
                <th className={compactView ? 'p-2' : 'p-4'}>{t('transactions.table.merchant')}</th>
                {!compactView && <th className="p-4">{t('transactions.table.account')}</th>}
                <th className={compactView ? 'p-2' : 'p-4'}>{compactView ? '' : t('transactions.table.category')}</th>
                <th className={`${compactView ? 'p-2' : 'p-4'} text-right`}>{t('transactions.table.amount')}</th>
                <th className={compactView ? 'p-2 w-[60px]' : 'p-4 w-[80px]'}></th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  onEdit={(tx) => { setEditingTx(tx); setShowAddModal(true); }}
                  onDelete={handleDelete}
                  isHighlighted={importNotice?.ids?.includes(tx.id) || false}
                  compact={compactView}
                />
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={compactView ? 5 : 6} className="p-8 text-center text-muted">
                    {data.length === 0 ? t('transactions.noData') : t('transactions.noMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showAddModal && (
        <TransactionModal
          onClose={() => { setShowAddModal(false); setEditingTx(null); }}
          editingTx={editingTx}
          accounts={accounts}
          categories={categories}
          onSave={handleSave}
          merchantSuggestions={merchantSuggestions}
        />
      )}
    </div>
  );
};
