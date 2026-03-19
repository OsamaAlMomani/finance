import crypto from 'crypto';
import { getMonthlyReportById, getMonthlyReportByMonth } from './reportsService.js';

const createIntegrityHash = (payload) => {
  return crypto.createHash('sha256').update(payload).digest('hex');
};

const createShareSnapshot = (db, input) => {
  const report = input.reportId
    ? getMonthlyReportById(db, input.reportId)
    : getMonthlyReportByMonth(db, input.month);

  if (!report) {
    throw new Error('Cannot create share snapshot without report data.');
  }

  const payloadObject = {
    reportId: report.id,
    month: report.month,
    sharedAt: new Date().toISOString(),
    sharedBy: input.sharedBy || 'local',
    filters: input.filters || {},
    readOnly: true,
    data: report.snapshot_data
  };

  const payloadJson = JSON.stringify(payloadObject);
  const integrityHash = createIntegrityHash(payloadJson);

  db.prepare(`
    INSERT INTO share_snapshots (id, report_id, snapshot_name, payload_json, integrity_hash, status, expires_at)
    VALUES (@id, @reportId, @snapshotName, @payloadJson, @integrityHash, 'active', @expiresAt)
  `).run({
    id: input.id,
    reportId: report.id,
    snapshotName: input.snapshot_name || `Snapshot ${report.month}`,
    payloadJson,
    integrityHash,
    expiresAt: input.expires_at || null
  });

  return getShareSnapshotById(db, input.id);
};

const listShareSnapshots = (db, filter = {}) => {
  let query = 'SELECT * FROM share_snapshots';
  const conditions = [];
  const params = [];

  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }

  if (filter.report_id) {
    conditions.push('report_id = ?');
    params.push(filter.report_id);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';

  return db.prepare(query).all(...params).map((row) => ({
    ...row,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null
  }));
};

const getShareSnapshotById = (db, id) => {
  const row = db.prepare('SELECT * FROM share_snapshots WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null
  };
};

const revokeShareSnapshot = (db, id) => {
  db.prepare(`
    UPDATE share_snapshots
    SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getShareSnapshotById(db, id);
};

const exportShareSnapshotPackage = (db, id) => {
  const snapshot = getShareSnapshotById(db, id);
  if (!snapshot) {
    throw new Error('Share snapshot not found.');
  }

  const packageObject = {
    id: snapshot.id,
    reportId: snapshot.report_id,
    snapshotName: snapshot.snapshot_name,
    status: snapshot.status,
    integrityHash: snapshot.integrity_hash,
    payload: snapshot.payload
  };

  const packageJson = JSON.stringify(packageObject, null, 2);
  const recomputedHash = createIntegrityHash(JSON.stringify(snapshot.payload || {}));

  return {
    fileName: `${snapshot.snapshot_name.replace(/\s+/g, '_').toLowerCase()}_${snapshot.id}.json`,
    packageJson,
    integrityHash: snapshot.integrity_hash,
    integrityValid: recomputedHash === snapshot.integrity_hash
  };
};

export {
  createShareSnapshot,
  exportShareSnapshotPackage,
  listShareSnapshots,
  revokeShareSnapshot
};
