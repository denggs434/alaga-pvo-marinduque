/**
 * Seeds the database with the starter inventory, an admin account
 * and a demo customer.  Run with:  npm run seed
 * WARNING: clears the products collection first.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Product = require('../src/models/Product');
const User = require('../src/models/User');
const products = require('./products');
const seedHistory = require('./history');

const credits = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'assets', 'img', 'credits.json'), 'utf8')
);
const creditFor = (image) => {
  const c = credits.find((x) => x.image === image);
  return c ? { author: c.author, license: c.license, source: c.source } : undefined;
};

async function upsertUser({ name, email, password, role, phone }) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ name, email, password, role, phone });
}

async function seed() {
  await connectDB(process.env.MONGO_URI);

  await Product.deleteMany({});
  // insert one by one so the slug hook runs for each document
  for (const p of products) await Product.create({ ...p, imageCredit: creditFor(p.image) });
  console.log(`Inserted ${products.length} products.`);

  const h = await seedHistory(creditFor);
  console.log(`Sample sales history: ${h.orders} orders, ${h.soldCars} sold cars, ${h.customers} demo customers.`);

  const admin = await upsertUser({
    name: 'Voltyard Admin',
    email: process.env.ADMIN_EMAIL || 'admin@voltyard.ph',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    role: 'admin',
  });
  const demo = await upsertUser({
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    password: 'Customer123!',
    role: 'customer',
    phone: '0917 555 0142',
  });
  console.log(`Admin login:    ${admin.email}`);
  console.log(`Customer login: ${demo.email} / Customer123!`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
