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
exports.whapiWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const firebase_admin_1 = require("../../config/firebase-admin");
const whapiApiToken = (0, params_1.defineSecret)('WHAPI_API_TOKEN');
const whapiOwnerId = (0, params_1.defineSecret)('WHAPI_OWNER_ID');
// ---------- Helpers ----------
function parsePhone(from) {
    // Strip @s.whatsapp.net or @g.us etc.
    return from.split('@')[0];
}
function normalizePhone(phone) {
    return phone.replace(/\D/g, '');
}
function extractContent(msg) {
    var _a, _b, _c, _d;
    if ((_a = msg.text) === null || _a === void 0 ? void 0 : _a.body)
        return msg.text.body;
    if (msg.image)
        return msg.image.caption || '';
    if (msg.gif || ((_b = msg.video) === null || _b === void 0 ? void 0 : _b.gif_play))
        return ((_c = msg.video) === null || _c === void 0 ? void 0 : _c.caption) || ((_d = msg.gif) === null || _d === void 0 ? void 0 : _d.caption) || '';
    if (msg.video)
        return msg.video.caption || '';
    if (msg.document)
        return msg.document.caption || '';
    return '';
}
function extractMediaUrl(msg) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return ((_m = (_k = (_h = (_f = (_d = (_b = (_a = msg.image) === null || _a === void 0 ? void 0 : _a.link) !== null && _b !== void 0 ? _b : (_c = msg.video) === null || _c === void 0 ? void 0 : _c.link) !== null && _d !== void 0 ? _d : (_e = msg.document) === null || _e === void 0 ? void 0 : _e.link) !== null && _f !== void 0 ? _f : (_g = msg.audio) === null || _g === void 0 ? void 0 : _g.link) !== null && _h !== void 0 ? _h : (_j = msg.sticker) === null || _j === void 0 ? void 0 : _j.link) !== null && _k !== void 0 ? _k : (_l = msg.gif) === null || _l === void 0 ? void 0 : _l.link) !== null && _m !== void 0 ? _m : null);
}
function toMessageType(type, msg) {
    var _a;
    if (type === 'image')
        return 'image';
    if (type === 'sticker')
        return 'sticker';
    if (type === 'gif' || (type === 'video' && ((_a = msg.video) === null || _a === void 0 ? void 0 : _a.gif_play)))
        return 'image';
    if (type === 'video')
        return 'video';
    if (type === 'document')
        return 'document';
    if (type === 'audio' || type === 'voice' || type === 'ptt')
        return 'audio';
    return 'text';
}
function toLastMessagePreview(msg) {
    var _a, _b, _c;
    if ((_a = msg.text) === null || _a === void 0 ? void 0 : _a.body)
        return msg.text.body;
    if (msg.image)
        return msg.image.caption || '📷 Imagen';
    if (msg.gif || ((_b = msg.video) === null || _b === void 0 ? void 0 : _b.gif_play))
        return '🎞️ GIF';
    if (msg.video)
        return msg.video.caption || '🎥 Video';
    if (msg.document)
        return `📄 ${(_c = msg.document.filename) !== null && _c !== void 0 ? _c : 'Documento'}`;
    if (msg.audio)
        return '🎤 Audio';
    if (msg.sticker)
        return '🎭 Sticker';
    return `[${msg.type}]`;
}
/**
 * Find an existing contact by phone number or create a new one.
 * Returns the contactId.
 */
async function findOrCreateContact(phone, name, ownerId) {
    const normalized = normalizePhone(phone);
    // Search by normalized digits to handle format differences
    const snap = await firebase_admin_1.adminDb
        .collection('contacts')
        .where('ownerId', '==', ownerId)
        .where('phoneNormalized', '==', normalized)
        .limit(1)
        .get();
    if (!snap.empty) {
        const doc = snap.docs[0];
        // Update name if we now know it and didn't before
        if (name && !doc.data().name) {
            await doc.ref.update({ name, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        return doc.id;
    }
    // Create new contact
    const now = admin.firestore.FieldValue.serverTimestamp();
    const ref = await firebase_admin_1.adminDb.collection('contacts').add({
        name: name || phone,
        phone,
        phoneNormalized: normalized,
        email: null,
        company: null,
        tags: [],
        source: 'whatsapp',
        ownerId,
        createdAt: now,
        updatedAt: now,
    });
    v2_1.logger.info(`Created new contact ${ref.id} for phone ${phone}`);
    return ref.id;
}
// ---------- HTTP Function ----------
exports.whapiWebhook = v2_1.https.onRequest({ cors: false, region: 'us-central1', secrets: [whapiApiToken, whapiOwnerId] }, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    // Log full payload for diagnostics
    v2_1.logger.info('whapiWebhook received', {
        topLevelKeys: Object.keys((_a = req.body) !== null && _a !== void 0 ? _a : {}),
        rawBody: JSON.stringify(req.body).slice(0, 1000),
    });
    // Respond immediately — Whapi expects a fast 200
    res.status(200).send('OK');
    const payload = req.body;
    const messages = (_d = (_b = payload.messages) !== null && _b !== void 0 ? _b : (_c = payload.data) === null || _c === void 0 ? void 0 : _c.messages) !== null && _d !== void 0 ? _d : [];
    if (messages.length === 0) {
        v2_1.logger.info('whapiWebhook: no messages in payload, ignoring event');
        return;
    }
    const ownerId = whapiOwnerId.value() || null;
    if (!ownerId) {
        v2_1.logger.error('whapiWebhook: WHAPI_OWNER_ID secret not configured');
        return;
    }
    for (const msg of messages) {
        const isOutgoing = msg.from_me === true;
        v2_1.logger.info('whapiWebhook processing message', {
            id: msg.id,
            type: msg.type,
            from_me: isOutgoing,
            from: msg.from,
        });
        // For outgoing messages echoed by Whapi (sent via API or from the phone),
        // store as 'assistant' role so the conversation history is complete.
        // For incoming messages from clients, store as 'user'.
        const role = isOutgoing ? 'assistant' : 'user';
        // The phone of the OTHER party:
        // - Incoming: msg.from is the client
        // - Outgoing: the client is msg.chat_id (strip the suffix)
        const rawPhone = isOutgoing ? msg.chat_id : msg.from;
        const phone = parsePhone(rawPhone);
        // Skip group messages (contain "-" in phone like "1234-5678@g.us")
        if (phone.includes('-') || rawPhone.includes('@g.us')) {
            v2_1.logger.info(`Skipping group message ${msg.id}`);
            continue;
        }
        const clientName = isOutgoing ? null : ((_e = msg.from_name) !== null && _e !== void 0 ? _e : null);
        const content = extractContent(msg);
        const preview = toLastMessagePreview(msg);
        const msgType = toMessageType(msg.type, msg);
        const mediaUrl = extractMediaUrl(msg);
        const filename = (_g = (_f = msg.document) === null || _f === void 0 ? void 0 : _f.filename) !== null && _g !== void 0 ? _g : null;
        const now = admin.firestore.FieldValue.serverTimestamp();
        try {
            // Find or create contact
            const contactId = await findOrCreateContact(phone, clientName, ownerId);
            // Deterministic conversation ID eliminates race conditions.
            // Two concurrent webhook calls for the same phone always resolve to the same doc.
            const deterministicId = (0, crypto_1.createHash)('sha256')
                .update(`${ownerId}:whatsapp:${normalizePhone(phone)}`)
                .digest('hex')
                .slice(0, 20);
            const convRef = firebase_admin_1.adminDb.collection('conversations').doc(deterministicId);
            const convSnap = await convRef.get();
            const conversationId = deterministicId;
            if (!convSnap.exists) {
                const displayName = clientName || phone;
                // set() is idempotent — concurrent calls create the same document safely
                await convRef.set({
                    customerPhone: phone,
                    customerName: clientName,
                    contactId,
                    status: 'active',
                    aiEnabled: false,
                    labels: [],
                    unreadCount: isOutgoing ? 0 : 1,
                    channel: 'whatsapp',
                    lastMessage: preview,
                    ownerId,
                    createdAt: now,
                    updatedAt: now,
                });
                // Auto-create CRM lead in "nuevos" (fire-and-forget, don't block message storage)
                firebase_admin_1.adminDb
                    .collection('leads')
                    .where('ownerId', '==', ownerId)
                    .where('phone', '==', phone)
                    .limit(1)
                    .get()
                    .then((existingLead) => {
                    if (existingLead.empty) {
                        return firebase_admin_1.adminDb.collection('leads').add({
                            name: displayName,
                            phone,
                            email: null,
                            stage: 'nuevos',
                            notes: null,
                            value: null,
                            source: 'WhatsApp',
                            contactId,
                            ownerId,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                    return null;
                })
                    .then(() => v2_1.logger.info(`Lead ensured for ${phone}`))
                    .catch((e) => v2_1.logger.warn('Lead creation failed (non-critical):', e));
            }
            else {
                await convRef.update(Object.assign(Object.assign({ lastMessage: preview, contactId, updatedAt: now }, (isOutgoing ? {} : { unreadCount: admin.firestore.FieldValue.increment(1) })), (clientName ? { customerName: clientName } : {})));
            }
            // Idempotency: use Whapi message ID as Firestore document ID
            const msgRef = firebase_admin_1.adminDb
                .collection('conversations')
                .doc(conversationId)
                .collection('messages')
                .doc(msg.id);
            if ((await msgRef.get()).exists) {
                v2_1.logger.info(`Duplicate message ${msg.id} — skipped`);
                continue;
            }
            await msgRef.set(Object.assign(Object.assign(Object.assign({ role,
                content, messageType: msgType, isInternalNote: false, whapiMessageId: msg.id }, (mediaUrl ? { mediaUrl } : {})), (filename ? { filename } : {})), { createdAt: admin.firestore.Timestamp.fromMillis(msg.timestamp * 1000) }));
            v2_1.logger.info(`Stored ${role} message ${msg.id} in conversation ${conversationId}`);
        }
        catch (err) {
            v2_1.logger.error(`Failed to process Whapi message ${msg.id}:`, err);
            await firebase_admin_1.adminDb.collection('_dlq').add({
                source: 'whapiWebhook',
                payload: msg,
                error: err.message,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
});
//# sourceMappingURL=webhook.js.map