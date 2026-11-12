/**
 * Lists shared by the models, the controllers and the seed script.
 * To reuse the platform for another province, change PROVINCE and MUNICIPALITIES.
 */
module.exports = {
  PROVINCE: 'Marinduque',
  MUNICIPALITIES: ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'],

  SPECIES: ['dog', 'cat', 'rabbit', 'bird', 'other'],
  SEXES: ['male', 'female'],
  PET_STATUSES: ['active', 'missing', 'deceased'],
  MEDICAL_TYPES: ['checkup', 'illness', 'injury', 'surgery', 'deworming', 'other'],

  REPORT_TYPES: ['bite', 'missing', 'stray', 'welfare'],
  REPORT_STATUSES: ['submitted', 'under-review', 'in-progress', 'resolved', 'closed'],
  OPEN_REPORT_STATUSES: ['submitted', 'under-review', 'in-progress'],

  ANNOUNCEMENT_CATEGORIES: ['vaccination', 'free-program', 'anti-rabies', 'deworming', 'services', 'advisory'],

  CONTACT_TOPICS: ['general', 'registration', 'vaccination', 'report', 'other'],

  /** Image paths the API accepts: files we ship or files saved by POST /api/uploads. */
  IMAGE_PATH: /^assets\/img\/(uploads|pets)\/[\w.-]+\.(jpe?g|png|webp)$/,
  PHONE: /^[0-9+()\s-]{7,20}$/,
  EMAIL: /^\S+@\S+\.\S+$/,
};
