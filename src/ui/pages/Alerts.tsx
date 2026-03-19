import { useCallback, useEffect, useMemo, useState } from 'react';

type AlertStatus = 'active' | 'acknowledged' | 'snoozed' | 'resolved';
type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertItem {
  id: string;
  source_type: string;
  source_id: string;
  trigger_type: string;
  condition_text: string;
  severity: AlertSeverity;
  message: string;
  recommended_action: string;
  status: AlertStatus;
  created_at: string;
}

const severityClass: Record<AlertSeverity, string> = {
  info: 'bg-blue-50 border-blue-300 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  critical: 'bg-red-50 border-red-300 text-red-800'
};

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const data = await window.electron.invoke('db-get-alerts', {
        includeResolved: true,
        status: statusFilter || undefined,
        severity: severityFilter || undefined
      });
      setAlerts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    const onDataChanged = () => {
      void loadAlerts();
    };
    window.addEventListener('finance:data-changed', onDataChanged);
    return () => window.removeEventListener('finance:data-changed', onDataChanged);
  }, [loadAlerts]);

  const groupedCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const alert of alerts) {
      counts[alert.status] = (counts[alert.status] || 0) + 1;
    }
    return counts;
  }, [alerts]);

  const updateStatus = async (id: string, status: AlertStatus) => {
    if (!window.electron) return;
    await window.electron.invoke('db-set-alert-status', id, status, {});
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    await loadAlerts();
  };

  if (loading) return <div className="p-4">Loading alerts...</div>;

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold font-heading">System Alerts</h2>
        <div className="text-sm text-gray-500">
          Active: {groupedCount.active || 0} | Acknowledged: {groupedCount.acknowledged || 0} | Snoozed: {groupedCount.snoozed || 0}
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="alerts-status" className="block text-sm font-bold mb-1">Status</label>
          <select
            id="alerts-status"
            className="p-2 border rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="snoozed">Snoozed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div>
          <label htmlFor="alerts-severity" className="block text-sm font-bold mb-1">Severity</label>
          <select
            id="alerts-severity"
            className="p-2 border rounded"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <button
          className="btn bg-gray-100"
          onClick={() => {
            setStatusFilter('');
            setSeverityFilter('');
          }}
        >
          Clear Filters
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-y-auto">
        {alerts.map((alert) => (
          <div key={alert.id} className={`card border ${severityClass[alert.severity] || severityClass.warning}`}>
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-bold text-lg">{alert.message}</h3>
                <p className="text-sm">{alert.condition_text}</p>
                <p className="text-xs mt-1 opacity-80">Action: {alert.recommended_action || 'Review details'}</p>
                <p className="text-xs mt-1 opacity-70">
                  Source: {alert.source_type}:{alert.source_id} | Trigger: {alert.trigger_type} | Created: {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right min-w-[180px]">
                <div className="text-xs font-bold uppercase mb-2">{alert.status}</div>
                <div className="flex flex-col gap-2">
                  <button className="btn bg-blue-100" onClick={() => updateStatus(alert.id, 'acknowledged')}>Acknowledge</button>
                  <button className="btn bg-yellow-100" onClick={() => updateStatus(alert.id, 'snoozed')}>Snooze</button>
                  <button className="btn bg-green-100" onClick={() => updateStatus(alert.id, 'resolved')}>Resolve</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="card text-center text-gray-500">No alerts found for selected filters.</div>
        )}
      </div>
    </div>
  );
};
