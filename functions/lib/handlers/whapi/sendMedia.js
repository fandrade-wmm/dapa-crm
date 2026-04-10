"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMedia = void 0;
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("../../middleware/auth");
const whapiClient_1 = require("./whapiClient");
const whapiApiToken = (0, params_1.defineSecret)('WHAPI_API_TOKEN');
exports.sendMedia = v2_1.https.onCall({ secrets: [whapiApiToken] }, async (request) => {
    await (0, auth_1.verifyAuth)(request);
    const { conversationId, mediaUrl, mediaType, caption, filename } = request.data;
    if (!conversationId || !mediaUrl || !mediaType) {
        throw new v2_1.https.HttpsError('invalid-argument', 'conversationId, mediaUrl and mediaType are required.');
    }
    const db = (0, firestore_1.getFirestore)();
    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) {
        throw new v2_1.https.HttpsError('not-found', 'Conversation not found.');
    }
    const conv = convSnap.data();
    // Send via Whapi first to get the message ID, which becomes the Firestore
    // document ID — this makes the webhook's idempotency check skip the duplicate.
    let whapiMessageId;
    const token = whapiApiToken.value();
    if (token) {
        process.env.WHAPI_API_TOKEN = token;
        const chatId = (0, whapiClient_1.toChatId)(conv.customerPhone);
        try {
            let whapiRes;
            if (mediaType === 'image') {
                whapiRes = await (0, whapiClient_1.sendImageMessage)(chatId, mediaUrl, caption);
            }
            else if (mediaType === 'video') {
                whapiRes = await (0, whapiClient_1.sendVideoMessage)(chatId, mediaUrl, caption);
            }
            else if (mediaType === 'document') {
                whapiRes = await (0, whapiClient_1.sendDocumentMessage)(chatId, mediaUrl, filename !== null && filename !== void 0 ? filename : 'archivo', caption);
            }
            else {
                whapiRes = await (0, whapiClient_1.sendVoiceMessage)(chatId, mediaUrl);
            }
            whapiMessageId = whapiRes === null || whapiRes === void 0 ? void 0 : whapiRes.id;
        }
        catch (err) {
            v2_1.logger.error('Whapi media send failed:', err);
            throw new v2_1.https.HttpsError('internal', 'Failed to send media via Whapi.');
        }
    }
    const msgTypeMap = {
        image: 'image',
        video: 'video',
        document: 'document',
        audio: 'audio',
    };
    const msgRef = db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(whapiMessageId !== null && whapiMessageId !== void 0 ? whapiMessageId : db.collection('_').doc().id);
    const messageData = Object.assign(Object.assign({ role: 'assistant', content: caption !== null && caption !== void 0 ? caption : '', messageType: msgTypeMap[mediaType], mediaUrl, filename: filename !== null && filename !== void 0 ? filename : null, isInternalNote: false }, (whapiMessageId ? { whapiMessageId } : {})), { createdAt: firestore_1.FieldValue.serverTimestamp() });
    await msgRef.set(messageData);
    await db.collection('conversations').doc(conversationId).update({
        lastMessage: mediaType === 'image' ? '📷 Imagen' :
            mediaType === 'video' ? '🎥 Video' :
                mediaType === 'document' ? `📄 ${filename !== null && filename !== void 0 ? filename : 'Documento'}` :
                    '🎤 Nota de voz',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Media message sent: ${mediaType} to conversation ${conversationId}`);
    return { id: msgRef.id, sent: true };
});
//# sourceMappingURL=sendMedia.js.map