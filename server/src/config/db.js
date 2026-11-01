/**
 * MongoDB connection via Mongoose.
 * The URI comes from MONGO_URI in server/.env.
 */
const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
