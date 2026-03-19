import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
  const [reports, setReports] = useState<Array<{ id: string; month: string }>>([]);
  const [snapshots, setSnapshots] = useState<ShareSnapshot[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [canEditSharing, setCanEditSharing] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [permissionForm, setPermissionForm] = useState({
    scopeType: 'module',
    scopeId: 'reports',
    role: 'Viewer',
    subjectType: 'user',
    subjectId: localStorage.getItem('authUserId') || 'local',
    visibility: 'private'
  });

  const load = useCallback(async () => {
    if (!window.electron) return;
    const [reportData, snapshotData, permissionData, permissionCheck] = await Promise.all([
      window.electron.invoke('db-get-reports').catch(() => []),
      window.electron.invoke('db-list-share-snapshots', {}).catch(() => []),
      window.electron.invoke('db-get-permissions').catch(() => []),
      window.electron.invoke('db-check-permission', {
        scopeType: 'module',
        scopeId: 'sharing',
        subjectType: 'user',
        subjectId: localStorage.getItem('authUserId') || 'local',
        requiredRole: 'Editor'
      }).catch(() => ({ allowed: true }))
    ]);

    const normalizedReports = (Array.isArray(reportData) ? reportData : []).map((item: { id: string; month: string }) => ({ id: item.id, month: item.month }));
    setReports(normalizedReports);
    setSnapshots(Array.isArray(snapshotData) ? snapshotData : []);
    setPermissions(Array.isArray(permissionData) ? permissionData : []);
    setCanEditSharing(permissionCheck?.allowed !== false);
    setSelectedReportId((prev) => prev || normalizedReports[0]?.id || '');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onDataChanged = () => {
      void load();
    };
    window.addEventListener('finance:data-changed', onDataChanged);
    return () => window.removeEventListener('finance:data-changed', onDataChanged);
  }, [load]);

  const createSnapshot = async () => {
    if (!window.electron) return;
    if (!selectedReportId) {
      alert('Choose a report first.');
      return;
    }

    try {
      await window.electron.invoke('db-create-share-snapshot', {
        id: uuidv4(),
        reportId: selectedReportId,
        snapshot_name: snapshotName || 'Share Snapshot',
        subjectType: 'user',
        subjectId: localStorage.getItem('authUserId') || 'local',
        scopeType: 'module',
        scopeId: 'sharing'
      });
      setSnapshotName('');
      window.dispatchEvent(new CustomEvent('finance:data-changed'));
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create snapshot');
    }
  };

  const revokeSnapshot = async (id: string) => {
    if (!window.electron) return;
    await window.electron.invoke('db-revoke-share-snapshot', id, {
      scopeType: 'module',
      scopeId: 'sharing',
      subjectType: 'user',
      subjectId: localStorage.getItem('authUserId') || 'local'
    });
    window.dispatchEvent(new CustomEvent('finance:data-changed'));
    await load();
  };

  const exportSnapshot = async (id: string) => {
    if (!window.electron) return;
    const data = await window.electron.invoke('db-export-share-snapshot', id);
    downloadText(data.fileName || `${id}.json`, data.packageJson || '{}');
  };

  const savePermissionEntry = async () => {
    if (!window.electron) return;
    await window.electron.invoke('db-save-permission', {
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
    if (!window.electron) return;
    await window.electron.invoke('db-delete-permission', id);
    await load();
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <h2 className="text-3xl font-bold font-heading">Sharing & Permissions</h2>

      <div className="card">
        <h3 className="text-xl font-bold mb-3">Share Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="share-report" className="block text-sm font-bold mb-1">Report</label>
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
            <label htmlFor="share-name" className="block text-sm font-bold mb-1">Snapshot Name</label>
            <input id="share-name" className="w-full p-2 border rounded" value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} placeholder="e.g. Board review" />
          </div>

          <button className="btn bg-blue-500 text-white" onClick={createSnapshot} disabled={!canEditSharing}>Create Snapshot</button>
        </div>
        {!canEditSharing && <p className="text-xs text-red-600 mt-2">Sharing actions are disabled by permissions.</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card overflow-y-auto">
          <h3 className="text-xl font-bold mb-3">Snapshots</h3>
          <div className="space-y-2">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="border rounded p-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">{snapshot.snapshot_name}</p>
                    <p className="text-xs text-gray-500">Report: {snapshot.report_id}</p>
                    <p className="text-xs text-gray-500">Status: {snapshot.status}</p>
                    <p className="text-xs text-gray-500 break-all">Hash: {snapshot.integrity_hash}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="btn bg-green-100" onClick={() => exportSnapshot(snapshot.id)} disabled={!canEditSharing}>Export</button>
                    <button className="btn bg-red-100" onClick={() => revokeSnapshot(snapshot.id)} disabled={snapshot.status === 'revoked' || !canEditSharing}>Revoke</button>
                  </div>
                </div>
              </div>
            ))}

            {snapshots.length === 0 && <div className="text-sm text-gray-500">No snapshots created yet.</div>}
          </div>
        </div>

        <div className="card overflow-y-auto">
          <h3 className="text-xl font-bold mb-3">Permissions</h3>

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

          <button className="btn bg-indigo-500 text-white mb-3" onClick={savePermissionEntry} disabled={!canEditSharing}>Save Permission</button>

          <div className="space-y-2">
            {permissions.map((permission) => (
              <div key={permission.id} className="border rounded p-2 text-sm flex justify-between items-start gap-2">
                <div>
                  <p><strong>{permission.role}</strong> on {permission.scope_type}:{permission.scope_id}</p>
                  <p className="text-xs text-gray-500">{permission.subject_type}:{permission.subject_id} ({permission.visibility})</p>
                </div>
                <button className="btn bg-red-100" onClick={() => deletePermissionEntry(permission.id)} disabled={!canEditSharing}>Delete</button>
              </div>
            ))}
            {permissions.length === 0 && <div className="text-sm text-gray-500">No permission entries.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
