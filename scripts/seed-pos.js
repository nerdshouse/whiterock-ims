/**
 * Seed sample purchase orders for Table A and Table B.
 *
 * Usage (same env as seed-first-member.js):
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json node scripts/seed-pos.js
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function loadCred() {
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (jsonPath) {
    const resolved = path.resolve(jsonPath);
    if (!fs.existsSync(resolved)) {
      console.error('Service account file not found:', resolved);
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH (path to key.json) or FIREBASE_SERVICE_ACCOUNT_JSON.');
    process.exit(1);
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON.');
    process.exit(1);
  }
}

const cred = loadCred();

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

const db = admin.firestore();

async function pickOne(collectionName) {
  const snap = await db.collection(collectionName).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function run() {
  const warehouse = await pickOne('warehouses');
  const sku = await pickOne('skus');
  if (!warehouse || !sku) {
    console.error('Need at least one warehouse and one SKU to seed POs.');
    process.exit(1);
  }

  const groupId = 'PO-DEMO-1';
  const now = new Date();
  const etdA = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const etaA = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const basePayload = {
    poNumber: groupId,
    warehouseId: warehouse.id,
    skuCode: sku.skuCode || sku.skuCode,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Table A line
  await db.collection('purchaseOrders').add({
    ...basePayload,
    quantity: 100,
    etd: etdA,
    eta: etaA,
    status: 'Pending',
    type: 'A',
    groupId,
    locked: false,
    archived: false,
  });

  // Table B line
  const etdB = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const etaB = new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000);
  await db.collection('purchaseOrders').add({
    ...basePayload,
    quantity: 50,
    etd: etdB,
    eta: etaB,
    status: 'Pending',
    type: 'B',
    groupId,
    locked: false,
    archived: false,
  });

  console.log('Seeded demo PO group', groupId);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

