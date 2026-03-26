const normalizeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const ensureString = (value, field, options = {}) => {
  const {
    required = true,
    allowEmpty = false,
    defaultValue = '',
    maxLength = 255
  } = options;

  const normalized = normalizeString(value || defaultValue);
  if (required && normalized.length === 0 && !allowEmpty) {
    throw new Error(`${field} is required.`);
  }

  if (!allowEmpty && normalized.length === 0) {
    throw new Error(`${field} cannot be empty.`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`${field} exceeds maximum length of ${maxLength}.`);
  }

  return normalized;
};

const ensureNumber = (value, field, options = {}) => {
  const {
    required = true,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    allowNaN = false,
    defaultValue = 0
  } = options;

  const raw = value ?? defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    if (allowNaN) return Number.NaN;
    if (required) throw new Error(`${field} must be a valid number.`);
    return Number(defaultValue);
  }

  if (parsed < min) {
    throw new Error(`${field} must be at least ${min}.`);
  }

  if (parsed > max) {
    throw new Error(`${field} must be at most ${max}.`);
  }

  return parsed;
};

const ensureEnum = (value, field, allowed, options = {}) => {
  const fallback = options.fallback ?? allowed?.[0];
  const normalized = normalizeString(value || fallback).toLowerCase();
  const canonical = allowed.find((item) => item.toLowerCase() === normalized);
  if (!canonical) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return canonical;
};

const ensureIsoDate = (value, field, options = {}) => {
  const { required = true, allowEmpty = false } = options;
  const normalized = normalizeString(value);
  if (!normalized) {
    if (!required || allowEmpty) return '';
    throw new Error(`${field} is required.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${field} must use YYYY-MM-DD format.`);
  }

  const asDate = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error(`${field} is not a valid date.`);
  }

  return normalized;
};

const toBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return 1;
  return 0;
};

export {
  ensureEnum,
  ensureIsoDate,
  ensureNumber,
  ensureString,
  toBooleanFlag
};
