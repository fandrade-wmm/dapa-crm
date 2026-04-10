/**
 * One-time script to create the first superAdmin user.
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password> "<Full Name>" [role]
 *
 * Example:
 *   node scripts/create-admin.js pancho@empresa.com MyPass123 "Francisco Andrade" superAdmin
 *
 * Role options: superAdmin | admin (default: admin)
 */

const admin = require('../functions/node_modules/firebase-admin');

const [,, email, password, name, roleArg] = process.argv;

if (!email || !password || !name) {
  console.error('\nUsage: node scripts/create-admin.js <email> <password> "<Full Name>" [superAdmin|admin]');
  console.error('Example: node scripts/create-admin.js pancho@empresa.com MyPass123 "Francisco Andrade" superAdmin\n');
  process.exit(1);
}

const role = roleArg === 'superAdmin' ? 'superAdmin' : 'admin';

admin.initializeApp({ projectId: 'dapa-crm-assistant' });
const auth = admin.auth();
const db = admin.firestore();

async function main() {
  console.log(`\nCreating ${role}: ${email} (${name}) ...`);

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: name });
    console.log('✓ Firebase Auth user created');
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
      console.log('✓ User already exists in Auth — updating Firestore record');
    } else {
      throw err;
    }
  }

  await db.collection('users').doc(userRecord.uid).set({
    name,
    email,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log('✓ Firestore user document written');
  console.log(`\n✅ Done!`);
  console.log(`   UID:   ${userRecord.uid}`);
  console.log(`   Email: ${email}`);
  console.log(`   Role:  ${role}`);
  console.log('\nLog in at the app with these credentials.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
