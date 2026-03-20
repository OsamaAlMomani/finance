const DEFAULT_RULE_PRIORITY = 100;

const normalizeString = (value) => String(value ?? '').trim();

const parseRuleAction = (actionJson) => {
  if (!actionJson) return {};
  try {
    const parsed = JSON.parse(actionJson);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const evalOperator = (left, operator, rightRaw) => {
  const right = normalizeString(rightRaw);
  const leftStr = normalizeString(left);

  switch (operator) {
    case 'equals':
      return leftStr.toLowerCase() === right.toLowerCase();
    case 'contains':
      return leftStr.toLowerCase().includes(right.toLowerCase());
    case 'starts_with':
      return leftStr.toLowerCase().startsWith(right.toLowerCase());
    case 'gt': {
      const ln = Number(left);
      const rn = Number(right);
      return Number.isFinite(ln) && Number.isFinite(rn) && ln > rn;
    }
    case 'lt': {
      const ln = Number(left);
      const rn = Number(right);
      return Number.isFinite(ln) && Number.isFinite(rn) && ln < rn;
    }
    default:
      return false;
  }
};

const loadTransactionCore = (db, transactionId) => {
  return db.prepare(`
    SELECT id, account_id, to_account_id, category_id, subcategory_id, type, amount, date, merchant, notes, tags_json
    FROM transactions
    WHERE id = ?
  `).get(transactionId);
};

const getRules = (db) => {
  return db.prepare(`
    SELECT *
    FROM classification_rules
    WHERE enabled = 1
    ORDER BY priority ASC, created_at ASC, id ASC
  `).all();
};

const upsertSubcategory = (db, subcategory) => {
  db.prepare(`
    INSERT INTO subcategories (id, category_id, name)
    VALUES (@id, @categoryId, @name)
    ON CONFLICT(id) DO UPDATE SET
      category_id = @categoryId,
      name = @name
  `).run({
    id: subcategory.id,
    categoryId: subcategory.category_id,
    name: subcategory.name
  });

  return subcategory;
};

const getSubcategories = (db, categoryId = null) => {
  if (categoryId) {
    return db.prepare('SELECT * FROM subcategories WHERE category_id = ? ORDER BY name').all(categoryId);
  }
  return db.prepare('SELECT * FROM subcategories ORDER BY name').all();
};

const deleteSubcategory = (db, id) => {
  db.prepare('UPDATE transactions SET subcategory_id = NULL WHERE subcategory_id = ?').run(id);
  db.prepare('DELETE FROM subcategories WHERE id = ?').run(id);
};

const upsertTag = (db, tag) => {
  db.prepare(`
    INSERT INTO tags (id, name, color)
    VALUES (@id, @name, @color)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      color = @color
  `).run({
    id: tag.id,
    name: tag.name,
    color: tag.color || '#6B7280'
  });

  return tag;
};

const getTags = (db) => {
  return db.prepare('SELECT * FROM tags ORDER BY name').all();
};

const deleteTag = (db, id) => {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
};

const upsertLabel = (db, label) => {
  db.prepare(`
    INSERT INTO labels (id, name, type, color, locked_flag)
    VALUES (@id, @name, @type, @color, @lockedFlag)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      type = @type,
      color = @color,
      locked_flag = @lockedFlag
  `).run({
    id: label.id,
    name: label.name,
    type: label.type || 'status',
    color: label.color || '#6B7280',
    lockedFlag: label.locked_flag ? 1 : 0
  });

  return label;
};

const getLabels = (db) => {
  return db.prepare('SELECT * FROM labels ORDER BY name').all();
};

const deleteLabel = (db, id) => {
  db.prepare('DELETE FROM labels WHERE id = ?').run(id);
};

const upsertClassificationRule = (db, rule) => {
  db.prepare(`
    INSERT INTO classification_rules (id, name, enabled, priority, field, operator, value, action_json)
    VALUES (@id, @name, @enabled, @priority, @field, @operator, @value, @actionJson)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      enabled = @enabled,
      priority = @priority,
      field = @field,
      operator = @operator,
      value = @value,
      action_json = @actionJson
  `).run({
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled === false ? 0 : 1,
    priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : DEFAULT_RULE_PRIORITY,
    field: rule.field || 'merchant',
    operator: rule.operator || 'contains',
    value: rule.value || '',
    actionJson: typeof rule.action_json === 'string'
      ? rule.action_json
      : JSON.stringify(rule.action || {})
  });

  return rule;
};

const getClassificationRules = (db) => {
  return db.prepare('SELECT * FROM classification_rules ORDER BY priority ASC, created_at ASC').all();
};

const deleteClassificationRule = (db, id) => {
  db.prepare('DELETE FROM classification_rules WHERE id = ?').run(id);
};

const setTransactionTagsAndLabels = (db, transactionId, tagIds = [], labelIds = []) => {
  db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(transactionId);
  db.prepare('DELETE FROM transaction_labels WHERE transaction_id = ?').run(transactionId);

  const insertTag = db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)');
  const insertLabel = db.prepare('INSERT INTO transaction_labels (transaction_id, label_id) VALUES (?, ?)');

  const tx = db.transaction(() => {
    for (const tagId of [...new Set(tagIds.filter(Boolean))]) {
      insertTag.run(transactionId, tagId);
    }

    for (const labelId of [...new Set(labelIds.filter(Boolean))]) {
      insertLabel.run(transactionId, labelId);
    }
  });

  tx();

  const tagNames = db.prepare(`
    SELECT t.name
    FROM transaction_tags tt
    JOIN tags t ON t.id = tt.tag_id
    WHERE tt.transaction_id = ?
    ORDER BY t.name
  `).all(transactionId).map((row) => row.name);

  db.prepare('UPDATE transactions SET tags_json = ? WHERE id = ?').run(JSON.stringify(tagNames), transactionId);
};

const getTransactionClassification = (db, transactionId) => {
  const tags = db.prepare(`
    SELECT t.id, t.name, t.color
    FROM transaction_tags tt
    JOIN tags t ON t.id = tt.tag_id
    WHERE tt.transaction_id = ?
    ORDER BY t.name
  `).all(transactionId);

  const labels = db.prepare(`
    SELECT l.id, l.name, l.type, l.color, l.locked_flag
    FROM transaction_labels tl
    JOIN labels l ON l.id = tl.label_id
    WHERE tl.transaction_id = ?
    ORDER BY l.name
  `).all(transactionId);

  return { tags, labels };
};

const applyClassificationToTransaction = (db, transactionId, provided = {}) => {
  const tx = loadTransactionCore(db, transactionId);
  if (!tx) return null;

  const rules = getRules(db);
  const next = {
    categoryId: provided.categoryId || tx.category_id || null,
    subcategoryId: provided.subcategoryId || tx.subcategory_id || null,
    tagIds: [...new Set((provided.tagIds || []).filter(Boolean))],
    labelIds: [...new Set((provided.labelIds || []).filter(Boolean))]
  };

  for (const rule of rules) {
    const fieldValue = tx[rule.field] ?? '';
    if (!evalOperator(fieldValue, rule.operator, rule.value)) {
      continue;
    }

    const action = parseRuleAction(rule.action_json);

    if (action.categoryId && !provided.categoryId) {
      next.categoryId = action.categoryId;
    }

    if (action.subcategoryId && !provided.subcategoryId) {
      next.subcategoryId = action.subcategoryId;
    }

    if (Array.isArray(action.addTagIds)) {
      next.tagIds = [...new Set([...next.tagIds, ...action.addTagIds.filter(Boolean)])];
    }

    if (Array.isArray(action.addLabelIds)) {
      next.labelIds = [...new Set([...next.labelIds, ...action.addLabelIds.filter(Boolean)])];
    }
  }

  db.prepare(`
    UPDATE transactions
    SET category_id = @categoryId,
        subcategory_id = @subcategoryId
    WHERE id = @id
  `).run({
    id: transactionId,
    categoryId: next.categoryId,
    subcategoryId: next.subcategoryId
  });

  setTransactionTagsAndLabels(db, transactionId, next.tagIds, next.labelIds);

  return {
    transactionId,
    ...next,
    classification: getTransactionClassification(db, transactionId)
  };
};

export {
  applyClassificationToTransaction,
  deleteClassificationRule,
  deleteLabel,
  deleteSubcategory,
  deleteTag,
  getClassificationRules,
  getLabels,
  getSubcategories,
  getTags,
  getTransactionClassification,
  upsertClassificationRule,
  upsertLabel,
  upsertSubcategory,
  upsertTag
};
