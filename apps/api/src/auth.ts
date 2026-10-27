import crypto from "node:crypto";
export const hash = (pw: string) => { const s = crypto.randomBytes(16).toString("hex"); return s + ":" + crypto.scryptSync(pw, s, 32).toString("hex"); };
export const check = (pw: string, h?: string) => {
  if (!h) return false; const [s, k] = h.split(":"); const a = Buffer.from(k, "hex"), b = crypto.scryptSync(pw, s, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const mac = (b: string, secret: string) => crypto.createHmac("sha256", secret).update(b).digest("base64url");
export const sign = (uid: string, secret: string) => { const b = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 8 * 36e5 })).toString("base64url"); return b + "." + mac(b, secret); };
export function verifyLocal(t: string, secret: string): string | null {
  const [b, s] = (t || "").split("."); if (!b || !s || s !== mac(b, secret)) return null;
  try { const p = JSON.parse(Buffer.from(b, "base64url").toString()); return p.exp > Date.now() ? p.uid : null; } catch { return null; }
}
