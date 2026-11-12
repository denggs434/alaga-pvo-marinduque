/**
 * Authentication middleware.
 *  - protect:      requires a valid "Authorization: Bearer <token>" header
 *  - adminOnly:    requires role "admin" (PVO staff)
 *  - ownerOnly:    requires role "owner" (pet owners: pets, posts, reports)
 *  - optionalAuth: attaches req.user when a valid token is sent, never rejects
 *
 * The user is reloaded from the database on every request, so a ban, a role
 * change or a password change takes effect immediately.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

/** Returns the user for a token, or a reason it cannot be used. */
async function userFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { reason: 'Your session has expired. Please log in again.' };
  }
  const user = await User.findById(payload.id);
  if (!user) return { reason: 'This account no longer exists.' };
  if (user.banned) return { reason: 'This account is suspended. Contact the PVO for help.' };
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
    return { reason: 'Your password was changed. Please log in again.' };
  }
  return { user };
}

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const protect = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Please log in to continue.');
  const { user, reason } = await userFromToken(token);
  if (!user) throw new HttpError(401, reason);
  req.user = user;
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = bearer(req);
  if (token) req.user = (await userFromToken(token)).user; // invalid token: continue as a visitor
  next();
});

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'PVO staff access only.'));
  next();
}

function ownerOnly(req, res, next) {
  if (req.user?.role !== 'owner') return next(new HttpError(403, 'Only pet owner accounts can do this. Staff accounts manage records from the admin panel.'));
  next();
}

module.exports = { protect, adminOnly, ownerOnly, optionalAuth };
