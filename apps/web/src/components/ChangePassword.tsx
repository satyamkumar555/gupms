"use client";
import { useState } from "react"; import { useAuth } from "@/lib/auth"; import { Alert, Field } from "./ui";
export function ChangePassword({ forced }: { forced?: boolean }) {
  const { changePassword } = useAuth(), [cur, setCur] = useState(""), [nw, setNw] = useState(""), [cf, setCf] = useState(""), [msg, setMsg] = useState<{ t: "err" | "ok"; s: string }>({ t: "ok", s: "" }), [busy, setB] = useState(false);
  const go = async (e: any) => { e.preventDefault(); setMsg({ t: "ok", s: "" });
    if (nw.length < 6) return setMsg({ t: "err", s: "New password must be at least 6 characters" }); if (nw !== cf) return setMsg({ t: "err", s: "New password and confirm password do not match" }); if (nw === cur) return setMsg({ t: "err", s: "New password must be different from the current one" });
    setB(true); try { await changePassword(cur, nw); setCur(""); setNw(""); setCf(""); setMsg({ t: "ok", s: "Password changed successfully" }); } catch (x: any) { setMsg({ t: "err", s: x.message }); } setB(false); };
  return <form onSubmit={go} className="space-y-3"><Field label={forced ? "Current (initial) password given by admin" : "Current password"}><input className="inp" type="password" required value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
    <Field label="New password (min 6 characters)"><input className="inp" type="password" required value={nw} onChange={(e) => setNw(e.target.value)} /></Field><Field label="Confirm new password"><input className="inp" type="password" required value={cf} onChange={(e) => setCf(e.target.value)} /></Field>
    <Alert msg={msg.s} type={msg.t} /><button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Change password"}</button></form>;
}
