// Firebase mode: Firebase Authentication (accounts/passwords) + Cloud Firestore (all data). Works with the real project or the local Emulator Suite.
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Store, Row } from "./store"; import type { Identity } from "./identity";
function init() { if (!getApps().length) initializeApp(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : undefined); }
export function firestoreStore(): Store {
  init(); const db = getFirestore(); db.settings({ ignoreUndefinedProperties: true });
  return {
    async get(c, id) { const s = await db.collection(c).doc(id).get(); return s.exists ? ({ ...s.data(), id } as Row) : null; },
    async set(c, id, d) { const { id: _i, ...rest } = d; await db.collection(c).doc(id).set(rest); },
    async del(c, id) { await db.collection(c).doc(id).delete(); },
    async list(c) { return (await db.collection(c).get()).docs.map((x) => ({ ...x.data(), id: x.id }) as Row); },
  };
}
export function firebaseIdentity(): Identity {
  init(); const a = getAuth();
  return {
    mode: "firebase",
    async create(email, password, name) { try { return (await a.createUser({ email, password, displayName: name })).uid; } catch (e: any) { if (e.code === "auth/email-already-exists") throw new Error("exists"); throw e; } },
    async setPassword(uid, password) { await a.updateUser(uid, { password }); },
    async remove(uid) { await a.deleteUser(uid); },
    async verify(t) { try { return (await a.verifyIdToken(t)).uid; } catch { return null; } },
  };
}
