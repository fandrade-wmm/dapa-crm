"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.markConversationRead = exports.updateConversationLabels = exports.toggleConversationAI = exports.addNote = exports.sendMessage = exports.getConversation = exports.getConversations = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
// ---------- Schemas ----------
const getConversationsSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    channel: zod_1.z.enum(['all', 'whatsapp', 'instagram']).default('all'),
    status: zod_1.z.enum(['all', 'active', 'resolved']).default('all'),
    limit: zod_1.z.number().int().positive().max(200).default(100),
});
const getConversationSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
const sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
});
const addNoteSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
});
const toggleConversationAISchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
    aiEnabled: zod_1.z.boolean(),
});
const updateConversationLabelsSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
    labels: zod_1.z.array(zod_1.z.string()),
});
const markConversationReadSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
});
// ---------- Helpers ----------
async function assertConversationOwner(conversationId, uid) {
    const doc = await firebase_admin_1.adminDb.collection('conversations').doc(conversationId).get();
    if (!doc.exists) {
        throw new v2_1.https.HttpsError('not-found', 'Conversation not found.');
    }
    const data = doc.data();
    if (data.ownerId !== uid) {
        throw new v2_1.https.HttpsError('permission-denied', 'Access denied.');
    }
    return doc;
}
// ---------- Cloud Functions ----------
exports.getConversations = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = getConversationsSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    const { search, channel, status, limit } = parsed.data;
    try {
        let query = firebase_admin_1.adminDb
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
        let results = snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        if (search) {
            const q = search.toLowerCase();
            results = results.filter((c) => {
                var _a, _b;
                return ((_a = c.customerName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q)) ||
                    c.customerPhone.includes(q) ||
                    ((_b = c.lastMessage) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(q));
            });
        }
        return results;
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error fetching conversations:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch conversations.');
    }
});
exports.getConversation = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = getConversationSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    try {
        const doc = await assertConversationOwner(parsed.data.id, authToken.uid);
        const messagesSnap = await firebase_admin_1.adminDb
            .collection('conversations')
            .doc(parsed.data.id)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .get();
        const messages = messagesSnap.docs.map((m) => (Object.assign({ id: m.id }, m.data())));
        return Object.assign(Object.assign({ id: doc.id }, doc.data()), { messages });
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error fetching conversation:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch conversation.');
    }
});
exports.sendMessage = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = sendMessageSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    const { conversationId, content } = parsed.data;
    try {
        await assertConversationOwner(conversationId, authToken.uid);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const msgRef = await firebase_admin_1.adminDb
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
        await firebase_admin_1.adminDb.collection('conversations').doc(conversationId).update({
            lastMessage: content,
            updatedAt: now,
        });
        const msgDoc = await msgRef.get();
        return Object.assign({ id: msgDoc.id }, msgDoc.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error sending message:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to send message.');
    }
});
exports.addNote = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = addNoteSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    const { conversationId, content } = parsed.data;
    try {
        await assertConversationOwner(conversationId, authToken.uid);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const msgRef = await firebase_admin_1.adminDb
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
        await firebase_admin_1.adminDb.collection('conversations').doc(conversationId).update({
            updatedAt: now,
        });
        const msgDoc = await msgRef.get();
        return Object.assign({ id: msgDoc.id }, msgDoc.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error adding note:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to add note.');
    }
});
exports.toggleConversationAI = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = toggleConversationAISchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    const { conversationId, aiEnabled } = parsed.data;
    try {
        await assertConversationOwner(conversationId, authToken.uid);
        await firebase_admin_1.adminDb.collection('conversations').doc(conversationId).update({
            aiEnabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { aiEnabled };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error toggling AI:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to toggle AI.');
    }
});
exports.updateConversationLabels = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = updateConversationLabelsSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    const { conversationId, labels } = parsed.data;
    try {
        await assertConversationOwner(conversationId, authToken.uid);
        await firebase_admin_1.adminDb.collection('conversations').doc(conversationId).update({
            labels,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { labels };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error updating labels:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to update labels.');
    }
});
exports.markConversationRead = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = markConversationReadSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    }
    const { conversationId } = parsed.data;
    try {
        await assertConversationOwner(conversationId, authToken.uid);
        await firebase_admin_1.adminDb.collection('conversations').doc(conversationId).update({
            unreadCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error marking read:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to mark as read.');
    }
});
//# sourceMappingURL=manageConversations.js.map