/**
 * Contact form: anyone can send a message; PVO staff read and triage them.
 */
const ContactMessage = require('../models/ContactMessage');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { oneOf, requireId } = require('../utils/validate');

const STATUSES = ['new', 'replied', 'closed'];

// POST /api/contact
exports.createMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, topic, message } = req.body;
  const doc = await ContactMessage.create({ name, email, phone: phone || undefined, topic, message });
  res.status(201).json({ message: 'Message received.', id: doc._id });
});

// GET /api/contact?status=  (admin)
exports.listMessages = asyncHandler(async (req, res) => {
  const status = oneOf(req.query.status, STATUSES);
  const messages = await ContactMessage.find(status ? { status } : {}).sort({ createdAt: -1 }).lean();
  res.json(messages);
});

// PATCH /api/contact/:id  { status }  (admin)
exports.updateMessageStatus = asyncHandler(async (req, res) => {
  const status = oneOf(req.body.status, STATUSES);
  if (!status) throw new HttpError(400, 'Choose a valid status: new, replied or closed.');
  const doc = await ContactMessage.findByIdAndUpdate(
    requireId(req.params.id, 'Message'),
    { status },
    { new: true, runValidators: true }
  );
  if (!doc) throw new HttpError(404, 'Message not found.');
  res.json(doc);
});

// DELETE /api/contact/:id  (admin)
exports.deleteMessage = asyncHandler(async (req, res) => {
  const doc = await ContactMessage.findByIdAndDelete(requireId(req.params.id, 'Message'));
  if (!doc) throw new HttpError(404, 'Message not found.');
  res.json({ message: 'Message deleted.' });
});
