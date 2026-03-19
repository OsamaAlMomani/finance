import { useCallback, useEffect, useState } from 'react';

interface Report {
  id: string;
  month: string;
  generated_at: string;
  snapshot_data?: {
    cashFlow?: {
      income: number;
      expense: number;
      net: number;
    };
    actualVsBudget?: Array<{ categoryName: string; limitAmount: number; spent: number; variance: number }>;
    goalProgress?: Array<{ name: string; current_amount: number; target_amount: number; goal_type?: string; risk_status?: string }>;
    loanStatus?: Array<{ name: string; current_balance: number; next_due_date?: string; due_status?: string }>;
    tagBreakdown?: Array<{ tag: string; count: number; amount: number }>;
    labelBreakdown?: Array<{ label: string; count: number; amount: number }>;
    riskNotes?: string[];
  };
}

const downloadText = (filename: string, content: string, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const ReportsPage = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEditReports, setCanEditReports] = useState(true);

  const load = useCallback(async () => {
    if (!window.electron) return;
    setLoading(true);
    try {
      const [data, permission] = await Promise.all([
        window.electron.invoke('db-get-reports'),
        window.electron.invoke('db-check-permission', {
          scopeType: 'module',
          scopeId: 'reports',
          subjectType: 'user',
          subjectId: localStorage.getItem('authUserId') || 'local',
          requiredRole: 'Editor'
        }).catch(() => ({ allowed: true }))
      ]);
      const list = Array.isArray(data) ? data : [];
      setReports(list);
      setSelected((prev) => prev || list[0] || null);
      setCanEditReports(permission?.allowed !== false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!window.electron) return;
    try {
      const report = await window.electron.invoke('db-generate-report', month);
      setSelected(report || null);
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Report generation failed.');
    }
  };

  const exportCsv = async () => {
    if (!window.electron || !selected) return;
    const csv = await window.electron.invoke('db-export-report-csv', selected.month);
    downloadText(`monthly_report_${selected.month}.csv`, csv, 'text/csv');
  };

  const exportPdf = async () => {
    if (!window.electron || !selected) return;
    const content = await window.electron.invoke('db-export-report-pdf-content', selected.month);
    downloadText(`monthly_report_${selected.month}.pdf`, content, 'application/pdf');
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold font-heading">Monthly Reports</h2>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="report-month" className="block text-sm font-bold mb-1">Month</label>
          <input id="report-month" type="month" className="p-2 border rounded" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <button className="btn bg-blue-500 text-white" onClick={generate} disabled={!canEditReports}>Generate from Settled Month</button>
        <button className="btn bg-green-500 text-white" onClick={exportCsv} disabled={!selected || !canEditReports}>Export CSV</button>
        <button className="btn bg-indigo-500 text-white" onClick={exportPdf} disabled={!selected || !canEditReports}>Export PDF</button>
        {!canEditReports && (
          <span className="text-xs text-red-600 font-semibold">Report actions are disabled by permissions.</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        <div className="card lg:col-span-1 overflow-y-auto">
          <h3 className="text-xl font-bold mb-2">Available Reports</h3>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <button
                  key={report.id}
                  className={`w-full text-left p-3 border rounded ${selected?.id === report.id ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
                  onClick={() => setSelected(report)}
                >
                  <div className="font-bold">{report.month}</div>
                  <div className="text-xs text-gray-500">Generated: {report.generated_at ? new Date(report.generated_at).toLocaleString() : 'n/a'}</div>
                </button>
              ))}

              {reports.length === 0 && <div className="text-sm text-gray-500">No reports yet.</div>}
            </div>
          )}
        </div>

        <div className="card lg:col-span-2 overflow-y-auto">
          <h3 className="text-xl font-bold mb-2">Report Detail</h3>
          {!selected ? (
            <div className="text-sm text-gray-500">Select a report to view details.</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded border bg-green-50">
                  <div className="text-xs text-gray-500">Income</div>
                  <div className="text-lg font-bold">{Number(selected.snapshot_data?.cashFlow?.income || 0).toFixed(2)}</div>
                </div>
                <div className="p-3 rounded border bg-red-50">
                  <div className="text-xs text-gray-500">Expense</div>
                  <div className="text-lg font-bold">{Number(selected.snapshot_data?.cashFlow?.expense || 0).toFixed(2)}</div>
                </div>
                <div className="p-3 rounded border bg-blue-50">
                  <div className="text-xs text-gray-500">Net</div>
                  <div className="text-lg font-bold">{Number(selected.snapshot_data?.cashFlow?.net || 0).toFixed(2)}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-1">Actual vs Budget</h4>
                <div className="space-y-1">
                  {(selected.snapshot_data?.actualVsBudget || []).map((row, idx) => (
                    <div key={idx} className="flex justify-between border rounded p-2">
                      <span>{row.categoryName}</span>
                      <span>Limit {Number(row.limitAmount || 0).toFixed(2)} | Spent {Number(row.spent || 0).toFixed(2)} | Variance {Number(row.variance || 0).toFixed(2)}</span>
                    </div>
                  ))}
                  {(selected.snapshot_data?.actualVsBudget || []).length === 0 && <div className="text-gray-500">No budget rows.</div>}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-1">Goal Progress</h4>
                <div className="space-y-1">
                  {(selected.snapshot_data?.goalProgress || []).map((goal, idx) => (
                    <div key={idx} className="flex justify-between border rounded p-2">
                      <span>{goal.name} ({goal.goal_type || 'standard'})</span>
                      <span>{Number(goal.current_amount || 0).toFixed(2)} / {Number(goal.target_amount || 0).toFixed(2)} ({goal.risk_status || 'normal'})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-1">Loan Status</h4>
                <div className="space-y-1">
                  {(selected.snapshot_data?.loanStatus || []).map((loan, idx) => (
                    <div key={idx} className="flex justify-between border rounded p-2">
                      <span>{loan.name}</span>
                      <span>Balance {Number(loan.current_balance || 0).toFixed(2)} | Due {loan.next_due_date || 'n/a'} ({loan.due_status || 'upcoming'})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-1">Risk Notes</h4>
                <ul className="list-disc ml-5">
                  {(selected.snapshot_data?.riskNotes || []).map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
