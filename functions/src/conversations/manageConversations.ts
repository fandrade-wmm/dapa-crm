import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

// ---------- Schemas ----------

const getConversationsSchema = z.object({
  search: z.string().nullish().transform((v) => v ?? undefined),
  channel: z.enum(['all', 'whatsapp', 'instagram']).default('all'),
  status: z.enum(['all', 'active', 'resolved']).default('all'),
  limit: z.number().int().positive().max(200).default(100),
});

const getConversationSchema = z.object({
  id: z.string().min(1),
});

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1),
});

const addNoteSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1),
});

const toggleConversationAISchema = z.object({
  conversationId: z.string().min(1),
  aiEnabled: z.boolean(),
});

const updateConversationLabelsSchema = z.object({
  conversationId: z.string().min(1),
  labels: z.array(z.string()),
});

const markConversationReadSchema = z.object({
  conversationId: z.string().min(1),
});

// ---------- Types ----------

export interface ConversationData {
  id: string;
  customerPhone: string;
  customerName: string | null;
  status: 'active' | 'resolved';
  aiEnabled: boolean;
  labels: string[];
  unreadCount: number;
  channel: 'whatsapp' | 'instagram';
  lastMessage: string | null;
  ownerId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'image' | 'video' | 'document' | 'note';
  isInternalNote: boolean;
  createdAt: admin.firestore.Timestamp;
}

export interface ConversationWithMessages extends ConversationData {
  messages: MessageData[];
}

// ---------- Helpers ----------

async function assertConversationOwner(
  conversationId: string,
  uid: string
): Promise<admin.firestore.DocumentSnapshot> {
  const doc = await adminDb.collection('conversations').doc(conversationId).get();
  if (!doc.exists) {
    throw new https.HttpsError('not-found', 'Conversation not found.');
  }
  const data = doc.data() as ConversationData;
  if (data.ownerId !== uid) {
    throw new https.HttpsError('permission-denied', 'Access denied.');
  }
  return doc;
}

// ---------- Cloud Functions ----------

export const getConversations = https.onCall<
  z.infer<typeof getConversationsSchema>,
  Promise<ConversationData[]>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = getConversationsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { search, channel, status, limit } = parsed.data;

  try {
    let query: admin.firestore.Query = adminDb
      .collection('conversations')
      .where('ownerId', '==', authToken.uid)
      .orderBy('updatedAt', 'desc')
      .limit(limit);

    if (channel !== 'all') {
      query = query.where('channel', '==', channel);
    }
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<ConversationData, 'id'>),
    }));

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (c) =>
          c.customerName?.toLowerCase().includes(q) ||
          c.customerPhone.includes(q) ||
          c.lastMessage?.toLowerCase().includes(q)
      );
    }

    return results;
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error fetching conversations:', { message: (err as Error).message, stack: (err as Error).stack });
    throw new https.HttpsError('internal', 'Failed to fetch conversations.');
  }
});

export const getConversation = https.onCall<
  z.infer<typeof getConversationSchema>,
  Promise<ConversationWithMessages>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = getConversationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  try {
    const doc = await assertConversationOwner(parsed.data.id, authToken.uid);
    const messagesSnap = await adminDb
      .collection('conversations')
      .doc(parsed.data.id)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages: MessageData[] = messagesSnap.docs.map((m) => ({
      id: m.id,
      ...(m.data() as Omit<MessageData, 'id'>),
    }));

    return {
      id: doc.id,
      ...(doc.data() as Omit<ConversationData, 'id'>),
      messages,
    };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error fetching conversation:', err);
    throw new https.HttpsError('internal', 'Failed to fetch conversation.');
  }
});

export const sendMessage = https.onCall<
  z.infer<typeof sendMessageSchema>,
  Promise<MessageData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = sendMessageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId, content } = parsed.data;

  try {
    await assertConversationOwner(conversationId, authToken.uid);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const msgRef = await adminDb
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .add({
        role: 'assistant',
        content,
        messageType: 'text',
        isInternalNote: false,
        createdAt: now,
      });

    await adminDb.collection('conversations').doc(conversationId).update({
      lastMessage: content,
      updatedAt: now,
    });

    const msgDoc = await msgRef.get();
    return { id: msgDoc.id, ...(msgDoc.data() as Omit<MessageData, 'id'>) };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error sending message:', err);
    throw new https.HttpsError('internal', 'Failed to send message.');
  }
});

export const addNote = https.onCall<
  z.infer<typeof addNoteSchema>,
  Promise<MessageData>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = addNoteSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId, content } = parsed.data;

  try {
    await assertConversationOwner(conversationId, authToken.uid);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const msgRef = await adminDb
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .add({
        role: 'assistant',
        content,
        messageType: 'note',
        isInternalNote: true,
        createdAt: now,
      });

    await adminDb.collection('conversations').doc(conversationId).update({
      updatedAt: now,
    });

    const msgDoc = await msgRef.get();
    return { id: msgDoc.id, ...(msgDoc.data() as Omit<MessageData, 'id'>) };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error adding note:', err);
    throw new https.HttpsError('internal', 'Failed to add note.');
  }
});

export const toggleConversationAI = https.onCall<
  z.infer<typeof toggleConversationAISchema>,
  Promise<{ aiEnabled: boolean }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = toggleConversationAISchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId, aiEnabled } = parsed.data;

  try {
    await assertConversationOwner(conversationId, authToken.uid);
    await adminDb.collection('conversations').doc(conversationId).update({
      aiEnabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { aiEnabled };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error toggling AI:', err);
    throw new https.HttpsError('internal', 'Failed to toggle AI.');
  }
});

export const updateConversationLabels = https.onCall<
  z.infer<typeof updateConversationLabelsSchema>,
  Promise<{ labels: string[] }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = updateConversationLabelsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId, labels } = parsed.data;

  try {
    await assertConversationOwner(conversationId, authToken.uid);
    await adminDb.collection('conversations').doc(conversationId).update({
      labels,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { labels };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error updating labels:', err);
    throw new https.HttpsError('internal', 'Failed to update labels.');
  }
});

export const markConversationRead = https.onCall<
  z.infer<typeof markConversationReadSchema>,
  Promise<{ success: boolean }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = markConversationReadSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId } = parsed.data;

  try {
    await assertConversationOwner(conversationId, authToken.uid);
    await adminDb.collection('conversations').doc(conversationId).update({
      unreadCount: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error marking read:', err);
    throw new https.HttpsError('internal', 'Failed to mark as read.');
  }
});
