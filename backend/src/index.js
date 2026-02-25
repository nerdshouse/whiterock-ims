import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth.js';

import warehouseRoutes from './routes/warehouses.js';
import skuRoutes from './routes/skus.js';
import stockRoutes from './routes/stock.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import historyRoutes from './routes/history.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json());

// Root – API is under /api
app.get('/', (req, res) => res.send('IMS API. Use the frontend at http://localhost:5173 — API routes: /api/health, /api/warehouses, /api/skus, etc.'));

// Health (no auth)
app.get('/api/health', (req, res) => res.json({ ok: true }));

// All API routes require auth
app.use('/api/warehouses', authMiddleware, warehouseRoutes);
app.use('/api/skus', authMiddleware, skuRoutes);
app.use('/api/stock', authMiddleware, stockRoutes);
app.use('/api/purchase-orders', authMiddleware, purchaseOrderRoutes);
app.use('/api/history', authMiddleware, historyRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`IMS API running on http://localhost:${PORT}`));
