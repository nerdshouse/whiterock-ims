import { getFirestore } from '../db/firestore.js';

export async function addStockMovement(db, { warehouseId, skuCode, changeType, quantityDelta, previousStock, newStock, userId, poNumber }) {
  const ref = db.collection('stockMovements').doc();
  await ref.set({
    warehouseId,
    skuCode,
    changeType: changeType || 'manual_update',
    quantityDelta: Number(quantityDelta),
    previousStock: Number(previousStock),
    newStock: Number(newStock),
    timestamp: new Date(),
    metadata: { userId, poNumber: poNumber || null },
  });
}
