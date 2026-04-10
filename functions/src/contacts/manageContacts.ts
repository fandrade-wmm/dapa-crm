import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Helpers ----------

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function buildFullName(firstName: string, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

// ---------- Schemas ----------

const contactUpsertSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().optional().nullable(),
  cedulaRuc: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
});

const updateContactSchema = contactUpsertSchema.partial().extend({
  id: z.string().min(1),
});

const deleteContactSchema = z.object({ id: z.string().min(1) });

const getContactsSchema = z.object({
  limit: z.number().int().positive().max(200).default(100),
  search: z.string().optional().nullable(),
  startAfter: z.string().optional(),
});

const getContactByPhoneSchema = z.object({
  phone: z.string().min(1),
});

// ---------- Types ----------

export interface ContactData {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  cedulaRuc: string | null;
  email: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  address: string | null;
  city: string | null;
  company: string | null;
  tags: string[];
  source: string;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ---------- getContacts ----------

export const getContacts = https.onCall<
  z.infer<typeof getContactsSchema>,
  Promise<ContactData[]>
>(async (request) => {
  const auth = await verifyAuth(request);
  const parsed = getContactsSchema.safeParse(request.data);
  if (!parsed.success) throw new https.HttpsError('invalid-argument', parsed.error.message);

  const { limit, search, startAfter } = parsed.data;

  try {
    let query = adminDb
      .collection('contacts')
      .where('ownerId', '==', auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (startAfter) {
      const startDoc = await adminDb.collection('contacts').doc(startAfter).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }

    const snap = await query.get();
    let results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ContactData));

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (c) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.cedulaRuc?.includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
      );
    }

    return results;
  } catch (err) {
    logger.error('getContacts error:', err);
    throw new https.HttpsError('internal', 'Failed to fetch contacts.');
  }
});

// ---------- getContactByPhone ----------

export const getContactByPhone = https.onCall<
  z.infer<typeof getContactByPhoneSchema>,
  Promise<ContactData | null>
>(async (request) => {
  const auth = await verifyAuth(request);
  const parsed = getContactByPhoneSchema.safeParse(request.data);
  if (!parsed.success) throw new https.HttpsError('invalid-argument', parsed.error.message);

  const normalized = normalizePhone(parsed.data.phone);

  const snap = await adminDb
    .collection('contacts')
    .where('ownerId', '==', auth.uid)
    .where('phoneNormalized', '==', normalized)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as ContactData;
});

// ---------- createContact ----------

export const createContact = https.onCall<
  z.infer<typeof contactUpsertSchema>,
  Promise<ContactData>
>(async (request) => {
  const auth = await verifyAuth(request);
  const parsed = contactUpsertSchema.safeParse(request.data);
  if (!parsed.success) throw new https.HttpsError('invalid-argument', parsed.error.message);

  const data = parsed.data;
  const phoneNormalized = data.phone ? normalizePhone(data.phone) : null;
  const fullName = buildFullName(data.firstName, data.lastName);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    // Prevent duplicates: if a contact with this phone already exists, update it instead
    if (phoneNormalized) {
      const existing = await adminDb
        .collection('contacts')
        .where('ownerId', '==', auth.uid)
        .where('phoneNormalized', '==', phoneNormalized)
        .limit(1)
        .get();

      if (!existing.empty) {
        const ref = existing.docs[0].ref;
        await ref.update({
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          fullName,
          cedulaRuc: data.cedulaRuc ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          phoneNormalized,
          address: data.address ?? null,
          city: data.city ?? null,
          company: data.company ?? null,
          tags: data.tags,
          updatedAt: now,
        });
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ContactData;
      }
    }

    const ref = await adminDb.collection('contacts').add({
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      fullName,
      cedulaRuc: data.cedulaRuc ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      phoneNormalized,
      address: data.address ?? null,
      city: data.city ?? null,
      company: data.company ?? null,
      tags: data.tags,
      source: 'manual',
      ownerId: auth.uid,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as ContactData;
  } catch (err) {
    logger.error('createContact error:', err);
    throw new https.HttpsError('internal', 'Failed to create contact.');
  }
});

// ---------- updateContact ----------

export const updateContact = https.onCall<
  z.infer<typeof updateContactSchema>,
  Promise<ContactData>
>(async (request) => {
  const auth = await verifyAuth(request);
  const parsed = updateContactSchema.safeParse(request.data);
  if (!parsed.success) throw new https.HttpsError('invalid-argument', parsed.error.message);

  const { id, ...updates } = parsed.data;

  try {
    const ref = adminDb.collection('contacts').doc(id);
    const existing = await ref.get();
    if (!existing.exists) throw new https.HttpsError('not-found', 'Contact not found.');
    if ((existing.data() as ContactData).ownerId !== auth.uid) {
      throw new https.HttpsError('permission-denied', 'Access denied.');
    }

    const existingData = existing.data() as ContactData;
    const firstName = updates.firstName ?? existingData.firstName;
    const lastName = updates.lastName !== undefined ? updates.lastName : existingData.lastName;
    const fullName = buildFullName(firstName, lastName);

    const phoneNormalized =
      updates.phone !== undefined
        ? updates.phone ? normalizePhone(updates.phone) : null
        : existingData.phoneNormalized;

    await ref.update({
      ...updates,
      fullName,
      phoneNormalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update linked conversations if name changed
    if (updates.firstName || updates.lastName !== undefined) {
      const convSnap = await adminDb
        .collection('conversations')
        .where('contactId', '==', id)
        .get();
      const batch = adminDb.batch();
      convSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { customerName: fullName });
      });
      if (!convSnap.empty) await batch.commit();
    }

    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as ContactData;
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('updateContact error:', err);
    throw new https.HttpsError('internal', 'Failed to update contact.');
  }
});

// ---------- deduplicateContacts ----------

export const deduplicateContacts = https.onCall<
  Record<string, never>,
  Promise<{ merged: number; deleted: number }>
>(async (request) => {
  const auth = await verifyAuth(request);

  const snap = await adminDb
    .collection('contacts')
    .where('ownerId', '==', auth.uid)
    .get();

  // Group contacts by normalized phone
  const groups = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();

  for (const doc of snap.docs) {
    const data = doc.data();
    const raw: string = data.phoneNormalized ?? (data.phone ? normalizePhone(data.phone) : '');
    const key = raw || `__no_phone_${doc.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(doc);
  }

  let merged = 0;
  let deleted = 0;

  for (const [key, docs] of groups) {
    if (docs.length <= 1 || key.startsWith('__no_phone_')) continue;

    // Pick winner: prefer contacts with a real name (not just phone digits), then most fields
    const score = (d: admin.firestore.QueryDocumentSnapshot) => {
      const data = d.data();
      const name: string = data.firstName ?? data.name ?? '';
      const isRealName = name && !/^\d+$/.test(name) && name !== (data.phone ?? '');
      return (
        (isRealName ? 100 : 0) +
        (data.lastName ? 10 : 0) +
        (data.email ? 5 : 0) +
        (data.cedulaRuc ? 5 : 0) +
        (data.company ? 3 : 0) +
        (data.city ? 2 : 0)
      );
    };

    docs.sort((a, b) => score(b) - score(a));
    const winner = docs[0];
    const losers = docs.slice(1);

    // Ensure winner has phoneNormalized set
    const winnerData = winner.data();
    if (!winnerData.phoneNormalized) {
      await winner.ref.update({
        phoneNormalized: key,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Re-point conversations and leads from losers → winner
    for (const loser of losers) {
      const loserId = loser.id;

      const convSnap = await adminDb
        .collection('conversations')
        .where('contactId', '==', loserId)
        .get();
      if (!convSnap.empty) {
        const batch = adminDb.batch();
        convSnap.docs.forEach((d) => batch.update(d.ref, { contactId: winner.id }));
        await batch.commit();
      }

      const leadSnap = await adminDb
        .collection('leads')
        .where('contactId', '==', loserId)
        .get();
      if (!leadSnap.empty) {
        const batch = adminDb.batch();
        leadSnap.docs.forEach((d) => batch.update(d.ref, { contactId: winner.id }));
        await batch.commit();
      }

      await loser.ref.delete();
      deleted++;
    }

    merged++;
    logger.info(`Merged ${docs.length} contacts for phone ${key} → winner ${winner.id}`);
  }

  logger.info(`deduplicateContacts: merged ${merged} groups, deleted ${deleted} duplicates`);
  return { merged, deleted };
});

// ---------- deleteContact ----------

export const deleteContact = https.onCall<
  z.infer<typeof deleteContactSchema>,
  Promise<{ success: boolean }>
>(async (request) => {
  const auth = await verifyAuth(request);
  const parsed = deleteContactSchema.safeParse(request.data);
  if (!parsed.success) throw new https.HttpsError('invalid-argument', parsed.error.message);

  const { id } = parsed.data;

  try {
    const ref = adminDb.collection('contacts').doc(id);
    const existing = await ref.get();
    if (!existing.exists) throw new https.HttpsError('not-found', 'Contact not found.');
    if ((existing.data() as ContactData).ownerId !== auth.uid) {
      throw new https.HttpsError('permission-denied', 'Access denied.');
    }

    await ref.delete();
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('deleteContact error:', err);
    throw new https.HttpsError('internal', 'Failed to delete contact.');
  }
});
