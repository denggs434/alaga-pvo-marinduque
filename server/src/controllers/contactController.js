/**
 * Contact form: anyone can send a message; admins read and triage them.
 */
const ContactMessage = require('../models/ContactMessage');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/contact
exports.createMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, topic, product, preferredDate, message } = req.body;
  const doc = await ContactMessage.create({
    name, email, phone, topic, message,
    product: product || undefined,
    preferredDate: preferredDate || undefined,
  });
  res.status(201).json({ message: 'Message received.', id: doc._id });
});

// GET /api/contact  (admin)
exports.listMessages = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const messages = await ContactMessage.find(filter)
    .sort({ createdAt: -1 })
    .populate('product', 'name stockNumber slug')
    .lean();
  res.json(messages);
});

// PATCH /api/contact/:id  (admin)
exports.updateMessageStatus = asyncHandler(async (req, res) => {
  const doc = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  );
  if (!doc) throw new HttpError(404, 'Message not found.');
  res.json(doc);
});

// DELETE /api/contact/:id  (admin)
exports.deleteMessage = asyncHandler(async (req, res) => {
  const doc = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!doc) throw new HttpError(404, 'Message not found.');
  res.json({ message: 'Message deleted.' });
});
