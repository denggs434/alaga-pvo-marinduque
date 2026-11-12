/**
 * Small in-memory rate limiter (no extra dependency).
 * Counts requests per client IP (plus user id when logged in) in a fixed window.
 * Good enough for a single server process; a multi-server deployment would
 * keep the counters in a shared store such as Redis.
 */
const HttpError = require('../utils/httpError');

module.exports = function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // key -> { count, reset }

  // Forget expired windows so memory does not grow.
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.reset <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = `${req.ip}|${req.user?._id || ''}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return next(new HttpError(429, message || 'Too many attempts. Please wait a few minutes and try again.'));
    }
    next();
  };
};
