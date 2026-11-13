/**
 * Accounts.
 *  - owner: registers pets, posts on the wall, files reports
 *  - admin: PVO staff; manages pets, announcements, reports and accounts
 * Public visitors have no account. Passwords are hashed with bcrypt and never returned.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MUNICIPALITIES, PHONE, EMAIL } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: [80, 'Name is too long.'] },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL, 'Enter a valid email address.'],
    },
    phone: { type: String, trim: true, match: [PHONE, 'Enter a valid phone number.'] },
    municipality: { type: String, enum: [...MUNICIPALITIES, ''], default: '' },
    barangay: { type: String, trim: true, maxlength: 60 },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      maxlength: [72, 'Password must be 72 characters or fewer.'], // bcrypt only reads 72 bytes
      select: false,
    },
    role: { type: String, enum: ['owner', 'admin'], default: 'owner' },
    // Marketplace: an owner who sells sets a shop name (and opens their shop by listing a product).
    shop: {
      name: { type: String, trim: true, maxlength: [60, 'Shop name is too long.'] },
      about: { type: String, trim: true, maxlength: [300, 'Keep the shop description under 300 characters.'] },
    },
    // Set by an admin. Banned accounts cannot log in or use an existing session.
    banned: { type: Boolean, default: false },
    bannedAt: Date,
    // Tokens issued before this moment stop working (set when the password changes).
    passwordChangedAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  // 1s back-dated so the token issued right after a change is still valid.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.passwordChangedAt;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
