import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

function snapToDoc(d) {
  const data = d.data();
  const id = d.id;
  const out = { id, ...data };
  if (data.createdAt?.toMillis) out.createdAt = data.createdAt.toMillis();
  if (data.updatedAt?.toMillis) out.updatedAt = data.updatedAt.toMillis();
  if (data.etd?.toMillis) out.etd = data.etd.toMillis();
  if (data.eta?.toMillis) out.eta = data.eta.toMillis();
  if (data.timestamp?.toMillis) out.timestamp = data.timestamp.toMillis();
  return out;
}

// ——— Warehouses ———
export function warehousesCollection() {
  return collection(db, 'warehouses');
}

export async function getWarehouses() {
  const q = query(warehousesCollection(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => snapToDoc(d));
}

export async function getWarehouse(id) {
  const d = await getDoc(doc(db, 'warehouses', id));
  if (!d.exists()) return null;
  return snapToDoc(d);
}

export async function addWarehouse({ name, location }) {
  const ref = await addDoc(warehousesCollection(), {
    name: String(name),
    location: location != null ? String(location) : '',
    createdAt: Timestamp.now(),
  });
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function updateWarehouse(id, updates) {
  const ref = doc(db, 'warehouses', id);
  const o = {};
  if (updates.name !== undefined) o.name = String(updates.name);
  if (updates.location !== undefined) o.location = String(updates.location);
  await updateDoc(ref, o);
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function deleteWarehouse(id) {
  await deleteDoc(doc(db, 'warehouses', id));
}

export function subscribeWarehouses(cb) {
  const q = query(warehousesCollection());
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => snapToDoc(d));
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    cb(list);
  });
}

// ——— SKUs ———
export function skusCollection() {
  return collection(db, 'skus');
}

export async function getSkus() {
  const q = query(skusCollection(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => snapToDoc(d));
}

export async function getSku(id) {
  const d = await getDoc(doc(db, 'skus', id));
  if (!d.exists()) return null;
  return snapToDoc(d);
}

export async function addSku(payload) {
  const { skuCode, name, category, status, purchaseRate, sellRate, weightPerUnit, pcsInBox } = payload;
  const ref = await addDoc(skusCollection(), {
    skuCode: String(skuCode),
    name: String(name),
    category: category != null ? String(category) : '',
    status: status === 'Inactive' ? 'Inactive' : 'Active',
    purchaseRate: Number(purchaseRate) || 0,
    sellRate: Number(sellRate) || 0,
    weightPerUnit: Number(weightPerUnit) || 0,
    pcsInBox: Number(pcsInBox) || 0,
    createdAt: Timestamp.now(),
  });
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function updateSku(id, updates) {
  const ref = doc(db, 'skus', id);
  const allowed = ['name', 'category', 'status', 'purchaseRate', 'sellRate', 'weightPerUnit', 'pcsInBox'];
  const o = {};
  for (const k of allowed) if (updates[k] !== undefined) o[k] = updates[k];
  if (o.status) o.status = o.status === 'Inactive' ? 'Inactive' : 'Active';
  if (o.pcsInBox !== undefined) o.pcsInBox = Number(o.pcsInBox);
  await updateDoc(ref, o);
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function getSkuByCode(skuCode) {
  const q = query(skusCollection(), where('skuCode', '==', skuCode), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snapToDoc(snap.docs[0]);
}

export async function deleteSku(id) {
  await deleteDoc(doc(db, 'skus', id));
}

export function subscribeSkus(cb) {
  const q = query(skusCollection());
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => snapToDoc(d));
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    cb(list);
  });
}

// ——— Stock (doc id = warehouseId_skuCode) ———
function stockDocId(warehouseId, skuCode) {
  const safe = (s) => String(s).replace(/[\s\/.#\[\]]/g, '_');
  return `${safe(warehouseId)}_${safe(skuCode)}`;
}

export function stockCollection() {
  return collection(db, 'stock');
}

export async function getStock(warehouseId = null) {
  let q = query(stockCollection(), orderBy('warehouseId'), orderBy('skuCode'));
  if (warehouseId) q = query(stockCollection(), where('warehouseId', '==', warehouseId), orderBy('skuCode'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() };
  });
}

export async function getStockRecord(warehouseId, skuCode) {
  const ref = doc(db, 'stock', stockDocId(warehouseId, skuCode));
  const d = await getDoc(ref);
  if (!d.exists()) return null;
  const data = d.data();
  return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() };
}

export async function setStock(warehouseId, skuCode, { currentStock, dailyAvgSale, leadTime, safetyStock, seasonalBuffer, stockForGrowth }, previousStock = null) {
  const id = stockDocId(warehouseId, skuCode);
  const ref = doc(db, 'stock', id);
  const docSnap = await getDoc(ref);
  const payload = {
    warehouseId,
    skuCode,
    currentStock: Number(currentStock ?? (docSnap.exists() ? docSnap.data().currentStock : 0)),
    dailyAvgSale: Number(dailyAvgSale ?? (docSnap.exists() ? docSnap.data().dailyAvgSale : 0)),
    leadTime: Number(leadTime ?? (docSnap.exists() ? docSnap.data().leadTime : 0)),
    safetyStock: Number(safetyStock ?? (docSnap.exists() ? docSnap.data().safetyStock : 0)) || 0,
    seasonalBuffer: Number(seasonalBuffer ?? (docSnap.exists() ? docSnap.data().seasonalBuffer : 0)) || 0,
    stockForGrowth: Number(stockForGrowth ?? (docSnap.exists() ? docSnap.data().stockForGrowth : 0)) || 0,
    updatedAt: serverTimestamp(),
  };
  if (docSnap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
  if (previousStock != null && payload.currentStock !== previousStock) {
    await addStockMovement({
      warehouseId,
      skuCode,
      changeType: 'manual_update',
      quantityDelta: payload.currentStock - previousStock,
      previousStock,
      newStock: payload.currentStock,
    });
  }
  const d = await getDoc(ref);
  const data = d.data();
  return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() };
}

export async function addStockRecord(warehouseId, skuCode, { currentStock, dailyAvgSale, leadTime, safetyStock, seasonalBuffer, stockForGrowth }) {
  const code = String(skuCode).trim();
  const id = stockDocId(warehouseId, code);
  const ref = doc(db, 'stock', id);
  const docSnap = await getDoc(ref);
  if (docSnap.exists()) throw new Error('Stock record already exists for this warehouse and SKU');
  await setDoc(ref, {
    warehouseId: String(warehouseId).trim(),
    skuCode: code,
    currentStock: Number(currentStock) || 0,
    dailyAvgSale: Number(dailyAvgSale) || 0,
    leadTime: Number(leadTime) || 0,
    safetyStock: Number(safetyStock) || 0,
    seasonalBuffer: Number(seasonalBuffer) || 0,
    stockForGrowth: Number(stockForGrowth) || 0,
    updatedAt: serverTimestamp(),
  });
  const d = await getDoc(ref);
  const data = d.data();
  return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() };
}

export function subscribeStock(warehouseId, cb) {
  let q = query(stockCollection(), orderBy('warehouseId'), orderBy('skuCode'));
  if (warehouseId) q = query(stockCollection(), where('warehouseId', '==', warehouseId), orderBy('skuCode'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => { const data = d.data(); return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() }; }));
  });
}

/** Subscribe to all stock records (for PO list computed columns). */
export function subscribeAllStock(cb) {
  const q = query(stockCollection(), orderBy('warehouseId'), orderBy('skuCode'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => { const data = d.data(); return { id: d.id, ...data, updatedAt: data.updatedAt?.toMillis?.() }; }));
  });
}

// ——— Stock movements (history) ———
export function stockMovementsCollection() {
  return collection(db, 'stockMovements');
}

export async function addStockMovement(payload) {
  const { metadata, ...rest } = payload;
  const ref = await addDoc(stockMovementsCollection(), {
    ...rest,
    metadata: metadata || {},
    timestamp: serverTimestamp(),
  });
  const d = await getDoc(ref);
  const data = d.data();
  return { id: d.id, ...data, timestamp: data.timestamp?.toMillis?.() };
}

export async function getStockMovements(warehouseId = null, limitCount = 200) {
  let q = query(stockMovementsCollection(), orderBy('timestamp', 'desc'), limit(limitCount));
  if (warehouseId) q = query(stockMovementsCollection(), where('warehouseId', '==', warehouseId), orderBy('timestamp', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, timestamp: data.timestamp?.toMillis?.() };
  });
}

export function subscribeStockMovements(warehouseId, cb) {
  let q = query(stockMovementsCollection(), orderBy('timestamp', 'desc'), limit(200));
  if (warehouseId) q = query(stockMovementsCollection(), where('warehouseId', '==', warehouseId), orderBy('timestamp', 'desc'), limit(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => { const data = d.data(); return { id: d.id, ...data, timestamp: data.timestamp?.toMillis?.() }; }));
  });
}

// ——— Purchase orders ———
export function purchaseOrdersCollection() {
  return collection(db, 'purchaseOrders');
}

export async function getPurchaseOrders(withinDays = 60) {
  const q = query(purchaseOrdersCollection(), orderBy('etd', 'asc'));
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => snapToDoc(d));
  if (withinDays > 0) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const minEtd = startOfToday.getTime();
    const cutoff = minEtd + withinDays * 24 * 60 * 60 * 1000;
    list = list.filter((po) => po.etd != null && po.etd >= minEtd && po.etd <= cutoff);
  }
  return list;
}

export async function addPurchaseOrder(payload) {
  const { poNumber, warehouseId, skuCode, quantity, etd, eta } = payload;
  if (!poNumber || !warehouseId || !skuCode) throw new Error('PO number, warehouse, and SKU are required');
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) throw new Error('Quantity must be at least 1');
  const ref = await addDoc(purchaseOrdersCollection(), {
    poNumber: String(poNumber).trim(),
    warehouseId: String(warehouseId).trim(),
    skuCode: String(skuCode).trim(),
    quantity: qty,
    etd: etd ? new Date(etd) : new Date(),
    eta: eta ? new Date(eta) : null,
    status: 'Pending',
    createdAt: Timestamp.now(),
  });
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function updatePurchaseOrderStatus(id, status, reason) {
  const ref = doc(db, 'purchaseOrders', id);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) throw new Error('Purchase order not found');
  const po = docSnap.data();
  if (po.status === 'Received') throw new Error('PO already received; cannot change status');

  const updatePayload = { status, updatedAt: serverTimestamp() };
  if (reason != null && String(reason).trim() !== '') updatePayload.statusReason = String(reason).trim();

  if (status === 'Received') {
    const batch = writeBatch(db);
    const stockId = stockDocId(po.warehouseId, po.skuCode);
    const stockRef = doc(db, 'stock', stockId);
    const stockSnap = await getDoc(stockRef);
    const prev = stockSnap.exists() ? stockSnap.data().currentStock : 0;
    const nextStock = prev + Number(po.quantity);
    const stockPayload = {
      warehouseId: po.warehouseId,
      skuCode: po.skuCode,
      currentStock: nextStock,
      dailyAvgSale: stockSnap.exists() ? stockSnap.data().dailyAvgSale : 0,
      leadTime: stockSnap.exists() ? stockSnap.data().leadTime : 0,
      updatedAt: serverTimestamp(),
    };
    batch.set(stockRef, stockPayload, stockSnap.exists() ? { merge: true } : {});
    batch.update(ref, { ...updatePayload, status: 'Received' });
    await batch.commit();
    await addStockMovement({
      warehouseId: po.warehouseId,
      skuCode: po.skuCode,
      changeType: 'po_received',
      quantityDelta: Number(po.quantity),
      previousStock: prev,
      newStock: nextStock,
      metadata: { poNumber: po.poNumber, reason: updatePayload.statusReason || null },
    });
  } else {
    await updateDoc(ref, updatePayload);
  }
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function updatePurchaseOrder(id, updates) {
  const ref = doc(db, 'purchaseOrders', id);
  const o = { updatedAt: serverTimestamp() };
  if (updates.poNumber !== undefined) o.poNumber = String(updates.poNumber).trim();
  if (updates.quantity !== undefined) o.quantity = Number(updates.quantity);
  if (updates.etd !== undefined) o.etd = new Date(updates.etd);
  if (updates.eta !== undefined) o.eta = updates.eta ? new Date(updates.eta) : null;
  if (updates.status !== undefined && ['Pending', 'In Transit', 'Received'].includes(updates.status)) o.status = updates.status;
  await updateDoc(ref, o);
  const d = await getDoc(ref);
  return snapToDoc(d);
}

export async function deletePurchaseOrder(id) {
  await deleteDoc(doc(db, 'purchaseOrders', id));
}

export function subscribePurchaseOrders(withinDays, cb) {
  const q = query(purchaseOrdersCollection(), orderBy('etd', 'asc'));
  return onSnapshot(q, (snap) => {
    let list = snap.docs.map((d) => snapToDoc(d));
    if (withinDays > 0) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const minEtd = startOfToday.getTime();
      const cutoff = minEtd + withinDays * 24 * 60 * 60 * 1000;
      list = list.filter((po) => po.etd != null && po.etd >= minEtd && po.etd <= cutoff);
    }
    cb(list);
  });
}

// ——— Members (allow-list: only these emails can sign in with Google) ———
export function membersCollection() {
  return collection(db, 'members');
}

function memberToDoc(d) {
  const data = d.data();
  const out = { id: d.id, ...data };
  if (data.createdAt?.toMillis) out.createdAt = data.createdAt.toMillis();
  return out;
}

/** Returns the member doc if this email is allowed to sign in, else null. */
export async function getMemberByEmail(email) {
  if (!email) return null;
  const q = query(membersCollection(), where('email', '==', email.trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return memberToDoc(snap.docs[0]);
}

export async function addMember({ email, displayName, role }) {
  const ref = await addDoc(membersCollection(), {
    email: String(email).trim().toLowerCase(),
    displayName: displayName != null ? String(displayName).trim() : '',
    role: role === 'Admin' ? 'Admin' : 'User',
    createdAt: Timestamp.now(),
  });
  const d = await getDoc(ref);
  return memberToDoc(d);
}

export async function updateMember(id, updates) {
  const ref = doc(db, 'members', id);
  const o = {};
  if (updates.displayName !== undefined) o.displayName = String(updates.displayName).trim();
  if (updates.role !== undefined) o.role = updates.role === 'Admin' ? 'Admin' : 'User';
  if (updates.uid !== undefined) o.uid = updates.uid;
  if (Object.keys(o).length > 0) await updateDoc(ref, o);
  const d = await getDoc(ref);
  return memberToDoc(d);
}

export async function deleteMember(id) {
  await deleteDoc(doc(db, 'members', id));
}

export function subscribeMembers(cb) {
  const q = query(membersCollection());
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => memberToDoc(d));
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    cb(list);
  });
}
