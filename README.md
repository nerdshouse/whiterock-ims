# IMS – Inventory Reorder Planning

Single React app using **Firestore** and **Firebase Auth**. Deploy to **Vercel** as a static site.

## Stack

- **Frontend:** React, Tailwind CSS, Vite
- **Database:** Firestore (client SDK)
- **Auth:** Firebase Authentication (email/password)
- **Hosting:** Vercel

## Setup

1. **Firebase**
   - Create a project at [Firebase Console](https://console.firebase.google.com).
   - Enable **Authentication** → Sign-in method → **Email/Password** and **Google**.
   - Create a **Firestore** database.
   - In Project settings → General, copy the Firebase config and update `src/lib/firebase.js` if your project is different from the default (whiterock-ims).

2. **Firestore indexes**
   - In Firestore → Indexes, create composite indexes when the app asks for them, or deploy:
   - `firebase deploy --only firestore:indexes` (if using Firebase CLI with `firestore.indexes.json`).

3. **Security rules**
   - In Firestore → Rules, paste the contents of `firestore.rules` (or deploy with `firebase deploy --only firestore:rules`).
   - Rules require `request.auth != null` for all reads/writes.
   - **If you see "Missing or insufficient permissions"**: your live rules are likely not updated. Deploy rules: `firebase deploy --only firestore:rules` (after `firebase use <project-id>`), or copy `firestore.rules` into the Firebase Console → Firestore → Rules and click **Publish**.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Sign in with Google. **Only emails added under Members can sign in** — add the first admin in Firestore Console (members collection, add a doc with email, displayName, role: "Admin", createdAt: now) or sign in with an existing member account and use the Members page to add others.

## Deploy to Vercel

1. Push the repo to GitHub (or connect another Git provider).
2. In [Vercel](https://vercel.com), import the project.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy. The SPA rewrite is in `vercel.json`.

No server or env vars are required for the app; Firebase config is in the client (public). For a different Firebase project, use env vars (e.g. `VITE_FIREBASE_PROJECT_ID`) and read them in `src/lib/firebase.js`.

## App sections

- **Warehouse** – List and add warehouses; click to view and manage stock.
- **Current View** – Dashboard: stock levels, safety stock, days left, stock-out date, projected sales, total weight. Update closing stock manually.
- **Database (SKU Master)** – SKU CRUD (code, name, category, status, rates, weight).
- **Purchase Orders** – Create POs; 60-day window; set status to Pending / In Transit / Received. **Received** adds quantity to stock and logs a movement.
- **History** – Stock movement log with timestamps.
- **Members** – List of allowed members (only these emails can sign in with Google). Add by email + name + role; edit or remove. No password — members sign in with Google only.

All data updates in real time via Firestore listeners.

## Members (Google-only allow-list)

Only users listed in **Members** can sign in. Admins add members by email (and optional name and role); those users then sign in with Google (no password). Add/Edit/Delete members use Firestore directly — no API or service account needed.

**Add the first admin from the repo (no Console):**

1. Firebase Console → Project settings → **Service accounts** → **Generate new private key** → save the JSON.
2. In the project root create a `.env` file with one line (paste the JSON as a single line, no line breaks):
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"whiterock-ims",...}
   ```
3. Run:
   ```bash
   npm install
   npm run seed-member -- your@gmail.com "Your Name" Admin
   ```
   Replace `your@gmail.com` and `"Your Name"` with the Google email and name for the first admin.
4. Sign in with Google in the app using that email.
