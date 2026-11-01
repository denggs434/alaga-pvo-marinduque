/**
 * Orders placed from the cart.
 *
 * Stock rules:
 *  - A vehicle is reserved the moment the order is placed (status available -> reserved).
 *  - A pre-order (vehicle not yet built) is never locked; any number of buyers can reserve one.
 *  - Accessory stock is decremented by the ordered quantity.
 *  - Cancelling releases both. Completing an order marks its vehicles as sold.
 * Each reservation uses a conditional update so two shoppers cannot reserve the same car.
 */
const Order = require('../models/Order');
const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

/** Put stock back for every line of an order (used on cancel and on failed checkout). */
async function releaseStock(lines) {
  await Promise.all(
    lines
      .filter((line) => !line.preorder) // pre-orders never took stock
      .map((line) =>
        line.category === 'vehicle'
          ? Product.updateOne({ _id: line.product, status: 'reserved' }, { status: 'available', stock: 1 })
          : Product.updateOne({ _id: line.product }, { $inc: { stock: line.qty } })
      )
  );
}

// POST /api/orders
exports.createOrder = asyncHandler(async (req, res) => {
  const { items = [], fulfillment, paymentMethod, notes } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty.');

  // Merge duplicate lines so the same product cannot be counted twice.
  const wanted = new Map();
  for (const { product, qty } of items) {
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    wanted.set(String(product), (wanted.get(String(product)) || 0) + n);
  }

  const products = await Product.find({ _id: { $in: [...wanted.keys()] } });
  if (products.length !== wanted.size) {
    throw new HttpError(400, 'One of the items in your cart is no longer listed. Remove it and try again.');
  }

  const held = []; // lines whose stock we already took, for rollback
  try {
    for (const p of products) {
      if (p.category === 'vehicle' && p.condition === 'pre-order') {
        if (p.status !== 'available') throw new HttpError(409, `Pre-orders for ${p.name} are closed.`);
        held.push({ product: p._id, category: 'vehicle', qty: 1, preorder: true });
      } else if (p.category === 'vehicle') {
        const ok = await Product.findOneAndUpdate(
          { _id: p._id, status: 'available' },
          { status: 'reserved', stock: 0 }
        );
        if (!ok) throw new HttpError(409, `${p.name} (${p.stockNumber}) was just reserved by another buyer.`);
        held.push({ product: p._id, category: 'vehicle', qty: 1 });
      } else {
        const qty = wanted.get(String(p._id));
        const ok = await Product.findOneAndUpdate(
          { _id: p._id, stock: { $gte: qty } },
          { $inc: { stock: -qty } }
        );
        if (!ok) throw new HttpError(409, `Only ${p.stock} of ${p.name} left in stock.`);
        held.push({ product: p._id, category: 'accessory', qty });
      }
    }

    const lines = products.map((p) => ({
      product: p._id,
      name: p.name,
      image: p.image,
      category: p.category,
      price: p.price,
      qty: p.category === 'vehicle' ? 1 : wanted.get(String(p._id)),
      preorder: p.condition === 'pre-order',
      deposit: p.category === 'vehicle' ? p.deposit ?? Order.VEHICLE_DEPOSIT : undefined,
    }));

    const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    const dueNow = lines.reduce((sum, l) => sum + (l.category === 'vehicle' ? l.deposit : l.price * l.qty), 0);

    const order = await Order.create({
      user: req.user._id,
      items: lines,
      subtotal,
      dueNow,
      balance: subtotal - dueNow,
      fulfillment,
      paymentMethod,
      notes,
    });
    res.status(201).json(order);
  } catch (err) {
    await releaseStock(held);
    throw err;
  }
});

// GET /api/orders/mine
exports.myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json(orders);
});

// GET /api/orders/:id  (owner or admin)
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone').lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  const isOwner = String(order.user._id) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new HttpError(403, 'This order belongs to another account.');
  res.json(order);
});

// PATCH /api/orders/:id/cancel  (owner, only while pending)
exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new HttpError(404, 'Order not found.');
  if (order.status !== 'pending') {
    throw new HttpError(400, 'This order is already confirmed. Contact us to change it.');
  }
  order.status = 'cancelled';
  await order.save();
  await releaseStock(order.items);
  res.json(order);
});

// GET /api/orders  (admin)
exports.listOrders = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('user', 'name email').lean();
  res.json(orders);
});

// PATCH /api/orders/:id/status  (admin)
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, 'Order not found.');
  if (['cancelled', 'completed'].includes(order.status)) {
    throw new HttpError(400, `This order is already ${order.status} and can no longer change.`);
  }

  order.status = status;
  await order.save();

  if (status === 'cancelled') await releaseStock(order.items);
  if (status === 'completed') {
    const vehicleIds = order.items.filter((i) => i.category === 'vehicle' && !i.preorder).map((i) => i.product);
    await Product.updateMany({ _id: { $in: vehicleIds } }, { status: 'sold', stock: 0 });
  }
  res.json(order);
});
