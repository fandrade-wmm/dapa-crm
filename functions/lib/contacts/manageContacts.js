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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteContact = exports.updateContact = exports.createContact = exports.getContacts = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
// ---------- Schemas ----------
const createContactSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateContactSchema = createContactSchema.partial().extend({
    id: zod_1.z.string().min(1),
});
const deleteContactSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
const getContactsSchema = zod_1.z.object({
    limit: zod_1.z.number().int().positive().max(100).default(20),
    startAfter: zod_1.z.string().optional(),
});
// ---------- Cloud Functions ----------
exports.getContacts = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = getContactsSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { limit, startAfter } = parsed.data;
    try {
        let query = firebase_admin_1.adminDb
            .collection('contacts')
            .where('ownerId', '==', authToken.uid)
            .orderBy('createdAt', 'desc')
            .limit(limit);
        if (startAfter) {
            const startDoc = await firebase_admin_1.adminDb.collection('contacts').doc(startAfter).get();
            if (startDoc.exists) {
                query = query.startAfter(startDoc);
            }
        }
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    }
    catch (err) {
        v2_1.logger.error('Error fetching contacts:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch contacts.');
    }
});
exports.createContact = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = createContactSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        const docRef = await firebase_admin_1.adminDb.collection('contacts').add(Object.assign(Object.assign({}, parsed.data), { ownerId: authToken.uid, createdAt: now, updatedAt: now }));
        const doc = await docRef.get();
        return Object.assign({ id: doc.id }, doc.data());
    }
    catch (err) {
        v2_1.logger.error('Error creating contact:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to create contact.');
    }
});
exports.updateContact = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = updateContactSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const _a = parsed.data, { id } = _a, updateData = __rest(_a, ["id"]);
    try {
        const docRef = firebase_admin_1.adminDb.collection('contacts').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Contact not found.');
        }
        const existingData = existing.data();
        if (existingData.ownerId !== authToken.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'You do not have permission to update this contact.');
        }
        await docRef.update(Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        const updated = await docRef.get();
        return Object.assign({ id: updated.id }, updated.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error updating contact:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to update contact.');
    }
});
exports.deleteContact = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = deleteContactSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { id } = parsed.data;
    try {
        const docRef = firebase_admin_1.adminDb.collection('contacts').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Contact not found.');
        }
        const existingData = existing.data();
        if (existingData.ownerId !== authToken.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'You do not have permission to delete this contact.');
        }
        await docRef.delete();
        return { success: true };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error deleting contact:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to delete contact.');
    }
});
//# sourceMappingURL=manageContacts.js.map