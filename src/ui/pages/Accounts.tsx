import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Edit2, Plus, Trash2, Wallet } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useI18n } from '../contexts/useI18n';
import { financeQueryKeys } from '../query/financeQueryKeys';
import { ipcClient } from '../services/ipcClient';
import { useUiStore } from '../state/uiStore';

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  initial_balance: number;
  current_balance?: number;
  currency?: string;
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAccounts = (input: unknown): Account[] => {
  const rows = Array.isArray(input) ? input : [];
  return rows.map((row) => {
    const raw = row as Partial<Account>;
    return {
      id: String(raw.id || ''),
      name: String(raw.name || 'Account'),
      type: String(raw.type || 'checking') as Account['type'],
      initial_balance: toNumber(raw.initial_balance, 0),
      current_balance: toNumber(raw.current_balance, toNumber(raw.initial_balance, 0)),
      currency: String(raw.currency || 'USD')
    };
  });
};

export const AccountsPage = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const balanceVisible = useUiStore((state) => state.balanceVisible);
  const toggleBalanceVisible = useUiStore((state) => state.toggleBalanceVisible);

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [pendingDeleteAccountId, setPendingDeleteAccountId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'checking' as Account['type'],
    initialBalance: ''
  });

  const hasElectron = typeof window !== 'undefined' && Boolean(window.electron?.invoke);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: financeQueryKeys.accounts(),
    queryFn: async () => normalizeAccounts(await ipcClient.accounts.getWithBalance()),
    enabled: hasElectron
  });

  const accounts = useMemo(() => data || [], [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; type: Account['type']; initialBalance: number }) => {
      if (editingAccount) {
        await ipcClient.accounts.update({
          id: payload.id,
          name: payload.name,
          type: payload.type,
          initialBalance: payload.initialBalance,
          currency: 'USD'
        });
      } else {
        await ipcClient.accounts.create({
          id: payload.id,
          name: payload.name,
          type: payload.type,
          initialBalance: payload.initialBalance,
          currency: 'USD'
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts() });
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      setShowModal(false);
      setEditingAccount(null);
      setForm({ name: '', type: 'checking', initialBalance: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => ipcClient.accounts.delete(accountId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.accounts() });
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.root });
      setPendingDeleteAccountId(null);
    }
  });

  const totals = useMemo(() => {
    const totalBalance = accounts.reduce((sum, account) => sum + toNumber(account.current_balance, 0), 0);
    return {
      totalBalance,
      count: accounts.length
    };
  }, [accounts]);

  const openCreateModal = () => {
    setEditingAccount(null);
    setForm({ name: '', type: 'checking', initialBalance: '' });
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setForm({
      name: account.name,
      type: account.type,
      initialBalance: String(toNumber(account.initial_balance, 0))
    });
    setShowModal(true);
  };

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasElectron) return;

    await saveMutation.mutateAsync({
      id: editingAccount?.id || uuidv4(),
      name: form.name.trim(),
      type: form.type,
      initialBalance: toNumber(form.initialBalance, 0)
    });
  };

  const formatMoney = (value: number) => `$${toNumber(value, 0).toFixed(2)}`;

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-3xl font-bold heading-font">{t('accounts.title')}</h2>
        <div className="flex items-center gap-2">
          <button type="button" className="ui-btn-muted flex items-center gap-2" onClick={() => void refetch()}>
            {t('accounts.refresh')}
          </button>
          <button
            type="button"
            className="ui-btn-muted flex items-center gap-2"
            onClick={toggleBalanceVisible}
            title={balanceVisible ? t('dashboard.hideBalances') : t('dashboard.showBalances')}
          >
            {balanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            {balanceVisible ? t('dashboard.hide') : t('dashboard.show')}
          </button>
          <button type="button" className="btn bg-theme-primary text-white flex items-center gap-2" onClick={openCreateModal}>
            <Plus size={16} /> {t('accounts.add')}
          </button>
        </div>
      </div>

      {!hasElectron && (
        <div className="card text-sm text-red-700 border-red-200 bg-red-50 mb-4">
          {t('accounts.noBackend')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">{t('accounts.totalAccounts')}</div>
          <div className="text-2xl font-bold text-ink">{totals.count}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">{t('accounts.totalBalance')}</div>
          <div className="text-2xl font-bold text-ink">{balanceVisible ? formatMoney(totals.totalBalance) : '••••••'}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-theme text-left">
                <th className="p-3">{t('dashboard.accountName')}</th>
                <th className="p-3">{t('dashboard.accountType')}</th>
                <th className="p-3 text-right">{t('dashboard.initialBalance')}</th>
                <th className="p-3 text-right">{t('accounts.currentBalance')}</th>
                <th className="p-3 text-right">{t('accounts.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-3 text-muted" colSpan={5}>{t('common.loading')}</td>
                </tr>
              )}
              {!isLoading && accounts.length === 0 && (
                <tr>
                  <td className="p-3 text-muted" colSpan={5}>{t('common.noData')}</td>
                </tr>
              )}
              {!isLoading && accounts.map((account) => {
                const currentBalance = toNumber(account.current_balance, account.initial_balance);
                return (
                  <tr key={account.id} className="border-b border-theme">
                    <td className="p-3 font-bold text-ink flex items-center gap-2">
                      <Wallet size={14} />
                      {account.name}
                    </td>
                    <td className="p-3 text-muted capitalize">{account.type}</td>
                    <td className="p-3 text-right font-mono text-ink">
                      {balanceVisible ? formatMoney(account.initial_balance) : '••••••'}
                    </td>
                    <td className={`p-3 text-right font-mono ${currentBalance < 0 ? 'text-red-600' : 'text-ink'}`}>
                      {balanceVisible ? formatMoney(currentBalance) : '••••••'}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-sm bg-gray-100 text-gray-700"
                          onClick={() => openEditModal(account)}
                          aria-label={`${t('common.edit')} ${account.name}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm bg-red-100 text-red-700"
                          onClick={() => setPendingDeleteAccountId(account.id)}
                          aria-label={`${t('common.delete')} ${account.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isError && (
        <div className="card mt-3 text-sm text-red-700 border-red-200 bg-red-50">
          {t('accounts.loadError')}
        </div>
      )}

      {showModal && (
        <div className="app-modal-backdrop" role="presentation" onClick={() => setShowModal(false)}>
          <div className="app-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3 className="app-modal-title">{editingAccount ? t('dashboard.editAccount') : t('dashboard.createAccount')}</h3>
            <form onSubmit={onSave} className="space-y-3">
              <div>
                <label htmlFor="account-name" className="block text-sm font-bold mb-1">{t('dashboard.accountName')}</label>
                <input
                  id="account-name"
                  className="ui-field"
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="account-type" className="block text-sm font-bold mb-1">{t('dashboard.accountType')}</label>
                <select
                  id="account-type"
                  className="ui-field"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as Account['type'] }))}
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
                  className="ui-field"
                  type="number"
                  step="0.01"
                  value={form.initialBalance}
                  onChange={(event) => setForm((prev) => ({ ...prev, initialBalance: event.target.value }))}
                />
              </div>
              <div className="app-modal-actions">
                <button type="button" className="btn app-modal-btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn app-modal-btn-primary" disabled={saveMutation.isPending}>
                  {editingAccount ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteAccountId)}
        title={t('common.delete')}
        message={t('dashboard.deleteConfirm')}
        destructive
        onCancel={() => setPendingDeleteAccountId(null)}
        onConfirm={() => {
          const id = pendingDeleteAccountId;
          if (!id) return;
          void deleteMutation.mutateAsync(id);
        }}
      />
    </div>
  );
};
