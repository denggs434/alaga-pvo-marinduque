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

  // Marketplace: owners open shops and sell pet supplies; paid in cash on pickup or delivery.
  PRODUCT_CATEGORIES: ['food', 'treats', 'toys', 'accessories', 'grooming', 'health', 'beds'],
  SELLER_STATUSES: ['pending', 'approved', 'rejected', 'suspended'],
  ORDER_STATUSES: ['placed', 'confirmed', 'ready', 'completed', 'cancelled'],
  OPEN_ORDER_STATUSES: ['placed', 'confirmed', 'ready'],
  FULFILLMENT: ['pickup', 'delivery'],
  DELIVERY_FEE: 60, // pesos, anywhere in the province
  FREE_DELIVERY_FROM: 1000, // orders this size or more ship free

  /**
   * Image paths the API accepts: files we ship, or files saved by POST /api/uploads
   * (local disk, or the Vercel Blob store when deployed on Vercel).
   */
  IMAGE_PATH: /^(assets\/img\/(uploads|pets|shop)\/[\w.-]+|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/uploads\/[\w.-]+)\.(jpe?g|png|webp)$/,
  PHONE: /^[0-9+()\s-]{7,20}$/,
  EMAIL: /^\S+@\S+\.\S+$/,
};
