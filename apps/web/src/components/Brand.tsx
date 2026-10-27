"use client";
import { useState } from "react"; import { SITE } from "@/lib/site";
export function Logo({ size = 40 }: { size?: number }) { const [bad, setBad] = useState(false);
  return bad ? <div style={{ width: size, height: size }} className="grid place-items-center rounded-lg bg-crimson text-sm font-bold text-white">GU</div> : <img src={SITE.logo} alt={SITE.name} style={{ width: size, height: size }} className="rounded-lg bg-white object-contain p-0.5" onError={() => setBad(true)} />; }
export const Brand = ({ dark }: { dark?: boolean }) => <div className="flex items-center gap-3"><Logo /><div className="leading-tight"><p className={`text-[11px] font-semibold uppercase tracking-widest ${dark ? "text-sky-200" : "text-crimson"}`}>{SITE.name}</p><p className={`text-sm font-bold ${dark ? "text-white" : "text-navy-900"}`}>{SITE.title}</p></div></div>;
