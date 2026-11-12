/**
 * PVO announcements. When `event.startsAt` is set the announcement is also a
 * scheduled activity (vaccination drive, deworming day…) and appears under
 * "Upcoming schedules" until it ends.
 */
const mongoose = require('mongoose');
const { ANNOUNCEMENT_CATEGORIES, MUNICIPALITIES, IMAGE_PATH } = require('../config/constants');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required.'], trim: true, maxlength: [140, 'Title is too long.'] },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, required: [true, 'Category is required.'] },
    body: { type: String, required: [true, 'Write the announcement text.'], trim: true, maxlength: [5000, 'Text is too long.'] },
    image: { type: String, match: [IMAGE_PATH, 'Upload the photo again.'] },
    event: {
      startsAt: Date,
      endsAt: Date,
      venue: { type: String, trim: true, maxlength: 120 },
      municipality: { type: String, enum: [...MUNICIPALITIES, ''], default: '' },
    },
    pinned: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

announcementSchema.index({ published: 1, 'event.startsAt': 1 });

announcementSchema.pre('validate', function checkEvent(next) {
  const e = this.event || {};
  if (e.endsAt && !e.startsAt) this.invalidate('event.startsAt', 'Add a start date and time.');
  if (e.startsAt && e.endsAt && e.endsAt < e.startsAt) this.invalidate('event.endsAt', 'The end must be after the start.');
  if (e.startsAt && !e.venue) this.invalidate('event.venue', 'Add the venue for this schedule.');
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);
