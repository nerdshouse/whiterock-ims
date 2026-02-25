import { Router } from 'express';
import { getFirestore } from '../db/firestore.js';

const router = Router();
const db = getFirestore();
const coll = () => db.collection('skus');

router.get('/', async (req, res, next) => {
  try {
    const snap = await coll().orderBy('createdAt', 'desc').get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toMillis?.() }));
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await coll().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'SKU not found' });
    const data = doc.data();
    res.json({ id: doc.id, ...data, createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { skuCode, name, category, status, purchaseRate, sellRate, weightPerUnit } = req.body;
    if (!skuCode || !name) return res.status(400).json({ error: 'skuCode and name are required' });
    const snap = await coll().where('skuCode', '==', skuCode).limit(1).get();
    if (!snap.empty) return res.status(400).json({ error: 'SKU code already exists' });
    const ref = coll().doc();
    await ref.set({
      skuCode: String(skuCode),
      name: String(name),
      category: category != null ? String(category) : '',
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      purchaseRate: Number(purchaseRate) || 0,
      sellRate: Number(sellRate) || 0,
      weightPerUnit: Number(weightPerUnit) || 0,
      createdAt: new Date(),
    });
    const doc = await ref.get();
    const data = doc.data();
    res.status(201).json({ id: doc.id, ...data, createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const ref = coll().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'SKU not found' });
    const body = req.body;
    const allowed = ['name', 'category', 'status', 'purchaseRate', 'sellRate', 'weightPerUnit'];
    const updates = {};
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      if (k === 'status') updates[k] = body[k] === 'Inactive' ? 'Inactive' : 'Active';
      else if (typeof body[k] === 'number') updates[k] = body[k];
      else updates[k] = String(body[k]);
    }
    await ref.update(updates);
    const updated = await ref.get();
    const data = updated.data();
    res.json({ id: updated.id, ...data, createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ref = coll().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'SKU not found' });
    await ref.delete();
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
