import { Router } from 'express';
import { getFirestore } from '../db/firestore.js';

const router = Router();
const db = getFirestore();
const coll = () => db.collection('warehouses');

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
    if (!doc.exists) return res.status(404).json({ error: 'Warehouse not found' });
    const data = doc.data();
    res.json({ id: doc.id, ...data, createdAt: data.createdAt?.toMillis?.() });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const ref = coll().doc();
    await ref.set({
      name: String(name),
      location: location != null ? String(location) : '',
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
    const { name, location } = req.body;
    const ref = coll().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Warehouse not found' });
    const updates = {};
    if (name !== undefined) updates.name = String(name);
    if (location !== undefined) updates.location = String(location);
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
    if (!doc.exists) return res.status(404).json({ error: 'Warehouse not found' });
    await ref.delete();
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
