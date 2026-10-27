"use client";
import { Suspense, useEffect, useState } from "react"; import { useSearchParams } from "next/navigation"; import { api, dt } from "@/lib/api"; import { Brand } from "@/components/Brand"; import { Alert, Badge } from "@/components/ui";
function ConsentInner() {
  const token = useSearchParams().get("t") || "";
  const [d, setD] = useState<any>(null), [err, setErr] = useState(""), [msg, setMsg] = useState("");
  const load = () => api("/public/consent/" + token).then(setD).catch((e) => setErr(e.message)); useEffect(() => { load(); }, []); // eslint-disable-line
  const send = async (consent: string) => { setErr(""); try { await api("/public/consent/" + token, "POST", { consent }); setMsg("Your consent is locked. Thank you."); load(); } catch (e: any) { setErr(e.message); } };
  return <div className="mx-auto max-w-xl p-4 md:p-8"><div className="mb-6"><Brand /></div><div className="card space-y-4 p-6">
    {!d ? <Alert msg={err || "Loading…"} /> : <><div><p className="text-xs uppercase tracking-wide text-slate-500">Recruitment invitation</p><h2 className="text-xl font-bold text-navy-900">{d.drive.company}</h2><p className="text-sm text-slate-600">Hello {d.name} ({d.roll})</p></div>
      <div className="grid grid-cols-2 gap-2 text-sm">{[["Drive Ref", d.drive.ref], ["Type", d.drive.type], ["Designation", d.drive.designation], ["Location", d.drive.jobLocation], ["Date", `${d.drive.startDate} to ${d.drive.endDate}`], ["Venue / Time", `${d.drive.venue || "-"} ${d.drive.reportTime || ""}`]].map(([a, b]) => <div key={a}><p className="text-xs text-slate-500">{a}</p><p className="font-medium">{b || "-"}</p></div>)}</div>
      {!!d.drive.mandatoryItems?.length && <div><p className="text-xs font-semibold text-slate-500">Bring</p><ul className="list-disc pl-5 text-sm">{d.drive.mandatoryItems.map((x: string) => <li key={x}>{x}</li>)}</ul></div>}
      <p className="text-sm">Consent deadline: <b>{dt(d.consentBy)}</b> (otherwise auto <i>Not Interested</i>)</p>
      <p className="text-sm">Current status: {d.consent ? <Badge>{d.consent}</Badge> : <Badge tone="amber">Not given</Badge>}</p>
      <Alert msg={err} /><Alert msg={msg} type="ok" /><div className="flex gap-2"><button className="btn" onClick={() => send("yes")}>Yes, I am interested</button><button className="btn-o" onClick={() => send("no")}>Not interested</button></div></>}</div></div>;
}

export default function Consent() { return <Suspense fallback={null}><ConsentInner /></Suspense>; }
