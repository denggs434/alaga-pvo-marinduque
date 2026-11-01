/**
 * Express application: JSON API under /api, plus the static client.
 * Kept separate from server.js so it can be imported without starting a listener.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));

// --- REST API ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api', notFound);

// --- Frontend (the /client folder) ---
const clientDir = path.join(__dirname, '..', '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(clientDir, '404.html')));

app.use(errorHandler);

module.exports = app;
