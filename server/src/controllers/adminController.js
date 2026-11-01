/**
 * Dashboard numbers for the admin panel.
 */
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const ContactMessage = require('../models/ContactMessage');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/admin/sales?weeks=12
 * Sales numbers for the admin Sales view, computed in MongoDB:
 *  - totals: completed sales, deposits collected, open pipeline, cars sold, average order
 *  - weekly: value booked per week (Monday start, Manila time), zero-filled
 *  - byModel: revenue per model (accessories grouped as "Charging & parts")
 *  - byStatus: order count and value per status
 * Cancelled orders are excluded from money figures.
 */
exports.getSales = asyncHandler(async (req, res) => {
  const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 12, 1), 52);
  const TZ = 'Asia/Manila';
  const weekStart = (d) => {
    // Monday 00:00 in Manila for the given date, as a UTC Date
    const local = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
    const offset = local.getTime() - d.getTime();
    const day = (local.getDay() + 6) % 7; // Monday = 0
    local.setHours(0, 0, 0, 0);
    local.setDate(local.getDate() - day);
    return new Date(local.getTime() - offset);
  };
  const thisWeek = weekStart(new Date());
  const since = new Date(thisWeek.getTime() - (weeks - 1) * 7 * 864e5);
  const live = { status: { $ne: 'cancelled' } };

  const [totals, weekly, byModel, byStatus, carsSold] = await Promise.all([
    Order.aggregate([
      { $match: live },
      {
        $group: {
          _id: null,
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$subtotal', 0] } },
          deposits: { $sum: '$dueNow' },
          pipeline: { $sum: { $cond: [{ $in: ['$status', ['pending', 'confirmed', 'ready']] }, '$subtotal', 0] } },
          orders: { $sum: 1 },
          average: { $avg: '$subtotal' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...live, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit: 'week', startOfWeek: 'monday', timezone: TZ } },
          booked: { $sum: '$subtotal' },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$subtotal', 0] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: live },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$items.category', 'accessory'] },
              'Charging & parts',
              { $ifNull: ['$items.model', { $ifNull: [{ $first: '$p.model' }, 'Other'] }] },
            ],
          },
          revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          units: { $sum: '$items.qty' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$subtotal' } } }]),
    Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      { $match: { 'items.category': 'vehicle', 'items.preorder': { $ne: true } } },
      { $count: 'n' },
    ]),
  ]);

  // Zero-fill every week in the range so the chart has no gaps.
  const byWeek = new Map(weekly.map((w) => [new Date(w._id).getTime(), w]));
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * 864e5);
    const hit = [...byWeek.entries()].find(([t]) => Math.abs(t - start.getTime()) < 36e5 * 12);
    const w = hit ? hit[1] : null;
    return { weekStart: start, booked: w?.booked || 0, completed: w?.completed || 0, orders: w?.orders || 0 };
  });

  const t = totals[0] || {};
  res.json({
    weeks,
    totals: {
      completed: t.completed || 0,
      deposits: t.deposits || 0,
      pipeline: t.pipeline || 0,
      orders: t.orders || 0,
      average: Math.round(t.average || 0),
      carsSold: carsSold[0]?.n || 0,
    },
    weekly: series,
    byModel: byModel.map((m) => ({ label: m._id, revenue: m.revenue, units: m.units })),
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, { count: s.count, value: s.value }])),
  });
});

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
