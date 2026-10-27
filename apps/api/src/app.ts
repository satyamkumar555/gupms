import express from "express"; import cors from "cors"; import helmet from "helmet"; import crypto from "node:crypto";
import type { Store, Row } from "./store";
import type { Identity } from "./identity"; import type { FileStore } from "./files";
import { DEFAULT_CONFIG } from "./defaults";

export interface Opts { store: Store; identity: Identity; files: FileStore; origins: string[]; dev?: boolean }
const DAY = 864e5, YEAR = 365 * DAY, now = () => Date.now();
const eod = (t: number) => { const d = new Date(t); d.setHours(23, 59, 59, 999); return d.getTime(); };
const sod = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const isoToday = () => new Date().toISOString().slice(0, 10);
class HttpError extends Error { constructor(public status: number, m: string) { super(m); } }
const E = (s: number, m: string) => new HttpError(s, m);
const rid = () => crypto.randomBytes(6).toString("hex");
const norm = (s: any) => String(s ?? "").trim().toLowerCase();
const top = (u: Row) => u.role === "admin" || u.role === "ceo";
const RESERVED = ["id", "pw", "password", "status", "role", "path", "scope", "createdAt", "reportsTo"];
const clean = (b: any) => { const o = { ...b }; RESERVED.forEach((k) => delete o[k]); return o; };
const pick = (b: any, keys: string[]) => Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
const catOf = (l: number) => (l >= 10 ? "A++" : l >= 6 ? "A+" : l >= 3 ? "A" : "-");
const ROLE_NAMES: Record<string, string> = { admin: "Administrator", ceo: "CEO / Chancellor", hod: "HOD", officer: "Placement / T&P Officer", td: "Training & Development", student: "Student" };
const DRIVE_KEYS = ["campus","team","type","poSession","placeStatus","recLocation","venue","reportTime","jd","jobLocation","designation","startDate","endDate","expectedResultDate","expectedDoj","expectedRequirement","bond","minPool","compCriteria","comment","terms","keySkills","jobRole","externalLink","specialInstructions","mandatoryItems","guidelines","otherInstructions","coreBranch","rounds","companyId"];

export function createApp(o: Opts) {
  const S = o.store, I = o.identity, F = o.files, app = express();
  const all = (c: string) => S.list(c);
  app.use(helmet(), cors({ origin: o.origins }), express.json({ limit: "2mb" }));
  const A = (fn: (req: any, res: any) => Promise<any>) => (req: any, res: any, next: any) =>
    fn(req, res).then((r) => { if (r !== undefined && !res.headersSent) res.json(r); }).catch(next);
  const pub = (u: Row) => { const { pw, ...r } = u; return r; };
  const scoped = (rows: Row[], u: Row) => (top(u) ? rows : rows.filter((r) => (r.scope || []).includes(u.id)));
  const own = (rec: Row, u: Row) => top(u) || (rec.scope || []).includes(u.id);

  const authn = async (req: any, _res: any, next: any) => {
    try {
      const t = (req.headers.authorization || "").slice(7);
      const uid = await I.verify(t);
      const u = uid ? await S.get("users", uid) : null;
      if (!u) throw E(401, "Login required");
      if (u.status !== "active") throw E(403, u.status === "blocked" ? "Your account is blocked. Please contact the administrator." : "Your account is not active. Please contact the administrator.");
      req.user = u; next();
    } catch (e: any) { next(e.status ? e : E(401, "Login required")); }
  };
  const need = (...roles: string[]) => (req: any, _r: any, next: any) => (top(req.user) || roles.includes(req.user.role) ? next() : next(E(403, "Not allowed for your role")));
  const adminOnly = (req: any, _r: any, next: any) => (req.user.role === "admin" ? next() : next(E(403, "Admin only")));

  async function notify(pred: (u: Row) => boolean, text: string, link?: string) {
    const us = (await all("users")).filter((u) => u.status === "active" && pred(u));
    await Promise.all(us.map((u) => S.set("notifications", rid(), { to: u.id, text, link, at: now(), read: false })));
  }
  async function audit(u: Row, action: string, target: string) { await S.set("audit", rid(), { at: now(), by: u.email, action, target }); }
  const idTokens = (txt: any) => { const seen = new Set<string>(); return String(txt || "").split(/[\s,;]+/).map((x) => x.trim()).filter((x) => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };
  const matchStudent = (studs: Row[], tok: string) => studs.find((x) => [x.roll, x.email, x.personalEmail, x.enrollmentNo, x.uniqueId].some((v) => v && norm(v) === norm(tok))); // roll no / email / enrollment no / any unique ID
  const rollKey = (r: any) => String(r || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const pwCheck = (p: any) => { if (String(p || "").length < 6) throw E(400, "Password must be at least 6 characters"); return String(p); };
  /** Single place where accounts are created (admin staff, admin bulk import, student self-registration). */
  async function createAccount(a: { email: string; password: string; role: string; profile: any; reportsToEmail?: string; mustChange: boolean }) {
    const email = norm(a.email), users = await all("users");
    if (users.some((u) => u.email === email)) throw E(409, `Email already registered: ${email}`);
    const re = norm(a.reportsToEmail), par = re ? users.find((u) => u.email === re) : null;
    if (re && !par) throw E(400, `Reports-to account not found: ${re}`);
    let uid: string; try { uid = await I.create(email, pwCheck(a.password), a.profile.name); } catch (e: any) { throw e.message === "exists" ? E(409, `Email already registered: ${email}`) : e.status ? e : E(400, e.message); }
    const doc = { ...clean(a.profile), email, role: a.role, status: "active", mustChangePassword: a.mustChange, reportsTo: par?.id || null, path: par ? [...(par.path || []), par.id] : [], createdAt: now() };
    delete (doc as any).reportsToEmail; await S.set("users", uid, doc); return { id: uid, ...doc } as Row;
  }
  // ---------- AUTH: students register themselves (verified against admin-fed data); staff accounts are created by Admin only ----------
  async function studentRecord(roll: any, email: any) {
    const rec = await S.get("registry", rollKey(roll));
    if (!rec || norm(rec.email) !== norm(email)) throw E(404, "Roll number and email do not match the university student records. Please check, or contact the placement office.");
    if (rec.registered) throw E(409, "This student is already registered. Please sign in (use Forgot password if needed).");
    return rec;
  }
  app.post("/api/auth/verify-student", A(async (req) => { const { id, registered, reportsToEmail, ...rec } = await studentRecord(req.body.roll, req.body.email); return { found: true, record: rec }; }));
  app.post("/api/auth/register-student", A(async (req) => {
    const rec = await studentRecord(req.body.roll, req.body.email), b = req.body; pwCheck(b.password);
    const hods = (await all("users")).filter((u) => u.role === "hod" && u.status === "active");
    const verified = pick(rec, ["name", "roll", "email", "course", "passout", "campus"]);
    await createAccount({ email: rec.email, password: b.password, role: "student", profile: { ...pick(rec, ["phone", "gender", "dob", "fatherName", "fatherMobile", "personalEmail", "enrollmentNo", "uniqueId"]), ...b, ...verified }, reportsToEmail: rec.reportsToEmail || (hods.length === 1 ? hods[0].email : undefined), mustChange: false });
    await S.set("registry", rec.id, { ...rec, registered: true }); return { ok: true };
  }));
  app.post("/api/auth/login", A(async (req) => { // local mode; in Firebase mode the browser signs in with Firebase and sends the ID token
    if (!I.login) throw E(400, "Use Firebase sign-in");
    const r = await I.login(norm(req.body.email), String(req.body.password || "")); if (!r) throw E(401, "Invalid email or password");
    const u = await S.get("users", r.uid); if (!u) throw E(401, "Account not found");
    if (u.status !== "active") throw E(403, u.status === "blocked" ? "Your account is blocked. Please contact the administrator." : "Your account is not active.");
    if (req.body.kind === "student" && u.role !== "student") throw E(403, "This is a staff account. Please use the Admin Login link at the bottom of the page.");
    if (req.body.kind === "staff" && u.role === "student") throw E(403, "Students must sign in from the main login page.");
    return { token: r.token, user: u };
  }));
  app.post("/api/auth/forgot", A(async (req) => {
    if (!I.login) throw E(400, "Use Firebase password reset");
    const u = (await all("users")).find((x) => x.email === norm(req.body.email)); let devLink: string | undefined;
    if (u) { const token = rid() + rid() + rid(); await S.set("resets", token, { uid: u.id, exp: now() + 36e5 }); if (o.dev) devLink = `/reset?token=${token}`; }
    return { ok: true, devLink, message: "If this email is registered, a reset link has been sent." };
  }));
  app.post("/api/auth/reset", A(async (req) => {
    const r = await S.get("resets", String(req.body.token || "")); if (!r || r.exp < now()) throw E(400, "This reset link is invalid or has expired");
    await I.setPassword(r.uid, pwCheck(req.body.password)); await S.del("resets", r.id);
    const u = await S.get("users", r.uid); if (u) await S.set("users", u.id, { ...u, mustChangePassword: false }); return { ok: true };
  }));
  app.post("/api/auth/change-password", authn, A(async (req) => { // local mode (Firebase mode changes it in the browser, then calls /api/me/password-changed)
    if (!I.checkPassword) throw E(400, "Change the password from the Firebase sign-in");
    if (!(await I.checkPassword(req.user.id, String(req.body.current || "")))) throw E(400, "Current password is incorrect");
    await I.setPassword(req.user.id, pwCheck(req.body.password)); await S.set("users", req.user.id, { ...req.user, mustChangePassword: false }); return { ok: true };
  }));
  app.post("/api/me/password-changed", authn, A(async (req) => { await S.set("users", req.user.id, { ...req.user, mustChangePassword: false }); return { ok: true }; }));
  app.get("/api/me", authn, A(async (req) => pub(req.user)));
  app.get("/api/config", authn, A(async () => ({ ...DEFAULT_CONFIG, ...Object.fromEntries(Object.entries((await S.get("config", "site")) || {}).filter(([k, v]) => k !== "id" && v && (!Array.isArray(v) || v.length))) })));

  // ---------- PEOPLE (hierarchy) ----------
  app.get("/api/people", authn, A(async (req) => {
    const u = req.user, us = (await all("users")).filter((x) => x.id !== u.id).map(pub);
    if (top(u)) return us;
    if (u.role === "hod") return us.filter((x) => (x.path || []).includes(u.id));
    if (u.role === "officer") return us.filter((x) => x.role === "student" && x.reportsTo === u.reportsTo);
    return [];
  }));

  // ---------- COMPANIES ----------
  const old = (x: number) => now() - x > 2 * YEAR;
  const notAssigned = (c: Row) => !c.spoc || old(Math.max(c.lastVisit || 0, c.assignedAt || 0)); // Rule 1: SPOC has not visited in 2 years
  const noHiring = (c: Row) => old(Math.max(c.lastHire || 0, c.assignedAt || 0));                 // Rule 2: no hiring visit in 2 years
  const cstatus = (c: Row) => (notAssigned(c) ? "Not Assigned" : noHiring(c) ? "Unassigned" : "Assigned");
  const creason = (c: Row) => (!c.spoc ? "No SPOC assigned" : notAssigned(c) ? "SPOC has not visited this company in the last 2 years" : noHiring(c) ? "Not visited for hiring in the last 2 years" : "");
  const cview = (c: Row, nVisits = 0) => {
    const sal = (c.courseSalaries || []).map((x: any) => +x.maxSalary || 0), mins = (c.courseSalaries || []).map((x: any) => +x.minSalary || 0);
    const max = Math.max(0, ...sal), min = mins.length ? Math.min(...mins) : 0;
    return { ...c, minSal: min, maxSal: max, cat: catOf(max), status: cstatus(c), reason: creason(c), visits: nVisits };
  };
  // Who may edit a company: Admin and CEO (write access to everything); the SPOC officer; a HOD only for companies of officers in HIS team.
  const canEditCompany = (u: Row, c: Row, users: Row[]) => top(u) || (u.role === "officer" && c.spoc === u.id) || (u.role === "hod" && !!c.spoc && (users.find((x) => x.id === c.spoc)?.path || []).includes(u.id));
  app.get("/api/companies", authn, need("hod", "officer"), A(async (req) => { // students / T&D never get company master data
    const vs = await all("visits"), users = req.user.role === "hod" ? await all("users") : [];
    return (await all("companies")).map((c) => ({ ...cview(c, vs.filter((v) => v.companyId === c.id && v.status === "Approved").length), canEdit: canEditCompany(req.user, c, users) }));
  }));
  app.post("/api/companies", authn, need("officer"), A(async (req) => {
    const b = { ...req.body }, u = req.user, spocId = b.spocId; delete b.spocId;
    if (!b.name || !b.district || !b.state) throw E(400, "Company name, state and district are required");
    if ((await all("companies")).some((c) => norm(c.name) === norm(b.name) && norm(c.district) === norm(b.district) && norm(c.state) === norm(b.state)))
      throw E(409, "Company already exists at this location. You can add the same company only for a different location.");
    let spoc: Row | null = u; // an officer who creates a company becomes its SPOC
    if (top(u)) { spoc = spocId ? await S.get("users", spocId) : null; if (spocId && (!spoc || spoc.role !== "officer")) throw E(400, "SPOC must be a Placement Officer"); } // Admin / CEO: pick an officer, or leave empty so any officer can self-assign
    const id = rid();
    await S.set("companies", id, { ...clean(b), rating: +b.rating, maxLpa: +b.maxLpa || 0, spoc: spoc?.id || null, spocName: spoc?.name || null, assignedAt: spoc ? now() : 0, lastVisit: 0, lastHire: 0, addedOn: now(), updatedOn: now(), createdBy: u.id, createdByName: u.name, createdByRole: u.role, updatedBy: u.id, updatedByName: u.name });
    await audit(u, "create company", b.name); return { id };
  }));
  app.put("/api/companies/:id", authn, need("hod", "officer"), A(async (req) => {
    const c = await S.get("companies", req.params.id), u = req.user; if (!c) throw E(404, "Not found");
    if (!canEditCompany(u, c, u.role === "hod" ? await all("users") : [])) throw E(403, u.role === "officer" ? "Only the SPOC officer can edit this company" : "This company does not belong to an officer of your team - you can only view it");
    const keep = pick(c, ["spoc", "spocName", "assignedAt", "lastVisit", "lastHire", "addedOn", "createdBy", "createdByName", "createdByRole"]), data = clean(req.body);
    ["cat", "minSal", "maxSal", "visits", "reason", "canEdit", "spocId", "updatedBy", "updatedByName"].forEach((k) => delete data[k]);
    await S.set("companies", c.id, { ...data, ...keep, updatedOn: now(), updatedBy: u.id, updatedByName: u.name }); await audit(u, "edit company", c.name); return { ok: true };
  }));
  app.post("/api/companies/:id/assign", authn, need("officer"), A(async (req) => {
    const c = await S.get("companies", req.params.id); if (!c || cstatus(c) === "Assigned") throw E(400, "Company is already assigned - it stays with the current officer");
    if ((await all("assignments")).some((a) => a.companyId === c.id && a.status === "Pending")) throw E(409, "Assignment already pending HOD approval");
    const u = req.user; await S.set("assignments", rid(), { companyId: c.id, company: c.name, by: u.id, byName: u.name, status: "Pending", at: now(), scope: [...u.path, u.id] });
    await notify((x) => x.role === "hod" && (u.path || []).includes(x.id), `${u.name} requested assignment of ${c.name}`, "assign-approvals"); return { ok: true };
  }));

  // ---------- FOLLOW-UPS ----------
  app.get("/api/followups", authn, need("officer"), A(async (req) => scoped(await all("followups"), req.user)));
  app.post("/api/followups", authn, need("officer"), A(async (req) => { const u = req.user; const id = rid(); await S.set("followups", id, { ...pick(req.body, ["company", "contact", "note", "date", "nextDate"]), status: "Open", by: u.id, byName: u.name, scope: [...u.path, u.id] }); return { id }; }));
  app.put("/api/followups/:id", authn, need("officer"), A(async (req) => { const f = await S.get("followups", req.params.id); if (!f || !own(f, req.user)) throw E(404, "Not found"); await S.set("followups", f.id, { ...f, ...pick(req.body, ["note", "nextDate", "status"]) }); return { ok: true }; }));

  // ---------- VISITS ----------
  app.get("/api/visits", authn, A(async (req) => scoped(await all("visits"), req.user)));
  app.post("/api/visits", authn, need("officer"), A(async (req) => {
    const b = req.body, u = req.user;
    if (!b.type || !b.visitDate || !(+b.budget >= 0) || b.budget === "") throw E(400, "Visit type, date and expected budget are required");
    const id = rid(); await S.set("visits", id, { ...pick(b, ["type", "companyId", "company", "visitDate", "meetingFrom", "meetingTill", "purpose", "poSession"]), budget: +b.budget, status: "Pending", by: u.id, byName: u.name, createdAt: now(), scope: [...u.path, u.id] });
    await notify((x) => x.role === "hod" && (u.path || []).includes(x.id), `Visit approval requested by ${u.name}: ${b.type}`, "visits"); return { id };
  }));
  app.post("/api/visits/:id/feedback", authn, need("officer"), A(async (req) => {
    const v = await S.get("visits", req.params.id); if (!v || v.status !== "Approved" || !own(v, req.user)) throw E(400, "Visit is not approved");
    const b = req.body; if (!(+b.actual >= 0) || b.actual === "") throw E(400, "Actual spend required");
    if (+b.actual > v.budget && !String(b.explanation || "").trim()) throw E(400, "Budget exceeded: explanation is required");
    await S.set("visits", v.id, { ...v, actual: +b.actual, explanation: b.explanation || "", feedback: b.feedback || "", visitStatus: b.visitStatus || "Completed", feedbackDone: true });
    if (v.companyId) { const c = await S.get("companies", v.companyId); if (c) await S.set("companies", c.id, { ...c, lastVisit: now() }); }
    return { ok: true };
  }));

  // ---------- DRIVES ----------
  async function openInvites(d: Row) { // after HOD approval (manual or auto): drive is notified + invitation goes to students
    d.invitationStatus = "Invitation Send";
    await notify((x) => x.role !== "student", `Drive ${d.ref} (${d.company}) approved`, "drives");
    await notify((x) => d.invites.some((i: any) => i.uid === x.id), `Invitation: ${d.company} drive. Give your consent before ${new Date(d.consentBy).toLocaleString()}`, "drives");
  }
  async function fresh(d: Row) {
    let ch = false; const t = now();
    if (d.status === "Pending" && t > d.approveBy) { d.status = "Approved"; d.autoApproved = true; await openInvites(d); ch = true; }
    if (t > d.consentBy) for (const i of d.invites) if (i.consent == null) { i.consent = "auto_no"; ch = true; }
    if (ch) await S.set("drives", d.id, d); return d;
  }
  const stu = (d: Row, u: Row) => { const i = d.invites.find((x: any) => x.uid === u.id)!; const { invites, ...rest } = d; return { ...rest, scope: undefined, my: i.consent, myResult: d.results?.[i.roll] || null }; };
  app.get("/api/drives", authn, A(async (req) => {
    const u = req.user; let ds = await Promise.all((await all("drives")).map(fresh));
    if (u.role === "student") return ds.filter((d) => d.status === "Approved" && d.invitationStatus === "Invitation Send" && d.invites.some((i: any) => i.uid === u.id)).map((d) => stu(d, u));
    if (u.role === "td") return ds.filter((d) => d.status === "Approved").map((d) => ({ ...d, invites: d.invites.filter((i: any) => i.consent === "yes") }));
    return scoped(ds, u).filter((d) => d.status !== "Draft" || d.by === u.id || top(u));
  }));
  // Step 1-7 of the drive form are saved as a DRAFT; step 8 uploads the students and FLOATS the drive.
  async function checkFile(f: any, u: Row, kind: string) {
    const rec = f?.id ? await S.get("files", f.id) : null;
    if (!rec || rec.kind !== kind || (rec.by !== u.id && !top(u))) throw E(400, kind === "jd" ? "JD PDF is mandatory - please upload the JD file" : "Please upload the file again");
    return rec;
  }
  async function prepareDrive(b: any, u: Row, selfId: string | null, full: boolean) {
    const co = b.companyId ? await S.get("companies", b.companyId) : null; if (!co) throw E(400, "Select a company (My Company)");
    if (!top(u) && co.spoc !== u.id) throw E(403, "You can float drives only for companies where you are the SPOC (My Company)");
    if (cstatus(co) !== "Assigned") throw E(400, `Company is "${cstatus(co)}". Self-assign it first (HOD approval needed).`);
    const courses = (b.courses || []).filter((c: any) => c.course);
    const base: any = { ...pick(b, DRIVE_KEYS), courses, rollsText: String(b.rolls ?? ""), company: co.name, companyCat: cview(co).cat, companyRating: co.rating, companyArea: co.area, spocName: co.spocName, jd: typeof b.jd === "object" && b.jd?.id ? { id: b.jd.id, name: b.jd.name } : undefined };
    if (!full) return { base, invites: [] as any[], unmatched: [] as string[] };
    if (!b.jd?.id) throw E(400, "JD PDF is mandatory - please upload the JD file");
    await checkFile(b.jd, u, "jd");
    if (!courses.length) throw E(400, "Add at least one course");
    if (!b.startDate || !b.endDate || b.endDate < b.startDate) throw E(400, "Valid schedule start/end dates are required");
    if (!b.type || !b.designation) throw E(400, "Drive type and designation are required");
    for (const c of courses) for (const d of (await all("drives")).filter((x) => x.id !== selfId && !["Rejected", "Cancelled", "Draft"].includes(x.status)))
      if (d.courses.some((x: any) => x.course === c.course && (x.campus || "") === (c.campus || "")) && b.startDate <= d.endDate && b.endDate >= d.startDate)
        throw E(409, `Conflict: ${c.course} already has drive ${d.ref} (${d.startDate} to ${d.endDate})`);
    const toks = idTokens(b.rolls); if (!toks.length) throw E(400, "Upload student University Roll Nos / unique IDs");
    const studs = (await all("users")).filter((x) => x.role === "student" && x.status === "active"), invites: any[] = [], unmatched: string[] = [], used = new Set<string>();
    for (const t of toks) { const s = matchStudent(studs, t); if (!s) unmatched.push(t); else if (!used.has(s.id)) { used.add(s.id); invites.push({ roll: s.roll, uid: s.id, name: s.name, token: rid() + rid(), consent: null, ready: false }); } }
    if (!invites.length) throw E(400, "None of the IDs matched an active student: " + unmatched.slice(0, 10).join(", "));
    if (+b.minPool > 0 && invites.length < +b.minPool) throw E(400, `Min. pool size is ${b.minPool} but only ${invites.length} students matched (${unmatched.length} IDs not found)`);
    return { base, invites, unmatched };
  }
  async function floatDrive(id: string | null, u: Row, p: { base: any; invites: any[]; unmatched: string[] }) {
    const t = now(), docId = id || rid(), nums = (await all("drives")).map((d) => parseInt(String(d.ref || "").split("-").pop() || "0", 10) || 0), n = Math.max(0, ...nums) + 1;
    const d = { ...p.base, invites: p.invites, ref: `GU-DRV-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`, status: "Pending", invitationStatus: "Invitation Not Send", readyStatus: "Pending Ready Student", resultStatus: "Result Not Uploaded",
      by: u.id, officer: u.name, createdAt: t, invitedAt: t, approveBy: eod(t + DAY), consentBy: eod(t + 2 * DAY), prepFrom: sod(t + 5 * DAY), scope: [...u.path, u.id], results: {}, outcome: { joined: 0, left: 0, working: 0 } };
    await S.set("drives", docId, d);
    await notify((x) => x.role !== "student" && x.id !== u.id, `New drive floated: ${d.company} (${d.ref}) by ${u.name}. Waiting for HOD approval`, "drives");
    return { id: docId, ref: d.ref, invited: p.invites.length, unmatched: p.unmatched };
  }
  const draftDoc = (base: any, u: Row, old?: Row) => ({ ...base, ref: "DRAFT", status: "Draft", invitationStatus: "Invitation Not Send", readyStatus: "Pending Ready Student", resultStatus: "Result Not Uploaded", invites: [], by: u.id, officer: u.name, createdAt: old?.createdAt || now(), invitedAt: null, scope: [...u.path, u.id], results: {}, outcome: { joined: 0, left: 0, working: 0 } });
  app.post("/api/drives", authn, need("officer"), A(async (req) => {
    const b = req.body, u = req.user;
    if (b.draft) { const p = await prepareDrive(b, u, null, false), id = rid(); await S.set("drives", id, draftDoc(p.base, u)); return { id, draft: true }; }
    return floatDrive(null, u, await prepareDrive(b, u, null, true));
  }));
  app.post("/api/drives/:id/save", authn, need("officer"), A(async (req) => { // edit a DRAFT; with float:true validate everything, upload students and float
    const old = await S.get("drives", req.params.id), u = req.user; if (!old || old.status !== "Draft" || (old.by !== u.id && !top(u))) throw E(404, "Draft not found");
    if (!req.body.float) { const p = await prepareDrive(req.body, u, old.id, false); await S.set("drives", old.id, draftDoc(p.base, u, old)); return { id: old.id, draft: true }; }
    return floatDrive(old.id, u, await prepareDrive(req.body, u, old.id, true));
  }));
  app.delete("/api/drives/:id/draft", authn, need("officer"), A(async (req) => { const d = await S.get("drives", req.params.id); if (!d || d.status !== "Draft" || (d.by !== req.user.id && !top(req.user))) throw E(404, "Draft not found"); await S.del("drives", d.id); return { ok: true }; }));
  app.post("/api/drives/:id/decision", authn, need("hod"), A(async (req) => {
    const d = await S.get("drives", req.params.id); if (!d || !own(d, req.user)) throw E(404, "Not found"); await fresh(d);
    if (d.status !== "Pending") throw E(400, `Drive is already ${d.status}`);
    d.status = req.body.action === "approve" ? "Approved" : "Rejected"; d.decidedBy = req.user.name;
    if (d.status === "Approved") await openInvites(d); else await notify((x) => x.id === d.by, `Drive ${d.ref} (${d.company}) Rejected by HOD`, "drives");
    await S.set("drives", d.id, d); await audit(req.user, `drive ${d.status}`, d.ref); return { ok: true };
  }));
  app.post("/api/drives/:id/mark", authn, need("officer", "hod"), A(async (req) => { // Cancelled / Process Not Done
    const d = await S.get("drives", req.params.id); if (!d || !own(d, req.user)) throw E(404, "Not found");
    if (!["Cancelled", "Process Not Done"].includes(req.body.status)) throw E(400, "Bad status"); d.status = req.body.status; await S.set("drives", d.id, d); return { ok: true };
  }));
  async function applyConsent(d: Row, i: any, val: string) {
    await fresh(d);
    if (d.status !== "Approved") throw E(400, d.status === "Pending" ? "Drive is waiting for HOD approval. Consent opens after approval." : `Drive is ${d.status}`);
    if (now() > d.consentBy) throw E(400, "Consent window is closed (auto marked Not Interested)");
    i.consent = val === "yes" ? "yes" : "no"; i.consentAt = now(); await S.set("drives", d.id, d);
  }
  app.post("/api/drives/:id/consent", authn, need("student"), A(async (req) => {
    const d = await S.get("drives", req.params.id), i = d?.invites.find((x: any) => x.uid === req.user.id); if (!d || !i) throw E(404, "Not invited");
    await applyConsent(d, i, req.body.consent); return { ok: true };
  }));
  app.get("/api/public/consent/:token", A(async (req) => { // external link generated by the system
    for (const d of await all("drives")) { const i = d.invites.find((x: any) => x.token === req.params.token); if (i) { await fresh(d);
      return { name: i.name, roll: i.roll, consent: i.consent, status: d.status, consentBy: d.consentBy, drive: pick(d, ["ref", "company", "type", "designation", "jobLocation", "startDate", "endDate", "venue", "reportTime", "keySkills", "mandatoryItems", "guidelines", "externalLink", "specialInstructions"]), courses: d.courses }; } }
    throw E(404, "Invalid or expired link");
  }));
  app.post("/api/public/consent/:token", A(async (req) => {
    for (const d of await all("drives")) { const i = d.invites.find((x: any) => x.token === req.params.token); if (i) { await applyConsent(d, i, req.body.consent); return { ok: true }; } }
    throw E(404, "Invalid or expired link");
  }));
  app.post("/api/drives/:id/ready", authn, need("officer"), A(async (req) => {
    const d = await S.get("drives", req.params.id); if (!d || !own(d, req.user)) throw E(404, "Not found"); await fresh(d);
    d.invites.forEach((i: any) => { i.ready = i.consent === "yes"; }); d.readyStatus = "Approved Ready Student"; await S.set("drives", d.id, d); return { ready: d.invites.filter((i: any) => i.ready).length };
  }));
  app.post("/api/drives/:id/result", authn, need("officer"), A(async (req) => {
    const d = await S.get("drives", req.params.id); if (!d || !own(d, req.user)) throw E(404, "Not found"); await fresh(d);
    if (d.status !== "Approved") throw E(400, "Drive must be Approved first");
    const r = req.body.results || {};
    for (const k of Object.keys(r)) { const i = d.invites.find((x: any) => norm(x.roll) === norm(k)); if (!i || i.consent !== "yes") throw E(400, `${k}: result can be uploaded only for students with consent = Yes`); }
    for (const k of Object.keys(r)) { const i = d.invites.find((x: any) => norm(x.roll) === norm(k)); d.results[i.roll] = { result: r[k].result, package: +r[k].package || 0 }; }
    d.outcome = { joined: +req.body.joined || 0, left: +req.body.left || 0, working: +req.body.working || 0 };
    d.resultStatus = "Result Uploaded"; await S.set("drives", d.id, d);
    await notify((x) => x.role === "hod" && (d.scope || []).includes(x.id), `Result uploaded for ${d.ref}. Approval needed`, "drive-approvals"); return { ok: true };
  }));
  app.post("/api/drives/:id/result-decision", authn, need("hod"), A(async (req) => {
    const d = await S.get("drives", req.params.id); if (!d || !own(d, req.user) || d.resultStatus !== "Result Uploaded") throw E(400, "No uploaded result to decide");
    d.resultStatus = req.body.action === "approve" ? "Result Approved" : "Result Not Approved"; await S.set("drives", d.id, d);
    await notify((x) => x.id === d.by, `Result of ${d.ref} (${d.company}): ${d.resultStatus}`, "drives");
    if (d.resultStatus === "Result Approved") { const c = await S.get("companies", d.companyId); if (c) await S.set("companies", c.id, { ...c, lastHire: now() }); } return { ok: true };
  }));
  app.get("/api/calendar", authn, need("officer", "hod"), A(async () =>
    (await all("drives")).filter((d) => !["Rejected", "Cancelled", "Draft"].includes(d.status)).map((d) => ({ id: d.id, ref: d.ref, company: d.company, spocName: d.spocName, officer: d.officer, status: d.status, startDate: d.startDate, endDate: d.endDate, courses: d.courses.map((c: any) => c.course).join(", "), students: d.invites.length }))));

  // ---------- APPROVALS (HOD / CEO) ----------
  app.get("/api/approvals", authn, need("hod"), A(async (req) => {
    const u = req.user, pend = (rows: Row[]) => scoped(rows, u).filter((x) => x.status === "Pending");
    const drives = await Promise.all((await all("drives")).map(fresh));
    return { assignments: pend(await all("assignments")), visits: pend(await all("visits")), drives: pend(drives), eja: pend(await all("eja")), offers: pend(await all("offers")),
      results: scoped(drives, u).filter((d) => d.resultStatus === "Result Uploaded") };
  }));
  app.post("/api/assignments/:id/decision", authn, need("hod"), A(async (req) => {
    const a = await S.get("assignments", req.params.id); if (!a || !own(a, req.user) || a.status !== "Pending") throw E(400, "Not pending");
    a.status = req.body.action === "approve" ? "Approved" : "Rejected"; await S.set("assignments", a.id, a);
    if (a.status === "Approved") { const c = await S.get("companies", a.companyId), u = await S.get("users", a.by); if (c && u) await S.set("companies", c.id, { ...c, spoc: u.id, spocName: u.name, assignedAt: now(), updatedOn: now() }); }
    await notify((x) => x.id === a.by, `Company assign request for ${a.company} ${a.status}`, "companies"); return { ok: true };
  }));
  app.post("/api/visits/:id/decision", authn, need("hod"), A(async (req) => {
    const v = await S.get("visits", req.params.id); if (!v || !own(v, req.user) || v.status !== "Pending") throw E(400, "Not pending");
    v.status = req.body.action === "approve" ? "Approved" : "Rejected"; v.decidedBy = req.user.name; await S.set("visits", v.id, v);
    await notify((x) => x.id === v.by, `Visit request "${v.type}" ${v.status}`, "visits"); return { ok: true };
  }));

  // ---------- FILES: JD PDF + offer letters (stored through the FileStore: disk / Firestore / Firebase Storage) ----------
  const sniff = (b: Buffer) => (b.subarray(0, 4).toString("latin1") === "%PDF" ? "application/pdf" : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg" : b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG" ? "image/png" : null);
  // Express reads the raw body itself; Cloud Functions has already read it (req.rawBody) - so use whichever exists.
  const rawUpload = (req: any, res: any, next: any) => (req.rawBody || (Buffer.isBuffer(req.body) && req.body.length) ? next() : express.raw({ type: () => true, limit: "11mb" })(req, res, next));
  app.post("/api/files", authn, rawUpload, A(async (req) => {
    const u = req.user, kind = String(req.query.kind || ""), buf: Buffer = req.rawBody ? Buffer.from(req.rawBody) : Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (kind === "jd" ? !(top(u) || u.role === "officer") : kind === "offer" ? u.role !== "student" : true) throw E(403, "You cannot upload this kind of file");
    if (!buf.length) throw E(400, "The file is empty"); if (buf.length > F.maxBytes) throw E(400, `File is too large (maximum ${Math.round(F.maxBytes / 1048576)} MB)`);
    const type = sniff(buf); if (!type || (kind === "jd" && type !== "application/pdf")) throw E(400, kind === "jd" ? "The JD must be a PDF file" : "Only PDF, JPG or PNG files are allowed");
    const id = rid() + rid(), name = String(req.query.name || "file").replace(/[^\w.\- ()]/g, "_").slice(0, 120), meta = await F.put(id, buf, type);
    await S.set("files", id, { name, type, size: buf.length, kind, by: u.id, byName: u.name, scope: [...u.path, u.id], createdAt: now(), backend: F.kind, ...meta });
    return { id, name, size: buf.length, type };
  }));
  app.get("/api/files/:id", authn, A(async (req, res) => {
    const f = await S.get("files", req.params.id), u = req.user; if (!f) throw E(404, "File not found");
    let ok = top(u) || f.by === u.id || (f.scope || []).includes(u.id);
    if (!ok && f.kind === "jd") ok = (await all("drives")).some((d) => d.jd?.id === f.id && d.status === "Approved" && (u.role === "td" || d.invites.some((i: any) => i.uid === u.id))); // invited students and T&D can read an approved drive's JD
    if (!ok) throw E(403, "You cannot open this file");
    const buf = await F.get(f.id, f); if (!buf) throw E(404, "File content is missing");
    res.setHeader("Content-Type", f.type); res.setHeader("Cache-Control", "private, max-age=0"); res.send(buf);
  }));

  // ---------- OFFERS & EARLY JOINING (students) ----------
  app.get("/api/offers", authn, A(async (req) => (req.user.role === "student" ? (await all("offers")).filter((x) => x.studentId === req.user.id) : scoped(await all("offers"), req.user))));
  app.post("/api/offers", authn, need("student"), A(async (req) => {
    const u = req.user, d = await S.get("drives", req.body.driveId); const res = d?.results?.[u.roll];
    if (!d || res?.result !== "Selected") throw E(400, "Offer letter can be uploaded only for a drive where you are Selected");
    const file = await checkFile({ id: req.body.fileId }, u, "offer");
    await S.set("files", file.id, { ...file, scope: [...new Set([...(file.scope || []), d.by])] }); // the officer of this drive may open it
    const id = rid(); await S.set("offers", id, { driveId: d.id, ref: d.ref, company: d.company, studentId: u.id, roll: u.roll, name: u.name, fileId: file.id, fileName: file.name, package: +req.body.package || res.package || 0, status: "Pending", at: now(), scope: [...u.path, u.id, d.by] });
    await notify((x) => x.id === d.by, `${u.name} uploaded offer letter for ${d.company}`, "offers"); return { id };
  }));
  app.post("/api/offers/:id/decision", authn, need("officer", "hod"), A(async (req) => {
    const x = await S.get("offers", req.params.id); if (!x || !own(x, req.user) || x.status !== "Pending") throw E(400, "Not pending");
    x.status = req.body.action === "approve" ? "Approved" : "Rejected"; await S.set("offers", x.id, x);
    await notify((y) => y.id === x.studentId, `Your offer letter for ${x.company} is ${x.status}`, "offers"); return { ok: true };
  }));
  app.get("/api/eja", authn, A(async (req) => (req.user.role === "student" ? (await all("eja")).filter((x) => x.studentId === req.user.id) : scoped(await all("eja"), req.user))));
  app.post("/api/eja", authn, need("student"), A(async (req) => {
    const u = req.user, b = req.body; if (!b.company || !b.fromDate || !b.toDate || b.toDate < b.fromDate) throw E(400, "Company and valid from/to dates required");
    const placed = (await all("drives")).some((d) => d.results?.[u.roll]?.result === "Selected" && ["Result Uploaded", "Result Approved"].includes(d.resultStatus)), locked = (await all("offers")).some((x) => x.studentId === u.id && x.status === "Approved");
    if (!placed && !locked) throw E(400, "Early Joining can be applied only by placed / locked students (selected in a drive, or with an approved offer letter)");
    const id = rid(); await S.set("eja", id, { ...pick(b, ["company", "fromDate", "toDate", "reason"]), studentId: u.id, roll: u.roll, name: u.name, status: "Pending", at: now(), scope: [...u.path, u.id] });
    await notify((x) => x.role === "hod" && (u.path || []).includes(x.id), `Early joining request from ${u.name}`, "early-joining"); return { id };
  }));
  app.post("/api/eja/:id/decision", authn, need("hod"), A(async (req) => {
    const x = await S.get("eja", req.params.id); if (!x || !own(x, req.user) || x.status !== "Pending") throw E(400, "Not pending");
    x.status = req.body.action === "approve" ? "Approved" : "Rejected";
    if (x.status === "Approved") { x.attendance = "Auto-marked (Early Joining)"; x.days = Math.round((Date.parse(x.toDate) - Date.parse(x.fromDate)) / DAY) + 1; }
    await S.set("eja", x.id, x); await notify((y) => y.id === x.studentId, `Early joining request ${x.status}`, "early-joining"); return { ok: true };
  }));

  // ---------- STUDENT MANAGER ----------
  app.get("/api/students", authn, need("hod", "officer", "td"), A(async (req) => {
    const u = req.user, ds = await Promise.all((await all("drives")).map(fresh));
    let us = (await all("users")).filter((x) => x.role === "student").map(pub); const ejas = (await all("eja")).filter((e) => e.status === "Approved");
    if (u.role === "hod") us = us.filter((x) => (x.path || []).includes(u.id));
    if (u.role === "officer" || u.role === "td") us = us.filter((x) => x.reportsTo === u.reportsTo);
    return us.map((s) => {
      const inv = ds.map((d) => ({ d, i: d.invites.find((i: any) => i.uid === s.id) })).filter((x) => x.i);
      const sel = inv.filter((x) => x.d.results?.[s.roll]?.result === "Selected" && ["Result Uploaded", "Result Approved"].includes(x.d.resultStatus));
      const yes = inv.filter((x) => x.i.consent === "yes").length;
      return { ...s, totalInvitation: inv.length, replied: inv.filter((x) => x.i.consent === "yes" || x.i.consent === "no").length, notReplied: inv.filter((x) => !x.i.consent || x.i.consent === "auto_no").length, saidYes: yes, driveParticipation: inv.filter((x) => x.d.results?.[s.roll]).length,
        blocked: s.status === "blocked" ? "Yes" : "No", earlyJoining: ejas.some((e) => e.studentId === s.id) ? "Yes" : "No", earlyJoiningDetail: ejas.filter((e) => e.studentId === s.id).map((e) => `${e.company} (${e.fromDate} to ${e.toDate})`).join("; "),
        placed: sel.length > 0 ? "Placed" : "Unplaced", companyPlaced: sel.map((x) => x.d.company).join(", "), totalPlaced: sel.length, packages: sel.map((x) => x.d.results[s.roll].package).join(", ") };
    }).filter((s) => u.role !== "td" || s.saidYes > 0); // T&D sees only consent=Yes students
  }));

  // ---------- NOTIFICATIONS ----------
  app.get("/api/notifications", authn, A(async (req) => {
    const u = req.user, out: any[] = [], t = now(), today = isoToday();
    const ds = await Promise.all((await all("drives")).map(fresh));
    if (u.role === "student") ds.filter((d) => d.status === "Approved" && t <= d.consentBy && d.invites.some((i: any) => i.uid === u.id && !i.consent)).forEach((d) => out.push({ kind: "Consent", text: `Consent pending: ${d.company} (till ${new Date(d.consentBy).toLocaleString()})`, link: "drives" }));
    else {
      const mine = scoped(ds, u);
      mine.filter((d) => d.status === "Approved" && d.startDate >= today).forEach((d) => out.push({ kind: "Upcoming drive", text: `${d.company} on ${d.startDate} (${d.ref})`, link: "drives" }));
      mine.filter((d) => d.status === "Approved" && d.endDate < today && d.resultStatus === "Result Not Uploaded").forEach((d) => out.push({ kind: "Result pending", text: `${d.company} (${d.ref}) drive date passed, result not uploaded`, link: "drives" }));
      scoped(await all("visits"), u).filter((v) => v.status === "Approved" && v.visitDate < today && !v.feedbackDone).forEach((v) => out.push({ kind: "Visit feedback pending", text: `${v.type} (${v.visitDate})`, link: "visits" }));
      if (u.role === "officer") (await all("followups")).filter((f) => f.by === u.id && f.status === "Open" && f.nextDate && f.nextDate <= today).forEach((f) => out.push({ kind: "Follow-up due", text: `${f.company}: ${f.note}`, link: "followups" }));
    }
    const mineN = (await all("notifications")).filter((n) => n.to === u.id).sort((a, b) => b.at - a.at).slice(0, 25);
    mineN.forEach((n) => out.push({ kind: "Update", text: n.text, link: n.link, at: n.at }));
    return out;
  }));

  // ---------- ADMIN ----------
  app.post("/api/admin/staff", authn, adminOnly, A(async (req) => { // CEO / HOD / Officer / T&D accounts are created only here
    const b = req.body;
    if (!["ceo", "hod", "officer", "td"].includes(b.role)) throw E(400, "Role must be CEO, HOD, Placement Officer or Training & Development");
    if (!String(b.name || "").trim() || !norm(b.email)) throw E(400, "Name and email are required");
    const u = await createAccount({ email: b.email, password: b.password, role: b.role, profile: pick(b, ["name", "phone", "empId", "designation", "department", "campus", "team"]), reportsToEmail: b.reportsToEmail, mustChange: true });
    await audit(req.user, "create staff account", `${u.email} (${u.role})`); return { id: u.id };
  }));
  const REG_KEYS = ["roll", "name", "email", "phone", "course", "passout", "campus", "gender", "dob", "fatherName", "fatherMobile", "personalEmail", "enrollmentNo", "uniqueId"];
  app.post("/api/admin/students/import", authn, adminOnly, A(async (req) => { // admin feeds student registration data (+ optional login accounts with a common password)
    const { rows, createAccounts, commonPassword, defaultHodEmail } = req.body; if (!Array.isArray(rows) || !rows.length) throw E(400, "No rows to import");
    if (rows.length > 2000) throw E(400, "Import at most 2000 rows at a time"); if (createAccounts) pwCheck(commonPassword);
    const out = { total: rows.length, registry: 0, accounts: 0, skipped: 0, errors: [] as string[], credentials: [] as any[] };
    for (const [i, r] of rows.entries()) {
      const roll = rollKey(r.roll), email = norm(r.email), name = String(r.name || "").trim();
      if (!roll || !email || !name) { out.errors.push(`Row ${i + 1}: roll, name and email are required`); continue; }
      const old = await S.get("registry", roll), hod = norm(r.hodEmail || r.reportsToEmail || defaultHodEmail);
      let rec: any = { ...(old || {}), ...pick({ ...r, roll: String(r.roll).trim(), email, name }, REG_KEYS), reportsToEmail: hod || old?.reportsToEmail || "", registered: !!old?.registered };
      if (createAccounts && !rec.registered) {
        try { const pw = String(r.password || "").trim() || commonPassword; await createAccount({ email, password: pw, role: "student", profile: pick(rec, REG_KEYS), reportsToEmail: rec.reportsToEmail, mustChange: true });
          rec.registered = true; out.accounts++; out.credentials.push({ roll: rec.roll, name, email, password: pw }); } catch (e: any) { out.errors.push(`Row ${i + 1} (${roll}): ${e.message}`); }
      } else if (createAccounts) out.skipped++;
      await S.set("registry", roll, rec); out.registry++;
    }
    await audit(req.user, "import student data", `${out.registry} records, ${out.accounts} accounts`); return out;
  }));
  app.post("/api/admin/users/:id/reset-password", authn, adminOnly, A(async (req) => {
    const u = await S.get("users", req.params.id); if (!u) throw E(404, "User not found");
    await I.setPassword(u.id, pwCheck(req.body.password)); await S.set("users", u.id, { ...u, mustChangePassword: true }); await audit(req.user, "reset password", u.email); return { ok: true };
  }));
  const COLS = ["users", "registry", "companies", "visits", "drives", "assignments", "offers", "eja", "followups", "notifications", "config", "audit"];
  const okc = (q: any, _r: any, n: any) => (COLS.includes(q.params.c) ? n() : n(E(400, "Unknown collection")));
  app.get("/api/admin/:c", authn, adminOnly, okc, A(async (req) => all(req.params.c)));
  app.put("/api/admin/:c/:id", authn, adminOnly, okc, A(async (req) => {
    const { c, id } = req.params, data = { ...req.body }; delete data.id;
    if (c === "users") {
      if (data.newPassword) { await I.setPassword(id, pwCheck(data.newPassword)); data.mustChangePassword = true; delete data.newPassword; }
      if (data.reportsTo) { const p = await S.get("users", data.reportsTo); data.path = p ? [...(p.path || []), p.id] : []; } else data.path = [];
    }
    await S.set(c, id, data); await audit(req.user, "edit", `${c}/${id}`); return { ok: true };
  }));
  app.delete("/api/admin/:c/:id", authn, adminOnly, okc, A(async (req) => {
    if (req.params.c === "users") { if (req.params.id === req.user.id) throw E(400, "You cannot delete your own account"); await I.remove(req.params.id).catch(() => {}); }
    await S.del(req.params.c, req.params.id); await audit(req.user, "delete", `${req.params.c}/${req.params.id}`); return { ok: true };
  }));

  app.use((_q, _r, n) => n(E(404, "Not found")));
  app.use((e: any, _q: any, res: any, _n: any) => { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : "Server error" }); });
  return app;
}
