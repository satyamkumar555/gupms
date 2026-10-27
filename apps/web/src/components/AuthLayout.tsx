"use client";
import { Brand } from "./Brand"; import { SITE } from "@/lib/site";
export function AuthLayout({ icon: I, title, sub, points, children }: { icon: any; title: string; sub: string; points: string[]; children: any }) {
  return <div className="grid min-h-screen lg:grid-cols-2">
    <div className="hidden flex-col justify-between bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 p-10 text-white lg:flex"><Brand dark />
      <div><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-crimson"><I className="h-7 w-7" /></div><h1 className="text-4xl font-bold leading-tight">{title}</h1><p className="mt-2 max-w-md text-slate-300">{sub}</p>
        <ul className="mt-6 max-w-md space-y-1.5 text-sm text-slate-200">{points.map((a) => <li key={a} className="flex gap-2"><span className="text-sky-300">✓</span>{a}</li>)}</ul></div>
      <p className="text-xs text-slate-400">© {new Date().getFullYear()} {SITE.name}</p></div>
    <div className="flex items-center justify-center overflow-y-auto p-6"><div className="w-full max-w-md space-y-5"><div className="lg:hidden"><Brand /></div>{children}</div></div></div>;
}
