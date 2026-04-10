import { https, logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

// ---------- Types ----------

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  ownerId: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ---------- getCatalogs ----------

export const getCatalogs = https.onCall<Record<string, never>, Promise<Catalog[]>>(
  {},
  async (request) => {
    const auth = await verifyAuth(request);
    const db = getFirestore();

    const snap = await db
      .collection('catalogs')
      .where('ownerId', '==', auth.uid)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Catalog));
  }
);

// ---------- createCatalog ----------

interface CreateCatalogInput {
  name: string;
  description?: string;
  fileUrl: string;
  fileName: string;
}

export const createCatalog = https.onCall<CreateCatalogInput, Promise<Catalog>>(
  {},
  async (request) => {
    const auth = await verifyAuth(request);
    const { name, description, fileUrl, fileName } = request.data;

    if (!name || !fileUrl || !fileName) {
      throw new https.HttpsError('invalid-argument', 'name, fileUrl and fileName are required.');
    }

    const db = getFirestore();
    const ref = db.collection('catalogs').doc();

    const data = {
      name,
      description: description ?? null,
      fileUrl,
      fileName,
      ownerId: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await ref.set(data);
    logger.info(`Catalog created: ${ref.id} by ${auth.uid}`);

    const snap = await ref.get();
    return { id: snap.id, ...snap.data() } as Catalog;
  }
);

// ---------- updateCatalog ----------

interface UpdateCatalogInput {
  id: string;
  name?: string;
  description?: string | null;
}

export const updateCatalog = https.onCall<UpdateCatalogInput, Promise<Catalog>>(
  {},
  async (request) => {
    const auth = await verifyAuth(request);
    const { id, ...updates } = request.data;

    if (!id) throw new https.HttpsError('invalid-argument', 'id is required.');

    const db = getFirestore();
    const ref = db.collection('catalogs').doc(id);
    const snap = await ref.get();

    if (!snap.exists) throw new https.HttpsError('not-found', 'Catalog not found.');
    if (snap.data()!.ownerId !== auth.uid) {
      throw new https.HttpsError('permission-denied', 'Not your catalog.');
    }

    await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    const updated = await ref.get();
    return { id: updated.id, ...updated.data() } as Catalog;
  }
);

// ---------- deleteCatalog ----------

export const deleteCatalog = https.onCall<{ id: string }, Promise<{ success: boolean }>>(
  {},
  async (request) => {
    const auth = await verifyAuth(request);
    const { id } = request.data;

    if (!id) throw new https.HttpsError('invalid-argument', 'id is required.');

    const db = getFirestore();
    const ref = db.collection('catalogs').doc(id);
    const snap = await ref.get();

    if (!snap.exists) throw new https.HttpsError('not-found', 'Catalog not found.');
    if (snap.data()!.ownerId !== auth.uid) {
      throw new https.HttpsError('permission-denied', 'Not your catalog.');
    }

    await ref.delete();
    logger.info(`Catalog deleted: ${id} by ${auth.uid}`);
    return { success: true };
  }
);
