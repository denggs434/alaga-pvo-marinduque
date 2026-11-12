/**
 * Contact messages.
 *  - Anyone can send one; a logged-in sender's message is linked to their account.
 *  - Staff read them, reply in writing, archive and restore. There is no delete.
 *  - Senders read their messages and the PVO's replies under Account → Messages.
 */
const ContactMessage = require('../models/ContactMessage');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { str, requireId } = require('../utils/validate');

/** What the sender sees: their message and the replies, never staff account ids. */
const forSender = (m) => ({
  _id: m._id,
  topic: m.topic,
  message: m.message,
  status: m.status,
  createdAt: m.createdAt,
  unread: m.unreadByUser,
  replies: (m.replies || []).map((r) => ({ _id: r._id, text: r.text, by: r.byName || 'PVO staff', createdAt: r.createdAt })),
});

async function findMessage(id) {
  const doc = await ContactMessage.findById(requireId(id, 'Message'));
  if (!doc) throw new HttpError(404, 'Message not found.');
  return doc;
}

// POST /api/contact  (anyone; linked to the account when logged in)
exports.createMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, topic, message } = req.body;
  const doc = await ContactMessage.create({ user: req.user?._id, name, email, phone: phone || undefined, topic, message });
  res.status(201).json({ message: 'Message received.', id: doc._id, linked: !!req.user });
});

// GET /api/contact/mine  (logged in: own messages and replies)
exports.myMessages = asyncHandler(async (req, res) => {
  const list = await ContactMessage.find({ user: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json(list.map(forSender));
});

// GET /api/contact/mine/unread  -> { count }  (for the account menu dot)
exports.myUnreadCount = asyncHandler(async (req, res) => {
  res.json({ count: await ContactMessage.countDocuments({ user: req.user._id, unreadByUser: true }) });
});

// PATCH /api/contact/mine/read  (the sender opened their messages)
exports.markMineRead = asyncHandler(async (req, res) => {
  await ContactMessage.updateMany({ user: req.user._id, unreadByUser: true }, { unreadByUser: false });
  res.json({ message: 'Marked as read.' });
});

// GET /api/contact?box=inbox|archived|all  (admin)
exports.listMessages = asyncHandler(async (req, res) => {
  const box = str(req.query.box) || 'inbox';
  const filter = box === 'archived' ? { archived: true } : box === 'all' ? {} : { archived: { $ne: true } };
  const messages = await ContactMessage.find(filter).sort({ createdAt: -1 }).populate('user', 'name email').lean();
  res.json(messages.map((m) => ({ ...m, hasAccount: !!m.user })));
});

// POST /api/contact/:id/replies  { text }  (admin) — the only way a message becomes "replied"
exports.replyToMessage = asyncHandler(async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (text.length < 2) throw new HttpError(400, 'Write a reply first.', { text: 'Write a reply first.' });
  const doc = await findMessage(req.params.id);
  doc.replies.push({ by: req.user._id, byName: req.user.name, text });
  doc.status = 'replied';
  doc.unreadByUser = !!doc.user;
  await doc.save();
  await doc.populate('user', 'name email');
  res.status(201).json({ ...doc.toObject(), hasAccount: !!doc.user });
});

// PATCH /api/contact/:id  { archived: true|false }  (admin) — archive or restore, never delete
exports.setArchived = asyncHandler(async (req, res) => {
  if (typeof req.body.archived !== 'boolean') throw new HttpError(400, 'Say whether to archive or restore the message.');
  const archived = req.body.archived;
  const doc = await ContactMessage.findByIdAndUpdate(
    requireId(req.params.id, 'Message'),
    archived ? { archived: true, archivedAt: new Date() } : { archived: false, $unset: { archivedAt: 1 } },
    { new: true }
  ).populate('user', 'name email');
  if (!doc) throw new HttpError(404, 'Message not found.');
  res.json({ ...doc.toObject(), hasAccount: !!doc.user });
});
