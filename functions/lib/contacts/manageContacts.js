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
exports.deleteContact = exports.deduplicateContacts = exports.updateContact = exports.createContact = exports.getContactByPhone = exports.getContacts = void 0;
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const zod_1 = require("zod");
const firebase_admin_1 = require("../config/firebase-admin");
const auth_1 = require("../middleware/auth");
// ---------- Helpers ----------
function normalizePhone(phone) {
    return phone.replace(/\D/g, '');
}
function buildFullName(firstName, lastName) {
    return [firstName, lastName].filter(Boolean).join(' ').trim();
}
// ---------- Schemas ----------
const contactUpsertSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'El nombre es requerido'),
    lastName: zod_1.z.string().optional().nullable(),
    cedulaRuc: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    company: zod_1.z.string().optional().nullable(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
});
const updateContactSchema = contactUpsertSchema.partial().extend({
    id: zod_1.z.string().min(1),
});
const deleteContactSchema = zod_1.z.object({ id: zod_1.z.string().min(1) });
const getContactsSchema = zod_1.z.object({
    limit: zod_1.z.number().int().positive().max(200).default(100),
    search: zod_1.z.string().optional().nullable(),
    startAfter: zod_1.z.string().optional(),
});
const getContactByPhoneSchema = zod_1.z.object({
    phone: zod_1.z.string().min(1),
});
// ---------- getContacts ----------
exports.getContacts = v2_1.https.onCall(async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const parsed = getContactsSchema.safeParse(request.data);
    if (!parsed.success)
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    const { limit, search, startAfter } = parsed.data;
    try {
        let query = firebase_admin_1.adminDb
            .collection('contacts')
            .where('ownerId', '==', auth.uid)
            .orderBy('createdAt', 'desc')
            .limit(limit);
        if (startAfter) {
            const startDoc = await firebase_admin_1.adminDb.collection('contacts').doc(startAfter).get();
            if (startDoc.exists)
                query = query.startAfter(startDoc);
        }
        const snap = await query.get();
        let results = snap.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
        if (search) {
            const q = search.toLowerCase();
            results = results.filter((c) => {
                var _a, _b, _c, _d, _e, _f;
                return ((_a = c.fullName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(q)) ||
                    ((_b = c.phone) === null || _b === void 0 ? void 0 : _b.includes(q)) ||
                    ((_c = c.email) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(q)) ||
                    ((_d = c.cedulaRuc) === null || _d === void 0 ? void 0 : _d.includes(q)) ||
                    ((_e = c.city) === null || _e === void 0 ? void 0 : _e.toLowerCase().includes(q)) ||
                    ((_f = c.company) === null || _f === void 0 ? void 0 : _f.toLowerCase().includes(q));
            });
        }
        return results;
    }
    catch (err) {
        v2_1.logger.error('getContacts error:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to fetch contacts.');
    }
});
// ---------- getContactByPhone ----------
exports.getContactByPhone = v2_1.https.onCall(async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const parsed = getContactByPhoneSchema.safeParse(request.data);
    if (!parsed.success)
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    const normalized = normalizePhone(parsed.data.phone);
    const snap = await firebase_admin_1.adminDb
        .collection('contacts')
        .where('ownerId', '==', auth.uid)
        .where('phoneNormalized', '==', normalized)
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return Object.assign({ id: doc.id }, doc.data());
});
// ---------- createContact ----------
exports.createContact = v2_1.https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const auth = await (0, auth_1.verifyAuth)(request);
    const parsed = contactUpsertSchema.safeParse(request.data);
    if (!parsed.success)
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    const data = parsed.data;
    const phoneNormalized = data.phone ? normalizePhone(data.phone) : null;
    const fullName = buildFullName(data.firstName, data.lastName);
    const now = admin.firestore.FieldValue.serverTimestamp();
    try {
        // Prevent duplicates: if a contact with this phone already exists, update it instead
        if (phoneNormalized) {
            const existing = await firebase_admin_1.adminDb
                .collection('contacts')
                .where('ownerId', '==', auth.uid)
                .where('phoneNormalized', '==', phoneNormalized)
                .limit(1)
                .get();
            if (!existing.empty) {
                const ref = existing.docs[0].ref;
                await ref.update({
                    firstName: data.firstName,
                    lastName: (_a = data.lastName) !== null && _a !== void 0 ? _a : null,
                    fullName,
                    cedulaRuc: (_b = data.cedulaRuc) !== null && _b !== void 0 ? _b : null,
                    email: (_c = data.email) !== null && _c !== void 0 ? _c : null,
                    phone: (_d = data.phone) !== null && _d !== void 0 ? _d : null,
                    phoneNormalized,
                    address: (_e = data.address) !== null && _e !== void 0 ? _e : null,
                    city: (_f = data.city) !== null && _f !== void 0 ? _f : null,
                    company: (_g = data.company) !== null && _g !== void 0 ? _g : null,
                    tags: data.tags,
                    updatedAt: now,
                });
                const updated = await ref.get();
                return Object.assign({ id: updated.id }, updated.data());
            }
        }
        const ref = await firebase_admin_1.adminDb.collection('contacts').add({
            firstName: data.firstName,
            lastName: (_h = data.lastName) !== null && _h !== void 0 ? _h : null,
            fullName,
            cedulaRuc: (_j = data.cedulaRuc) !== null && _j !== void 0 ? _j : null,
            email: (_k = data.email) !== null && _k !== void 0 ? _k : null,
            phone: (_l = data.phone) !== null && _l !== void 0 ? _l : null,
            phoneNormalized,
            address: (_m = data.address) !== null && _m !== void 0 ? _m : null,
            city: (_o = data.city) !== null && _o !== void 0 ? _o : null,
            company: (_p = data.company) !== null && _p !== void 0 ? _p : null,
            tags: data.tags,
            source: 'manual',
            ownerId: auth.uid,
            createdAt: now,
            updatedAt: now,
        });
        const doc = await ref.get();
        return Object.assign({ id: doc.id }, doc.data());
    }
    catch (err) {
        v2_1.logger.error('createContact error:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to create contact.');
    }
});
// ---------- updateContact ----------
exports.updateContact = v2_1.https.onCall(async (request) => {
    var _a;
    const auth = await (0, auth_1.verifyAuth)(request);
    const parsed = updateContactSchema.safeParse(request.data);
    if (!parsed.success)
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    const _b = parsed.data, { id } = _b, updates = __rest(_b, ["id"]);
    try {
        const ref = firebase_admin_1.adminDb.collection('contacts').doc(id);
        const existing = await ref.get();
        if (!existing.exists)
            throw new v2_1.https.HttpsError('not-found', 'Contact not found.');
        if (existing.data().ownerId !== auth.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'Access denied.');
        }
        const existingData = existing.data();
        const firstName = (_a = updates.firstName) !== null && _a !== void 0 ? _a : existingData.firstName;
        const lastName = updates.lastName !== undefined ? updates.lastName : existingData.lastName;
        const fullName = buildFullName(firstName, lastName);
        const phoneNormalized = updates.phone !== undefined
            ? updates.phone ? normalizePhone(updates.phone) : null
            : existingData.phoneNormalized;
        await ref.update(Object.assign(Object.assign({}, updates), { fullName,
            phoneNormalized, updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        // Update linked conversations if name changed
        if (updates.firstName || updates.lastName !== undefined) {
            const convSnap = await firebase_admin_1.adminDb
                .collection('conversations')
                .where('contactId', '==', id)
                .get();
            const batch = firebase_admin_1.adminDb.batch();
            convSnap.docs.forEach((doc) => {
                batch.update(doc.ref, { customerName: fullName });
            });
            if (!convSnap.empty)
                await batch.commit();
        }
        const updated = await ref.get();
        return Object.assign({ id: updated.id }, updated.data());
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('updateContact error:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to update contact.');
    }
});
// ---------- deduplicateContacts ----------
exports.deduplicateContacts = v2_1.https.onCall(async (request) => {
    var _a;
    const auth = await (0, auth_1.verifyAuth)(request);
    const snap = await firebase_admin_1.adminDb
        .collection('contacts')
        .where('ownerId', '==', auth.uid)
        .get();
    // Group contacts by normalized phone
    const groups = new Map();
    for (const doc of snap.docs) {
        const data = doc.data();
        const raw = (_a = data.phoneNormalized) !== null && _a !== void 0 ? _a : (data.phone ? normalizePhone(data.phone) : '');
        const key = raw || `__no_phone_${doc.id}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(doc);
    }
    let merged = 0;
    let deleted = 0;
    for (const [key, docs] of groups) {
        if (docs.length <= 1 || key.startsWith('__no_phone_'))
            continue;
        // Pick winner: prefer contacts with a real name (not just phone digits), then most fields
        const score = (d) => {
            var _a, _b, _c;
            const data = d.data();
            const name = (_b = (_a = data.firstName) !== null && _a !== void 0 ? _a : data.name) !== null && _b !== void 0 ? _b : '';
            const isRealName = name && !/^\d+$/.test(name) && name !== ((_c = data.phone) !== null && _c !== void 0 ? _c : '');
            return ((isRealName ? 100 : 0) +
                (data.lastName ? 10 : 0) +
                (data.email ? 5 : 0) +
                (data.cedulaRuc ? 5 : 0) +
                (data.company ? 3 : 0) +
                (data.city ? 2 : 0));
        };
        docs.sort((a, b) => score(b) - score(a));
        const winner = docs[0];
        const losers = docs.slice(1);
        // Ensure winner has phoneNormalized set
        const winnerData = winner.data();
        if (!winnerData.phoneNormalized) {
            await winner.ref.update({
                phoneNormalized: key,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Re-point conversations and leads from losers → winner
        for (const loser of losers) {
            const loserId = loser.id;
            const convSnap = await firebase_admin_1.adminDb
                .collection('conversations')
                .where('contactId', '==', loserId)
                .get();
            if (!convSnap.empty) {
                const batch = firebase_admin_1.adminDb.batch();
                convSnap.docs.forEach((d) => batch.update(d.ref, { contactId: winner.id }));
                await batch.commit();
            }
            const leadSnap = await firebase_admin_1.adminDb
                .collection('leads')
                .where('contactId', '==', loserId)
                .get();
            if (!leadSnap.empty) {
                const batch = firebase_admin_1.adminDb.batch();
                leadSnap.docs.forEach((d) => batch.update(d.ref, { contactId: winner.id }));
                await batch.commit();
            }
            await loser.ref.delete();
            deleted++;
        }
        merged++;
        v2_1.logger.info(`Merged ${docs.length} contacts for phone ${key} → winner ${winner.id}`);
    }
    v2_1.logger.info(`deduplicateContacts: merged ${merged} groups, deleted ${deleted} duplicates`);
    return { merged, deleted };
});
// ---------- deleteContact ----------
exports.deleteContact = v2_1.https.onCall(async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const parsed = deleteContactSchema.safeParse(request.data);
    if (!parsed.success)
        throw new v2_1.https.HttpsError('invalid-argument', parsed.error.message);
    const { id } = parsed.data;
    try {
        const ref = firebase_admin_1.adminDb.collection('contacts').doc(id);
        const existing = await ref.get();
        if (!existing.exists)
            throw new v2_1.https.HttpsError('not-found', 'Contact not found.');
        if (existing.data().ownerId !== auth.uid) {
            throw new v2_1.https.HttpsError('permission-denied', 'Access denied.');
        }
        await ref.delete();
        return { success: true };
    }
    catch (err) {
        if (err instanceof v2_1.https.HttpsError)
            throw err;
        v2_1.logger.error('deleteContact error:', err);
        throw new v2_1.https.HttpsError('internal', 'Failed to delete contact.');
    }
});
//# sourceMappingURL=manageContacts.js.map