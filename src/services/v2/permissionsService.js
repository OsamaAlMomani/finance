const ROLE_RANK = {
  Viewer: 1,
  Editor: 2,
  Owner: 3
};

const normalizeRole = (role) => {
  if (!role) return 'Viewer';
  const candidates = Object.keys(ROLE_RANK);
  const found = candidates.find((candidate) => candidate.toLowerCase() === String(role).toLowerCase());
  return found || 'Viewer';
};

const savePermission = (db, permission) => {
  const role = normalizeRole(permission.role);

  db.prepare(`
    INSERT INTO permissions (id, scope_type, scope_id, role, visibility, subject_type, subject_id)
    VALUES (@id, @scopeType, @scopeId, @role, @visibility, @subjectType, @subjectId)
    ON CONFLICT(id) DO UPDATE SET
      scope_type = @scopeType,
      scope_id = @scopeId,
      role = @role,
      visibility = @visibility,
      subject_type = @subjectType,
      subject_id = @subjectId,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: permission.id,
    scopeType: permission.scope_type,
    scopeId: permission.scope_id || 'global',
    role,
    visibility: permission.visibility || 'private',
    subjectType: permission.subject_type || 'user',
    subjectId: permission.subject_id || 'local'
  });

  return getPermissionById(db, permission.id);
};

const getPermissions = (db, filter = {}) => {
  let query = 'SELECT * FROM permissions';
  const params = [];
  const conditions = [];

  if (filter.scope_type) {
    conditions.push('scope_type = ?');
    params.push(filter.scope_type);
  }

  if (filter.scope_id) {
    conditions.push('scope_id = ?');
    params.push(filter.scope_id);
  }

  if (filter.subject_type) {
    conditions.push('subject_type = ?');
    params.push(filter.subject_type);
  }

  if (filter.subject_id) {
    conditions.push('subject_id = ?');
    params.push(filter.subject_id);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY scope_type, scope_id, role DESC';
  return db.prepare(query).all(...params);
};

const getPermissionById = (db, id) => {
  return db.prepare('SELECT * FROM permissions WHERE id = ?').get(id);
};

const deletePermission = (db, id) => {
  db.prepare('DELETE FROM permissions WHERE id = ?').run(id);
};

const getEffectiveRole = (db, context) => {
  const scopeType = context.scopeType;
  const scopeId = context.scopeId || 'global';
  const subjectType = context.subjectType || 'user';
  const subjectId = context.subjectId || 'local';

  const exact = db.prepare(`
    SELECT role
    FROM permissions
    WHERE scope_type = ?
      AND scope_id = ?
      AND subject_type = ?
      AND subject_id = ?
    ORDER BY CASE role WHEN 'Owner' THEN 3 WHEN 'Editor' THEN 2 ELSE 1 END DESC
    LIMIT 1
  `).get(scopeType, scopeId, subjectType, subjectId);

  if (exact?.role) {
    return normalizeRole(exact.role);
  }

  const global = db.prepare(`
    SELECT role
    FROM permissions
    WHERE scope_type = 'global'
      AND scope_id = 'global'
      AND subject_type = ?
      AND subject_id = ?
    ORDER BY CASE role WHEN 'Owner' THEN 3 WHEN 'Editor' THEN 2 ELSE 1 END DESC
    LIMIT 1
  `).get(subjectType, subjectId);

  return normalizeRole(global?.role || 'Viewer');
};

const checkPermission = (db, context) => {
  const requiredRole = normalizeRole(context.requiredRole || 'Viewer');
  const actualRole = getEffectiveRole(db, context);

  return {
    allowed: ROLE_RANK[actualRole] >= ROLE_RANK[requiredRole],
    actualRole,
    requiredRole
  };
};

const enforcePermission = (db, context) => {
  const result = checkPermission(db, context);
  if (!result.allowed) {
    throw new Error(`Permission denied. Required ${result.requiredRole}, but caller has ${result.actualRole}.`);
  }
  return result;
};

const ensureDefaultOwnerPermission = (db, subjectType = 'user', subjectId = 'local') => {
  const existing = db.prepare(`
    SELECT id
    FROM permissions
    WHERE scope_type = 'global'
      AND scope_id = 'global'
      AND subject_type = ?
      AND subject_id = ?
    LIMIT 1
  `).get(subjectType, subjectId);

  if (existing) return;

  db.prepare(`
    INSERT INTO permissions (id, scope_type, scope_id, role, visibility, subject_type, subject_id)
    VALUES (@id, 'global', 'global', 'Owner', 'private', @subjectType, @subjectId)
  `).run({
    id: `perm_global_${subjectType}_${subjectId}`,
    subjectType,
    subjectId
  });
};

export {
  checkPermission,
  deletePermission,
  enforcePermission,
  ensureDefaultOwnerPermission,
  getPermissions,
  savePermission
};
