import { https } from 'firebase-functions/v2';
import { adminDb } from '../config/firebase-admin';
import { verifyAuth } from '../middleware/auth';

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

    const convsSnap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('conversations')
      .get();

    const totalConversations = convsSnap.size;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let todayConversations = 0;
    let totalUnread = 0;
    let totalMessages = 0;

    for (const doc of convsSnap.docs) {
      const data = doc.data();
      const createdAt: Date | null = data.createdAt?.toDate?.() ?? null;
      if (createdAt && createdAt >= todayStart) {
        todayConversations++;
      }
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

export const toggleBot = https.onCall<{ botEnabled: boolean }, Promise<{ botEnabled: boolean }>>(
  async (request) => {
    const token = await verifyAuth(request);
    const uid = token.uid;
    const { botEnabled } = request.data;

    await adminDb
      .collection('users')
      .doc(uid)
      .collection('settings')
      .doc('bot')
      .set({ botEnabled }, { merge: true });

    return { botEnabled };
  }
);
