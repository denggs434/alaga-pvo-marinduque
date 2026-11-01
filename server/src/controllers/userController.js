/**
 * Users: register, log in, view/update own profile; admins can list users.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/users/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  // role is deliberately not read from the body: new accounts are always customers.
  const user = await User.create({ name, email, phone, password });
  res.status(201).json({ user, token: signToken(user) });
});

// POST /api/users/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Only accept plain strings (blocks {"$gt": ""} style injection and bcrypt crashes).
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Enter your email and password.');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  if (user.banned) throw new HttpError(403, 'This account is suspended. Contact the showroom for help.');
  res.json({ user, token: signToken(user) });
});

// GET /api/users/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// PUT /api/users/me
exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const { name, phone, password } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (password) user.password = password;
  await user.save();
  res.json(user);
});

// GET /api/users  (admin)
exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  res.json(users.map(({ password, __v, ...u }) => u));
});

/** Load a customer account an admin is allowed to act on. */
async function findCustomer(id) {
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, 'Customer not found.');
  if (user.role === 'admin') throw new HttpError(403, 'Admin accounts cannot be banned or deleted here.');
  return user;
}

// PATCH /api/users/:id/ban  { banned: true|false }  (admin)
exports.setBanned = asyncHandler(async (req, res) => {
  const user = await findCustomer(req.params.id);
  user.banned = req.body.banned === true;
  user.bannedAt = user.banned ? new Date() : undefined;
  await user.save();
  res.json(user);
});

// DELETE /api/users/:id  (admin)
// Refused while the customer has open orders, so no reservation is left orphaned.
// Completed and cancelled orders stay for the sales history.
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await findCustomer(req.params.id);
  const open = await Order.countDocuments({ user: user._id, status: { $in: ['pending', 'confirmed', 'ready'] } });
  if (open) {
    throw new HttpError(409, `${user.name} has ${open} open ${open === 1 ? 'order' : 'orders'}. Complete or cancel ${open === 1 ? 'it' : 'them'} first.`);
  }
  await user.deleteOne();
  res.json({ message: `Deleted ${user.name}.` });
});
