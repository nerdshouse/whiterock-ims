/**
 * One-time script to add the first member (or any member) to Firestore.
 * Only these emails can sign in with Google. Run once to add yourself as admin.
 *
 * Usage:
 *   # With path to service account JSON file (recommended):
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json node scripts/seed-first-member.js your@email.com "Your Name" Admin
 *
 *   # Or with JSON string in env:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' node scripts/seed-first-member.js your@email.com "Your Name" Admin
 *
 * Get the key file: Firebase Console → Project settings → Service accounts → Generate new private key.
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
    console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH (path to key.json) or FIREBASE_SERVICE_ACCOUNT_JSON (JSON string).');
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

const email = process.argv[2];
const displayName = process.argv[3] || '';
const role = (process.argv[4] || 'Admin').toLowerCase() === 'admin' ? 'Admin' : 'User';

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/seed-first-member.js <email> [displayName] [Admin|User]');
  console.error('Example: node scripts/seed-first-member.js you@gmail.com "Your Name" Admin');
  process.exit(1);
}

async function run() {
  const col = db.collection('members');
  const normalized = email.trim().toLowerCase();
  const snap = await col.where('email', '==', normalized).limit(1).get();
  if (!snap.empty) {
    console.log('Member with email', email, 'already exists. No change.');
    process.exit(0);
  }
  await col.add({
    email: normalized,
    displayName: String(displayName).trim(),
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('Added member:', email, '|', displayName || '(no name)', '|', role);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
