/**
 * A message sent from the Contact page, and the PVO's replies to it.
 *  - Anyone can send one. When the sender is logged in, the message is linked
 *    to their account so they can read the replies on the Messages page.
 *  - Staff answer with a written reply (status becomes "replied" only then).
 *  - A logged-in sender can write follow-ups in the same conversation (Messages
 *    page); that puts it back to "new" so staff see it needs an answer.
 *  - Messages are never deleted: staff archive them and can restore them.
 */
const mongoose = require('mongoose');
const { CONTACT_TOPICS, EMAIL, PHONE } = require('../config/constants');

const replySchema = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  byName: { type: String, trim: true, maxlength: 80 }, // kept even if the staff account is removed later
  fromSender: { type: Boolean, default: false }, // a follow-up from the person who wrote in (not staff)
  text: { type: String, required: [true, 'Write a reply first.'], trim: true, minlength: [2, 'Write a reply first.'], maxlength: [2000, 'Replies are limited to 2000 characters.'] },
  createdAt: { type: Date, default: Date.now },
});

const contactSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      lowercase: true,
      trim: true,
      match: [EMAIL, 'Enter a valid email address.'],
    },
    phone: { type: String, trim: true, match: [PHONE, 'Enter a valid phone number.'] },
    topic: { type: String, enum: CONTACT_TOPICS, default: 'general' },
    message: {
      type: String,
      required: [true, 'Message is required.'],
      trim: true,
      minlength: [10, 'Message must be at least 10 characters.'],
      maxlength: 2000,
    },
    status: { type: String, enum: ['new', 'replied'], default: 'new' },
    replies: { type: [replySchema], validate: [(v) => v.length <= 50, 'This conversation is too long.'] },
    // The sender has a reply they have not opened yet.
    unreadByUser: { type: Boolean, default: false },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactMessage', contactSchema);
