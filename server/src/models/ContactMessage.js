/** Messages sent from the Contact page. Anyone can send one; PVO staff triage them. */
const mongoose = require('mongoose');
const { CONTACT_TOPICS, EMAIL, PHONE } = require('../config/constants');

const contactSchema = new mongoose.Schema(
  {
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
    status: { type: String, enum: ['new', 'replied', 'closed'], default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactMessage', contactSchema);
