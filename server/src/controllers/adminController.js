/**
 * Dashboard numbers for the admin panel.
 */
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const ContactMessage = require('../models/ContactMessage');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/admin/stats
exports.getStats = asyncHandler(async (req, res) => {
  const [vehicleStatus, lowStock, orderStatus, customers, newMessages, revenue] = await Promise.all([
    Product.aggregate([{ $match: { category: 'vehicle' } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.countDocuments({ category: 'accessory', stock: { $lte: 3 } }),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'customer' }),
    ContactMessage.countDocuments({ status: 'new' }),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, dueNow: { $sum: '$dueNow' }, subtotal: { $sum: '$subtotal' } } },
    ]),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
  res.json({
    vehicles: toMap(vehicleStatus),
    orders: toMap(orderStatus),
    lowStockAccessories: lowStock,
    customers,
    newMessages,
    collected: revenue[0]?.dueNow || 0,
    bookedValue: revenue[0]?.subtotal || 0,
  });
});
