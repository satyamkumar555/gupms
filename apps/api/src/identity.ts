import crypto from "node:crypto";
import type { Store } from "./store";
import { hash, check, sign, verifyLocal } from "./auth";
/** Who can sign in. Roles/profile live in the `users` collection; this only handles credentials. */
export interface Identity {
  mode: "local" | "firebase";
  create(email: string, password: string, name?: string): Promise<string>; // returns uid; throws Error("exists") for duplicate email
  setPassword(uid: string, password: string): Promise<void>;
  remove(uid: string): Promise<void>;
  verify(token: string): Promise<string | null>;
  login?(email: string, password: string): Promise<{ uid: string; token: string } | null>; // local mode only (Firebase signs in from the browser)
  checkPassword?(uid: string, password: string): Promise<boolean>;
}
export function localIdentity(S: Store, secret: string): Identity {
  return {
    mode: "local",
    async create(email, password) {
      if ((await S.list("credentials")).some((c) => c.email === email)) throw new Error("exists");
      const uid = crypto.randomBytes(8).toString("hex"); await S.set("credentials", uid, { email, pw: hash(password) }); return uid;
    },
    async setPassword(uid, password) { const c = await S.get("credentials", uid); if (!c) throw new Error("Account not found"); await S.set("credentials", uid, { ...c, pw: hash(password) }); },
    async remove(uid) { await S.del("credentials", uid); },
    async verify(token) { return verifyLocal(token, secret); },
    async login(email, password) { const c = (await S.list("credentials")).find((x) => x.email === email); return c && check(password, c.pw) ? { uid: c.id, token: sign(c.id, secret) } : null; },
    async checkPassword(uid, password) { const c = await S.get("credentials", uid); return !!c && check(password, c.pw); },
  };
}
