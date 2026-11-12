/** The logged-in user's wall notifications. */
const Notification = require('../models/Notification');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { requireId } = require('../utils/validate');

// GET /api/notifications  -> { items, unread }
exports.list = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).select('-user -actor').lean(),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ items, unread });
});

// GET /api/notifications/unread  -> { unread }  (cheap poll)
exports.unread = asyncHandler(async (req, res) => {
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
});

// PATCH /api/notifications/read-all
exports.readAll = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ unread: 0 });
});

// PATCH /api/notifications/:id/read
exports.readOne = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: requireId(req.params.id, 'Notification'), user: req.user._id }, { read: true });
  if (!n) throw new HttpError(404, 'Notification not found.');
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
});
