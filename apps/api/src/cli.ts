// npm run create-admin:firebase -- <email> <password> [name]      create (or promote) the first Admin
// npm run remove-demo:firebase [-- --yes] [-- --keep you@x.com]   delete leftover demo accounts/data from older versions
// npm run fix-companies:firebase [-- --yes]                       companies created by Admin/CEO get no officer-SPOC (any officer can then self-assign)
import { buildRuntime } from "./runtime";
const DEMO_EMAILS = ["admin", "ceo", "hod", "officer", "td", "student", ...Array.from({ length: 7 }, (_, i) => "student" + (i + 1)), "tanya", "manish", "newoff", "rajesh", "bulk1", "bulk2"].map((x) => x + "@gu.edu");
const DEMO_DOCS: [string, string[]][] = [["companies", ["c-tech", "c-infra", "c-fin", "c-hire", "c-cloud"]], ["drives", ["d-past", "d-new"]], ["visits", ["v-1", "v-2"]], ["registry", ["GU2201001", "GU2201002", "GU2201003", "GU2201004", "GU2201005", "GU2201006", "GU2201007", "GU2201008", "GU2201009", "GU2201010", "GU2201201", "GU2201202"]]];
(async () => {
  const args = process.argv.slice(2), cmd = args[0], { store, identity, mode, storeKind } = await buildRuntime();
  console.log(`[cli] auth=${mode} data=${storeKind}${process.env.FIRESTORE_EMULATOR_HOST ? " (emulator)" : ""}`);
  if (cmd === "create-admin") {
    const [a, b, c] = args.slice(1); if (!a || !b) throw new Error("Usage: create-admin <email> <password> [name]");
    const email = a.toLowerCase(), existing = (await store.list("users")).find((u) => u.email === email);
    if (existing) { await store.set("users", existing.id, { ...existing, role: "admin", status: "active" }); console.log("Existing user promoted to admin:", email); }
    else { const uid = await identity.create(email, b, c || "Admin"); await store.set("users", uid, { name: c || "Admin", email, role: "admin", status: "active", mustChangePassword: false, reportsTo: null, path: [], createdAt: Date.now() }); console.log("Admin created:", email); }
  } else if (cmd === "remove-demo") {
    const yes = args.includes("--yes"), keep = (args[args.indexOf("--keep") + 1] || "").toLowerCase();
    const users = (await store.list("users")).filter((u) => DEMO_EMAILS.includes(u.email) && u.email !== keep);
    console.log(`Demo accounts found (${users.length}):`, users.map((u) => u.email).join(", ") || "none");
    const docs: [string, string][] = []; for (const [c, ids] of DEMO_DOCS) for (const id of ids) if (await store.get(c, id)) docs.push([c, id]);
    console.log(`Demo records found (${docs.length}):`, docs.map(([c, i]) => `${c}/${i}`).join(", ") || "none");
    if (!yes) console.log("\nNothing deleted. Run again with --yes to delete these. Use --keep your-admin@email.com if one of them is your real admin.");
    else { for (const u of users) { await identity.remove(u.id).catch(() => {}); await store.del("users", u.id); } for (const [c, i] of docs) await store.del(c, i); console.log("Deleted."); }
  } else if (cmd === "fix-company-owners") {
    const yes = args.includes("--yes"), users = await store.list("users"), bad = (await store.list("companies")).filter((c) => c.spoc && users.find((u) => u.id === c.spoc)?.role !== "officer");
    console.log(`Companies whose SPOC is not a Placement Officer (${bad.length}):`, bad.map((c) => `${c.name} (SPOC: ${c.spocName})`).join(", ") || "none");
    if (!yes) console.log("\nNothing changed. Run again with --yes to clear the SPOC of these companies (they become 'Not Assigned' so an officer can self-assign them with HOD approval).");
    else { for (const c of bad) await store.set("companies", c.id, { ...c, spoc: null, spocName: null, assignedAt: 0 }); console.log("Fixed."); }
  } else console.log("Commands: create-admin <email> <password> [name] | remove-demo [--yes] [--keep email] | fix-company-owners [--yes]");
  process.exit(0);
})().catch((e) => { console.error("[cli] failed:", e.message); process.exit(1); });
