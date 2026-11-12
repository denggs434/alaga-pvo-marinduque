/**
 * Vercel Function entry: every /api/* request is rewritten here (see vercel.json)
 * and handled by the same Express app that `npm start` runs locally.
 * The website itself (/client) is served as static files by Vercel.
 *
 * Environment (Vercel project settings):
 *   MONGODB_URI            set by the MongoDB Atlas integration (or MONGO_URI)
 *   JWT_SECRET             long random string (16+ characters)
 *   BLOB_READ_WRITE_TOKEN  set by the connected Vercel Blob store (photo uploads)
 */
const app = require('../server/src/app');
const connectDB = require('../server/src/config/db');

module.exports = async function handler(req, res) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('JWT_SECRET is missing or shorter than 16 characters.');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: 'The server is not configured yet. Please try again later.' }));
  }
  try {
    await connectDB(); // reused across requests on the same instance
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: 'The database is not reachable right now. Please try again in a moment.' }));
  }
  return app(req, res);
};
