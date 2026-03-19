import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const data = await window.electron.invoke('db-get-settlement-by-month', selectedMonth);
      setSettlement(data || null);
      setNotes(data?.notes || '');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const finalize = async () => {
    if (!window.electron) return;
    try {
      const result = await window.electron.invoke('db-finalize-settlement', selectedMonth, notes);
      setSettlement(result?.settlement || null);
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to finalize month');
    }
  };

  const reopen = async () => {
    if (!window.electron) return;
    const reason = prompt('Reason for reopening month?', 'Post-close transaction correction') || '';
    try {
      const result = await window.electron.invoke('db-reopen-settlement', selectedMonth, reason);
      setSettlement(result || null);
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to reopen month');
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold font-heading">Monthly Settlement</h2>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="settlement-month" className="block text-sm font-bold mb-1">Month</label>
          <input
            id="settlement-month"
            type="month"
            className="p-2 border rounded"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button className="btn bg-green-500 text-white" onClick={finalize} disabled={loading}>Finalize Month</button>
          <button className="btn bg-yellow-500 text-white" onClick={reopen} disabled={loading}>Reopen Month</button>
        </div>
      </div>

      {loading ? (
        <div className="p-4">Loading settlement...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-xl font-bold mb-2">Settlement Status</h3>
            {settlement ? (
              <>
                <p className="text-sm"><strong>Status:</strong> {settlement.status}</p>
                <p className="text-sm"><strong>Dirty:</strong> {settlement.is_dirty ? 'Yes' : 'No'}</p>
                <p className="text-sm"><strong>Unresolved Alerts:</strong> {settlement.unresolved_count}</p>
                <p className="text-sm"><strong>Reconciled At:</strong> {settlement.reconciled_at ? new Date(settlement.reconciled_at).toLocaleString() : 'Not finalized'}</p>

                <label htmlFor="settlement-notes" className="block text-sm font-bold mt-3 mb-1">Notes</label>
                <textarea
                  id="settlement-notes"
                  className="w-full p-2 border rounded"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </>
            ) : (
              <p className="text-sm text-gray-500">No settlement exists for this month yet. Save transactions to initialize it.</p>
            )}
          </div>

          <div className="card">
            <h3 className="text-xl font-bold mb-2">Checklist</h3>
            {settlement?.checklist?.items?.length ? (
              <div className="space-y-2">
                {settlement.checklist.items.map((item) => (
                  <div key={item.key} className={`p-2 rounded border ${item.done ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="font-semibold text-sm">{item.done ? 'Done' : 'Pending'} - {item.label}</p>
                    {item.meta && (
                      <p className="text-xs text-gray-600">{JSON.stringify(item.meta)}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Checklist will appear after settlement is initialized.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
