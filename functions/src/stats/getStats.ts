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

    const botDocRef = adminDb.collection('users').doc(uid).collection('settings').doc('bot');
    const botDoc = await botDocRef.get();
    const botEnabled: boolean = botDoc.exists ? (botDoc.data()?.botEnabled ?? true) : true;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const convsCollectionRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('conversations');

    const [totalConversationsAggSnap, todayConversationsAggSnap, convsSnap] = await Promise.all([
      convsCollectionRef.count().get(),
      convsCollectionRef.where('createdAt', '>=', todayStart).count().get(),
      convsCollectionRef.select('unreadCount', 'messageCount').get(),
    ]);

    const totalConversations = totalConversationsAggSnap.data().count;
    const todayConversations = todayConversationsAggSnap.data().count;

    let totalUnread = 0;
    let totalMessages = 0;

    for (const doc of convsSnap.docs) {
      const data = doc.data();
      totalUnread += data.unreadCount ?? 0;
      totalMessages += data.messageCount ?? 0;
    }

    return {
      todayConversations,
      totalConversations,
      totalUnread,
      totalMessages,
      botEnabled,
    };
  }
);

const toggleBotSchema = z.object({
  botEnabled: z.boolean(),
});

export const toggleBot = https.onCall<{ botEnabled: boolean }, Promise<{ botEnabled: boolean }>>(
  async (request) => {
    const token = await verifyAuth(request);
    const uid = token.uid;

    const parsed = toggleBotSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new https.HttpsError(
        'invalid-argument',
        'botEnabled must be a boolean. ' + parsed.error.message
      );
    }

    const { botEnabled } = parsed.data;

    await adminDb
      .collection('users')
      .doc(uid)
      .collection('settings')
      .doc('bot')
      .set({ botEnabled }, { merge: true });

    return { botEnabled };
  }
);
