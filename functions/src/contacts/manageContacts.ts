import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const createContactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateContactSchema = createContactSchema.partial().extend({
  id: z.string().min(1),
});

const deleteContactSchema = z.object({
  id: z.string().min(1),
});

const getContactsSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  startAfter: z.string().optional(),
});

// ---------- Types ----------

type CreateContactRequest = z.infer<typeof createContactSchema>;
type UpdateContactRequest = z.infer<typeof updateContactSchema>;
type DeleteContactRequest = z.infer<typeof deleteContactSchema>;
type GetContactsRequest = z.infer<typeof getContactsSchema>;

interface ContactData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ---------- Cloud Functions ----------

export const getContacts = https.onCall<
  GetContactsRequest,
  Promise<ContactData[]>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = getContactsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { limit, startAfter } = parsed.data;

  try {
    let query = adminDb
      .collection('contacts')
      .where('ownerId', '==', authToken.uid)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (startAfter) {
      const startDoc = await adminDb.collection('contacts').doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<ContactData, 'id'>),
    }));
  } catch (err) {
    logger.error('Error fetching contacts:', err);
    throw new https.HttpsError('internal', 'Failed to fetch contacts.');
  }
});

export const createContact = https.onCall<
  CreateContactRequest,
  Promise<ContactData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = createContactSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await adminDb.collection('contacts').add({
      ...parsed.data,
      ownerId: authToken.uid,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await docRef.get();
    return {
      id: doc.id,
      ...(doc.data() as Omit<ContactData, 'id'>),
    };
  } catch (err) {
    logger.error('Error creating contact:', err);
    throw new https.HttpsError('internal', 'Failed to create contact.');
  }
});

export const updateContact = https.onCall<
  UpdateContactRequest,
  Promise<ContactData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = updateContactSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id, ...updateData } = parsed.data;

  try {
    const docRef = adminDb.collection('contacts').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Contact not found.');
    }

    const existingData = existing.data() as ContactData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to update this contact.'
      );
    }

    await docRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<ContactData, 'id'>),
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating contact:', err);
    throw new https.HttpsError('internal', 'Failed to update contact.');
  }
});

export const deleteContact = https.onCall<
  DeleteContactRequest,
  Promise<{ success: boolean }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = deleteContactSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError(
      'invalid-argument',
      'Invalid request data: ' + parsed.error.message
    );
  }

  const { id } = parsed.data;

  try {
    const docRef = adminDb.collection('contacts').doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new https.HttpsError('not-found', 'Contact not found.');
    }

    const existingData = existing.data() as ContactData;
    if (existingData.ownerId !== authToken.uid) {
      throw new https.HttpsError(
        'permission-denied',
        'You do not have permission to delete this contact.'
      );
    }

    await docRef.delete();
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error deleting contact:', err);
    throw new https.HttpsError('internal', 'Failed to delete contact.');
  }
});
