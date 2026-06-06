/**
 * MODULE D — BACKEND API
 * Express server entry point.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const blockchain = require('./blockchain/blockchainService');

const app = express();

// Security headers
app.use(helmet());

// Rate limiting — 100 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
app.use(express.json({ limit: '100kb' }));

// API key guard for write endpoints
app.use((req, res, next) => {
  if (req.method === 'GET' || req.path === '/health') return next();
  const apiKey = process.env.API_KEY;
  if (apiKey && req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Initialize blockchain connection
blockchain.init(
  process.env.RPC_URL,
  process.env.OWNER_PRIVATE_KEY,
  process.env.CONTRACT_ADDRESS
);

// Routes
app.use('/issuer', require('./routes/issuer'));
app.use('/credential', require('./routes/credential'));
app.use('/proof', require('./routes/proof'));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
