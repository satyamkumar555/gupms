"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import { useRouter } from "next/navigation"; import { GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth"; import { PORTAL_HOME } from "@/lib/nav"; import { api } from "@/lib/api"; import { AuthLayout } from "@/components/AuthLayout"; import { Alert, Field, Fld, useForm } from "@/components/ui"; import { BY_ROLE, COMMON } from "@/lib/fields"; import { STATES, districtsFor } from "@/lib/geo"; import { DEFAULT } from "@/lib/defaults";
const VERIFIED = ["roll", "campus", "course", "passout"], SKIP = ["reportsToEmail", "name"], OPTIONAL = ["gap", "backs", "fatherMobile", "curG", "personalEmail"];
export default function StudentHome() {
  const { user, loading, login, forgot } = useAuth(), r = useRouter(), [tab, setTab] = useState<"login" | "register" | "forgot">("login");
  useEffect(() => { if (!loading && user?.role === "student") r.replace(PORTAL_HOME); }, [user, loading, r]);
  return <AuthLayout icon={GraduationCap} title="Student Login & Registration" sub="Sign in to see your drive invitations, lock your consent and track your placement journey." points={["Registration is verified against the university student records", "Lock consent Yes / No before the deadline", "Upload offer letters and apply for early joining", "Staff members: use the Admin Login link below"]}>
    <div className="flex rounded-lg bg-slate-200 p-1 text-sm font-medium">{(["login", "register"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md py-2 ${tab === t || (t === "login" && tab === "forgot") ? "bg-white text-navy-900 shadow" : "text-slate-500"}`}>{t === "login" ? "Student Login" : "New Registration"}</button>)}</div>
    {tab === "register" ? <Register onDone={async (e, p) => { await login(e, p, "student"); r.push(PORTAL_HOME); }} /> : tab === "forgot" ? <Forgot forgot={forgot} back={() => setTab("login")} /> : <Login login={login} onForgot={() => setTab("forgot")} onOk={() => r.push(PORTAL_HOME)} />}
    <div className="border-t pt-4 text-center text-sm"><Link href="/staff" className="font-medium text-crimson">Admin Login →</Link></div>
  </AuthLayout>;
}
function Login({ login, onForgot, onOk }: any) {
  const [email, setE] = useState(""), [pw, setP] = useState(""), [err, setErr] = useState(""), [busy, setB] = useState(false);
  const go = async (e: any) => { e.preventDefault(); setErr(""); setB(true); try { await login(email, pw, "student"); onOk(); } catch (x: any) { setErr(x.message); } setB(false); };
  return <form className="space-y-3" onSubmit={go}><div><h2 className="text-2xl font-bold text-navy-900">Student sign in</h2><p className="text-sm text-slate-500">Use your university email and password</p></div>
    <Field label="Email"><input className="inp" type="email" required autoFocus value={email} onChange={(e) => setE(e.target.value)} /></Field><Field label="Password"><input className="inp" type="password" required value={pw} onChange={(e) => setP(e.target.value)} /></Field>
    <Alert msg={err} /><button className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    <div className="flex justify-between text-sm"><button type="button" className="text-crimson" onClick={onForgot}>Forgot password?</button></div></form>;
}
function Forgot({ forgot, back }: any) {
  const [email, setE] = useState(""), [res, setRes] = useState<any>(null), [err, setErr] = useState("");
  const go = async (e: any) => { e.preventDefault(); setErr(""); try { setRes(await forgot(email)); } catch (x: any) { setErr(x.message); } };
  return <form className="space-y-3" onSubmit={go}><div><h2 className="text-2xl font-bold text-navy-900">Forgot password</h2><p className="text-sm text-slate-500">Enter your registered email. A reset link will be sent.</p></div>
    <Field label="Email"><input className="inp" type="email" required value={email} onChange={(e) => setE(e.target.value)} /></Field><Alert msg={err} />
    {res && <div className="space-y-2"><Alert type="ok" msg="If this email is registered, a password reset link has been sent." />{res.devLink && <Link className="btn-o btn-sm w-full" href={res.devLink}>Open the reset link</Link>}</div>}
    <button className="btn w-full">Send reset link</button><button type="button" className="w-full text-sm text-slate-500" onClick={back}>← Back to sign in</button></form>;
}
function Register({ onDone }: { onDone: (e: string, p: string) => Promise<void> }) {
  const [step, setStep] = useState(1), v = useForm<any>({}), f = useForm<any>({}), [rec, setRec] = useState<any>(null), [err, setErr] = useState(""), [busy, setB] = useState(false);
  const verify = async (e: any) => { e.preventDefault(); setErr(""); setB(true); try { const r = await api("/auth/verify-student", "POST", v.f); setRec(r.record); f.setAll({ ...r.record }); setStep(2); } catch (x: any) { setErr(x.message); } setB(false); };
  const fields = [...COMMON.filter((x) => !SKIP.includes(x.k)), ...BY_ROLE.student].filter((x) => !VERIFIED.includes(x.k));
  const submit = async (e: any) => { e.preventDefault(); setErr(""); if (f.f.password !== f.f.confirm) return setErr("Password and confirm password do not match"); setB(true);
    try { const { confirm, ...rest } = f.f; await api("/auth/register-student", "POST", { ...rest, roll: v.f.roll, email: v.f.email }); await onDone(rec.email, f.f.password); } catch (x: any) { setErr(x.message); } setB(false); };
  if (step === 1) return <form className="space-y-3" onSubmit={verify}><div><h2 className="text-2xl font-bold text-navy-900">Student registration</h2><p className="text-sm text-slate-500">Step 1 of 2 · Verify yourself. Your roll number and email must match the university student records.</p></div>
    <Fld label="University Roll No." k="roll" f={v.f} set={v.set} req /><Fld label="University email (as given to the university)" k="email" type="email" f={v.f} set={v.set} req /><Alert msg={err} /><button className="btn w-full" disabled={busy}>{busy ? "Verifying…" : "Verify & continue"}</button></form>;
  return <form className="space-y-3" onSubmit={submit}><div><h2 className="text-2xl font-bold text-navy-900">Complete registration</h2><p className="text-sm text-slate-500">Step 2 of 2 · Verified ✅</p></div>
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-emerald-50 p-3 text-sm">{[["Name", rec.name], ["Roll No.", rec.roll], ["Email", rec.email], ["Course", rec.course], ["Session", rec.passout], ["Campus", rec.campus]].map(([a, b]) => <div key={a}><p className="text-[11px] text-slate-500">{a}</p><p className="font-medium">{b || "—"}</p></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-2"><Fld label="Create password (min 6)" k="password" type="password" f={f.f} set={f.set} req /><Fld label="Confirm password" k="confirm" type="password" f={f.f} set={f.set} req /></div>
    <p className="pt-1 text-sm font-semibold text-navy-900">Your details</p>
    <div className="grid gap-3 sm:grid-cols-2">{fields.map((x) => <Fld key={x.k} label={x.l} k={x.k} f={f.f} set={f.set} type={x.t} opts={x.geo === "state" ? STATES : undefined} list={x.geo === "district" ? districtsFor(f.f.state) : undefined} req={!OPTIONAL.includes(x.k)} />)}</div>
    <Alert msg={err} /><div className="flex gap-2"><button type="button" className="btn-o" onClick={() => setStep(1)}>Back</button><button className="btn flex-1" disabled={busy}>{busy ? "Registering…" : "Register & sign in"}</button></div></form>;
}
