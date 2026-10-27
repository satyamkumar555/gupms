"use client";
import { useEffect, useState } from "react"; import { useRouter } from "next/navigation"; import { KeyRound } from "lucide-react"; import { useAuth } from "@/lib/auth"; import { api } from "@/lib/api"; import { ConfigCtx } from "@/lib/ctx"; import { ChangePassword } from "@/components/ChangePassword"; import { Brand } from "@/components/Brand";
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth(), r = useRouter(), [cfg, setCfg] = useState<any>(null), must = !!user?.mustChangePassword;
  useEffect(() => { if (!loading && !user) r.replace(localStorage.getItem("gupms_kind") === "staff" ? "/staff" : "/"); }, [user, loading, r]);
  useEffect(() => { if (user && !must) api("/config").then(setCfg).catch(() => {}); }, [user, must]);
  if (loading || !user) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (must) return <div className="grid min-h-screen place-items-center p-4"><div className="card w-full max-w-md space-y-4 p-6"><Brand /><div className="flex items-center gap-2 text-navy-900"><KeyRound className="h-5 w-5 text-crimson" /><h1 className="text-lg font-bold">Set your own password</h1></div>
    <p className="text-sm text-slate-500">Hello {user.name}. Your account was created by the administrator with an initial password. Please set your own password to continue.</p><ChangePassword forced />
    <button className="w-full text-sm text-slate-500" onClick={async () => { await logout(); location.href = user.role === "student" ? "/" : "/staff"; }}>Sign out</button></div></div>;
  if (!cfg) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  return <ConfigCtx.Provider value={cfg}>{children}</ConfigCtx.Provider>;
}
