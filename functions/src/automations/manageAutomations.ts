import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const triggerSchema = z.object({
  type: z.enum(['message_received', 'keyword_match', 'time_based']),
  conditions: z.record(z.unknown()).optional(),
});

const actionSchema = z.object({
  type: z.enum(['send_message', 'assign_agent', 'add_label']),
  params: z.record(z.unknown()).optional(),
});

const createAutomationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: triggerSchema,
  actions: z.array(actionSchema).default([]),
  isActive: z.boolean().default(true),
});

const updateAutomationSchema = createAutomationSchema
  .partial()
  .extend({ id: z.string().min(1) });

const deleteAutomationSchema = z.object({
  id: z.string().min(1),
});

// ---------- Types ----------

export interface AutomationData {
  id: string;
  name: string;
  description: string | null;
  trigger: {
    type: 'message_received' | 'keyword_match' | 'time_based';
    conditions?: Record<string, unknown>;
  };
  actions: Array<{
    type: 'send_message' | 'assign_agent' | 'add_label';
    params?: Record<string, unknown>;
  }>;
  isActive: boolean;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ---------- Cloud Functions ----------

export const getAutomations = https.onCall<
  Record<string, never> | undefined,
  Promise<AutomationData[]>
>(async (request) => {
  const token = await verifyAuth(request);

  try {
    const snapshot = await adminDb
      .collection('automations')
      .where('ownerId', '==', token.uid)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<AutomationData, 'id'>),
    }));
  } catch (err) {
    logger.error('Error fetching automations:', err);
    throw new https.HttpsError('internal', 'Failed to fetch automations.');
  }
});

export const createAutomation = https.onCall<
  z.infer<typeof createAutomationSchema>,
  Promise<AutomationData>
>(async (request) => {
  const token = await verifyAuth(request);

  const parsed = createAutomationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('automations').add({
      ...parsed.data,
      description: parsed.data.description ?? null,
      ownerId: token.uid,
      createdAt: now,
      updatedAt: now,
    });

    const created = await docRef.get();
    return {
      id: created.id,
      ...(created.data() as Omit<AutomationData, 'id'>),
    };
  } catch (err) {
    logger.error('Error creating automation:', err);
    throw new https.HttpsError('internal', 'Failed to create automation.');
  }
});

export const updateAutomation = https.onCall<
  z.infer<typeof updateAutomationSchema>,
  Promise<AutomationData>
>(async (request) => {
  const token = await verifyAuth(request);

  const parsed = updateAutomationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id, ...updateData } = parsed.data;

  try {
    const docRef = adminDb.collection('automations').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Automation not found.');
    }

    const existingData = existing.data() as AutomationData;
    if (existingData.ownerId !== token.uid) {
      throw new https.HttpsError('permission-denied', 'Not authorized.');
    }

    await docRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<AutomationData, 'id'>),
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating automation:', err);
    throw new https.HttpsError('internal', 'Failed to update automation.');
  }
});

export const deleteAutomation = https.onCall<
  z.infer<typeof deleteAutomationSchema>,
  Promise<{ success: boolean }>
>(async (request) => {
  const token = await verifyAuth(request);

  const parsed = deleteAutomationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id } = parsed.data;

  try {
    const docRef = adminDb.collection('automations').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Automation not found.');
    }

    const existingData = existing.data() as AutomationData;
    if (existingData.ownerId !== token.uid) {
      throw new https.HttpsError('permission-denied', 'Not authorized.');
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error deleting automation:', err);
    throw new https.HttpsError('internal', 'Failed to delete automation.');
  }
});
