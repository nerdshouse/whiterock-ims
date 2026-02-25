import { Router } from 'express';
import { getFirestore } from '../db/firestore.js';
import { addStockMovement } from '../lib/stockMovement.js';

const router = Router();
const db = getFirestore();
const coll = () => db.collection('purchaseOrders');
const stockColl = () => db.collection('stock');

function stockDocId(warehouseId, skuCode) {
  return `${warehouseId}_${skuCode}`.replace(/\s/g, '_');
}

router.get('/', async (req, res, next) => {
  try {
    const { warehouseId, status, withinDays } = req.query;
    let q = coll().orderBy('etd', 'asc');
    if (warehouseId) q = q.where('warehouseId', '==', warehouseId);
    if (status) q = q.where('status', '==', status);
    const snap = await q.get();
    let list = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, etd: data.etd?.toMillis?.(), createdAt: data.createdAt?.toMillis?.() };
    });
    const days = withinDays ? parseInt(withinDays, 10) : 60;
    if (days > 0) {
      const now = Date.now();
      const cutoff = now + days * 24 * 60 * 60 * 1000;
      list = list.filter(po => po.etd && po.etd >= now && po.etd <= cutoff);
    }
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await coll().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Purchase order not found' });
    const data = doc.data();
    res.json({ id: doc.id, ...data, etd: data.etd?.toMillis?.(), createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { poNumber, warehouseId, skuCode, quantity, etd } = req.body;
    if (!poNumber || !warehouseId || !skuCode || quantity == null) {
      return res.status(400).json({ error: 'poNumber, warehouseId, skuCode, and quantity are required' });
    }
    const ref = coll().doc();
    const etdDate = etd ? new Date(etd) : new Date();
    await ref.set({
      poNumber: String(poNumber),
      warehouseId: String(warehouseId),
      skuCode: String(skuCode),
      quantity: Number(quantity),
      etd: etdDate,
      status: 'Pending',
      createdAt: new Date(),
    });
    const doc = await ref.get();
    const data = doc.data();
    res.status(201).json({
      id: doc.id,
      ...data,
      etd: data.etd?.toMillis?.(),
      createdAt: data.createdAt?.toMillis?.(),
    });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'In Transit', 'Received'].includes(status)) {
      return res.status(400).json({ error: 'status must be Pending, In Transit, or Received' });
    }
    const ref = coll().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Purchase order not found' });
    const po = doc.data();
    if (po.status === 'Received') {
      return res.status(400).json({ error: 'PO already received' });
    }
    if (status === 'Received') {
      const stockRef = stockColl().doc(stockDocId(po.warehouseId, po.skuCode));
      const stockDoc = await stockRef.get();
      const prev = stockDoc.exists ? stockDoc.data().currentStock : 0;
      const nextStock = prev + Number(po.quantity);
      const payload = {
        warehouseId: po.warehouseId,
        skuCode: po.skuCode,
        currentStock: nextStock,
        dailyAvgSale: stockDoc.exists ? stockDoc.data().dailyAvgSale : 0,
        leadTime: stockDoc.exists ? stockDoc.data().leadTime : 0,
        updatedAt: new Date(),
      };
      if (stockDoc.exists) await stockRef.update(payload);
      else await stockRef.set(payload);
      await addStockMovement(db, {
        warehouseId: po.warehouseId,
        skuCode: po.skuCode,
        changeType: 'po_received',
        quantityDelta: Number(po.quantity),
        previousStock: prev,
        newStock: nextStock,
        userId: req.user?.uid,
        poNumber: po.poNumber,
      });
    }
    await ref.update({ status, updatedAt: new Date() });
    const updated = await ref.get();
    const data = updated.data();
    res.json({ id: updated.id, ...data, etd: data.etd?.toMillis?.(), createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const ref = coll().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Purchase order not found' });
    const { quantity, etd, status } = req.body;
    const updates = { updatedAt: new Date() };
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (etd !== undefined) updates.etd = new Date(etd);
    if (status !== undefined && ['Pending', 'In Transit', 'Received'].includes(status)) updates.status = status;
    await ref.update(updates);
    const updated = await ref.get();
    const data = updated.data();
    res.json({ id: updated.id, ...data, etd: data.etd?.toMillis?.(), createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ref = coll().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Purchase order not found' });
    await ref.delete();
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
