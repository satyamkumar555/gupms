"use client";
import { Download } from "lucide-react"; import { downloadBoth } from "@/lib/xlsx"; import { Card, useLoad } from "@/components/ui";
export function Downloads() {
  const co = useLoad<any[]>("/companies", []), dr = useLoad<any[]>("/drives", []), st = useLoad<any[]>("/students", []);
  const run = (k: string, fmt: "csv" | "xlsx") => { const rows: any[][] = [];
    if (k === "hr") { rows.push(["Company", "Branch", "Designation", "Title", "Name", "Phone", "Alt Phone", "Official Email", "Personal Email", "LinkedIn"]); co.d.forEach((c) => (c.contacts || []).forEach((p: any) => rows.push([c.name, p.branch, p.designation, p.title, p.name, p.phone, p.altPhone, p.officialEmail, p.personalEmail, p.linkedin]))); }
    if (k === "des") { rows.push(["Company", "Designation", "Drive Ref", "CTC From (LPA)", "CTC To (LPA)", "Courses"]); dr.d.forEach((x) => rows.push([x.company, x.designation, x.ref, x.courses?.[0]?.ctcFrom, x.courses?.[0]?.ctcTo, x.courses.map((c: any) => c.course).join(" | ")])); }
    if (k === "alc") { rows.push(["Company", "Alumni (placed students)"]); co.d.forEach((c) => rows.push([c.name, st.d.filter((s) => (s.companyPlaced || "").includes(c.name)).length])); }
    if (k === "ald") { rows.push(["Company", "Roll", "Name", "Course", "Session", "Package (LPA)"]); st.d.forEach((s) => String(s.companyPlaced || "").split(", ").filter(Boolean).forEach((c: string, i: number) => rows.push([c, s.roll, s.name, s.course, s.passout, String(s.packages).split(", ")[i]]))); }
    downloadBoth(fmt, "company-" + k, rows); };
  const L: [string, string, string][] = [["hr", "Basic HR", "All HR / contact persons from every company's Contact Person Diary"], ["des", "Designation Report", "Designations offered by companies in drives, with CTC range and courses"], ["alc", "Alumni Count", "How many of our students are placed in each company"], ["ald", "Alumni Details", "Roll no., name, course, session and package of placed students company-wise"]];
  return <Card title="Downloads (Master Profile)"><div className="grid gap-3 sm:grid-cols-2">{L.map(([k, t, d]) => <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div><p className="font-semibold text-navy-900">{t}</p><p className="text-xs text-slate-500">{d}</p></div><div className="flex gap-1.5"><button className="btn btn-sm" onClick={() => run(k, "xlsx")}><Download className="h-3.5 w-3.5" />Excel</button><button className="btn-o btn-sm" onClick={() => run(k, "csv")}>CSV</button></div></div>)}</div></Card>;
}
