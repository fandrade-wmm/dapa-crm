/**
 * Seed script: creates 3 admin users in Firebase Auth + Firestore.
 *
 * Prerequisites:
 *   1. Install firebase-admin:  npm install -D firebase-admin
 *   2. Download a service account key from Firebase Console:
 *      Project Settings → Service accounts → Generate new private key
 *   3. Save it as  scripts/service-account.json  (already in .gitignore)
 *   4. Run:  node scripts/seed-users.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const DEFAULT_PASSWORD = 'WebMyMoney2024!';

const USERS = [
  {
    email: 'fandrade@webmymoney.com',
    displayName: 'F. Andrade',
    role: 'admin',
  },
  {
    email: 'manuel@webmymoney.com',
    displayName: 'Manuel',
    role: 'admin',
  },
  {
    email: 'admin@webmymoney.com',
    displayName: 'Admin',
    role: 'admin',
  },
];

async function seedUser({ email, displayName, role }) {
  let uid;

  // Try to get existing user first
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`✓ Auth user already exists: ${email} (${uid})`);
  } catch {
    // User doesn't exist — create it
    const created = await auth.createUser({
      email,
      displayName,
      password: DEFAULT_PASSWORD,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`✓ Created Auth user: ${email} (${uid})`);
  }

  // Upsert Firestore document
  const docRef = db.collection('users').doc(uid);
  const snap = await docRef.get();

  if (snap.exists) {
    console.log(`  → Firestore doc already exists for ${email}, skipping.`);
  } else {
    await docRef.set({
      email,
      displayName,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    console.log(`  → Firestore doc created for ${email}`);
  }
}

async function main() {
  console.log('Seeding users into Firebase Auth + Firestore…\n');
  for (const user of USERS) {
    await seedUser(user);
  }
  console.log('\nDone!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
