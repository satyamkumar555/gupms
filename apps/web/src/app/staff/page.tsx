"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import { useRouter } from "next/navigation"; import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth"; import { PORTAL_HOME } from "@/lib/nav"; import { AuthLayout } from "@/components/AuthLayout"; import { Alert, Field } from "@/components/ui";
export default function StaffLogin() {
  const { user, loading, login, forgot } = useAuth(), r = useRouter(), [email, setE] = useState(""), [pw, setP] = useState(""), [err, setErr] = useState(""), [busy, setB] = useState(false), [fg, setFg] = useState<any>(null);
  useEffect(() => { if (!loading && user && user.role !== "student") r.replace(PORTAL_HOME); }, [user, loading, r]);
  const go = async (e: any) => { e.preventDefault(); setErr(""); setB(true); try { await login(email, pw, "staff"); r.push(PORTAL_HOME); } catch (x: any) { setErr(x.message); } setB(false); };
  const reset = async () => { setErr(""); if (!email) return setErr("Enter your email first"); try { setFg(await forgot(email)); } catch (x: any) { setErr(x.message); } };
  return <AuthLayout icon={Shield} title="Admin Login" sub="Sign in with the email and password issued to you. Your account opens automatically." points={["Your access is decided by your account", "Accounts are issued by the university", "First login: set your own password"]}>
    <div><h2 className="text-2xl font-bold text-navy-900">Sign in</h2><p className="text-sm text-slate-500">Enter your login ID (email) and password</p></div>
    <form className="space-y-3" onSubmit={go}><Field label="Login ID (email)"><input className="inp" type="email" required autoFocus value={email} onChange={(e) => setE(e.target.value)} /></Field><Field label="Password"><input className="inp" type="password" required value={pw} onChange={(e) => setP(e.target.value)} /></Field>
      <Alert msg={err} />{fg && <Alert type="ok" msg="If this email is registered, a password reset link has been sent." />}{fg?.devLink && <Link className="btn-o btn-sm w-full" href={fg.devLink}>Open the reset link</Link>}
      <button className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button><button type="button" className="text-sm text-crimson" onClick={reset}>Forgot password?</button></form>
    <p className="border-t pt-4 text-center text-sm"><Link href="/" className="text-slate-500">← Student login & registration</Link></p></AuthLayout>;
}
