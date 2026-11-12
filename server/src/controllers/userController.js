/**
 * Accounts: register, log in, view/update own profile.
 * Admins: list owners, ban/unban, delete.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pet = require('../models/Pet');
const Post = require('../models/Post');
const Report = require('../models/Report');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { requireId } = require('../utils/validate');
const { OPEN_REPORT_STATUSES } = require('../config/constants');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const PROFILE_FIELDS = ['name', 'phone', 'municipality', 'barangay'];

// POST /api/users/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, municipality, barangay, password } = req.body;
  if (typeof password !== 'string') throw new HttpError(400, 'Choose a password.', { password: 'Choose a password.' });
  // role is never read from the body: new accounts are always pet owners.
  const user = await User.create({ name, email, phone: phone || undefined, municipality, barangay, password });
  res.status(201).json({ user, token: signToken(user) });
});

// POST /api/users/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Only plain strings (blocks {"$gt": ""} style injection and bcrypt crashes).
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Enter your email and password.');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  if (user.banned) throw new HttpError(403, 'This account is suspended. Contact the PVO for help.');
  res.json({ user, token: signToken(user) });
});

// GET /api/users/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// PUT /api/users/me   { name, phone, municipality, barangay, currentPassword?, newPassword? }
// Changing the password needs the current one and signs out every other session.
exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  PROFILE_FIELDS.forEach((k) => {
    if (req.body[k] !== undefined) user[k] = req.body[k] === '' && k === 'phone' ? undefined : req.body[k];
  });

  const { currentPassword, newPassword } = req.body;
  if (newPassword) {
    if (typeof currentPassword !== 'string' || !(await user.matchPassword(currentPassword))) {
      throw new HttpError(400, 'Your current password is incorrect.', { currentPassword: 'Your current password is incorrect.' });
    }
    user.password = newPassword;
  }
  await user.save();
  // A fresh token, because a password change invalidates the old ones.
  res.json({ user, token: newPassword ? signToken(user) : undefined });
});

// GET /api/users  (admin) — owners with their pet and report counts
exports.listUsers = asyncHandler(async (req, res) => {
  const [users, pets, reports] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    Pet.aggregate([{ $group: { _id: '$owner', n: { $sum: 1 } } }]),
    Report.aggregate([{ $group: { _id: '$reporter', n: { $sum: 1 } } }]),
  ]);
  const count = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const petCount = count(pets);
  const reportCount = count(reports);
  res.json(
    users.map(({ password, __v, passwordChangedAt, ...u }) => ({
      ...u,
      petCount: petCount.get(String(u._id)) || 0,
      reportCount: reportCount.get(String(u._id)) || 0,
    }))
  );
});

/** Load an owner account an admin is allowed to act on. */
async function findOwner(id) {
  const user = await User.findById(requireId(id, 'Account'));
  if (!user) throw new HttpError(404, 'Account not found.');
  if (user.role === 'admin') throw new HttpError(403, 'Staff accounts cannot be banned or deleted here.');
  return user;
}

// PATCH /api/users/:id/ban  { banned: true|false }  (admin)
exports.setBanned = asyncHandler(async (req, res) => {
  const user = await findOwner(req.params.id);
  user.banned = req.body.banned === true;
  user.bannedAt = user.banned ? new Date() : undefined;
  await user.save();
  res.json(user);
});

// DELETE /api/users/:id  (admin)
// Removes the account, its pets and its posts. Refused while the owner has open
// reports so no case loses its contact. Closed reports stay for PVO records.
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await findOwner(req.params.id);
  const open = await Report.countDocuments({ reporter: user._id, status: { $in: OPEN_REPORT_STATUSES } });
  if (open) {
    throw new HttpError(409, `${user.name} has ${open} open ${open === 1 ? 'report' : 'reports'}. Resolve or close ${open === 1 ? 'it' : 'them'} first.`);
  }
  const petIds = await Pet.distinct('_id', { owner: user._id });
  await Promise.all([
    Post.deleteMany({ $or: [{ author: user._id }, { pet: { $in: petIds } }] }),
    Post.updateMany({}, { $pull: { likes: user._id, comments: { user: user._id } } }),
    Pet.deleteMany({ owner: user._id }),
  ]);
  await user.deleteOne();
  res.json({ message: `Deleted ${user.name} and ${petIds.length} ${petIds.length === 1 ? 'pet' : 'pets'}.` });
});
