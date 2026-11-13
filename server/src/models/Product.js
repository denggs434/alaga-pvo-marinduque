/**
 * Marketplace products: food, toys, accessories and other pet supplies, listed by
 * pet owners who sell (seller) or by the PVO's own Alaga Official Store (no seller).
 * `species` lists the animals a product suits (empty = any pet); the shop uses
 * it to pick products for a user's own pets. `stock` and `sold` change only
 * through atomic $inc updates when orders are placed or cancelled.
 */
const mongoose = require('mongoose');
const { PRODUCT_CATEGORIES, SPECIES, IMAGE_PATH } = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: [100, 'Name is too long.'] },
    description: { type: String, required: [true, 'Add a short description.'], trim: true, maxlength: [2000, 'Description is too long.'] },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty = Alaga Official Store (PVO)
    category: { type: String, enum: PRODUCT_CATEGORIES, required: [true, 'Choose a category.'] },
    species: { type: [{ type: String, enum: SPECIES }], default: [] },
    brand: { type: String, trim: true, maxlength: 60 },
    price: { type: Number, required: [true, 'Enter a price.'], min: [1, 'The price must be at least ₱1.'], max: [100000, 'That price is too high.'] },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative.'],
      validate: { validator: Number.isInteger, message: 'Stock must be a whole number.' },
    },
    photos: {
      type: [{ type: String, match: [IMAGE_PATH, 'Upload the photo again.'] }],
      validate: [(v) => v.length <= 4, 'Add up to 4 photos.'],
    },
    active: { type: Boolean, default: true }, // hidden from the shop when false
    sold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ active: 1, category: 1, sold: -1 });

module.exports = mongoose.model('Product', productSchema);
