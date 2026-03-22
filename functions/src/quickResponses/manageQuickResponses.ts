import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const createQuickResponseSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().default(''),
  sortOrder: z.number().int().default(0),
});

const updateQuickResponseSchema = createQuickResponseSchema.partial().extend({
  id: z.string().min(1),
});

const deleteQuickResponseSchema = z.object({
  id: z.string().min(1),
});

// ---------- Types ----------

type CreateQuickResponseRequest = z.infer<typeof createQuickResponseSchema>;
type UpdateQuickResponseRequest = z.infer<typeof updateQuickResponseSchema>;
type DeleteQuickResponseRequest = z.infer<typeof deleteQuickResponseSchema>;

interface QuickResponseData {
  id: string;
  title: string;
  content: string;
  category: string;
  sortOrder: number;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ---------- Cloud Functions ----------

export const getQuickResponses = https.onCall<
  Record<string, never> | undefined,
  Promise<QuickResponseData[]>
>(async (request) => {
  const authToken = await verifyAuth(request);

  try {
    const snapshot = await adminDb
      .collection('quickResponses')
      .where('ownerId', '==', authToken.uid)
      .orderBy('sortOrder', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<QuickResponseData, 'id'>),
    }));
  } catch (err) {
    logger.error('Error fetching quick responses:', err);
    throw new https.HttpsError('internal', 'Failed to fetch quick responses.');
  }
});

export const createQuickResponse = https.onCall<
  CreateQuickResponseRequest,
  Promise<QuickResponseData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = createQuickResponseSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('quickResponses').add({
      ...parsed.data,
      ownerId: authToken.uid,
      createdAt: now,
      updatedAt: now,
    });

    const created = await docRef.get();
    return {
      id: created.id,
      ...(created.data() as Omit<QuickResponseData, 'id'>),
    };
  } catch (err) {
    logger.error('Error creating quick response:', err);
    throw new https.HttpsError('internal', 'Failed to create quick response.');
  }
});

export const updateQuickResponse = https.onCall<
  UpdateQuickResponseRequest,
  Promise<QuickResponseData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = updateQuickResponseSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id, ...updateData } = parsed.data;

  try {
    const docRef = adminDb.collection('quickResponses').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Quick response not found.');
    }

    const existingData = existing.data() as QuickResponseData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to update this quick response.'
      );
    }

    await docRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<QuickResponseData, 'id'>),
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating quick response:', err);
    throw new https.HttpsError('internal', 'Failed to update quick response.');
  }
});

export const deleteQuickResponse = https.onCall<
  DeleteQuickResponseRequest,
  Promise<{ success: boolean }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = deleteQuickResponseSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id } = parsed.data;

  try {
    const docRef = adminDb.collection('quickResponses').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Quick response not found.');
    }

    const existingData = existing.data() as QuickResponseData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to delete this quick response.'
      );
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error deleting quick response:', err);
    throw new https.HttpsError('internal', 'Failed to delete quick response.');
  }
});
