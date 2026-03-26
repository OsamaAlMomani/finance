import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../contexts/useI18n';
import { onFinanceDataChanged } from '../services/dataEvents';
import { ipcClient } from '../services/ipcClient';

interface SettlementChecklistItem {
  key: string;
  label: string;
  done: boolean;
  meta?: Record<string, unknown>;
}

interface Settlement {
  id: string;
  month: string;
  status: 'in_review' | 'finalized';
  is_dirty: number;
  unresolved_count: number;
  reconciled_at?: string;
  notes?: string;
  checklist?: {
    items?: SettlementChecklistItem[];
    unresolvedCount?: number;
  };
}

export const SettlementPage = () => {
  const { t } = useI18n();
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('Post-close transaction correction');
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ipcClient.settlement.getByMonth(selectedMonth) as Settlement | null;
      setSettlement(data || null);
      setNotes(data?.notes || '');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const off = onFinanceDataChanged(() => {
      void load();
    });
    return off;
  }, [load]);

  const finalize = async () => {
    try {
      const result = await ipcClient.settlement.finalize(selectedMonth, notes) as { settlement?: Settlement | null } | null;
      setSettlement(result?.settlement || null);
      setNotice({ type: 'success', text: t('settlement.notice.finalized') });
      await load();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('settlement.notice.finalizeFailed')
      });
    }
  };

  const reopen = async () => {
    try {
      const result = await ipcClient.settlement.reopen(selectedMonth, reopenReason || 'Post-close transaction correction') as Settlement | null;
      setSettlement(result || null);
      setNotice({ type: 'success', text: t('settlement.notice.reopened') });
      await load();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('settlement.notice.reopenFailed')
      });
    }
  };

  return (
    <div className="settlement-page ui-page-shell gap-4 pb-6">
      <div className="ui-page-header">
        <h2 className="text-3xl font-bold font-heading">{t('settlement.title')}</h2>
      </div>

      <div className="card ui-page-actions items-end">
        <div>
          <label htmlFor="settlement-month" className="block text-sm font-bold mb-1">{t('settlement.month')}</label>
          <input
            id="settlement-month"
            type="month"
            className="ui-field"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>

        <div className="min-w-56">
          <label htmlFor="reopen-reason" className="block text-sm font-bold mb-1">{t('settlement.reopenReason')}</label>
          <input
            id="reopen-reason"
            className="ui-field"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder={t('settlement.reopenReasonPlaceholder')}
          />
        </div>

        <div className="ui-page-actions">
          <button className="btn" onClick={finalize} disabled={loading}>{t('settlement.finalize')}</button>
          <button className="ui-btn-surface text-theme-primary" onClick={reopen} disabled={loading}>{t('settlement.reopen')}</button>
        </div>

        {notice && (
          <p className={`ui-status-note ${notice.type === 'error' ? 'ui-status-note-error' : 'ui-status-note-success'}`}>
            {notice.text}
          </p>
        )}
      </div>

      {loading ? (
        <div className="card text-ink">{t('settlement.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[24rem]">
          <div className="card min-h-[18rem]">
            <h3 className="text-xl font-bold mb-2">{t('settlement.statusTitle')}</h3>
            {settlement ? (
              <>
                <div className="space-y-2 text-sm text-ink">
                  <div className="ui-soft-row"><strong>{t('settlement.status')}:</strong> {settlement.status}</div>
                  <div className="ui-soft-row"><strong>{t('settlement.dirty')}:</strong> {settlement.is_dirty ? t('settlement.yes') : t('settlement.no')}</div>
                  <div className="ui-soft-row"><strong>{t('settlement.unresolvedAlerts')}:</strong> {settlement.unresolved_count}</div>
                  <div className="ui-soft-row"><strong>{t('settlement.reconciledAt')}:</strong> {settlement.reconciled_at ? new Date(settlement.reconciled_at).toLocaleString() : t('settlement.notFinalized')}</div>
                </div>

                <label htmlFor="settlement-notes" className="block text-sm font-bold mt-3 mb-1">{t('common.notes')}</label>
                <textarea
                  id="settlement-notes"
                  className="ui-field"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </>
            ) : (
              <p className="text-sm text-muted">{t('settlement.empty')}</p>
            )}
          </div>

          <div className="card min-h-[18rem] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">{t('settlement.checklist')}</h3>
            {settlement?.checklist?.items?.length ? (
              <div className="space-y-2">
                {settlement.checklist.items.map((item) => (
                  <div key={item.key} className={`ui-soft-row ${item.done ? 'bg-theme-primary-soft' : 'bg-theme-error-soft'}`}>
                    <p className="font-semibold text-sm text-ink">
                      <span className={`ui-badge ${item.done ? 'ui-badge-active' : 'ui-badge-danger'} mr-2`}>
                        {item.done ? t('settlement.done') : t('settlement.pending')}
                      </span>
                      {item.label}
                    </p>
                    {item.meta && (
                      <p className="ui-code-block mt-2">{JSON.stringify(item.meta)}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('settlement.checklistEmpty')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
