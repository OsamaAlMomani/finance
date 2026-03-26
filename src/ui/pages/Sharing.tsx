import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useI18n } from '../contexts/useI18n';
import { onFinanceDataChanged } from '../services/dataEvents';
import { ipcClient } from '../services/ipcClient';

interface ShareSnapshot {
  id: string;
  report_id: string;
  snapshot_name: string;
  status: string;
  integrity_hash: string;
  created_at: string;
}

interface PermissionEntry {
  id: string;
  scope_type: string;
  scope_id: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  subject_type: string;
  subject_id: string;
  visibility: string;
}

const downloadText = (fileName: string, content: string, mime = 'application/json') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export const SharingPage = () => {
  const { t } = useI18n();
  const [reports, setReports] = useState<Array<{ id: string; month: string }>>([]);
  const [snapshots, setSnapshots] = useState<ShareSnapshot[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [canEditSharing, setCanEditSharing] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [shareNotice, setShareNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [permissionForm, setPermissionForm] = useState({
    scopeType: 'module',
    scopeId: 'reports',
    role: 'Viewer',
    subjectType: 'user',
    subjectId: localStorage.getItem('authUserId') || 'local',
    visibility: 'private'
  });

  const load = useCallback(async () => {
    const [reportData, snapshotData, permissionData, permissionCheck] = await Promise.all([
      ipcClient.sharing.getReports().catch(() => []),
      ipcClient.sharing.listSnapshots().catch(() => []),
      ipcClient.sharing.getPermissions().catch(() => []),
      ipcClient.permission.check('sharing', 'Editor')
    ]);

    const normalizedReports = (Array.isArray(reportData) ? reportData : []).map((item: { id: string; month: string }) => ({ id: item.id, month: item.month }));
    setReports(normalizedReports);
    setSnapshots(Array.isArray(snapshotData) ? snapshotData : []);
    setPermissions(Array.isArray(permissionData) ? permissionData : []);
    setCanEditSharing(permissionCheck?.allowed !== false);
    setSelectedReportId((prev) => prev || normalizedReports[0]?.id || '');
  }, []);

  const reportMonthMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const report of reports) {
      map.set(report.id, report.month);
    }
    return map;
  }, [reports]);

  const normalizeName = useCallback((name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const off = onFinanceDataChanged(() => {
      void load();
    });
    return off;
  }, [load]);

  const createSnapshot = async () => {
    setShareNotice(null);

    if (!selectedReportId) {
      setShareNotice({ type: 'error', text: t('sharing.notice.chooseReport') });
      return;
    }

    const displayMonth = reportMonthMap.get(selectedReportId) || t('sharing.defaultReport');
    const effectiveName = snapshotName.trim() || t('sharing.defaultSnapshotName', { month: displayMonth });

    const hasDuplicate = snapshots.some((snapshot) => {
      if (snapshot.status === 'revoked') return false;
      return snapshot.report_id === selectedReportId && normalizeName(snapshot.snapshot_name) === normalizeName(effectiveName);
    });

    if (hasDuplicate) {
      setShareNotice({
        type: 'error',
        text: t('sharing.notice.duplicate')
      });
      return;
    }

    try {
      await ipcClient.sharing.createSnapshot({
        id: uuidv4(),
        reportId: selectedReportId,
        snapshot_name: effectiveName
      });
      setSnapshotName('');
      setShareNotice({ type: 'success', text: t('sharing.notice.created') });
      await load();
    } catch (error) {
      setShareNotice({
        type: 'error',
        text: error instanceof Error ? error.message : t('sharing.notice.createFailed')
      });
    }
  };

  const revokeSnapshot = async (id: string) => {
    await ipcClient.sharing.revokeSnapshot(id);
    await load();
  };

  const exportSnapshot = async (id: string) => {
    const data = await ipcClient.sharing.exportSnapshot(id) as { fileName?: string; packageJson?: string };
    downloadText(data.fileName || `${id}.json`, data.packageJson || '{}');
  };

  const savePermissionEntry = async () => {
    await ipcClient.sharing.savePermission({
      id: uuidv4(),
      scope_type: permissionForm.scopeType,
      scope_id: permissionForm.scopeId,
      role: permissionForm.role,
      subject_type: permissionForm.subjectType,
      subject_id: permissionForm.subjectId,
      visibility: permissionForm.visibility
    });
    await load();
  };

  const deletePermissionEntry = async (id: string) => {
    await ipcClient.sharing.deletePermission(id);
    await load();
  };

  return (
    <div className="sharing-page flex flex-col gap-4 min-h-0 pb-6">
      <h2 className="text-3xl font-bold font-heading">{t('sharing.title')}</h2>

      <div className="card">
        <h3 className="text-xl font-bold mb-3">{t('sharing.shareSnapshot')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="share-report" className="block text-sm font-bold mb-1">{t('sharing.report')}</label>
            <select
              id="share-report"
              className="w-full p-2 border rounded"
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
            >
              {reports.map((report) => (
                <option key={report.id} value={report.id}>{report.month} ({report.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="share-name" className="block text-sm font-bold mb-1">{t('sharing.snapshotName')}</label>
            <input
              id="share-name"
              className="w-full p-2 border rounded"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder={t('sharing.snapshotPlaceholder')}
            />
          </div>

          <button className="btn bg-blue-500 text-white" onClick={createSnapshot} disabled={!canEditSharing}>{t('sharing.createSnapshot')}</button>
        </div>
        {shareNotice && (
          <p className={`text-xs mt-2 ${shareNotice.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{shareNotice.text}</p>
        )}
        {!canEditSharing && <p className="text-xs text-red-600 mt-2">{t('sharing.permissionsDisabled')}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[24rem]">
        <div className="card overflow-y-auto min-h-[18rem]">
          <h3 className="text-xl font-bold mb-3">{t('sharing.snapshots')}</h3>
          <div className="sharing-bridges">
            {snapshots.map((snapshot, index) => (
              <div
                key={snapshot.id}
                className={`sharing-bridge ${index < snapshots.length - 1 ? 'sharing-bridge-connected' : ''}`}
              >
                <span className="sharing-bridge-dot" aria-hidden />
                <div className="sharing-bridge-card">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{snapshot.snapshot_name}</p>
                    <div className="sharing-link-badges">
                      <span className="sharing-link-badge">{t('sharing.report')} {reportMonthMap.get(snapshot.report_id) || snapshot.report_id}</span>
                      <span className={`sharing-link-badge ${snapshot.status === 'revoked' ? 'sharing-link-badge-revoked' : 'sharing-link-badge-active'}`}>
                        {snapshot.status}
                      </span>
                      <span className="sharing-link-badge">{t('common.idLabel')} {snapshot.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-xs text-gray-500 break-all mt-2">{t('sharing.hash')}: {snapshot.integrity_hash}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="btn bg-green-100" onClick={() => exportSnapshot(snapshot.id)} disabled={!canEditSharing}>{t('sharing.export')}</button>
                    <button className="btn bg-red-100" onClick={() => revokeSnapshot(snapshot.id)} disabled={snapshot.status === 'revoked' || !canEditSharing}>{t('sharing.revoke')}</button>
                  </div>
                </div>
              </div>
            ))}

            {snapshots.length === 0 && <div className="text-sm text-gray-500">{t('sharing.noSnapshots')}</div>}
          </div>
        </div>

        <div className="card overflow-y-auto min-h-[18rem]">
          <h3 className="text-xl font-bold mb-3">{t('sharing.permissions')}</h3>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input className="p-2 border rounded" value={permissionForm.scopeType} onChange={(e) => setPermissionForm({ ...permissionForm, scopeType: e.target.value })} placeholder="scope_type" />
            <input className="p-2 border rounded" value={permissionForm.scopeId} onChange={(e) => setPermissionForm({ ...permissionForm, scopeId: e.target.value })} placeholder="scope_id" />
            <select className="p-2 border rounded" value={permissionForm.role} onChange={(e) => setPermissionForm({ ...permissionForm, role: e.target.value as 'Owner' | 'Editor' | 'Viewer' })}>
              <option value="Owner">Owner</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
            <input className="p-2 border rounded" value={permissionForm.subjectId} onChange={(e) => setPermissionForm({ ...permissionForm, subjectId: e.target.value })} placeholder="subject_id" />
            <input className="p-2 border rounded" value={permissionForm.subjectType} onChange={(e) => setPermissionForm({ ...permissionForm, subjectType: e.target.value })} placeholder="subject_type" />
            <input className="p-2 border rounded" value={permissionForm.visibility} onChange={(e) => setPermissionForm({ ...permissionForm, visibility: e.target.value })} placeholder="visibility" />
          </div>

          <button className="btn bg-indigo-500 text-white mb-3" onClick={savePermissionEntry} disabled={!canEditSharing}>{t('sharing.savePermission')}</button>

          <div className="space-y-2">
            {permissions.map((permission) => (
              <div key={permission.id} className="border rounded p-2 text-sm flex justify-between items-start gap-2">
                <div>
                  <p><strong>{permission.role}</strong> {t('sharing.permissionOn')} {permission.scope_type}:{permission.scope_id}</p>
                  <p className="text-xs text-gray-500">{permission.subject_type}:{permission.subject_id} ({permission.visibility})</p>
                </div>
                <button className="btn bg-red-100" onClick={() => deletePermissionEntry(permission.id)} disabled={!canEditSharing}>{t('common.delete')}</button>
              </div>
            ))}
            {permissions.length === 0 && <div className="text-sm text-gray-500">{t('sharing.noPermissions')}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
