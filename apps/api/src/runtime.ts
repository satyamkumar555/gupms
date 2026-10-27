import dotenv from "dotenv"; import path from "node:path";
dotenv.config({ path: process.env.ENV_FILE || ".env.localdev" }); // developer settings; in Firebase Functions the values come from .env.<project-id>
import { MemoryStore, Store } from "./store"; import { localIdentity, Identity } from "./identity"; import { diskFiles, chunkFiles, bucketFiles, FileStore } from "./files";
export async function buildRuntime(): Promise<{ store: Store; identity: Identity; files: FileStore; mode: string; storeKind: string }> {
  const mode = process.env.AUTH_MODE || "local", storeKind = process.env.STORE || "memory", dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || ".data");
  if (process.env.NODE_ENV === "production" && (mode === "local" || storeKind === "memory")) throw new Error("Production needs AUTH_MODE=firebase and STORE=firestore");
  if (mode === "local" && storeKind === "firestore") throw new Error("AUTH_MODE=local needs STORE=memory");
  const fb = mode === "firebase" || storeKind === "firestore" ? await import("./firebase") : null;
  const store: Store = storeKind === "firestore" ? fb!.firestoreStore() : new MemoryStore(path.join(dataDir, "db.json"));
  const identity = mode === "firebase" ? fb!.firebaseIdentity() : localIdentity(store, process.env.LOCAL_SECRET || "dev-secret");
  const files = storeKind !== "firestore" ? diskFiles(path.join(dataDir, "uploads")) : (process.env.FIREBASE_STORAGE_BUCKET || process.env.GU_STORAGE_BUCKET) ? await bucketFiles((process.env.FIREBASE_STORAGE_BUCKET || process.env.GU_STORAGE_BUCKET)!) : chunkFiles(store);
  return { store, identity, files, mode, storeKind };
}
