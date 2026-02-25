import admin from 'firebase-admin';

function getAdmin() {
  if (admin.apps.length > 0) return admin;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const cred = JSON.parse(json);
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  } else {
    admin.initializeApp();
  }
  return admin;
}

function getAuth() {
  return getAdmin().auth();
}

function getFirestore() {
  return getAdmin().firestore();
}

async function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAuth().verifyIdToken(auth.slice(7));
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const user = await verifyToken(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const method = req.method;

  if (method === 'POST') {
    const { email, password, displayName, role } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    try {
      const auth = getAuth();
      const created = await auth.createUser({
        email: String(email).trim(),
        password: String(password),
        displayName: displayName ? String(displayName).trim() : undefined,
      });
      const db = getFirestore();
      await db.collection('members').doc(created.uid).set({
        email: created.email,
        displayName: displayName ? String(displayName).trim() : '',
        role: role === 'Admin' ? 'Admin' : 'User',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(201).json({ uid: created.uid });
      return;
    } catch (e) {
      res.status(400).json({ error: e.message || 'Create failed' });
      return;
    }
  }

  if (method === 'PUT') {
    const uid = req.query?.uid || req.body?.uid;
    if (!uid) {
      res.status(400).json({ error: 'uid required' });
      return;
    }
    const { displayName, role, password } = req.body || {};
    try {
      const auth = getAuth();
      const updates = {};
      if (password !== undefined && password !== '') updates.password = String(password);
      if (displayName !== undefined) updates.displayName = String(displayName).trim();
      if (Object.keys(updates).length > 0) await auth.updateUser(uid, updates);

      const db = getFirestore();
      const ref = db.collection('members').doc(uid);
      const doc = await ref.get();
      if (doc.exists) {
        const o = {};
        if (displayName !== undefined) o.displayName = String(displayName).trim();
        if (role !== undefined) o.role = role === 'Admin' ? 'Admin' : 'User';
        if (Object.keys(o).length > 0) await ref.update(o);
      }

      res.status(200).json({ ok: true });
      return;
    } catch (e) {
      res.status(400).json({ error: e.message || 'Update failed' });
      return;
    }
  }

  if (method === 'DELETE') {
    const uid = req.query?.uid || req.body?.uid;
    if (!uid) {
      res.status(400).json({ error: 'uid required' });
      return;
    }
    try {
      await getAuth().deleteUser(uid);
      await getFirestore().collection('members').doc(uid).delete();
      res.status(200).json({ ok: true });
      return;
    } catch (e) {
      res.status(400).json({ error: e.message || 'Delete failed' });
      return;
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
