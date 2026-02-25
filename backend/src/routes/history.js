import { Router } from 'express';
import { getFirestore } from '../db/firestore.js';

const router = Router();
const db = getFirestore();
const coll = () => db.collection('stockMovements');

router.get('/', async (req, res, next) => {
  try {
    const { warehouseId, skuCode, limit } = req.query;
    let q = coll().orderBy('timestamp', 'desc');
    if (warehouseId) q = q.where('warehouseId', '==', warehouseId);
    if (skuCode) q = q.where('skuCode', '==', skuCode);
    const cap = Math.min(parseInt(limit, 10) || 200, 500);
    const snap = await q.limit(cap).get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        timestamp: data.timestamp?.toMillis?.(),
      };
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

export default router;
