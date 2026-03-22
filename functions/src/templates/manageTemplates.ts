import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const createTemplateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  content: z.string().min(1),
  language: z.string().default('es'),
  isActive: z.boolean().default(true),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
  id: z.string().min(1),
});

const deleteTemplateSchema = z.object({
  id: z.string().min(1),
});

// ---------- Types ----------

type CreateTemplateRequest = z.infer<typeof createTemplateSchema>;
type UpdateTemplateRequest = z.infer<typeof updateTemplateSchema>;
type DeleteTemplateRequest = z.infer<typeof deleteTemplateSchema>;

interface TemplateData {
  id: string;
  name: string;
  category: string;
  content: string;
  language: string;
  isActive: boolean;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ---------- Cloud Functions ----------

export const getTemplates = https.onCall<
  Record<string, never> | undefined,
  Promise<TemplateData[]>
>(async (request) => {
  const authToken = await verifyAuth(request);

  try {
    const snapshot = await adminDb
      .collection('templates')
      .where('ownerId', '==', authToken.uid)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<TemplateData, 'id'>),
    }));
  } catch (err) {
    logger.error('Error fetching templates:', err);
    throw new https.HttpsError('internal', 'Failed to fetch templates.');
  }
});

export const createTemplate = https.onCall<
  CreateTemplateRequest,
  Promise<TemplateData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = createTemplateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('templates').add({
      ...parsed.data,
      ownerId: authToken.uid,
      createdAt: now,
      updatedAt: now,
    });

    const created = await docRef.get();
    return {
      id: created.id,
      ...(created.data() as Omit<TemplateData, 'id'>),
    };
  } catch (err) {
    logger.error('Error creating template:', err);
    throw new https.HttpsError('internal', 'Failed to create template.');
  }
});

export const updateTemplate = https.onCall<
  UpdateTemplateRequest,
  Promise<TemplateData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = updateTemplateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id, ...updateData } = parsed.data;

  try {
    const docRef = adminDb.collection('templates').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Template not found.');
    }

    const existingData = existing.data() as TemplateData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to update this template.'
      );
    }

    await docRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<TemplateData, 'id'>),
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating template:', err);
    throw new https.HttpsError('internal', 'Failed to update template.');
  }
});

export const deleteTemplate = https.onCall<
  DeleteTemplateRequest,
  Promise<{ success: boolean }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = deleteTemplateSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id } = parsed.data;

  try {
    const docRef = adminDb.collection('templates').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Template not found.');
    }

    const existingData = existing.data() as TemplateData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to delete this template.'
      );
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error deleting template:', err);
    throw new https.HttpsError('internal', 'Failed to delete template.');
  }
});
