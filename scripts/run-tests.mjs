// npm test  ->  starts the API in LOCAL mode with TEST fixtures (never touches Firebase) on port 4010, runs scripts/e2e.mjs, stops the API.
import { spawn } from "node:child_process"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { createRequire } from "node:module";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gupms-test-")), port = 4010;
const env = { ...process.env, AUTH_MODE: "local", STORE: "memory", TEST_FIXTURES: "true", PORT: String(port), DATA_DIR: dir, NODE_ENV: "development", ENV_FILE: path.join(dir, "none.env") };
const tsx = createRequire(path.resolve("apps/api/package.json")).resolve("tsx/cli"); // run tsx directly (no shell) so the API process is really stopped on every OS
const api = spawn(process.execPath, [tsx, "src/server.ts"], { cwd: "apps/api", env, stdio: ["ignore", "pipe", "inherit"] });
let up = false; api.stdout.on("data", (d) => { if (String(d).includes("GU-PMS API")) up = true; });
for (let i = 0; i < 60 && !up; i++) await new Promise((r) => setTimeout(r, 500));
if (!up) { console.error("API did not start"); api.kill(); process.exit(1); }
const t = spawn("node", ["scripts/e2e.mjs"], { env: { ...process.env, API: `http://localhost:${port}/api` }, stdio: "inherit" });
t.on("exit", (c) => { api.kill(); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(c ?? 1); }, 300); });
