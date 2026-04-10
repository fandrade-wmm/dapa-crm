"use strict";
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
exports.deleteCatalog = exports.updateCatalog = exports.createCatalog = exports.getCatalogs = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("../middleware/auth");
// ---------- getCatalogs ----------
exports.getCatalogs = v2_1.https.onCall({}, async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const db = (0, firestore_1.getFirestore)();
    const snap = await db
        .collection('catalogs')
        .where('ownerId', '==', auth.uid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
});
exports.createCatalog = v2_1.https.onCall({}, async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const { name, description, fileUrl, fileName } = request.data;
    if (!name || !fileUrl || !fileName) {
        throw new v2_1.https.HttpsError('invalid-argument', 'name, fileUrl and fileName are required.');
    }
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('catalogs').doc();
    const data = {
        name,
        description: description !== null && description !== void 0 ? description : null,
        fileUrl,
        fileName,
        ownerId: auth.uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await ref.set(data);
    v2_1.logger.info(`Catalog created: ${ref.id} by ${auth.uid}`);
    const snap = await ref.get();
    return Object.assign({ id: snap.id }, snap.data());
});
exports.updateCatalog = v2_1.https.onCall({}, async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const _a = request.data, { id } = _a, updates = __rest(_a, ["id"]);
    if (!id)
        throw new v2_1.https.HttpsError('invalid-argument', 'id is required.');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('catalogs').doc(id);
    const snap = await ref.get();
    if (!snap.exists)
        throw new v2_1.https.HttpsError('not-found', 'Catalog not found.');
    if (snap.data().ownerId !== auth.uid) {
        throw new v2_1.https.HttpsError('permission-denied', 'Not your catalog.');
    }
    await ref.update(Object.assign(Object.assign({}, updates), { updatedAt: firestore_1.FieldValue.serverTimestamp() }));
    const updated = await ref.get();
    return Object.assign({ id: updated.id }, updated.data());
});
// ---------- deleteCatalog ----------
exports.deleteCatalog = v2_1.https.onCall({}, async (request) => {
    const auth = await (0, auth_1.verifyAuth)(request);
    const { id } = request.data;
    if (!id)
        throw new v2_1.https.HttpsError('invalid-argument', 'id is required.');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('catalogs').doc(id);
    const snap = await ref.get();
    if (!snap.exists)
        throw new v2_1.https.HttpsError('not-found', 'Catalog not found.');
    if (snap.data().ownerId !== auth.uid) {
        throw new v2_1.https.HttpsError('permission-denied', 'Not your catalog.');
    }
    await ref.delete();
    v2_1.logger.info(`Catalog deleted: ${id} by ${auth.uid}`);
    return { success: true };
});
//# sourceMappingURL=manageCatalogs.js.map