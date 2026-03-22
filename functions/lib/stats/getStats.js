"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleBot = exports.getStats = void 0;
const v2_1 = require("firebase-functions/v2");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
exports.getStats = v2_1.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    const token = await (0, auth_1.verifyAuth)(request);
    const uid = token.uid;
    const botDocRef = firebase_admin_1.adminDb.collection('users').doc(uid).collection('settings').doc('bot');
    const botDoc = await botDocRef.get();
    const botEnabled = botDoc.exists ? ((_b = (_a = botDoc.data()) === null || _a === void 0 ? void 0 : _a.botEnabled) !== null && _b !== void 0 ? _b : true) : true;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const convsCollectionRef = firebase_admin_1.adminDb
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
        totalUnread += (_c = data.unreadCount) !== null && _c !== void 0 ? _c : 0;
        totalMessages += (_d = data.messageCount) !== null && _d !== void 0 ? _d : 0;
    }
    return {
        todayConversations,
        totalConversations,
        totalUnread,
        totalMessages,
        botEnabled,
    };
});
const toggleBotSchema = zod_1.z.object({
    botEnabled: zod_1.z.boolean(),
});
exports.toggleBot = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAuth)(request);
    const uid = token.uid;
    const parsed = toggleBotSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'botEnabled must be a boolean. ' + parsed.error.message);
    }
    const { botEnabled } = parsed.data;
    await firebase_admin_1.adminDb
        .collection('users')
        .doc(uid)
        .collection('settings')
        .doc('bot')
        .set({ botEnabled }, { merge: true });
    return { botEnabled };
});
//# sourceMappingURL=getStats.js.map