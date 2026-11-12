/**
 * A registered pet. Each pet gets a PVO registration number (MQ-2026-00001) and
 * carries its own vaccination record and medical history.
 *
 * Privacy: the controllers decide what is public. Visitors see the profile, the
 * owner's first name and municipality, and the rabies status; never the health
 * records or the owner's contact details.
 */
const mongoose = require('mongoose');
const Counter = require('./Counter');
const { SPECIES, SEXES, PET_STATUSES, MEDICAL_TYPES, MUNICIPALITIES, IMAGE_PATH } = require('../config/constants');

const notFuture = { validator: (d) => !d || d <= new Date(), message: 'Date cannot be in the future.' };

const vaccinationSchema = new mongoose.Schema(
  {
    vaccine: { type: String, required: [true, 'Vaccine name is required.'], trim: true, maxlength: 60 },
    dateGiven: { type: Date, required: [true, 'Date given is required.'], validate: notFuture },
    nextDue: {
      type: Date,
      validate: {
        validator(d) { return !d || !this.dateGiven || d > this.dateGiven; },
        message: 'The next due date must be after the date given.',
      },
    },
    administeredBy: { type: String, trim: true, maxlength: 80 },
    // Owner entries start unverified; PVO staff approve (verified) or reject them.
    // The entry itself is never changed by staff.
    verified: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    reviewedAt: Date,
  },
  { timestamps: true }
);

const medicalSchema = new mongoose.Schema(
  {
    date: { type: Date, required: [true, 'Date is required.'], validate: notFuture },
    type: { type: String, enum: MEDICAL_TYPES, default: 'checkup' },
    title: { type: String, required: [true, 'Title is required.'], trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 1000 },
    vet: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

const petSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Pet name is required.'], trim: true, maxlength: [40, 'Name is too long.'] },
    species: { type: String, enum: SPECIES, required: [true, 'Species is required.'] },
    breed: { type: String, trim: true, maxlength: 60, default: '' },
    sex: { type: String, enum: SEXES, required: [true, 'Sex is required.'] },
    birthDate: { type: Date, validate: notFuture },
    color: { type: String, trim: true, maxlength: 40 },
    neutered: { type: Boolean, default: false },
    photos: {
      type: [{ type: String, match: [IMAGE_PATH, 'Upload the photo again.'] }],
      validate: [(v) => v.length <= 6, 'A pet can have up to 6 photos.'],
    },
    bio: { type: String, trim: true, maxlength: [500, 'Keep the bio under 500 characters.'] },
    municipality: { type: String, enum: MUNICIPALITIES, required: [true, 'Municipality is required.'] },

    registrationNo: { type: String, unique: true, sparse: true },
    // PVO review of the owner's submission: pending -> verified (approved) or rejected.
    // Staff never edit the submitted details; a rejected pet goes back to pending when the owner edits it.
    registrationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    verifiedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 300 },
    reviewedAt: Date,

    isPublic: { type: Boolean, default: true }, // shown on the community wall
    status: { type: String, enum: PET_STATUSES, default: 'active' },

    vaccinations: [vaccinationSchema],
    medicalHistory: [medicalSchema],
  },
  { timestamps: true }
);

petSchema.index({ isPublic: 1, status: 1, createdAt: -1 });

/** Assign the next registration number on first save (after validation, so failed saves use no number). */
petSchema.pre('save', async function assignNumber(next) {
  if (!this.registrationNo) {
    const n = await Counter.next('pet');
    this.registrationNo = `MQ-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
  }
  next();
});

/**
 * Anti-rabies status from the vaccination record.
 * Due date = nextDue if given, otherwise one year after the shot.
 * Returns { status: 'none' | 'current' | 'overdue', due }
 */
const rabiesDue = (v) => (v.nextDue ? new Date(v.nextDue) : new Date(new Date(v.dateGiven).setFullYear(new Date(v.dateGiven).getFullYear() + 1)));

function rabiesStatus(pet) {
  const shots = (pet.vaccinations || []).filter((v) => /rabies/i.test(v.vaccine) && !v.rejected);
  if (!shots.length) return { status: 'none' };
  const due = shots
    .map((v) => (v.nextDue ? new Date(v.nextDue) : new Date(new Date(v.dateGiven).setFullYear(new Date(v.dateGiven).getFullYear() + 1))))
    .sort((a, b) => b - a)[0];
  return { status: due >= new Date() ? 'current' : 'overdue', due };
}

petSchema.statics.rabiesStatus = rabiesStatus;

/**
 * Anti-rabies vaccination status for PVO review and the owner:
 *  - vaccinated:     a PVO-verified shot that is still valid
 *  - pending:        a valid shot entered by the owner, waiting for PVO verification
 *  - not-vaccinated: no valid shot (expired: date the last verified shot ran out, if any)
 * Rejected entries never count.
 */
function vaccinationStatus(pet) {
  const now = new Date();
  const shots = (pet.vaccinations || []).filter((v) => /rabies/i.test(v.vaccine) && !v.rejected);
  const latest = (list) => list.map(rabiesDue).sort((a, b) => b - a)[0];
  const verified = latest(shots.filter((v) => v.verified));
  if (verified && verified >= now) return { status: 'vaccinated', due: verified };
  const pending = latest(shots.filter((v) => !v.verified && rabiesDue(v) >= now));
  if (pending) return { status: 'pending', due: pending };
  return { status: 'not-vaccinated', expired: verified || undefined };
}
petSchema.statics.vaccinationStatus = vaccinationStatus;

module.exports = mongoose.model('Pet', petSchema);
