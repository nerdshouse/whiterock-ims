import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function getFirestore() {
  if (db) return db;
  if (admin.apps.length === 0) {
    const credPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, '..', 'serviceAccountKey.json');
    if (existsSync(credPath)) {
      const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      // Default credentials (e.g. GCP environment)
      admin.initializeApp();
    }
  }
  db = admin.firestore();
  return db;
}

export function getAuth() {
  return admin.auth();
}
