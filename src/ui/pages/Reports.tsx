import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../contexts/useI18n';
import { onFinanceDataChanged } from '../services/dataEvents';
import { ipcClient } from '../services/ipcClient';

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
  const { t } = useI18n();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEditReports, setCanEditReports] = useState(true);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, permission] = await Promise.all([
        ipcClient.reports.getAll().catch(() => []),
        ipcClient.permission.check('reports', 'Editor')
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

  useEffect(() => {
    const off = onFinanceDataChanged(() => {
      void load();
    });
    return off;
  }, [load]);

  const generate = async () => {
    try {
      const report = await ipcClient.reports.generate(month) as Report | null;
      setSelected(report || null);
      setNotice({ type: 'success', text: t('reports.notice.generated', { month }) });
      await load();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('reports.notice.generateFailed')
      });
    }
  };

  const exportCsv = async () => {
    if (!selected) return;
    try {
      const csv = await ipcClient.reports.exportCsv(selected.month);
      downloadText(`monthly_report_${selected.month}.csv`, csv, 'text/csv');
      setNotice({ type: 'success', text: t('reports.notice.csvExported') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('reports.notice.csvFailed')
      });
    }
  };

  const exportPdf = async () => {
    if (!selected) return;
    try {
      const content = await ipcClient.reports.exportPdf(selected.month);
      downloadText(`monthly_report_${selected.month}.pdf`, content, 'application/pdf');
      setNotice({ type: 'success', text: t('reports.notice.pdfExported') });
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('reports.notice.pdfFailed')
      });
    }
  };

  return (
    <div className="reports-page page-shell min-h-0 pb-6">
      <div className="page-hero">
        <div className="page-copy">
          <p className="page-eyebrow">{t('sidebar.domain.analysis')}</p>
          <h2 className="page-title heading-font">{t('reports.title')}</h2>
          <p className="page-subtitle">{t('reports.subtitle')}</p>
        </div>
      </div>

      <div className="card reports-toolbar-card">
        <div>
          <label htmlFor="report-month" className="block mb-2">{t('reports.month')}</label>
          <input id="report-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        <div className="page-actions">
          <button className="btn bg-blue-500 text-white" onClick={generate} disabled={!canEditReports}>{t('reports.generate')}</button>
          <button className="btn bg-green-500 text-white" onClick={exportCsv} disabled={!selected || !canEditReports}>{t('reports.exportCsv')}</button>
          <button className="btn bg-indigo-500 text-white" onClick={exportPdf} disabled={!selected || !canEditReports}>{t('reports.exportPdf')}</button>
        </div>

        {!canEditReports && (
          <span className="reports-notice is-error">{t('reports.permissionsDisabled')}</span>
        )}
        {notice && (
          <span className={`reports-notice ${notice.type === 'error' ? 'is-error' : 'is-success'}`}>
            {notice.text}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[26rem]">
        <div className="card lg:col-span-1 overflow-y-auto min-h-[18rem]">
          <h3 className="text-xl font-bold mb-2">{t('reports.available')}</h3>
          {loading ? (
            <div>{t('common.loading')}</div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <button
                  key={report.id}
                  className={`reports-list-button ${selected?.id === report.id ? 'is-active' : ''}`}
                  onClick={() => setSelected(report)}
                >
                  <div className="font-bold">{report.month}</div>
                  <div className="text-xs text-gray-500">
                    {t('reports.generatedAt')}: {report.generated_at ? new Date(report.generated_at).toLocaleString() : t('common.notAvailable')}
                  </div>
                </button>
              ))}

              {reports.length === 0 && <div className="text-sm text-gray-500">{t('reports.none')}</div>}
            </div>
          )}
        </div>

        <div className="card lg:col-span-2 overflow-y-auto min-h-[18rem]">
          <h3 className="text-xl font-bold mb-2">{t('reports.detail')}</h3>
          {!selected ? (
            <div className="text-sm text-gray-500">{t('reports.selectHint')}</div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="reports-metrics-grid">
                <div className="reports-metric-card bg-green-50">
                  <div className="text-xs text-gray-500">{t('reports.income')}</div>
                  <strong>{Number(selected.snapshot_data?.cashFlow?.income || 0).toFixed(2)}</strong>
                </div>
                <div className="reports-metric-card bg-red-50">
                  <div className="text-xs text-gray-500">{t('reports.expense')}</div>
                  <strong>{Number(selected.snapshot_data?.cashFlow?.expense || 0).toFixed(2)}</strong>
                </div>
                <div className="reports-metric-card bg-blue-50">
                  <div className="text-xs text-gray-500">{t('reports.net')}</div>
                  <strong>{Number(selected.snapshot_data?.cashFlow?.net || 0).toFixed(2)}</strong>
                </div>
              </div>

              <div className="reports-detail-section">
                <h4 className="font-bold mb-1">{t('reports.actualVsBudget')}</h4>
                <div className="space-y-1">
                  {(selected.snapshot_data?.actualVsBudget || []).map((row, idx) => (
                    <div key={idx} className="reports-detail-row">
                      <span>{row.categoryName}</span>
                      <span>
                        {t('reports.limit')} {Number(row.limitAmount || 0).toFixed(2)} | {t('reports.spent')} {Number(row.spent || 0).toFixed(2)} | {t('reports.variance')} {Number(row.variance || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {(selected.snapshot_data?.actualVsBudget || []).length === 0 && <div className="text-gray-500">{t('reports.noBudgetRows')}</div>}
                </div>
              </div>

              <div className="reports-detail-section">
                <h4 className="font-bold mb-1">{t('reports.goalProgress')}</h4>
                <div className="space-y-1">
                  {(selected.snapshot_data?.goalProgress || []).map((goal, idx) => (
                    <div key={idx} className="reports-detail-row">
                      <span>{goal.name} ({goal.goal_type || t('reports.standard')})</span>
                      <span>{Number(goal.current_amount || 0).toFixed(2)} / {Number(goal.target_amount || 0).toFixed(2)} ({goal.risk_status || t('reports.normal')})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="reports-detail-section">
                <h4 className="font-bold mb-1">{t('reports.loanStatus')}</h4>
                <div className="space-y-1">
                  {(selected.snapshot_data?.loanStatus || []).map((loan, idx) => (
                    <div key={idx} className="reports-detail-row">
                      <span>{loan.name}</span>
                      <span>
                        {t('reports.balance')} {Number(loan.current_balance || 0).toFixed(2)} | {t('reports.due')} {loan.next_due_date || t('common.notAvailable')} ({loan.due_status || t('reports.upcoming')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-1">{t('reports.riskNotes')}</h4>
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
