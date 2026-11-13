/**
 * Marketplace orders: one order per seller (a cart with items from three shops
 * becomes three orders, like Shopee). Each line keeps a copy of the product's name, price and photo at
 * the time of purchase, so later price changes or deleted products never alter
 * an order. Payment is cash, on pickup at the PVO office or on delivery.
 * `history` is the timeline the buyer sees, like a report's.
 */
const mongoose = require('mongoose');
const Counter = require('./Counter');
const { ORDER_STATUSES, FULFILLMENT, MUNICIPALITIES, PHONE } = require('../config/constants');

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    photo: String,
    qty: { type: Number, min: 1, max: 20 },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES },
    note: { type: String, trim: true, maxlength: 500 },
    by: { type: String, enum: ['buyer', 'seller', 'pvo'] },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty = Alaga Official Store
    shopName: String,
    items: { type: [itemSchema], validate: [(v) => v.length > 0, 'Your cart is empty.'] },
    subtotal: Number,
    deliveryFee: { type: Number, default: 0 },
    total: Number,
    fulfillment: { type: String, enum: FULFILLMENT, required: [true, 'Choose pickup or delivery.'] },
    contact: {
      name: { type: String, required: [true, 'Enter the name for this order.'], trim: true, maxlength: 80 },
      phone: { type: String, required: [true, 'Enter a phone number we can text.'], trim: true, match: [PHONE, 'Enter a valid phone number.'] },
    },
    address: {
      municipality: { type: String, enum: [...MUNICIPALITIES, ''], default: '' },
      barangay: { type: String, trim: true, maxlength: 60 },
      details: { type: String, trim: true, maxlength: 200 }, // street, landmark
    },
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ORDER_STATUSES, default: 'placed' },
    history: [historySchema],
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });

orderSchema.pre('validate', function prepare(next) {
  if (this.fulfillment === 'delivery') {
    if (!this.address?.municipality) this.invalidate('address.municipality', 'Choose the municipality for delivery.');
    if (!this.address?.barangay) this.invalidate('address.barangay', 'Enter the barangay for delivery.');
  }
  if (this.isNew && !this.history.length) this.history.push({ status: 'placed', note: 'Order received.', by: 'buyer' });
  next();
});

/** Reference number on first save (after validation, so rejected orders use no number). */
orderSchema.pre('save', async function assignReference(next) {
  if (!this.reference) {
    const n = await Counter.next('order');
    this.reference = `ORD-${String(new Date().getFullYear()).slice(2)}${String(n).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
