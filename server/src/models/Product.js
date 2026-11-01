/**
 * Product = anything sold in the shop.
 *  - category "vehicle":   a single physical car with a stock number (stock is always 1)
 *  - category "accessory": chargers, wheels, etc. with a stock count
 */
const mongoose = require('mongoose');

const MODELS = ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck', 'Roadster'];

const creditSchema = new mongoose.Schema(
  { author: String, license: String, source: String },
  { _id: false }
);

const specsSchema = new mongoose.Schema(
  {
    rangeKm: Number,        // rated range in km (WLTP / EPA converted)
    zeroTo100: Number,      // seconds, 0–100 km/h
    topSpeedKph: Number,
    batteryKwh: Number,     // usable capacity, approximate
    drive: { type: String, enum: ['RWD', 'AWD', ''] },
    seats: Number,
    odometerKm: { type: Number, default: 0 },
    batteryHealth: { type: Number, min: 0, max: 100 }, // % of original capacity
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: ['vehicle', 'accessory'], required: [true, 'Category is required.'] },
    model: { type: String, enum: [...MODELS, ''], default: '' },
    compatibleWith: [{ type: String, enum: MODELS }],
    stockNumber: { type: String, trim: true },
    condition: { type: String, enum: ['new', 'pre-owned'], default: 'new' },
    year: Number,
    trim: { type: String, trim: true },
    color: { type: String, trim: true },
    price: { type: Number, required: [true, 'Price is required.'], min: [0, 'Price cannot be negative.'] },
    stock: { type: Number, default: 1, min: 0 },
    status: { type: String, enum: ['available', 'reserved', 'sold'], default: 'available' },
    image: { type: String, required: [true, 'An image path is required.'] },
    imageCredit: creditSchema,
    summary: { type: String, maxlength: 200 },
    description: { type: String, maxlength: 3000 },
    features: [String],
    specs: specsSchema,
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', model: 'text', trim: 'text', summary: 'text' });

/** Build a URL slug from the name if one was not given. */
productSchema.pre('validate', function setSlug(next) {
  if (!this.slug && this.name) {
    const base = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    this.slug = this.stockNumber ? `${base}-${this.stockNumber.toLowerCase()}` : base;
  }
  if (this.category === 'vehicle') this.stock = this.status === 'available' ? 1 : 0;
  next();
});

productSchema.statics.MODELS = MODELS;

module.exports = mongoose.model('Product', productSchema);
