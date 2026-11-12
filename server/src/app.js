/**
 * Express application: JSON API under /api, plus the static client.
 * Kept separate from server.js so it can be imported without starting a listener.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const securityHeaders = require('./middleware/securityHeaders');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
// On Vercel requests arrive through its proxy: read the visitor's IP from
// X-Forwarded-For so rate limits count each visitor, not the proxy.
if (process.env.VERCEL) app.set('trust proxy', true);
app.use(securityHeaders);
// Only needed when the client is hosted elsewhere; same-origin requests never use it.
if (process.env.CLIENT_ORIGIN) app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

// --- REST API ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/pets', require('./routes/petRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api', notFound);

// --- Frontend (the /client folder) ---
const clientDir = path.join(__dirname, '..', '..', 'client');
app.use(
  express.static(clientDir, {
    extensions: ['html'],
    setHeaders: (res, file) => {
      // Photos never change under the same name (uploads get random names): cache a week.
      // Pages, scripts and styles: always check for a newer copy after an update.
      const isImage = /\.(jpe?g|png|webp|svg)$/i.test(file);
      res.setHeader('Cache-Control', isImage ? 'public, max-age=604800' : 'no-cache');
    },
  })
);
app.use((req, res) => res.status(404).sendFile(path.join(clientDir, '404.html')));

app.use(errorHandler);

module.exports = app;
