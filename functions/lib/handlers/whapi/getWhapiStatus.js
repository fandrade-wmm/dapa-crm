"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhapiStatus = void 0;
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const auth_1 = require("../../middleware/auth");
const whapiClient_1 = require("./whapiClient");
const whapiApiToken = (0, params_1.defineSecret)('WHAPI_API_TOKEN');
/** Normalize whatever Whapi returns into our simple status string */
function normalizeStatus(raw) {
    const text = typeof raw === 'string'
        ? raw.toLowerCase()
        : typeof raw === 'object' && raw !== null
            ? raw.text.toLowerCase()
            : '';
    if (text === 'active' || text === 'authenticated' || text === 'connected' || text === 'auth')
        return 'active';
    if (text === 'qr' || text === 'scan_qr_code')
        return 'qr';
    if (text === 'loading' || text === 'init' || text === 'launch' || text === 'connecting')
        return 'loading';
    if (text === 'stop' || text === 'stopped' || text === 'offline' || text === 'disconnected')
        return 'offline';
    v2_1.logger.warn(`Unknown Whapi status: ${JSON.stringify(raw)}`);
    return 'loading';
}
exports.getWhapiStatus = v2_1.https.onCall({ secrets: [whapiApiToken] }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    await (0, auth_1.verifyAuth)(request);
    const token = whapiApiToken.value();
    if (!token) {
        return { status: 'not_configured' };
    }
    // Make token available to whapiClient via process.env
    process.env.WHAPI_API_TOKEN = token;
    try {
        const health = await (0, whapiClient_1.getChannelHealth)();
        v2_1.logger.info('Whapi health response:', JSON.stringify(health));
        const status = normalizeStatus(health.status);
        const phone = (_c = (_a = health.phone) !== null && _a !== void 0 ? _a : (_b = health.device) === null || _b === void 0 ? void 0 : _b.phone) !== null && _c !== void 0 ? _c : (_d = health.user) === null || _d === void 0 ? void 0 : _d.id;
        const name = (_g = (_e = health.name) !== null && _e !== void 0 ? _e : (_f = health.device) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : (_h = health.user) === null || _h === void 0 ? void 0 : _h.name;
        if (status === 'qr') {
            try {
                const qr = await (0, whapiClient_1.getChannelQR)();
                return { status: 'qr', qrCode: (0, whapiClient_1.extractQRCode)(qr) };
            }
            catch (qrErr) {
                v2_1.logger.warn('Could not fetch QR code:', qrErr);
                return { status: 'qr' };
            }
        }
        return { status, phone, name };
    }
    catch (err) {
        v2_1.logger.error('Error fetching Whapi channel status:', err);
        throw new v2_1.https.HttpsError('internal', 'No se pudo obtener el estado de WhatsApp.');
    }
});
//# sourceMappingURL=getWhapiStatus.js.map