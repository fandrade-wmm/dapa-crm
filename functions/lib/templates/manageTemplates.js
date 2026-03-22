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
exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplates = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
// ---------- Schemas ----------
const createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    category: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
    language: zod_1.z.string().default('es'),
    isActive: zod_1.z.boolean().default(true),
});
const updateTemplateSchema = createTemplateSchema.partial().extend({
    id: zod_1.z.string().min(1),
});
const deleteTemplateSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
// ---------- Cloud Functions ----------
exports.getTemplates = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    try {
        const snapshot = await firebase_admin_1.adminDb
            .collection('templates')
            .where('ownerId', '==', authToken.uid)
            .orderBy('createdAt', 'asc')
            .get();
        return snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    }
    catch (err) {
        v2_1.logger.error('Error fetching templates:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch templates.');
    }
});
exports.createTemplate = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = createTemplateSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        const docRef = await firebase_admin_1.adminDb.collection('templates').add(Object.assign(Object.assign({}, parsed.data), { ownerId: authToken.uid, createdAt: now, updatedAt: now }));
        const created = await docRef.get();
        return Object.assign({ id: created.id }, created.data());
    }
    catch (err) {
        v2_1.logger.error('Error creating template:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to create template.');
    }
});
exports.updateTemplate = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = updateTemplateSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const _a = parsed.data, { id } = _a, updateData = __rest(_a, ["id"]);
    try {
        const docRef = firebase_admin_1.adminDb.collection('templates').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Template not found.');
        }
        const existingData = existing.data();
        if (existingData.ownerId !== authToken.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'You do not have permission to update this template.');
        }
        await docRef.update(Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        const updated = await docRef.get();
        return Object.assign({ id: updated.id }, updated.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error updating template:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to update template.');
    }
});
exports.deleteTemplate = v2_1.https.onCall(async (request) => {
    const authToken = await (0, auth_1.verifyAuth)(request);
    const parsed = deleteTemplateSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { id } = parsed.data;
    try {
        const docRef = firebase_admin_1.adminDb.collection('templates').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Template not found.');
        }
        const existingData = existing.data();
        if (existingData.ownerId !== authToken.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'You do not have permission to delete this template.');
        }
        await docRef.delete();
        return { success: true };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error deleting template:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to delete template.');
    }
});
//# sourceMappingURL=manageTemplates.js.map