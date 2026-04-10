import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';
import { sendTextMessage, toChatId } from '../handlers/whapi/whapiClient';

const whapiApiToken = defineSecret('WHAPI_API_TOKEN');

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

const assignConversationSchema = z.object({
  conversationId: z.string().min(1),
  assignedTo: z.string().nullable(),
  assignedToName: z.string().nullable(),
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
  assignedTo: string | null;
  assignedToName: string | null;
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
      // Strip non-digits for phone matching (handles "+593...", "593...", "09..." etc.)
      const qDigits = search.replace(/\D/g, '');
      results = results.filter(
        (c) =>
          c.customerName?.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && c.customerPhone.includes(qDigits)) ||
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
>({ secrets: [whapiApiToken] }, async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = sendMessageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId, content } = parsed.data;

  try {
    const convDoc = await assertConversationOwner(conversationId, authToken.uid);
    const convData = convDoc.data() as ConversationData;

    const token = whapiApiToken.value();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const clientNow = admin.firestore.Timestamp.now();

    // Step 1: Send via Whapi first so we get the Whapi message ID.
    // Using that ID as the Firestore document ID makes the webhook's
    // idempotency check (doc(msg.id).exists) find and skip the duplicate.
    let whapiMessageId: string | undefined;
    if (convData.channel === 'whatsapp' && token) {
      process.env.WHAPI_API_TOKEN = token;
      try {
        const whapiRes = await sendTextMessage(toChatId(convData.customerPhone), content);
        whapiMessageId = whapiRes.id;
      } catch (whapiErr) {
        logger.error('Whapi send failed — message stored but not delivered:', whapiErr);
      }
    }

    // Step 2: Persist to Firestore using Whapi ID as doc ID (prevents webhook duplicate).
    const msgRef = adminDb
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(whapiMessageId ?? adminDb.collection('_').doc().id);

    await Promise.all([
      // Write message to Firestore
      msgRef.set({
        role: 'assistant',
        content,
        messageType: 'text',
        isInternalNote: false,
        ...(whapiMessageId ? { whapiMessageId } : {}),
        createdAt: now,
      }),
      // Update conversation metadata
      adminDb.collection('conversations').doc(conversationId).update({
        lastMessage: content,
        updatedAt: now,
      }),
    ]);

    // Return without an extra Firestore read
    return {
      id: msgRef.id,
      role: 'assistant',
      content,
      messageType: 'text',
      isInternalNote: false,
      createdAt: clientNow,
    } as MessageData;
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
    const clientNow = admin.firestore.Timestamp.now();
    const msgRef = adminDb
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc();

    await Promise.all([
      msgRef.set({
        role: 'assistant',
        content,
        messageType: 'note',
        isInternalNote: true,
        createdAt: now,
      }),
      adminDb.collection('conversations').doc(conversationId).update({
        updatedAt: now,
      }),
    ]);

    return {
      id: msgRef.id,
      role: 'assistant',
      content,
      messageType: 'note',
      isInternalNote: true,
      createdAt: clientNow,
    } as MessageData;
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
      // Do NOT update updatedAt here — marking as read should not change sort order
    });
    return { success: true };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error marking read:', err);
    throw new https.HttpsError('internal', 'Failed to mark as read.');
  }
});

export const assignConversation = https.onCall<
  z.infer<typeof assignConversationSchema>,
  Promise<{ assignedTo: string | null; assignedToName: string | null }>
>(async (request) => {
  const authToken = await verifyAuth(request);

  const parsed = assignConversationSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new https.HttpsError('invalid-argument', parsed.error.message);
  }

  const { conversationId, assignedTo, assignedToName } = parsed.data;

  try {
    await assertConversationOwner(conversationId, authToken.uid);
    await adminDb.collection('conversations').doc(conversationId).update({
      assignedTo,
      assignedToName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { assignedTo, assignedToName };
  } catch (err) {
    if (err instanceof https.HttpsError) throw err;
    logger.error('Error assigning conversation:', err);
    throw new https.HttpsError('internal', 'Failed to assign conversation.');
  }
});
