"use client";
import { useEffect, useState } from "react"; import Link from "next/link"; import { Bell, LogOut, Menu, X } from "lucide-react";
import { NAV, ROLES, Role } from "@/lib/roles"; import { portalHref } from "@/lib/nav"; import { Brand } from "./Brand"; import { useAuth } from "@/lib/auth"; import { api, dt } from "@/lib/api"; import { cx, Badge } from "./ui";
export function Shell({ role, page, config, children }: { role: Role; page: string; config: any; children: any }) {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false), [bell, setBell] = useState(false), [notes, setNotes] = useState<any[]>([]);
  useEffect(() => { api("/notifications").then(setNotes).catch(() => {}); }, [page]);
  const override: string[] | undefined = config?.nav?.[role]; let items = NAV.filter((n) => n.roles.includes(role));
  if (override?.length) items = [...(override.map((k) => items.find((n) => n.key === k)).filter(Boolean) as any[]), ...items.filter((n) => ["dashboard", "profile"].includes(n.key) || n.group === "Admin").filter((n) => !override.includes(n.key))];
  const groups = [...new Set(items.map((n) => n.group))], isOn = (k: string) => page === k || (page.startsWith(k + "/") && !NAV.some((m) => m.key === page));
  const side = <aside className="flex h-full w-64 flex-col bg-navy-950 text-slate-300"><div className="border-b border-white/10 p-4"><Brand dark /></div>
    <nav className="flex-1 space-y-3 overflow-y-auto p-3">{groups.map((g) => { const its = items.filter((n) => n.group === g), single = its.length === 1 && (its[0].label === g || g === "Main");
      return <div key={g}>{!single && <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{g}</p>}
        {its.map((n) => { const I = n.icon; return <Link key={n.key} href={portalHref(n.key)} onClick={() => setOpen(false)} className={cx("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm", isOn(n.key) ? "bg-crimson text-white" : "hover:bg-white/5")}><I className="h-4 w-4 shrink-0" />{n.label}</Link>; })}</div>; })}</nav>
    <div className="border-t border-white/10 p-3 text-xs text-slate-500">Logged in as <b className="text-slate-300">{ROLES[role].label}</b></div></aside>;
  const title = NAV.find((n) => n.key === page)?.label || NAV.find((n) => isOn(n.key))?.label;
  return <div className="flex min-h-screen"><div className="sticky top-0 hidden h-screen lg:block">{side}</div>
    {open && <div className="fixed inset-0 z-40 flex lg:hidden"><div className="h-full">{side}</div><div className="flex-1 bg-black/40" onClick={() => setOpen(false)} /></div>}
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
      <button className="lg:hidden" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><h1 className="hidden text-sm font-semibold text-navy-900 lg:block">{title}</h1>
      <div className="flex items-center gap-3"><div className="relative"><button className="relative rounded-full p-2 hover:bg-slate-100" onClick={() => setBell(!bell)}><Bell className="h-5 w-5" />{notes.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-crimson px-1 text-[10px] text-white">{notes.length}</span>}</button>
        {bell && <div className="absolute right-0 mt-2 max-h-96 w-80 overflow-auto rounded-xl border bg-white p-2 shadow-xl">{notes.length ? notes.slice(0, 30).map((n, i) => <Link key={i} href={portalHref(n.link || "dashboard")} onClick={() => setBell(false)} className="block rounded-lg p-2 text-sm hover:bg-slate-50"><Badge tone="blue">{n.kind}</Badge><p className="mt-1">{n.text}</p>{n.at && <p className="text-xs text-slate-400">{dt(n.at)}</p>}</Link>) : <p className="p-3 text-sm text-slate-400">No notifications</p>}</div>}</div>
        <div className="hidden text-right text-xs leading-tight sm:block"><p className="font-semibold">{user?.name}</p><p className="text-slate-500">{ROLES[role].label}</p></div>
        <button className="btn-o btn-sm" onClick={async () => { await logout(); location.href = role === "student" ? "/" : "/staff"; }}><LogOut className="h-3.5 w-3.5" />Logout</button></div></header>
      <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">{config?.notice?.[role] && <div className="rounded-lg border-l-4 border-crimson bg-white p-3 text-sm shadow-sm">📢 {config.notice[role]}</div>}{children}</main></div></div>;
}
