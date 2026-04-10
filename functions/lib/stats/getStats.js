"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleBot = exports.getStats = void 0;
const v2_1 = require("firebase-functions/v2");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
exports.getStats = v2_1.https.onCall(async (request) => {
    var _a, _b, _c;
    const token = await (0, auth_1.verifyAuth)(request);
    const uid = token.uid;
    // Bot setting (stored per user)
    const botDoc = await firebase_admin_1.adminDb
        .collection('users').doc(uid)
        .collection('settings').doc('bot')
        .get();
    const botEnabled = botDoc.exists ? ((_b = (_a = botDoc.data()) === null || _a === void 0 ? void 0 : _a.botEnabled) !== null && _b !== void 0 ? _b : true) : true;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // Conversations are stored in the root collection with ownerId field
    const convsRef = firebase_admin_1.adminDb.collection('conversations').where('ownerId', '==', uid);
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
        totalUnread += (_c = doc.data().unreadCount) !== null && _c !== void 0 ? _c : 0;
    }
    // Count total messages across all conversations (aggregate)
    const msgsSnap = await firebase_admin_1.adminDb
        .collectionGroup('messages')
        .where('role', '==', 'user')
        .count()
        .get();
    totalMessages = msgsSnap.data().count;
    return { todayConversations, totalConversations, totalUnread, totalMessages, botEnabled };
});
const toggleBotSchema = zod_1.z.object({ botEnabled: zod_1.z.boolean() });
exports.toggleBot = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAuth)(request);
    const uid = token.uid;
    const parsed = toggleBotSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    await firebase_admin_1.adminDb
        .collection('users').doc(uid)
        .collection('settings').doc('bot')
        .set({ botEnabled: parsed.data.botEnabled }, { merge: true });
    return { botEnabled: parsed.data.botEnabled };
});
//# sourceMappingURL=getStats.js.map