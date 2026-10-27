"use client";
import { Suspense, useContext } from "react"; import { useRouter, useSearchParams } from "next/navigation"; import { portalHref } from "@/lib/nav"; import { ConfigCtx } from "@/lib/ctx"; import { useAuth } from "@/lib/auth"; import { Shell } from "@/components/Shell"; import { allowed, Role } from "@/lib/roles";
import { Dashboard } from "@/features/Dashboard"; import { Companies } from "@/features/Companies"; import { Downloads } from "@/features/Downloads"; import { FollowUps } from "@/features/FollowUps"; import { Visits } from "@/features/Visits"; import { Drives } from "@/features/Drives";
import { CalendarView } from "@/features/CalendarView"; import { Approvals } from "@/features/Approvals"; import { Students } from "@/features/Students"; import { Offers, EarlyJoining } from "@/features/Student2"; import { Trackers } from "@/features/Trackers";
import { People, Profile } from "@/features/People"; import { UsersAdmin, RegistryAdmin, DataEditor, SettingsAdmin, AuditLog } from "@/features/Admin";
const C: Record<string, [any, any?]> = { dashboard: [Dashboard], companies: [Companies], downloads: [Downloads], "early-joining": [EarlyJoining], followups: [FollowUps], visits: [Visits], students: [Students],
  "drive-approvals": [Approvals, { kind: "drives" }], drives: [Drives], calendar: [CalendarView], offers: [Offers], "assign-approvals": [Approvals, { kind: "assign" }], "placement-tracker": [Trackers, { fixed: "placement" }], "drive-tracker": [Trackers, { fixed: "drive" }], "visit-chart": [Trackers, { fixed: "visit" }],
  people: [People], profile: [Profile], users: [UsersAdmin], registry: [RegistryAdmin], data: [DataEditor], settings: [SettingsAdmin], audit: [AuditLog] };
function PortalPage() {
  const params = { slug: (useSearchParams().get("p") || "dashboard").split("/").filter(Boolean) }, cfg = useContext(ConfigCtx), { user } = useAuth(), r = useRouter(), role = user!.role as Role, key = params.slug?.[0] || "dashboard", arg = params.slug?.[1], full = [key, arg].filter(Boolean).join("/");
  const ok = C[key] && allowed(role, arg === "new" || arg?.startsWith("draft-") ? `${key}/new` : key);
  if (!ok) return <Shell role={role} page="dashboard" config={cfg}><p className="py-10 text-center text-slate-500">This page is not available for your role.</p></Shell>;
  const [X, extra] = C[key]; return <Shell role={role} page={full} config={cfg}><X role={role} cfg={cfg} arg={arg} go={(p: string) => r.push(portalHref(p))} {...extra} /></Shell>;
}

export default function Page() { return <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}><PortalPage /></Suspense>; }
