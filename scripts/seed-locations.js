/**
 * Seed the locations collection in Firestore (used by Warehouse Location dropdown).
 * Uses the same credentials as seed-first-member.js.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json node scripts/seed-locations.js Bhiwandi Mumbai Delhi
 *
 *   Or with default locations (Bhiwandi, Mumbai) if no args:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json node scripts/seed-locations.js
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

const DEFAULT_LOCATIONS = ['Bhiwandi', 'Mumbai'];
const locationNames = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => s.trim()).filter(Boolean)
  : DEFAULT_LOCATIONS;

if (locationNames.length === 0) {
  console.error('Usage: node scripts/seed-locations.js [location1] [location2] ...');
  console.error('Example: node scripts/seed-locations.js Bhiwandi Mumbai Delhi');
  process.exit(1);
}

async function run() {
  const col = db.collection('locations');
  const existing = await col.get();
  const existingNames = new Set(existing.docs.map((d) => (d.data().name || '').trim().toLowerCase()));

  const toAdd = locationNames.filter((name) => !existingNames.has(name.trim().toLowerCase()));
  if (toAdd.length === 0) {
    console.log('All given locations already exist. No change.');
    process.exit(0);
  }

  for (const name of toAdd) {
    await col.add({
      name: String(name).trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Added location:', name);
  }
  console.log('Done. Total locations added:', toAdd.length);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
