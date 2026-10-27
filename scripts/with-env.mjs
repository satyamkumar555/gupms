// Cross-platform: node scripts/with-env.mjs <envfile> -- <command...>   (loads KEY=VALUE lines, then runs the command)
import fs from "node:fs"; import { spawn } from "node:child_process";
const [file, sep, ...cmd] = process.argv.slice(2);
if (!file || sep !== "--" || !cmd.length) { console.error("Usage: with-env.mjs <envfile> -- <command...>"); process.exit(1); }
const env = { ...process.env };
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const p = spawn(cmd.join(" "), { stdio: "inherit", shell: true, env }); p.on("exit", (c) => process.exit(c ?? 0));
