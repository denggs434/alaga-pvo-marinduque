/**
 * Helpers for reading untrusted input.
 * Express turns ?a[$ne]=x into an object, so every query value is forced to a
 * plain string before it reaches a MongoDB filter.
 */
const mongoose = require('mongoose');
const HttpError = require('./httpError');

/** A query/body value as a trimmed string, or '' for anything else. */
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** The value if it is one of the allowed strings, otherwise undefined. */
const oneOf = (v, list) => (list.includes(str(v)) ? str(v) : undefined);

/** Escape user text before using it in a RegExp. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Clamp page/limit query values. */
function paging(q, { limit: def = 12, max = 50 } = {}) {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || def, 1), max);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
}

/** Throw 404 for anything that is not a valid ObjectId (instead of a CastError). */
function requireId(id, what = 'Record') {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, `${what} not found.`);
  return id;
}

/** Copy only the listed keys that are present in the body. */
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

/** "Maria Santos" -> "Maria S." (how owners appear to the public) */
function publicName(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

module.exports = { str, oneOf, escapeRegex, paging, requireId, pick, publicName };
