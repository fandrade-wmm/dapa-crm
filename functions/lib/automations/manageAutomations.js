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
exports.deleteAutomation = exports.updateAutomation = exports.createAutomation = exports.getAutomations = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
// ---------- Schemas ----------
const triggerSchema = zod_1.z.object({
    type: zod_1.z.enum(['message_received', 'keyword_match', 'time_based']),
    conditions: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const actionSchema = zod_1.z.object({
    type: zod_1.z.enum(['send_message', 'assign_agent', 'add_label']),
    params: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const createAutomationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    trigger: triggerSchema,
    actions: zod_1.z.array(actionSchema).default([]),
    isActive: zod_1.z.boolean().default(true),
});
const updateAutomationSchema = createAutomationSchema
    .partial()
    .extend({ id: zod_1.z.string().min(1) });
const deleteAutomationSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
// ---------- Cloud Functions ----------
exports.getAutomations = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAuth)(request);
    try {
        const snapshot = await firebase_admin_1.adminDb
            .collection('automations')
            .where('ownerId', '==', token.uid)
            .orderBy('createdAt', 'asc')
            .get();
        return snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    }
    catch (err) {
        v2_1.logger.error('Error fetching automations:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch automations.');
    }
});
exports.createAutomation = v2_1.https.onCall(async (request) => {
    var _a;
    const token = await (0, auth_1.verifyAuth)(request);
    const parsed = createAutomationSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    try {
        const now = admin.firestore.FieldValue.serverTimestamp();
        const docRef = await firebase_admin_1.adminDb.collection('automations').add(Object.assign(Object.assign({}, parsed.data), { description: (_a = parsed.data.description) !== null && _a !== void 0 ? _a : null, ownerId: token.uid, createdAt: now, updatedAt: now }));
        const created = await docRef.get();
        return Object.assign({ id: created.id }, created.data());
    }
    catch (err) {
        v2_1.logger.error('Error creating automation:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to create automation.');
    }
});
exports.updateAutomation = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAuth)(request);
    const parsed = updateAutomationSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const _a = parsed.data, { id } = _a, updateData = __rest(_a, ["id"]);
    try {
        const docRef = firebase_admin_1.adminDb.collection('automations').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Automation not found.');
        }
        const existingData = existing.data();
        if (existingData.ownerId !== token.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'Not authorized.');
        }
        await docRef.update(Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        const updated = await docRef.get();
        return Object.assign({ id: updated.id }, updated.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error updating automation:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to update automation.');
    }
});
exports.deleteAutomation = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAuth)(request);
    const parsed = deleteAutomationSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { id } = parsed.data;
    try {
        const docRef = firebase_admin_1.adminDb.collection('automations').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Automation not found.');
        }
        const existingData = existing.data();
        if (existingData.ownerId !== token.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'Not authorized.');
        }
        await docRef.delete();
        return { success: true };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error deleting automation:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to delete automation.');
    }
});
//# sourceMappingURL=manageAutomations.js.map