"use client";
import Link from "next/link"; import { Badge, Card, Stat, useLoad, Empty } from "@/components/ui"; import { dt } from "@/lib/api"; import { ROLES, NAV, MODULES, Role } from "@/lib/roles"; import { useAuth } from "@/lib/auth"; import { portalHref } from "@/lib/nav";
export function Dashboard({ role }: { role: Role }) {
  const { user } = useAuth(), R = ROLES[role], co = useLoad<any[]>("/companies", []), dr0 = useLoad<any[]>("/drives", []), no = useLoad<any[]>("/notifications", []);
  const vi = useLoad<any[]>(["student", "td"].includes(role) ? null : "/visits", []), ap = useLoad<any>(["hod", "ceo", "admin"].includes(role) ? "/approvals" : null, null);
  const dr = { ...dr0, d: dr0.d.filter((x: any) => x.status !== "Draft") }; const today = new Date().toISOString().slice(0, 10), upcoming = dr.d.filter((d) => !["Rejected", "Cancelled"].includes(d.status) && d.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const pend: Record<string, number> = ap.d ? { "drive-approvals": ap.d.drives.length + ap.d.results.length, "assign-approvals": ap.d.assignments.length, visits: ap.d.visits.length, offers: ap.d.offers.length, "early-joining": ap.d.eja.length } : {};
  const total = ap.d ? Object.values(pend).reduce((a, b) => a + b, 0) : 0;
  const stats = role === "student"
    ? [["Invitations", dr.d.length], ["Consent pending", dr.d.filter((d) => !d.my && Date.now() <= d.consentBy).length, "amber"], ["Said Yes", dr.d.filter((d) => d.my === "yes").length, "green"], ["Selected", dr.d.filter((d) => d.myResult?.result === "Selected").length, "green"]]
    : role === "td" ? [["Approved drives", dr.d.length], ["Consent = Yes students", dr.d.reduce((n, d) => n + d.invites.length, 0), "green"], ["Upcoming drives", upcoming.length, "amber"]]
    : [["Companies", co.d.length], ["Not Assigned / Unassigned", co.d.filter((c) => c.status !== "Assigned").length, "red"], ["Drives", dr.d.length], ["Upcoming drives", upcoming.length, "green"], ["Pending approvals", role === "officer" ? vi.d.filter((v) => v.status === "Pending").length + dr.d.filter((d) => d.status === "Pending").length : total, "amber"]];
  const mods = MODULES.map((m) => ({ ...m, items: NAV.filter((n) => n.group === m.group && n.roles.includes(role)) })).filter((m) => m.items.length);
  return <>
    <div><h2 className="text-xl font-bold text-navy-900">Welcome, {user?.name}</h2><p className="text-sm text-slate-500">{R.label} · {R.tagline}</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{stats.map(([l, v, t]: any) => <Stat key={l} label={l} value={v} tone={t} />)}</div>
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Portal modules</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{mods.map((m) => { const I = m.icon; return <section key={m.group} className="card flex flex-col p-4 transition hover:shadow-md">
        <div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-lg bg-navy-900 text-white"><I className="h-5 w-5" /></div>{m.group === "Notifications" && no.d.length > 0 && <Badge tone="red">{no.d.length}</Badge>}</div>
        <h3 className="mt-3 font-semibold text-navy-900">{m.group}</h3><p className="mt-1 flex-1 text-xs text-slate-500">{m.items.length < NAV.filter((n) => n.group === m.group).length ? m.items.map((n) => n.label).join(" • ") : m.desc}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{m.items.map((n) => <Link key={n.key} href={portalHref(n.key)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-navy-800 hover:bg-crimson hover:text-white">{n.label}{pend[n.key] > 0 && <span className="rounded-full bg-crimson px-1.5 text-[10px] text-white">{pend[n.key]}</span>}</Link>)}</div></section>; })}</div></div>
    <div className="grid gap-4">
      <Card title="Upcoming / active drives">{upcoming.length ? <ul className="divide-y">{upcoming.slice(0, 5).map((d) => <li key={d.id} className="flex items-center justify-between py-2 text-sm"><div><p className="font-medium">{d.company}</p><p className="text-xs text-slate-500">{d.startDate} → {d.endDate} · {d.type}</p></div><Badge>{d.status}</Badge></li>)}</ul> : <Empty>No upcoming drives</Empty>}</Card></div>
    {role === "student" && dr.d.some((d) => !d.my && Date.now() <= d.consentBy) && <Card title="⏰ Consent deadline">{dr.d.filter((d) => !d.my && Date.now() <= d.consentBy).map((d) => <p key={d.id} className="text-sm">{d.company}: give your consent before <b>{dt(d.consentBy)}</b> (else auto Not Interested)</p>)}</Card>}
    <Card title="Your access (as per portal rules)"><ul className="grid gap-1 text-sm sm:grid-cols-2">{R.access.map((a) => <li key={a} className="flex gap-2"><span className="text-emerald-600">✓</span>{a}</li>)}</ul></Card>
  </>;
}
