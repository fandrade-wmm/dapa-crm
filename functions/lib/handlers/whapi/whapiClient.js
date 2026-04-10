"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChannelHealth = getChannelHealth;
exports.getChannelQR = getChannelQR;
exports.extractQRCode = extractQRCode;
exports.sendTextMessage = sendTextMessage;
exports.toChatId = toChatId;
exports.sendImageMessage = sendImageMessage;
exports.sendVideoMessage = sendVideoMessage;
exports.sendDocumentMessage = sendDocumentMessage;
exports.sendVoiceMessage = sendVoiceMessage;
const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
function getToken() {
    const token = process.env.WHAPI_API_TOKEN;
    if (!token)
        throw new Error('WHAPI_API_TOKEN not configured');
    return token;
}
async function whapiGet(path) {
    const res = await fetch(`${WHAPI_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Whapi GET ${path} → ${res.status}: ${text}`);
    }
    return res.json();
}
async function whapiPost(path, body) {
    const res = await fetch(`${WHAPI_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Whapi POST ${path} → ${res.status}: ${text}`);
    }
    return res.json();
}
async function getChannelHealth() {
    return whapiGet('/health');
}
async function getChannelQR() {
    // Correct Whapi endpoint for QR login
    return whapiGet('/users/login');
}
/** Extract the base64 QR image regardless of which field Whapi uses */
function extractQRCode(qr) {
    var _a, _b;
    return (_b = (_a = qr.qr_code) !== null && _a !== void 0 ? _a : qr.base64) !== null && _b !== void 0 ? _b : qr.image;
}
/**
 * Send a text message via Whapi.
 * chatId format: "521234567890@s.whatsapp.net"
 */
async function sendTextMessage(chatId, text) {
    return whapiPost('/messages/text', {
        to: chatId,
        body: text,
    });
}
/** Build the WhatsApp chatId from a plain phone number */
function toChatId(phone) {
    const clean = phone.replace(/\D/g, '');
    return `${clean}@s.whatsapp.net`;
}
async function sendImageMessage(chatId, mediaUrl, caption) {
    return whapiPost('/messages/image', Object.assign({ to: chatId, media: mediaUrl }, (caption ? { caption } : {})));
}
async function sendVideoMessage(chatId, mediaUrl, caption) {
    return whapiPost('/messages/video', Object.assign({ to: chatId, media: mediaUrl }, (caption ? { caption } : {})));
}
async function sendDocumentMessage(chatId, mediaUrl, filename, caption) {
    return whapiPost('/messages/document', Object.assign({ to: chatId, media: mediaUrl, filename }, (caption ? { caption } : {})));
}
async function sendVoiceMessage(chatId, mediaUrl) {
    return whapiPost('/messages/voice', {
        to: chatId,
        media: mediaUrl,
    });
}
//# sourceMappingURL=whapiClient.js.map