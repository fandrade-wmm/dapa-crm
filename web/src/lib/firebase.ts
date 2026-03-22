import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_NAME
    ? `https://${process.env.NEXT_PUBLIC_FIREBASE_DATABASE_NAME}.firebaseio.com`
    : undefined,
};

// Singleton pattern
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_EMULATOR === 'true'
) {
  const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreEmulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;

  if (authEmulatorHost) {
    connectAuthEmulator(auth, `http://${authEmulatorHost}`, {
      disableWarnings: true,
    });
  }

  if (firestoreEmulatorHost) {
    const [host, port] = firestoreEmulatorHost.split(':');
    connectFirestoreEmulator(db, host, parseInt(port ?? '8080', 10));
  }

  connectFunctionsEmulator(functions, 'localhost', 5001);
}
