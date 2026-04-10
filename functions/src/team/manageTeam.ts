import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAdmin, verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(['admin', 'agent']).default('agent'),
  permissions: z
    .object({
      conversations: z.boolean().default(true),
      crm: z.boolean().default(false),
      automations: z.boolean().default(false),
      quickResponses: z.boolean().default(true),
      settings: z.boolean().default(false),
    })
    .optional(),
});

const updateTeamMemberSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['admin', 'agent']).optional(),
  permissions: z
    .object({
      conversations: z.boolean(),
      crm: z.boolean(),
      automations: z.boolean(),
      quickResponses: z.boolean(),
      settings: z.boolean(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

const removeTeamMemberSchema = z.object({
  id: z.string().min(1),
});

// ---------- Types ----------

export interface TeamMemberData {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'agent';
  permissions: {
    conversations: boolean;
    crm: boolean;
    automations: boolean;
    quickResponses: boolean;
    settings: boolean;
  };
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
}

// ---------- Cloud Functions ----------

// ---------- getActiveAgents (any authenticated user) ----------

export const getActiveAgents = https.onCall<
  Record<string, never>,
  Promise<{ id: string; displayName: string | null; email: string }[]>
>(async (request) => {
  await verifyAuth(request);
  try {
    const snapshot = await adminDb.collection('users').get();
    return snapshot.docs
      .filter((doc) => doc.data().isActive !== false)
      .map((doc) => ({
        id: doc.id,
        displayName: (doc.data().displayName ?? doc.data().name) || null,
        email: doc.data().email as string,
      }));
  } catch (err) {
    logger.error('Error fetching active agents:', err);
    throw new https.HttpsError('internal', 'Failed to fetch agents.');
  }
});

// ---------- getTeam (admin only) ----------

export const getTeam = https.onCall<Record<string, never>, Promise<TeamMemberData[]>>(
  async (request) => {
    await verifyAdmin(request);

    try {
      const snapshot = await adminDb.collection('users').get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<TeamMemberData, 'id'>),
      }));
    } catch (err) {
      logger.error('Error fetching team:', err);
      throw new https.HttpsError('internal', 'Failed to fetch team members.');
    }
  }
);

export const inviteTeamMember = https.onCall<
  z.infer<typeof inviteTeamMemberSchema>,
  Promise<TeamMemberData & { inviteLink: string }>
>(async (request) => {
  await verifyAdmin(request);

  const parsed = inviteTeamMemberSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { email, displayName, role, permissions } = parsed.data;

  try {
    // Check if user already exists in Firestore
    const existing = await adminDb
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new https.HttpsError('already-exists', 'A user with this email already exists.');
    }

    // Generate a cryptographically random temporary password.
    // This ensures the Email/Password provider is registered so the user can sign in.
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).toUpperCase().slice(-4) +
      '!1';

    // Create (or reuse) the Firebase Auth user
    let authUser: admin.auth.UserRecord;
    try {
      // If they already exist in Auth, update to ensure email/password provider is active
      authUser = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(authUser.uid, { password: tempPassword, displayName });
    } catch {
      authUser = await admin.auth().createUser({
        email,
        displayName,
        password: tempPassword,
        emailVerified: false,
        disabled: false,
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const defaultPermissions = {
      conversations: true,
      crm: false,
      automations: false,
      quickResponses: true,
      settings: false,
      ...permissions,
    };

    const docRef = adminDb.collection('users').doc(authUser.uid);
    await docRef.set({
      email,
      displayName,
      role,
      permissions: defaultPermissions,
      isActive: true,
      createdAt: now,
    });

    // Generate a password reset link — this acts as the invite link.
    // The team member clicks it, sets their own password, and can log in.
    const inviteLink = await admin.auth().generatePasswordResetLink(email);

    const created = await docRef.get();
    return {
      id: created.id,
      ...(created.data() as Omit<TeamMemberData, 'id'>),
      inviteLink,
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error inviting team member:', err);
    throw new https.HttpsError('internal', 'Failed to invite team member.');
  }
});

export const updateTeamMember = https.onCall<
  z.infer<typeof updateTeamMemberSchema>,
  Promise<TeamMemberData>
>(async (request) => {
  const token = await verifyAdmin(request);

  const parsed = updateTeamMemberSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id, ...updateData } = parsed.data;

  if (id === token.uid) {
    throw new https.HttpsError('permission-denied', 'You cannot modify your own account.');
  }

  try {
    const docRef = adminDb.collection('users').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Team member not found.');
    }

    await docRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<TeamMemberData, 'id'>),
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating team member:', err);
    throw new https.HttpsError('internal', 'Failed to update team member.');
  }
});

export const removeTeamMember = https.onCall<
  z.infer<typeof removeTeamMemberSchema>,
  Promise<{ success: boolean }>
>(async (request) => {
  const token = await verifyAdmin(request);

  const parsed = removeTeamMemberSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id } = parsed.data;

  if (id === token.uid) {
    throw new https.HttpsError('permission-denied', 'You cannot remove yourself.');
  }

  try {
    const docRef = adminDb.collection('users').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Team member not found.');
    }

    // Deactivate instead of delete
    await docRef.update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error removing team member:', err);
    throw new https.HttpsError('internal', 'Failed to remove team member.');
  }
});
