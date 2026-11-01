/**
 * An order placed from the cart.
 * Vehicles are reserved with a deposit (default VEHICLE_DEPOSIT, or the listing's own);
 * the balance is paid at handover.
 * Accessories are paid in full.
 */
const mongoose = require('mongoose');

const VEHICLE_DEPOSIT = 50000; // PHP

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    image: String,
    category: { type: String, enum: ['vehicle', 'accessory'] },
    model: String, // snapshot, so sales reports survive listing deletions
    price: Number,
    qty: { type: Number, min: 1 },
    preorder: { type: Boolean, default: false }, // vehicle not yet in production
    deposit: Number,                              // deposit charged for this vehicle line
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [itemSchema],
      validate: [(v) => v.length > 0, 'Your cart is empty.'],
    },
    subtotal: Number,     // full price of everything
    dueNow: Number,       // deposits + accessories
    balance: Number,      // remaining vehicle balance, paid at handover
    fulfillment: {
      method: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
      fullName: { type: String, required: [true, 'Full name is required.'], trim: true },
      phone: { type: String, required: [true, 'Phone number is required.'], trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
    },
    paymentMethod: {
      type: String,
      enum: ['pay-at-showroom', 'bank-transfer'],
      default: 'pay-at-showroom',
    },
    notes: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'ready', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

orderSchema.pre('validate', function requireAddress(next) {
  if (this.fulfillment?.method === 'delivery' && !this.fulfillment.address) {
    this.invalidate('fulfillment.address', 'Delivery address is required.');
  }
  if (!this.reference) {
    const stamp = Date.now().toString(36).toUpperCase().slice(-5);
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    this.reference = `VY-${stamp}${rand}`;
  }
  next();
});

orderSchema.statics.VEHICLE_DEPOSIT = VEHICLE_DEPOSIT;

module.exports = mongoose.model('Order', orderSchema);
