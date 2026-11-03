/**
 * Products (vehicles + accessories).
 * Public: list with filters, get one.  Admin: create, update, delete.
 */
const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const SORTS = {
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  newest: { createdAt: -1 },
  'year-desc': { year: -1, price: -1 },
  'range-desc': { 'specs.rangeKm': -1 },
  'km-asc': { 'specs.odometerKm': 1 },
};

/** Fields an admin may set through the API. */
const EDITABLE = [
  'name', 'category', 'model', 'compatibleWith', 'stockNumber', 'condition', 'year', 'trim',
  'color', 'price', 'stock', 'status', 'image', 'imageCredit', 'summary', 'description',
  'features', 'specs', 'featured', 'deposit', 'disclaimer',
];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Parse a numeric query value; returns undefined for blanks and garbage like "abc". */
const num = (v) => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
/** Query values must be plain strings (Express turns ?a[$ne]=x into an object). */
const str = (v) => (typeof v === 'string' ? v : '');

/** Turn query-string filters into a MongoDB filter object. */
function buildFilter(q, isAdmin) {
  const filter = {};
  if (str(q.category)) filter.category = str(q.category);
  if (str(q.model)) filter.model = { $in: str(q.model).split(',') };
  if (str(q.condition)) filter.condition = str(q.condition);
  if (q.featured === 'true') filter.featured = true;
  const minPrice = num(q.minPrice);
  const maxPrice = num(q.maxPrice);
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }
  const minRange = num(q.minRange);
  if (minRange) filter['specs.rangeKm'] = { $gte: minRange };
  if (str(q.q).trim()) {
    const rx = new RegExp(escapeRegex(str(q.q).trim()), 'i');
    filter.$or = [{ name: rx }, { model: rx }, { trim: rx }, { color: rx }, { stockNumber: rx }];
  }
  // Shoppers never see sold cars. Admins see everything when they ask for all=true.
  if (!(isAdmin && q.all === 'true')) filter.status = { $ne: 'sold' };
  return filter;
}

// GET /api/products
exports.listProducts = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const filter = buildFilter(req.query, isAdmin);
  const sort = SORTS[req.query.sort] || { featured: -1, year: -1 };
  // Clamp paging so negative, zero or huge values cannot misbehave.
  const limit = Math.min(Math.max(Math.floor(num(req.query.limit) || 24), 1), 100);
  const page = Math.max(Math.floor(num(req.query.page) || 1), 1);

  const [items, total, modelCounts] = await Promise.all([
    Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
    // Counts per model for the filter sidebar (ignores the model filter itself).
    Product.aggregate([
      { $match: { ...buildFilter({ ...req.query, model: '' }, isAdmin), category: 'vehicle' } },
      { $group: { _id: '$model', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    facets: { models: Object.fromEntries(modelCounts.map((m) => [m._id, m.count])) },
  });
});

// GET /api/products/:idOrSlug
exports.getProduct = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = /^[a-f0-9]{24}$/i.test(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne(query).lean();
  if (!product) throw new HttpError(404, 'That listing does not exist or was removed.');

  // Suggest a few similar items: same model for vehicles, compatible gear for accessories.
  const related = await Product.find({
    _id: { $ne: product._id },
    status: { $ne: 'sold' },
    ...(product.category === 'vehicle'
      ? { $or: [{ model: product.model }, { compatibleWith: product.model }] }
      : { category: 'accessory' }),
  })
    .limit(4)
    .lean();

  res.json({ product, related });
});

// POST /api/products  (admin)
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(pick(req.body, EDITABLE));
  res.status(201).json(product);
});

// PUT /api/products/:id  (admin)
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.');
  Object.assign(product, pick(req.body, EDITABLE));
  await product.save(); // runs validators and the slug/stock hook
  res.json(product);
});

// PATCH /api/products/:id/stock  { delta: +n | -n }  (admin, accessories)
// Adjusts stock relative to the current database value with $inc, so a sale that
// happens while the admin page is open is never overwritten by a stale number.
exports.adjustStock = asyncHandler(async (req, res) => {
  const delta = req.body.delta;
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000) {
    throw new HttpError(400, 'Stock change must be a whole number between -1000 and 1000.');
  }
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, category: 'accessory', ...(delta < 0 && { stock: { $gte: -delta } }) },
    { $inc: { stock: delta } },
    { new: true }
  );
  if (!product) {
    const current = await Product.findById(req.params.id).select('category stock name').lean();
    if (!current) throw new HttpError(404, 'Product not found.');
    if (current.category !== 'accessory') throw new HttpError(400, 'Vehicle stock follows its status. Change the status instead.');
    throw new HttpError(409, `Only ${current.stock} of ${current.name} in stock.`);
  }
  res.json(product);
});

// DELETE /api/products/:id  (admin)
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.');
  res.json({ message: `Deleted ${product.name}.` });
});
