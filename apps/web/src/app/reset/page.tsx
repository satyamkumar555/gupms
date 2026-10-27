"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import { KeyRound } from "lucide-react"; import { api } from "@/lib/api"; import { AuthLayout } from "@/components/AuthLayout"; import { Alert, Field } from "@/components/ui";
export default function Reset() {
  const [token, setT] = useState(""), [pw, setP] = useState(""), [cf, setC] = useState(""), [err, setErr] = useState(""), [ok, setOk] = useState(false);
  useEffect(() => setT(new URLSearchParams(location.search).get("token") || ""), []);
  const go = async (e: any) => { e.preventDefault(); setErr(""); if (pw !== cf) return setErr("Passwords do not match"); try { await api("/auth/reset", "POST", { token, password: pw }); setOk(true); } catch (x: any) { setErr(x.message); } };
  return <AuthLayout icon={KeyRound} title="Reset password" sub="Choose a new password for your account." points={["Use at least 6 characters", "The link works once and expires in 1 hour"]}>
    {ok ? <div className="space-y-3"><Alert type="ok" msg="Password changed. You can sign in now." /><div className="flex gap-2"><Link className="btn" href="/">Student login</Link><Link className="btn-o" href="/staff">Staff login</Link></div></div>
      : <form className="space-y-3" onSubmit={go}><h2 className="text-2xl font-bold text-navy-900">Set new password</h2><Field label="New password"><input className="inp" type="password" required minLength={6} value={pw} onChange={(e) => setP(e.target.value)} /></Field><Field label="Confirm password"><input className="inp" type="password" required value={cf} onChange={(e) => setC(e.target.value)} /></Field><Alert msg={err} /><button className="btn w-full">Change password</button></form>}</AuthLayout>;
}
