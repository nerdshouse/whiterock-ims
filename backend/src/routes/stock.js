import { Router } from 'express';
import { getFirestore } from '../db/firestore.js';
import { addStockMovement } from '../lib/stockMovement.js';

const router = Router();
const db = getFirestore();
const coll = () => db.collection('stock');

function docId(warehouseId, skuCode) {
  return `${warehouseId}_${skuCode}`.replace(/\s/g, '_');
}

router.get('/', async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    let q = coll().orderBy('warehouseId').orderBy('skuCode');
    if (warehouseId) q = coll().where('warehouseId', '==', warehouseId).orderBy('skuCode');
    const snap = await q.get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() };
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get('/:warehouseId/:skuCode', async (req, res, next) => {
  try {
    const { warehouseId, skuCode } = req.params;
    const doc = await coll().doc(docId(warehouseId, skuCode)).get();
    if (!doc.exists) return res.status(404).json({ error: 'Stock record not found' });
    const data = doc.data();
    res.json({ id: doc.id, ...data, updatedAt: data.updatedAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.put('/:warehouseId/:skuCode', async (req, res, next) => {
  try {
    const { warehouseId, skuCode } = req.params;
    const { currentStock, dailyAvgSale, leadTime } = req.body;
    const id = docId(warehouseId, skuCode);
    const ref = coll().doc(id);
    const doc = await ref.get();
    const previousStock = doc.exists ? doc.data().currentStock : 0;
    const newStock = currentStock !== undefined ? Number(currentStock) : (doc.exists ? doc.data().currentStock : 0);
    const payload = {
      warehouseId,
      skuCode,
      currentStock: newStock,
      dailyAvgSale: dailyAvgSale !== undefined ? Number(dailyAvgSale) : (doc.exists ? doc.data().dailyAvgSale : 0),
      leadTime: leadTime !== undefined ? Number(leadTime) : (doc.exists ? doc.data().leadTime : 0),
      updatedAt: new Date(),
    };
    if (doc.exists) {
      await ref.update(payload);
    } else {
      await ref.set(payload);
    }
    if (newStock !== previousStock) {
      await addStockMovement(db, {
        warehouseId,
        skuCode,
        changeType: 'manual_update',
        quantityDelta: newStock - previousStock,
        previousStock,
        newStock,
        userId: req.user?.uid,
      });
    }
    const updated = await ref.get();
    const data = updated.data();
    res.json({ id: updated.id, ...data, updatedAt: data.updatedAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { warehouseId, skuCode, currentStock, dailyAvgSale, leadTime } = req.body;
    if (!warehouseId || !skuCode) return res.status(400).json({ error: 'warehouseId and skuCode are required' });
    const id = docId(warehouseId, skuCode);
    const ref = coll().doc(id);
    const doc = await ref.get();
    if (doc.exists) return res.status(400).json({ error: 'Stock record already exists for this warehouse and SKU' });
    const stock = Number(currentStock) || 0;
    await ref.set({
      warehouseId,
      skuCode,
      currentStock: stock,
      dailyAvgSale: Number(dailyAvgSale) || 0,
      leadTime: Number(leadTime) || 0,
      updatedAt: new Date(),
    });
    const created = await ref.get();
    const data = created.data();
    res.status(201).json({ id: created.id, ...data, updatedAt: data.updatedAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

export default router;
