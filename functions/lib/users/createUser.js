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
exports.createUserAdmin = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
const createUserAdminSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    role: zod_1.z.enum(['superAdmin', 'admin', 'agent', 'user']).default('user'),
});
exports.createUserAdmin = v2_1.https.onCall(async (request) => {
    await (0, auth_1.verifyAdmin)(request);
    const parsed = createUserAdminSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Invalid request data: ' + parsed.error.message);
    }
    const { name, email, password, role } = parsed.data;
    let userRecord;
    try {
        userRecord = await firebase_admin_1.adminAuth.createUser({
            email,
            password,
            displayName: name,
        });
    }
    catch (err) {
        v2_1.logger.error('Error creating Firebase Auth user:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to create user account.');
    }
    try {
        await firebase_admin_1.adminDb.collection('users').doc(userRecord.uid).set({
            name,
            email,
            role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        v2_1.logger.error('Error creating Firestore user document:', err);
        // Rollback: delete the auth user if Firestore creation fails
        await firebase_admin_1.adminAuth.deleteUser(userRecord.uid);
        throw new v2_1.https.HttpsError('internal', 'Failed to create user record.');
    }
    return {
        uid: userRecord.uid,
        email,
        name,
        role,
    };
});
//# sourceMappingURL=createUser.js.map