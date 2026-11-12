/**
 * Incident reports: animal bites, missing pets, strays, welfare concerns.
 * Only the reporter and PVO staff can read a report. A missing-pet report can be
 * shared as a public alert (photo, area, description only) if the reporter opts in.
 * `history` is the timeline the reporter sees when tracking the report.
 */
const mongoose = require('mongoose');
const Counter = require('./Counter');
const { REPORT_TYPES, REPORT_STATUSES, SPECIES, MUNICIPALITIES, IMAGE_PATH, PHONE, EMAIL } = require('../config/constants');

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: REPORT_STATUSES },
    note: { type: String, trim: true, maxlength: 500 },
    by: { type: String, enum: ['reporter', 'pvo'] },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: REPORT_TYPES, required: [true, 'Choose what you are reporting.'] },
    animalSpecies: { type: String, enum: [...SPECIES, 'unknown'], default: 'dog' },
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }, // the reporter's own pet (missing reports)
    description: {
      type: String,
      required: [true, 'Describe what happened.'],
      trim: true,
      minlength: [20, 'Add a little more detail (at least 20 characters).'],
      maxlength: [3000, 'Keep the description under 3000 characters.'],
    },
    incidentDate: {
      type: Date,
      required: [true, 'Enter when it happened.'],
      validate: { validator: (d) => d <= new Date(), message: 'The date cannot be in the future.' },
    },
    location: {
      municipality: { type: String, enum: MUNICIPALITIES, required: [true, 'Choose the municipality.'] },
      barangay: { type: String, required: [true, 'Enter the barangay.'], trim: true, maxlength: 60 },
      details: { type: String, trim: true, maxlength: 200 }, // street, landmark
    },
    photos: {
      type: [{ type: String, match: [IMAGE_PATH, 'Upload the photo again.'] }],
      validate: [(v) => v.length <= 4, 'Attach up to 4 photos.'],
    },
    contact: {
      name: { type: String, required: [true, 'Enter a contact name.'], trim: true, maxlength: 80 },
      phone: { type: String, required: [true, 'Enter a phone number we can call.'], trim: true, match: [PHONE, 'Enter a valid phone number.'] },
      email: { type: String, trim: true, lowercase: true, match: [EMAIL, 'Enter a valid email address.'] },
    },
    priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
    status: { type: String, enum: REPORT_STATUSES, default: 'submitted' },
    history: [historySchema],
    publicAlert: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

reportSchema.pre('validate', function prepare(next) {
  if (this.isNew) {
    // Bites can mean rabies exposure: always high priority.
    if (this.type === 'bite') this.priority = 'high';
    if (this.type !== 'missing') this.publicAlert = false;
    if (!this.history.length) this.history.push({ status: 'submitted', note: 'Report received.', by: 'reporter' });
  }
  next();
});

/** Reference number on first save (after validation, so rejected reports use no number). */
reportSchema.pre('save', async function assignReference(next) {
  if (!this.reference) {
    const n = await Counter.next('report');
    this.reference = `RPT-${String(new Date().getFullYear()).slice(2)}${String(n).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Report', reportSchema);
