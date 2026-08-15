function createDomainError(code, detail) {
  return new Error(detail ? `${code}: ${detail}` : code);
}

function normalizeStrictBoolean(value, fieldName) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    var normalized = value.trim().toUpperCase();

    if (normalized === 'TRUE' || normalized === 'SI') {
      return true;
    }

    if (normalized === 'FALSE' || normalized === 'NO') {
      return false;
    }
  }

  throw createDomainError('INVALID_BOOLEAN', fieldName);
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createDomainError('REQUIRED_FIELD', fieldName);
  }

  return value.trim();
}

function optionalText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function assertOneOf(value, allowed, fieldName) {
  if (allowed.indexOf(value) === -1) {
    throw createDomainError('INVALID_ENUM', fieldName);
  }

  return value;
}

function parseDateValue(value, fieldName) {
  var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createDomainError('INVALID_DATE', fieldName);
  }

  return date;
}

function parseOptionalDateValue(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseDateValue(value, fieldName);
}

function padTimePart(value) {
  return String(value).padStart(2, '0');
}

function normalizeTimeValue(value, fieldName, required) {
  var match;
  var hours;
  var minutes;

  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      throw createDomainError('REQUIRED_FIELD', fieldName);
    }

    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw createDomainError('INVALID_TIME', fieldName);
    }

    return padTimePart(value.getHours()) + ':' + padTimePart(value.getMinutes());
  }

  if (typeof value !== 'string') {
    throw createDomainError('INVALID_TIME', fieldName);
  }

  match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    throw createDomainError('INVALID_TIME', fieldName);
  }

  hours = Number(match[1]);
  minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || (match[3] !== undefined && match[3] !== '00')) {
    throw createDomainError('INVALID_TIME', fieldName);
  }

  return padTimePart(hours) + ':' + padTimePart(minutes);
}

function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeEmail(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value).trim().toLowerCase();
}

function assertUnique(records, selector, code) {
  var seen = {};

  records.forEach(function(record) {
    var key = selector(record);

    if (seen[key]) {
      throw createDomainError(code, key);
    }

    seen[key] = true;
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    assertOneOf,
    assertUnique,
    createDomainError,
    isValidEmail,
    normalizeEmail,
    normalizeStrictBoolean,
    normalizeTimeValue,
    optionalText,
    parseDateValue,
    parseOptionalDateValue,
    requireText
  };
}
