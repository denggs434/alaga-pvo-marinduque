/**
 * Authentication middleware.
 *  - protect:   requires a valid "Authorization: Bearer <token>" header
 *  - adminOnly: requires the logged-in user to have role "admin"
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in to continue.');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, 'This account no longer exists.');
  req.user = user;
  next();
});

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Admin access only.'));
  next();
}

module.exports = { protect, adminOnly };

/**
 * Like protect, but never rejects: attaches req.user when a valid token
 * is present so public routes can show admins extra data.
 */
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = await User.findById(payload.id);
  } catch {
    /* invalid token: continue as a guest */
  }
  next();
};

module.exports.optionalAuth = optionalAuth;
