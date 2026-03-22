import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminAuth, adminDb } from '../config/firebase-admin';
import { verifyAdmin } from '../middleware/auth';

const createUserAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['superAdmin', 'admin', 'agent', 'user']).default('user'),
});

type CreateUserAdminRequest = z.infer<typeof createUserAdminSchema>;

interface CreateUserAdminResponse {
  uid: string;
  email: string;
  name: string;
  role: string;
}

export const createUserAdmin = https.onCall<
  CreateUserAdminRequest,
  Promise<CreateUserAdminResponse>
>(async (request) => {
  await verifyAdmin(request);

  const parsed = createUserAdminSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { name, email, password, role } = parsed.data;

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });
  } catch (err) {
    logger.error('Error creating Firebase Auth user:', err);
    throw new https.HttpsError('internal', 'Failed to create user account.');
  }

  try {
    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error('Error creating Firestore user document:', err);
    // Rollback: delete the auth user if Firestore creation fails
    await adminAuth.deleteUser(userRecord.uid);
    throw new https.HttpsError('internal', 'Failed to create user record.');
  }

  return {
    uid: userRecord.uid,
    email,
    name,
    role,
  };
});
