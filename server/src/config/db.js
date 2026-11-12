/**
 * MongoDB connection via Mongoose.
 * The URI comes from MONGO_URI in server/.env, or MONGODB_URI (set by the
 * MongoDB Atlas integration on Vercel).
 *
 * On Vercel one function instance serves many requests, so the connection is
 * opened once and the same promise is reused instead of reconnecting each time.
 */
const mongoose = require('mongoose');

let connecting = null;

async function connectDB(uri = process.env.MONGO_URI || process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!uri) throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env.');
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose
      .connect(uri, { dbName: process.env.MONGO_DB_NAME || undefined, serverSelectionTimeoutMS: 10000 })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.host}/${m.connection.name}`);
        return m.connection;
      })
      .catch((err) => {
        connecting = null; // allow the next request to retry
        throw err;
      });
  }
  return connecting;
}

module.exports = connectDB;
