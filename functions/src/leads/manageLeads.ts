import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const CRM_STAGES = ['nuevos', 'proforma', 'venta', 'completado', 'perdido'] as const;

const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  stage: z.enum(CRM_STAGES).default('nuevos'),
  notes: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});

const updateLeadSchema = createLeadSchema.partial().extend({
  id: z.string().min(1),
});

const deleteLeadSchema = z.object({
  id: z.string().min(1),
});

const getLeadsSchema = z.object({
  limit: z.number().int().positive().max(500).default(100),
  startAfter: z.string().optional(),
});

// ---------- Types ----------

type CreateLeadRequest = z.infer<typeof createLeadSchema>;
type UpdateLeadRequest = z.infer<typeof updateLeadSchema>;
type DeleteLeadRequest = z.infer<typeof deleteLeadSchema>;
type GetLeadsRequest = z.infer<typeof getLeadsSchema>;

interface LeadData {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  stage: typeof CRM_STAGES[number];
  notes?: string | null;
  value?: string | null;
  source?: string | null;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ---------- Cloud Functions ----------

export const getLeads = https.onCall<
  GetLeadsRequest,
  Promise<LeadData[]>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = getLeadsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { limit, startAfter } = parsed.data;

  try {
    let query = adminDb
      .collection('leads')
      .where('ownerId', '==', authToken.uid)
      .orderBy('createdAt', 'asc')
      .limit(limit);

    if (startAfter) {
      const startDoc = await adminDb.collection('leads').doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<LeadData, 'id'>),
    }));
  } catch (err) {
    logger.error('Error fetching leads:', err);
    throw new https.HttpsError('internal', 'Failed to fetch leads.');
  }
});

export const createLead = https.onCall<
  CreateLeadRequest,
  Promise<LeadData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = createLeadSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('leads').add({
      ...parsed.data,
      ownerId: authToken.uid,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await docRef.get();
    return {
      id: doc.id,
      ...(doc.data() as Omit<LeadData, 'id'>),
    };
  } catch (err) {
    logger.error('Error creating lead:', err);
    throw new https.HttpsError('internal', 'Failed to create lead.');
  }
});

export const updateLead = https.onCall<
  UpdateLeadRequest,
  Promise<LeadData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = updateLeadSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id, ...updateData } = parsed.data;

  try {
    const docRef = adminDb.collection('leads').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Lead not found.');
    }

    const existingData = existing.data() as LeadData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to update this lead.'
      );
    }

    await docRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<LeadData, 'id'>),
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating lead:', err);
    throw new https.HttpsError('internal', 'Failed to update lead.');
  }
});

export const deleteLead = https.onCall<
  DeleteLeadRequest,
  Promise<{ success: boolean }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = deleteLeadSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id } = parsed.data;

  try {
    const docRef = adminDb.collection('leads').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Lead not found.');
    }

    const existingData = existing.data() as LeadData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to delete this lead.'
      );
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error deleting lead:', err);
    throw new https.HttpsError('internal', 'Failed to delete lead.');
  }
});
