import { https } from 'firebase-functions/v2';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';
import { z } from 'zod';

export interface StatsResponse {
  todayConversations: number;
  totalConversations: number;
  totalUnread: number;
  totalMessages: number;
  botEnabled: boolean;
}

export const getStats = https.onCall<Record<string, never>, Promise<StatsResponse>>(
  async (request) => {
    const token = await verifyAuth(request);
    const uid = token.uid;

    // Bot setting (stored per user)
    const botDoc = await adminDb
      .collection('users').doc(uid)
      .collection('settings').doc('bot')
      .get();
    const botEnabled: boolean = botDoc.exists ? (botDoc.data()?.botEnabled ?? true) : true;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Conversations are stored in the root collection with ownerId field
    const convsRef = adminDb.collection('conversations').where('ownerId', '==', uid);

    const [totalSnap, todaySnap, allConvsSnap] = await Promise.all([
      convsRef.count().get(),
      convsRef.where('createdAt', '>=', todayStart).count().get(),
      convsRef.select('unreadCount').get(),
    ]);

    const totalConversations = totalSnap.data().count;
    const todayConversations = todaySnap.data().count;

    let totalUnread = 0;
    let totalMessages = 0;

    for (const doc of allConvsSnap.docs) {
      totalUnread += doc.data().unreadCount ?? 0;
    }

    // Count total messages across all conversations (aggregate)
    const msgsSnap = await adminDb
      .collectionGroup('messages')
      .where('role', '==', 'user')
      .count()
      .get();
    totalMessages = msgsSnap.data().count;

    return { todayConversations, totalConversations, totalUnread, totalMessages, botEnabled };
  }
);

const toggleBotSchema = z.object({ botEnabled: z.boolean() });

export const toggleBot = https.onCall<{ botEnabled: boolean }, Promise<{ botEnabled: boolean }>>(
  async (request) => {
    const token = await verifyAuth(request);
    const uid = token.uid;

    const parsed = toggleBotSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new https.HttpsError('invalid-argument', parsed.error.message);
    }

    await adminDb
      .collection('users').doc(uid)
      .collection('settings').doc('bot')
      .set({ botEnabled: parsed.data.botEnabled }, { merge: true });

    return { botEnabled: parsed.data.botEnabled };
  }
);
