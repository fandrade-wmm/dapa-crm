"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
exports.verifyAdmin = verifyAdmin;
const v2_1 = require("firebase-functions/v2");
const firebase_admin_1 = require("../config/firebase-admin");
/**
 * Verifies that the caller is authenticated and returns their decoded token.
 * Throws an HttpsError if unauthenticated.
 */
async function verifyAuth(context) {
    if (!context.auth) {
        throw new v2_1.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // context.auth.token is the decoded token in v2
    return context.auth.token;
}
/**
 * Verifies that the caller is an admin (role: admin or superAdmin).
 */
async function verifyAdmin(context) {
    var _a;
    const decodedToken = await verifyAuth(context);
    const userDoc = await firebase_admin_1.adminDb
        .collection('users')
        .doc(decodedToken.uid)
        .get();
    const role = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (!userDoc.exists || !['admin', 'superAdmin'].includes(role !== null && role !== void 0 ? role : '')) {
        throw new v2_1.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }
    return decodedToken;
}
//# sourceMappingURL=auth.js.map