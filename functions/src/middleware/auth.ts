import * as admin from 'firebase-admin';
import { https } from 'firebase-functions/v2';
import { adminAuth, adminDb } from '../config/firebase-admin';

/**
 * Verifies that the caller is authenticated and returns their decoded token.
 * Throws an HttpsError if unauthenticated.
 */
export async function verifyAuth(
  context: https.CallableRequest
): Promise<admin.auth.DecodedIdToken> {
  if (!context.auth) {
    throw new https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const decodedToken = await adminAuth.verifyIdToken(context.auth.token);
  return decodedToken;
}

/**
 * Verifies that the caller is an admin (role: admin or superAdmin).
 */
export async function verifyAdmin(
  context: https.CallableRequest
): Promise<admin.auth.DecodedIdToken> {
  const decodedToken = await verifyAuth(context);
  const userDoc = await adminDb
    .collection('users')
    .doc(decodedToken.uid)
    .get();

  const role = userDoc.data()?.role as string | undefined;
  if (!userDoc.exists || !['admin', 'superAdmin'].includes(role ?? '')) {
    throw new https.HttpsError(
      'permission-denied',
      'Only admins can perform this action.'
    );
  }

  return decodedToken;
}
