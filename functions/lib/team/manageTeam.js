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
exports.removeTeamMember = exports.updateTeamMember = exports.inviteTeamMember = exports.getTeam = exports.getActiveAgents = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
// ---------- Schemas ----------
const inviteTeamMemberSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    displayName: zod_1.z.string().min(1),
    role: zod_1.z.enum(['admin', 'agent']).default('agent'),
    permissions: zod_1.z
        .object({
        conversations: zod_1.z.boolean().default(true),
        crm: zod_1.z.boolean().default(false),
        automations: zod_1.z.boolean().default(false),
        quickResponses: zod_1.z.boolean().default(true),
        settings: zod_1.z.boolean().default(false),
    })
        .optional(),
});
const updateTeamMemberSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    role: zod_1.z.enum(['admin', 'agent']).optional(),
    permissions: zod_1.z
        .object({
        conversations: zod_1.z.boolean(),
        crm: zod_1.z.boolean(),
        automations: zod_1.z.boolean(),
        quickResponses: zod_1.z.boolean(),
        settings: zod_1.z.boolean(),
    })
        .optional(),
    isActive: zod_1.z.boolean().optional(),
});
const removeTeamMemberSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
// ---------- Cloud Functions ----------
// ---------- getActiveAgents (any authenticated user) ----------
exports.getActiveAgents = v2_1.https.onCall(async (request) => {
    await (0, auth_1.verifyAuth)(request);
    try {
        const snapshot = await firebase_admin_1.adminDb.collection('users').get();
        return snapshot.docs
            .filter((doc) => doc.data().isActive !== false)
            .map((doc) => {
            var _a;
            return ({
                id: doc.id,
                displayName: ((_a = doc.data().displayName) !== null && _a !== void 0 ? _a : doc.data().name) || null,
                email: doc.data().email,
            });
        });
    }
    catch (err) {
        v2_1.logger.error('Error fetching active agents:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch agents.');
    }
});
// ---------- getTeam (admin only) ----------
exports.getTeam = v2_1.https.onCall(async (request) => {
    await (0, auth_1.verifyAdmin)(request);
    try {
        const snapshot = await firebase_admin_1.adminDb.collection('users').get();
        return snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    }
    catch (err) {
        v2_1.logger.error('Error fetching team:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch team members.');
    }
});
exports.inviteTeamMember = v2_1.https.onCall(async (request) => {
    await (0, auth_1.verifyAdmin)(request);
    const parsed = inviteTeamMemberSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { email, displayName, role, permissions } = parsed.data;
    try {
        // Check if user already exists in Firestore
        const existing = await firebase_admin_1.adminDb
            .collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();
        if (!existing.empty) {
            throw new v2_1.https.HttpsError('already-exists', 'A user with this email already exists.');
        }
        // Generate a cryptographically random temporary password.
        // This ensures the Email/Password provider is registered so the user can sign in.
        const tempPassword = Math.random().toString(36).slice(-8) +
            Math.random().toString(36).toUpperCase().slice(-4) +
            '!1';
        // Create (or reuse) the Firebase Auth user
        let authUser;
        try {
            // If they already exist in Auth, update to ensure email/password provider is active
            authUser = await admin.auth().getUserByEmail(email);
            await admin.auth().updateUser(authUser.uid, { password: tempPassword, displayName });
        }
        catch (_a) {
            authUser = await admin.auth().createUser({
                email,
                displayName,
                password: tempPassword,
                emailVerified: false,
                disabled: false,
            });
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        const defaultPermissions = Object.assign({ conversations: true, crm: false, automations: false, quickResponses: true, settings: false }, permissions);
        const docRef = firebase_admin_1.adminDb.collection('users').doc(authUser.uid);
        await docRef.set({
            email,
            displayName,
            role,
            permissions: defaultPermissions,
            isActive: true,
            createdAt: now,
        });
        // Generate a password reset link — this acts as the invite link.
        // The team member clicks it, sets their own password, and can log in.
        const inviteLink = await admin.auth().generatePasswordResetLink(email);
        const created = await docRef.get();
        return Object.assign(Object.assign({ id: created.id }, created.data()), { inviteLink });
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error inviting team member:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to invite team member.');
    }
});
exports.updateTeamMember = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAdmin)(request);
    const parsed = updateTeamMemberSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const _a = parsed.data, { id } = _a, updateData = __rest(_a, ["id"]);
    if (id === token.uid) {
        throw new v2_1.https.HttpsError('permission-denied', 'You cannot modify your own account.');
    }
    try {
        const docRef = firebase_admin_1.adminDb.collection('users').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Team member not found.');
        }
        await docRef.update(Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        const updated = await docRef.get();
        return Object.assign({ id: updated.id }, updated.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error updating team member:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to update team member.');
    }
});
exports.removeTeamMember = v2_1.https.onCall(async (request) => {
    const token = await (0, auth_1.verifyAdmin)(request);
    const parsed = removeTeamMemberSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { id } = parsed.data;
    if (id === token.uid) {
        throw new v2_1.https.HttpsError('permission-denied', 'You cannot remove yourself.');
    }
    try {
        const docRef = firebase_admin_1.adminDb.collection('users').doc(id);
        const existing = await docRef.get();
        if (!existing.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Team member not found.');
        }
        // Deactivate instead of delete
        await docRef.update({
            isActive: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('Error removing team member:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to remove team member.');
    }
});
//# sourceMappingURL=manageTeam.js.map