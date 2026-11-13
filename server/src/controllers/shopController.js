/**
 * Marketplace: pet owners open shops and sell pet supplies; the PVO runs the
 * Alaga Official Store (products with no seller). Works like Shopee:
 *
 * Catalog   public; filter by category, species, shop; staff also see hidden items
 * Picks     products for the logged-in owner's own pets (by species), best sellers first
 * Related   "often bought together", from real orders, topped up with similar items
 * Selling   an owner applies to sell (shop name, what they sell, pickup point);
 *           PVO staff approve or reject; approved sellers list products, edit
 *           stock and price, and handle the orders placed with them
 * Sellers   staff review applications and can suspend or restore a shop
 *           (a suspended shop's products leave the shop until it is restored)
 * Orders    checkout splits the cart into one order per shop; cash on pickup or
 *           delivery; the buyer can cancel until the seller confirms
 * Staff     see every product and order, hide or remove listings, step in on orders
 *
 * Stock: each line is taken with one conditional $inc ({ stock: { $gte: qty } }),
 * so two buyers can never both get the last item. If any line fails, the lines
 * already taken are put back and nothing is ordered. Cancelling restores stock.
 */
const Product = require('../models/Product');
const Order = require('../models/Order');
const Pet = require('../models/Pet');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const notify = require('../utils/notify');
const { str, oneOf, escapeRegex, paging, requireId, pick, publicName } = require('../utils/validate');
const {
  PRODUCT_CATEGORIES, SPECIES, ORDER_STATUSES, OPEN_ORDER_STATUSES, FULFILLMENT, DELIVERY_FEE, FREE_DELIVERY_FROM,
} = require('../config/constants');

const OFFICIAL = 'Alaga Official Store';
const isAdmin = (u) => u?.role === 'admin';
const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');
const EDITABLE = ['name', 'description', 'category', 'species', 'brand', 'price', 'stock', 'photos', 'active'];
const SELLER = { path: 'seller', select: 'name shop municipality banned' };
const SORTS = {
  popular: { sold: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
};
const STATUS_TEXT = {
  confirmed: 'Order confirmed. The seller is preparing your items.',
  ready: 'Your order is ready for pickup or out for delivery.',
  completed: 'Order completed. Thank you!',
  cancelled: 'Order cancelled.',
};

/** The public face of a shop: never the owner's full name or contact details. */
function shopOf(seller) {
  if (!seller) return { id: 'official', name: OFFICIAL, official: true, municipality: 'Boac' };
  return { id: String(seller._id), name: seller.shop?.name || `${publicName(seller.name)}'s Pet Shop`, official: false, municipality: seller.municipality || '' };
}
/** A product as the shop shows it: the seller replaced by its shop. */
const view = (p) => ({ ...p, seller: p.seller?._id || null, shop: shopOf(p.seller) });

/** A seller's application state; shops named before applications existed count as approved. */
const sellerStatus = (u) => u?.shop?.status || (u?.shop?.name ? 'approved' : 'none');

/** Products of suspended shops, or of suspended accounts, are not for sale. */
async function bannedSellers() {
  return (await User.find({ $or: [{ banned: true }, { 'shop.status': { $in: ['suspended', 'rejected', 'pending'] } }] }).select('_id').lean()).map((u) => u._id);
}

/* ---------- Catalog ---------- */

// GET /api/shop/products?q=&category=&species=&shop=<userId>|official&sort=&page=&limit=   (admin: &all=true)
exports.listProducts = asyncHandler(async (req, res) => {
  const q = req.query;
  const all = isAdmin(req.user) && q.all === 'true';
  const filter = all ? {} : { active: true, seller: { $nin: await bannedSellers() } };
  const and = [];
  const category = oneOf(q.category, PRODUCT_CATEGORIES);
  const species = oneOf(q.species, SPECIES);
  if (category) filter.category = category;
  // A product for "any pet" (empty list) also suits the chosen species.
  if (species) and.push({ $or: [{ species }, { species: { $size: 0 } }] });
  if (str(q.q)) {
    const rx = new RegExp(escapeRegex(str(q.q)), 'i');
    and.push({ $or: [{ name: rx }, { brand: rx }, { description: rx }] });
  }
  let shop = null;
  let shopSeller = null;
  if (q.shop === 'official') {
    and.push({ seller: null });
    shop = shopOf(null);
  } else if (str(q.shop)) {
    const seller = await User.findById(requireId(str(q.shop), 'Shop')).select('name shop municipality createdAt').lean();
    if (!seller) throw new HttpError(404, 'Shop not found.');
    and.push({ seller: seller._id });
    shopSeller = seller._id;
    shop = { ...shopOf(seller), about: seller.shop?.about || '', since: seller.createdAt };
  }
  if (and.length) filter.$and = and;
  const sort = SORTS[str(q.sort)] || SORTS.popular;
  const { limit, page, skip } = paging(q, { limit: 24, max: 300 });

  const [items, total] = await Promise.all([
    Product.find(filter).sort({ ...sort, _id: -1 }).skip(skip).limit(limit).populate(SELLER).lean(),
    Product.countDocuments(filter),
  ]);
  if (shop) {
    const sold = await Product.aggregate([{ $match: { seller: shopSeller, active: true } }, { $group: { _id: null, n: { $sum: '$sold' } } }]);
    shop.sold = sold[0]?.n || 0;
    shop.products = total;
  }
  res.json({ items: items.map(view), total, page, pages: Math.ceil(total / limit) || 1, shop });
});

// GET /api/shop/shops -> the shops with products for sale, biggest sellers first
exports.listShops = asyncHandler(async (req, res) => {
  const rows = await Product.aggregate([
    { $match: { active: true } },
    { $group: { _id: '$seller', products: { $sum: 1 }, sold: { $sum: '$sold' }, photo: { $first: { $arrayElemAt: ['$photos', 0] } } } },
    { $sort: { sold: -1 } },
    { $limit: 24 },
  ]);
  const sellers = (await User.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) }, banned: { $ne: true } }).select('name shop municipality').lean())
    .filter((u) => sellerStatus(u) === 'approved');
  const byId = new Map(sellers.map((s) => [String(s._id), s]));
  res.json(rows
    .filter((r) => !r._id || byId.has(String(r._id)))
    .map((r) => ({ ...shopOf(r._id ? byId.get(String(r._id)) : null), products: r.products, sold: r.sold, photo: r.photo || null })));
});

// GET /api/shop/picks  (logged in) -> { pets: [{ name, species }], items }
// Products that suit the species of the user's own pets, best sellers first.
exports.picks = asyncHandler(async (req, res) => {
  const pets = await Pet.find({ owner: req.user._id, status: { $ne: 'deceased' } }).select('name species').lean();
  const species = [...new Set(pets.map((p) => p.species))];
  if (!species.length) return res.json({ pets: [], items: [] });
  const items = await Product.find({ active: true, stock: { $gt: 0 }, species: { $in: species }, seller: { $nin: [req.user._id, ...(await bannedSellers())] } })
    .sort({ sold: -1, createdAt: -1 })
    .limit(8)
    .populate(SELLER)
    .lean();
  res.json({ pets: pets.map((p) => ({ name: p.name, species: p.species })), items: items.map(view) });
});

// GET /api/shop/products/:id -> product + related ("often bought together", then similar)
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(requireId(req.params.id, 'Product')).populate(SELLER).lean();
  const mine = product && sameId(product.seller, req.user);
  const offSale = !product?.active || product?.seller?.banned || (product?.seller && sellerStatus(product.seller) !== 'approved');
  if (!product || (offSale && !mine && !isAdmin(req.user))) throw new HttpError(404, 'Product not found.');

  const together = await Order.aggregate([
    { $match: { 'items.product': product._id, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $match: { 'items.product': { $ne: product._id } } },
    { $group: { _id: '$items.product', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 8 },
  ]);
  const ids = together.map((t) => t._id);
  let related = await Product.find({ _id: { $in: ids }, active: true }).populate(SELLER).lean();
  related.sort((a, b) => ids.findIndex((i) => i.equals(a._id)) - ids.findIndex((i) => i.equals(b._id)));
  related = related.slice(0, 4).map((p) => ({ ...p, together: true }));

  if (related.length < 4) {
    const skip = [product._id, ...related.map((p) => p._id)];
    const similar = await Product.find({
      _id: { $nin: skip },
      active: true,
      $or: [{ category: product.category }, ...(product.species.length ? [{ species: { $in: product.species } }] : [])],
    }).sort({ sold: -1 }).limit(4 - related.length).populate(SELLER).lean();
    related = related.concat(similar);
  }
  res.json({ ...view(product), related: related.map(view) });
});

/* ---------- Selling ---------- */

/** Clean the editable fields of a product form. */
function productData(body) {
  const data = pick(body, EDITABLE);
  if ('species' in data) data.species = Array.isArray(data.species) ? [...new Set(data.species.filter((s) => SPECIES.includes(s)))] : [];
  if ('photos' in data && !Array.isArray(data.photos)) data.photos = [];
  if ('active' in data) data.active = data.active === true;
  return data;
}

/** Load a product the user may edit: their own listing, or any listing for staff. */
async function editable(req) {
  const product = await Product.findById(requireId(req.params.id, 'Product'));
  if (!product || (!isAdmin(req.user) && !sameId(product.seller, req.user))) throw new HttpError(404, 'Product not found.');
  if (!isAdmin(req.user) && sellerStatus(req.user) === 'suspended') throw new HttpError(403, 'Your shop is suspended. Message the PVO to have it restored.');
  return product;
}

/** The seller's own view of their shop and application. */
const myShopView = (u) => ({
  ...shopOf(u),
  about: u.shop?.about || '',
  sells: u.shop?.sells || [],
  pickup: u.shop?.pickup || '',
  status: sellerStatus(u),
  reason: u.shop?.reason || '',
  appliedAt: u.shop?.appliedAt || null,
  decidedAt: u.shop?.decidedAt || null,
});

// GET /api/shop/mine -> { shop, products }  (the seller's own shop, hidden items included)
exports.myShop = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ shop: myShopView(req.user), products });
});

// PUT /api/shop/mine  { name, about, sells, pickup }  (owner)
// Not yet a seller (or rejected): sends an application for PVO review.
// Approved: updates the shop details. Suspended: not allowed.
exports.updateMyShop = asyncHandler(async (req, res) => {
  const status = sellerStatus(req.user);
  if (status === 'suspended') throw new HttpError(403, 'Your shop is suspended. Message the PVO to have it restored.');
  const name = str(req.body.name);
  const about = str(req.body.about);
  const pickup = str(req.body.pickup);
  const sells = Array.isArray(req.body.sells) ? [...new Set(req.body.sells.filter((c) => PRODUCT_CATEGORIES.includes(c)))] : [];
  const errors = {};
  if (name.length < 3) errors.shopName = 'Give your shop a name (at least 3 characters).';
  else if (/official|pvo/i.test(name)) errors.shopName = 'Only the PVO store can use "Official" or "PVO" in its name.';
  if (about.length < 20) errors.about = 'Tell buyers and the PVO what you sell (at least 20 characters).';
  if (!sells.length) errors.sells = 'Choose at least one kind of product.';
  if (pickup.length < 5) errors.pickup = 'Enter where buyers can pick up orders.';
  if (Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0], errors);

  const shop = { ...(req.user.shop?.toObject?.() || req.user.shop || {}), name: name.slice(0, 60), about: about.slice(0, 300), sells, pickup: pickup.slice(0, 120) };
  if (status !== 'approved') Object.assign(shop, { status: 'pending', appliedAt: new Date(), reason: undefined, decidedAt: undefined });
  req.user.shop = shop;
  await req.user.save();
  res.json({ shop: myShopView(req.user) });
});

/* ---------- Sellers (staff) ---------- */

// GET /api/shop/sellers  (admin) -> every application and shop, with sales numbers
exports.listSellers = asyncHandler(async (req, res) => {
  const users = await User.find({ 'shop.name': { $exists: true, $ne: '' } }).select('name email phone municipality barangay shop banned createdAt').lean();
  const ids = users.map((u) => u._id);
  const [products, orders] = await Promise.all([
    Product.aggregate([{ $match: { seller: { $in: ids } } }, { $group: { _id: '$seller', products: { $sum: 1 }, live: { $sum: { $cond: ['$active', 1, 0] } }, sold: { $sum: '$sold' } } }]),
    Order.aggregate([{ $match: { seller: { $in: ids } } }, { $group: {
      _id: '$seller',
      orders: { $sum: 1 },
      open: { $sum: { $cond: [{ $in: ['$status', OPEN_ORDER_STATUSES] }, 1, 0] } },
      cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
      sales: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0] } },
    } }]),
  ]);
  const p = new Map(products.map((r) => [String(r._id), r]));
  const o = new Map(orders.map((r) => [String(r._id), r]));
  res.json(users
    .map((u) => ({
      _id: u._id, name: u.name, email: u.email, phone: u.phone, municipality: u.municipality, barangay: u.barangay, banned: u.banned,
      shop: { ...u.shop, status: sellerStatus(u) },
      products: p.get(String(u._id))?.products || 0,
      live: p.get(String(u._id))?.live || 0,
      sold: p.get(String(u._id))?.sold || 0,
      orders: o.get(String(u._id))?.orders || 0,
      openOrders: o.get(String(u._id))?.open || 0,
      cancelled: o.get(String(u._id))?.cancelled || 0,
      sales: o.get(String(u._id))?.sales || 0,
    }))
    .sort((a, b) => new Date(b.shop.appliedAt || 0) - new Date(a.shop.appliedAt || 0)));
});

// PATCH /api/shop/sellers/:id  { decision: approve|reject|suspend|restore, reason }  (admin)
exports.decideSeller = asyncHandler(async (req, res) => {
  const user = await User.findById(requireId(req.params.id, 'Seller'));
  if (!user?.shop?.name) throw new HttpError(404, 'Seller not found.');
  const decision = str(req.body.decision);
  const reason = str(req.body.reason).slice(0, 300);
  const from = sellerStatus(user);
  const allowed = { approve: ['pending', 'rejected'], reject: ['pending'], suspend: ['approved'], restore: ['suspended'] };
  if (!allowed[decision]) throw new HttpError(400, 'Choose approve, reject, suspend or restore.');
  if (!allowed[decision].includes(from)) throw new HttpError(409, `This shop is ${from}; it cannot be ${decision === 'approve' ? 'approved' : `${decision}ed`} now. Reload to see the latest.`);
  if ((decision === 'reject' || decision === 'suspend') && reason.length < 5) throw new HttpError(400, 'Write the reason the seller will see.', { reason: 'Write the reason the seller will see.' });

  const status = { approve: 'approved', reject: 'rejected', suspend: 'suspended', restore: 'approved' }[decision];
  user.shop.status = status;
  user.shop.reason = status === 'approved' ? undefined : reason;
  user.shop.decidedAt = new Date();
  await user.save();
  const text = {
    approve: `Your shop "${user.shop.name}" is approved. You can now list products under Account → My shop.`,
    reject: `Your seller application was not approved: ${reason} You can update it and apply again.`,
    suspend: `Your shop "${user.shop.name}" is suspended and its products are hidden: ${reason}`,
    restore: `Your shop "${user.shop.name}" is restored. Your products are back in the shop.`,
  }[decision];
  notify.shop(user._id, text);
  res.json({ _id: user._id, shop: { ...user.shop.toObject(), status } });
});

// POST /api/shop/products  (owner: lists in their shop; admin: lists in the official store)
exports.createProduct = asyncHandler(async (req, res) => {
  const data = productData(req.body);
  if (!isAdmin(req.user)) {
    const status = sellerStatus(req.user);
    if (status !== 'approved') {
      throw new HttpError(403, status === 'pending' ? 'Your seller application is still being reviewed by the PVO.' : status === 'suspended' ? 'Your shop is suspended.' : 'Apply to sell first, under Account → My shop.');
    }
    data.seller = req.user._id;
  }
  res.status(201).json(await Product.create(data));
});

// PUT /api/shop/products/:id  (the seller, or staff)
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await editable(req);
  Object.assign(product, productData(req.body));
  await product.save();
  res.json(product);
});

// DELETE /api/shop/products/:id  (the seller, or staff) — orders keep their own copy of the item
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await editable(req);
  await product.deleteOne();
  if (isAdmin(req.user) && product.seller) notify.shop(product.seller, `PVO staff removed your listing "${product.name}".`);
  res.json({ message: 'Product deleted.' });
});

/* ---------- Orders ---------- */

/** Put the items of an order (or of a failed checkout) back on the shelf. */
const restock = (lines) =>
  Promise.all(lines.map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty, sold: -l.qty } })));

// POST /api/shop/orders  (owner)  { items: [{ product, qty }], fulfillment, contact, address, note }
// -> 201 { orders: [...] }  one order per shop
exports.createOrder = asyncHandler(async (req, res) => {
  const raw = Array.isArray(req.body.items) ? req.body.items : [];
  // Merge repeated lines and clamp quantities.
  const wanted = new Map();
  for (const it of raw) {
    const id = requireId(String(it?.product || ''), 'Product');
    const qty = Math.floor(Number(it?.qty));
    if (!(qty >= 1)) continue;
    wanted.set(id, Math.min((wanted.get(id) || 0) + qty, 20));
  }
  if (!wanted.size) throw new HttpError(400, 'Your cart is empty.');
  if (wanted.size > 30) throw new HttpError(400, 'Order up to 30 different items at a time.');

  const fulfillment = oneOf(req.body.fulfillment, FULFILLMENT);
  if (!fulfillment) throw new HttpError(400, 'Choose pickup or delivery.', { fulfillment: 'Choose pickup or delivery.' });
  const banned = await bannedSellers();

  // Take each line from stock; on any failure put back what was taken.
  const taken = [];
  const created = [];
  try {
    for (const [id, qty] of wanted) {
      const p = await Product.findOneAndUpdate(
        { _id: id, active: true, stock: { $gte: qty }, seller: { $nin: [req.user._id, ...banned] } },
        { $inc: { stock: -qty, sold: qty } },
        { new: true }
      ).populate(SELLER).lean();
      if (!p) {
        const current = await Product.findById(id).select('name stock active seller').lean();
        if (current && sameId(current.seller, req.user)) throw new HttpError(409, `"${current.name}" is from your own shop. Remove it from your cart.`);
        if (!current || !current.active || banned.some((b) => sameId(b, current.seller))) throw new HttpError(409, 'An item in your cart is no longer sold. Remove it and try again.');
        throw new HttpError(409, current.stock
          ? `Only ${current.stock} of "${current.name}" left. Lower the quantity and try again.`
          : `"${current.name}" just sold out. Remove it and try again.`, { product: id, stock: current.stock });
      }
      taken.push({ product: p._id, name: p.name, price: p.price, photo: p.photos?.[0], qty, seller: p.seller });
    }

    // One order per shop.
    const groups = new Map();
    for (const l of taken) {
      const key = String(l.seller?._id || 'official');
      if (!groups.has(key)) groups.set(key, { seller: l.seller, lines: [] });
      groups.get(key).lines.push(l);
    }
    for (const { seller, lines } of groups.values()) {
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const deliveryFee = fulfillment === 'delivery' && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
      created.push(await Order.create({
        buyer: req.user._id,
        seller: seller?._id,
        shopName: shopOf(seller).name,
        items: lines.map(({ seller: _s, ...l }) => l),
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        fulfillment,
        contact: pick(req.body.contact, ['name', 'phone']),
        address: fulfillment === 'delivery' ? pick(req.body.address, ['municipality', 'barangay', 'details']) : {},
        note: str(req.body.note).slice(0, 300),
      }));
    }
  } catch (err) {
    await Promise.all([restock(taken), Order.deleteMany({ _id: { $in: created.map((o) => o._id) } })]);
    throw err;
  }
  created.forEach((o) => o.seller && notify.shop(o.seller, `New order ${o.reference}: ${o.items.length} item${o.items.length === 1 ? '' : 's'}, ₱${o.total}.`, o._id));
  res.status(201).json({ orders: created });
});

// GET /api/shop/orders/mine  (what I bought)
exports.myOrders = asyncHandler(async (req, res) => {
  res.json(await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 }).lean());
});

// GET /api/shop/orders/selling  (orders placed with my shop)
exports.sellingOrders = asyncHandler(async (req, res) => {
  res.json(await Order.find({ seller: req.user._id }).sort({ createdAt: -1 }).limit(300).lean());
});

// PATCH /api/shop/orders/:id/cancel  (buyer, only before the seller confirms it)
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: requireId(req.params.id, 'Order'), buyer: req.user._id, status: 'placed' },
    { status: 'cancelled', $push: { history: { status: 'cancelled', note: 'Cancelled by the buyer.', by: 'buyer' } } },
    { new: true }
  );
  if (!order) throw new HttpError(400, 'Only orders the seller has not confirmed yet can be cancelled. Message the seller or the PVO for help.');
  await restock(order.items);
  if (order.seller) notify.shop(order.seller, `The buyer cancelled order ${order.reference}.`, order._id);
  res.json(order);
});

// GET /api/shop/orders?status=open|<status>&q=  (admin: every shop)
exports.listOrders = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  if (q.status === 'open') filter.status = { $in: OPEN_ORDER_STATUSES };
  else if (oneOf(q.status, ORDER_STATUSES)) filter.status = str(q.status);
  if (str(q.q)) {
    const rx = new RegExp(escapeRegex(str(q.q)), 'i');
    filter.$or = [{ reference: rx }, { 'contact.name': rx }, { shopName: rx }, { 'address.barangay': rx }];
  }
  const { limit, skip } = paging(q, { limit: 300, max: 500 });
  const orders = await Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('buyer', 'name email phone').lean();
  res.json(orders);
});

// PATCH /api/shop/orders/:id  { status?, note? }  (the order's seller, or staff)
exports.updateOrder = asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Order');
  const status = req.body.status === undefined ? undefined : oneOf(req.body.status, ORDER_STATUSES);
  if (req.body.status !== undefined && !status) throw new HttpError(400, 'Choose a valid status.');
  const note = str(req.body.note).slice(0, 500);

  const current = await Order.findById(id).select('status seller').lean();
  const staff = isAdmin(req.user);
  // Staff handle official-store orders and can step in on any order; sellers handle their own.
  if (!current || (!staff && !sameId(current.seller, req.user))) throw new HttpError(404, 'Order not found.');
  if (['completed', 'cancelled'].includes(current.status) && status && status !== current.status) {
    throw new HttpError(400, `This order is already ${current.status}.`);
  }
  const changed = status && status !== current.status ? status : null;
  if (!changed && !note) throw new HttpError(400, 'Change the status or add a note for the buyer.');

  const update = { $push: { history: { status: changed || current.status, note: note || (changed && STATUS_TEXT[changed]) || undefined, by: staff ? 'pvo' : 'seller' } } };
  if (changed) update.$set = { status: changed };
  // Only apply if nobody changed the status since we read it.
  const order = await Order.findOneAndUpdate({ _id: id, status: current.status }, update, { new: true }).populate('buyer', 'name email phone');
  if (!order) throw new HttpError(409, 'Someone else just updated this order. Reload to see the latest.');
  if (changed === 'cancelled') await restock(order.items);
  notify.order(order, note || STATUS_TEXT[changed] || 'The seller added a note to your order.');
  res.json(order);
});

/** Marketplace numbers for the admin dashboard. */
exports.stats = async () => {
  const [byStatus, lowStock, revenue, sellers, products, pendingSellers] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Product.countDocuments({ active: true, stock: { $lte: 5 } }),
    Order.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Product.distinct('seller', { seller: { $ne: null } }),
    Product.countDocuments({ active: true }),
    User.countDocuments({ 'shop.status': 'pending' }),
  ]);
  const s = Object.fromEntries(byStatus.map((r) => [r._id, r.n]));
  return {
    newOrders: s.placed || 0,
    openOrders: OPEN_ORDER_STATUSES.reduce((sum, k) => sum + (s[k] || 0), 0),
    completed: s.completed || 0,
    revenue: revenue[0]?.total || 0,
    lowStock,
    sellers: sellers.length,
    pendingSellers,
    products,
  };
};
