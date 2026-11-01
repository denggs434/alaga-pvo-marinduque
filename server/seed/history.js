/**
 * Sample sales history so the admin Sales view has something to chart.
 * Everything here is clearly sample data: sold cars from the past 12 weeks,
 * a few accessory orders and two cancellations, bought by demo customers.
 * Order references start with "VY-H" so reseeding can replace them cleanly.
 */
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

const CUSTOMERS = [
  { name: 'Ana Lim', email: 'ana.lim@example.com', phone: '0917 210 4410', city: 'Boac' },
  { name: 'Ramon Villanueva', email: 'ramon.v@example.com', phone: '0918 332 0911', city: 'Gasan' },
  { name: 'Grace Manrique', email: 'grace.m@example.com', phone: '0927 845 1203', city: 'Santa Cruz' },
  { name: 'Paolo Rey', email: 'paolo.rey@example.com', phone: '0905 661 7720', city: 'Torrijos' },
];

// Sold cars (hidden from the shop because status is "sold")
const SOLD = [
  { stockNumber: 'VY-S101', name: '2020 Model 3 Standard Range Plus', model: 'Model 3', year: 2020, color: 'Pearl White', price: 1690000, image: 'assets/img/cars/model3-highland-perf.jpg' },
  { stockNumber: 'VY-S102', name: '2021 Model Y Long Range', model: 'Model Y', year: 2021, color: 'Pearl White', price: 2180000, image: 'assets/img/cars/modely-white.jpg' },
  { stockNumber: 'VY-S103', name: '2019 Model S Long Range', model: 'Model S', year: 2019, color: 'Pearl White', price: 2450000, image: 'assets/img/cars/models-2021-lr.jpg' },
  { stockNumber: 'VY-S104', name: '2022 Model 3 Long Range', model: 'Model 3', year: 2022, color: 'Ultra Red', price: 2290000, image: 'assets/img/cars/model3-highland-lr.jpg' },
  { stockNumber: 'VY-S105', name: '2017 Model X 75D', model: 'Model X', year: 2017, color: 'Solid Black', price: 2350000, image: 'assets/img/cars/modelx-black.jpg' },
  { stockNumber: 'VY-S106', name: '2023 Model Y Rear-Wheel Drive', model: 'Model Y', year: 2023, color: 'Midnight Silver Metallic', price: 2390000, image: 'assets/img/cars/modely-grey.jpg' },
];

// [weeksAgo, dayOfWeek, customerIndex, status, items[]]  item = stockNumber or [accessoryName, qty]
const ORDERS = [
  [11, 2, 0, 'completed', ['VY-S101', ['Wall Connector (Gen 3)', 1]]],
  [10, 4, 1, 'completed', [['Wall Connector (Gen 3)', 2]]],
  [9, 1, 2, 'completed', ['VY-S102']],
  [8, 5, 3, 'cancelled', [['Model 3 18" Aero Wheel Set', 1]]],
  [7, 3, 1, 'completed', ['VY-S103', ['Wall Connector (Gen 3)', 1]]],
  [6, 2, 0, 'completed', [['Destination Charger, Commercial Pair', 1]]],
  [5, 0, 2, 'completed', ['VY-S104']],
  [4, 4, 3, 'completed', [['Model 3 18" Aero Wheel Set', 1], ['Wall Connector (Gen 3)', 1]]],
  [3, 1, 0, 'completed', ['VY-S105']],
  [2, 3, 1, 'cancelled', [['Cybertruck 20" All-Terrain Wheel & Tyre', 1]]],
  [2, 5, 2, 'completed', ['VY-S106', ['Wall Connector (Gen 3)', 1]]],
  [1, 2, 3, 'confirmed', [['Destination Charger, Commercial Pair', 1]]],
  [0, 1, 0, 'ready', [['Model S 21" Wheel & Tyre (single)', 2]]],
];

const DEPOSIT = Order.VEHICLE_DEPOSIT;

async function seedHistory(creditFor) {
  await Order.deleteMany({ reference: /^VY-H/ });

  const customers = [];
  for (const c of CUSTOMERS) {
    customers.push((await User.findOne({ email: c.email })) || (await User.create({ ...c, password: 'Customer123!' })));
  }

  const sold = {};
  for (const s of SOLD) {
    sold[s.stockNumber] = await Product.create({
      ...s,
      category: 'vehicle',
      condition: 'pre-owned',
      status: 'sold',
      trim: s.name.replace(/^\d{4} Model [3SXY] /, ''),
      imageCredit: creditFor(s.image),
      summary: 'Sold. Kept for sales history.',
    });
  }
  const accessories = Object.fromEntries((await Product.find({ category: 'accessory' })).map((p) => [p.name, p]));

  const now = new Date();
  let n = 0;
  for (const [weeksAgo, dow, ci, status, list] of ORDERS) {
    const items = list.map((it) => {
      if (typeof it === 'string') {
        const p = sold[it];
        return { product: p._id, name: p.name, image: p.image, category: 'vehicle', model: p.model, price: p.price, qty: 1, deposit: DEPOSIT };
      }
      const p = accessories[it[0]];
      return { product: p._id, name: p.name, image: p.image, category: 'accessory', price: p.price, qty: it[1] };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const dueNow = items.reduce((s, i) => s + (i.category === 'vehicle' ? i.deposit : i.price * i.qty), 0);
    const c = customers[ci];
    const order = await Order.create({
      reference: `VY-H${String(++n).padStart(3, '0')}`,
      user: c._id,
      items,
      subtotal,
      dueNow,
      balance: subtotal - dueNow,
      status,
      fulfillment: { method: 'delivery', fullName: c.name, phone: c.phone, address: 'Sample address', city: CUSTOMERS[ci].city },
      notes: 'Sample sales history',
    });
    // Backdate: Monday of (weeksAgo) weeks ago + dow days, mid-afternoon.
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeksAgo * 7 + dow);
    d.setHours(14, 0, 0, 0);
    if (d > now) d.setTime(now.getTime() - 36e5);
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: d, updatedAt: d } });
  }
  return { orders: ORDERS.length, soldCars: SOLD.length, customers: CUSTOMERS.length };
}

module.exports = seedHistory;
