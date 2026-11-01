/** Messages sent from the Contact page (test drives, financing, trade-ins, questions). */
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address.'],
    },
    phone: { type: String, trim: true, maxlength: 20 },
    topic: {
      type: String,
      enum: ['test-drive', 'financing', 'trade-in', 'general'],
      default: 'general',
    },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    preferredDate: Date,
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
