"use client";
import { useMemo, useState, useEffect, useId } from "react"; import { Download, Search } from "lucide-react"; import { downloadCsv, api } from "@/lib/api"; import { downloadXlsx } from "@/lib/xlsx";
export const cx = (...a: any[]) => a.filter(Boolean).join(" ");
const TONE: Record<string, string> = { green: "bg-emerald-50 text-emerald-700 ring-emerald-200", red: "bg-rose-50 text-rose-700 ring-rose-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", blue: "bg-sky-50 text-sky-700 ring-sky-200", gray: "bg-slate-100 text-slate-600 ring-slate-200", navy: "bg-navy-900 text-white ring-navy-900" };
const AUTO: Record<string, string> = { Approved: "green", Assigned: "green", yes: "green", Selected: "green", active: "green", Completed: "green", "Result Approved": "green", "Invitation Send": "blue", "Approved Ready Student": "green", "Result Uploaded": "blue",
  Pending: "amber", pending: "amber", Open: "amber", "Pending Ready Student": "amber", "Result Not Uploaded": "amber", "Process Not Done": "amber", Rejected: "red", Cancelled: "red", "Not Assigned": "red", Draft: "gray", Unassigned: "amber", no: "red", auto_no: "red", "Not Selected": "red", "Result Not Approved": "red", "Invitation Not Send": "red" };
export const Badge = ({ children, tone }: { children: any; tone?: string }) => <span className={cx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1", TONE[tone || AUTO[String(children)] || "gray"])}>{children === "auto_no" ? "Not Interested (auto)" : children === "yes" ? "Yes" : children === "no" ? "No" : children}</span>;
export const Card = ({ title, action, children, className }: { title?: any; action?: any; children: any; className?: string }) => <section className={cx("card", className)}>{(title || action) && <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-semibold text-navy-900">{title}</h3><div className="flex gap-2">{action}</div></header>}<div className="p-4">{children}</div></section>;
export const Stat = ({ label, value, sub, tone = "navy" }: { label: string; value: any; sub?: string; tone?: string }) => <div className="card border-l-4 p-4" style={{ borderLeftColor: tone === "red" ? "#B3122E" : tone === "green" ? "#059669" : tone === "amber" ? "#d97706" : "#0B2A55" }}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-ink">{value}</p>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>;
export const Alert = ({ msg, type = "err" }: { msg: string; type?: "err" | "ok" }) => msg ? <div className={cx("rounded-lg px-3 py-2 text-sm", type === "err" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>{msg}</div> : null;
export const Empty = ({ children = "Nothing here yet." }: { children?: any }) => <p className="py-8 text-center text-sm text-slate-400">{children}</p>;
export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">{tabs.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", k === value ? "border-crimson text-crimson" : "border-transparent text-slate-500 hover:text-ink")}>{l}</button>)}</div>;
}
export function Field({ label, children, className }: { label: string; children: any; className?: string }) { return <label className={cx("block text-xs font-medium text-slate-600", className)}><span className="mb-1 block">{label}</span>{children}</label>; }
type P = { label: string; k: string; f: any; set: (k: string, v: any) => void; type?: string; opts?: string[]; list?: string[]; req?: boolean; rows?: number; className?: string; ph?: string };
export function Fld({ label, k, f, set, type = "text", opts, list, req, rows, className, ph }: P) {
  const v = f[k] ?? "", lid = useId(); const on = (e: any) => set(k, e.target.value);
  return <Field label={label + (req ? " *" : "")} className={className}>
    {opts ? <select className="inp" value={v} onChange={on} required={req}><option value="">Select…</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>
      : rows ? <textarea className="inp" rows={rows} value={v} onChange={on} required={req} placeholder={ph} /> : <><input className="inp" type={type} value={v} onChange={on} required={req} placeholder={ph || (list ? "Select or type" : undefined)} list={list ? lid : undefined} />{list && <datalist id={lid}>{list.map((o) => <option key={o} value={o} />)}</datalist>}</>}</Field>;
}
export function Multi({ label, options, value = [], onChange, className }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; className?: string }) {
  return <Field label={label} className={className}><div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto rounded-lg border border-slate-200 p-2">{options.map((o) => { const on = value.includes(o); return <button type="button" key={o} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className={cx("rounded-full px-2.5 py-1 text-xs ring-1", on ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-slate-600 ring-slate-300")}>{o.length > 60 ? o.slice(0, 57) + "…" : o}</button>; })}</div></Field>;
}
export function useForm<T extends Record<string, any>>(init: T) { const [f, setF] = useState<any>(init); return { f, set: (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v })), reset: () => setF(init), setAll: setF }; }
export function useMsg() { const [m, setM] = useState<{ t: "err" | "ok"; s: string }>({ t: "ok", s: "" }); useEffect(() => { if (m.s && m.t === "ok") { const x = setTimeout(() => setM({ t: "ok", s: "" }), 4000); return () => clearTimeout(x); } }, [m]); return { m, ok: (s: string) => setM({ t: "ok", s }), err: (s: string) => setM({ t: "err", s }), view: <Alert msg={m.s} type={m.t} /> }; }
export type Col<T = any> = { h: string; r: (x: T) => any; csv?: (x: T) => any };
export function Table<T = any>({ rows, cols, csv, search = true, empty }: { rows: T[]; cols: Col<T>[]; csv?: string; search?: boolean; empty?: string }) {
  const [q, setQ] = useState(""); const csvOf = (c: Col<T>, x: T) => { const v = c.csv ? c.csv(x) : c.r(x); return typeof v === "object" ? "" : v; };
  const shown = useMemo(() => (q ? rows.filter((x) => cols.some((c) => String(csvOf(c, x)).toLowerCase().includes(q.toLowerCase()))) : rows), [rows, q]); // eslint-disable-line
  return <div>
    {(search || csv) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">{search ? <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input className="inp !w-64 !pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div> : <span />}
      {csv && <div className="flex gap-2">{(["xlsx", "csv"] as const).map((k) => <button key={k} className="btn-o btn-sm" onClick={() => { const rr = [cols.map((c) => c.h), ...shown.map((x) => cols.map((c) => csvOf(c, x)))]; k === "xlsx" ? downloadXlsx(csv, rr) : downloadCsv(csv, rr); }}><Download className="h-3.5 w-3.5" />{k === "xlsx" ? "Excel" : "CSV"}</button>)}</div>}</div>}
    <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-sm"><thead><tr>{cols.map((c) => <th key={c.h} className="th">{c.h}</th>)}</tr></thead>
      <tbody>{shown.map((x: any, i) => <tr key={x.id || i} className="hover:bg-slate-50/60">{cols.map((c) => <td key={c.h} className="td">{c.r(x)}</td>)}</tr>)}</tbody></table>{!shown.length && <Empty>{empty}</Empty>}</div>
    <p className="mt-1 text-right text-xs text-slate-400">{shown.length} record(s)</p></div>;
}
export function useLoad<T>(path: string | null, init: T) { const [d, setD] = useState<T>(init), [loading, setL] = useState(true); 
  const load = async () => { if (!path) return; try { setD(await api(path)); } catch { /* ignore: role may not have access */ } setL(false); };
  useEffect(() => { load(); }, [path]); // eslint-disable-line
  return { d, loading, reload: load }; }

export type RF = { k: string; l: string; t?: string; opts?: string[]; optsFn?: (item: any) => string[] | undefined; listFn?: (item: any) => string[]; w?: string };
export function Repeater({ label, items = [], onChange, fields, blank, addLabel = "Add" }: { label: string; items: any[]; onChange: (v: any[]) => void; fields: RF[]; blank?: any; addLabel?: string }) {
  const up = (i: number, k: string, v: any) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-navy-900">{label}</p><button type="button" className="btn-o btn-sm" onClick={() => onChange([...items, { ...(blank || {}) }])}>+ {addLabel}</button></div>
    {items.map((it, i) => <div key={i} className="relative grid gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-2 lg:grid-cols-4"><button type="button" className="absolute right-2 top-1 text-xs text-crimson" onClick={() => onChange(items.filter((_, j) => j !== i))}>remove</button>
      {fields.map((f) => <Fld key={f.k} label={f.l} k={f.k} f={it} set={(k, v) => up(i, k, v)} type={f.t} opts={f.optsFn ? f.optsFn(it) : f.opts} list={f.listFn ? f.listFn(it) : undefined} />)}</div>)}
    {!items.length && <p className="text-xs text-slate-400">None added.</p>}</div>;
}
export function Confirm({ onYes, children, cls = "btn-o btn-sm", msg = "Are you sure?" }: { onYes: () => void; children: any; cls?: string; msg?: string }) { return <button className={cls} onClick={() => confirm(msg) && onYes()}>{children}</button>; }
