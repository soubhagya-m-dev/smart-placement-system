import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;

/**
 * Normalize a possibly-populated Mongoose ref into its raw id string.
 *
 * WHY THIS EXISTS:
 *   Mongoose's `.populate('job', 'title companyName')` transparently
 *   replaces a raw id with an object like `{ _id: '...', title: '...' }`.
 *   The field name stays the same but the SHAPE changes. Any frontend
 *   code that compares a populated field with `===` against a raw id
 *   silently fails — the filter just returns an empty list, the UI shows
 *   an empty state, and there is no error to debug.
 *
 *   Every populated ref must be normalized with this helper before
 *   comparison. This is the only safe way to compare against a ref that
 *   may or may not be populated (we cannot know at the call site).
 *
 * USAGE:
 *   notifications.filter(n => refId(n.job) === jobId)
 *   notifications.filter(n => refId(n.application) === app._id)
 *
 *   For deeper paths: refId(n.metadata?.something) also works — if the
 *   target is a populated ref, this returns its _id; if it's a string,
 *   it returns the string; if it's null/undefined, it returns null.
 *
 * @param {string|object|null|undefined} ref
 * @returns {string|null}
 */
export const refId = (ref) => {
  if (ref == null) return null;
  if (typeof ref === 'object') return ref._id ? String(ref._id) : null;
  return String(ref);
};

/**
 * Compare two possibly-populated refs for equality on their _id.
 * Convenience wrapper — use this in .filter/.find/.some callbacks.
 *
 * @param {string|object|null|undefined} a
 * @param {string|object|null|undefined} b
 * @returns {boolean}
 */
export const refsEqual = (a, b) => refId(a) === refId(b);
