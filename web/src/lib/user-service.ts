import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from './firebase';
import type { User } from './types';

export async function getUserById(uid: string): Promise<User> {
  const db = getFirestore(app);
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('User not found');
  return { uid, ...(snap.data() as Omit<User, 'uid'>) };
}
