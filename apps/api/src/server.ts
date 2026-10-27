import { buildRuntime } from "./runtime"; import { createApp } from "./app";
async function main() {
  const { store, identity, files, mode, storeKind } = await buildRuntime();
  if (process.env.TEST_FIXTURES === "true" && process.env.NODE_ENV !== "production") { const { seedDemo } = await import("../test/fixtures"); await seedDemo(store, identity); console.log("[test] fixtures loaded"); }
  const app = createApp({ store, identity, files, origins: (process.env.CORS_ORIGINS || "http://localhost:3000").split(","), dev: process.env.NODE_ENV !== "production" });
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`GU-PMS API on http://localhost:${port}  (auth=${mode}, data=${storeKind}, files=${files.kind}${process.env.FIRESTORE_EMULATOR_HOST ? ", FIREBASE EMULATOR" : ""})`));
}
main().catch((e) => { console.error("Startup failed:", e.message); process.exit(1); });
