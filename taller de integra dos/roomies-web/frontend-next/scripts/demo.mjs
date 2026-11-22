import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DEMO_CREDENTIALS, startDemoApi } from "./demo-api.mjs";

if (process.env.NODE_ENV === "production") {
  console.error("El modo demo requiere desarrollo local; NODE_ENV=production no está permitido.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT debe ser un puerto entre 1 y 65535.");
  process.exit(1);
}

const project = fileURLToPath(new URL("../", import.meta.url));
const api = await startDemoApi();
const origin = `http://127.0.0.1:${port}`;
// Only the demo API receives credentials and writes; dotenv cannot replace these origins.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA"].includes(key.toUpperCase())));
const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: project, windowsHide: true, stdio: "inherit",
  env: {
    ...env, NODE_ENV: "development", ROOMIES_DEMO_MODE: "1", ROOMIES_LOCAL_MODE: "1", ROOMIES_RUNTIME_MODE: "disposable",
    FASTAPI_ORIGIN: api.origin, WEB_AUTH_FASTAPI_ORIGIN: api.origin, WEB_AUTH_ORIGIN: origin,
    WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "legacy", WEB_SUPABASE_ORIGIN: "", WEB_SUPABASE_PUBLISHABLE_KEY: "", ROOMIES_SUPABASE_PROJECT_REF: "",
  },
});

let stopping = false;
async function stop(code) {
  if (stopping) return;
  stopping = true;
  if (child.pid && child.exitCode === null) {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  await api.close();
  process.exit(code);
}
child.on("error", (error) => { console.error(error.message); void stop(1); });
child.on("close", (code) => { void stop(code ?? 1); });
process.on("SIGINT", () => { void stop(0); });
process.on("SIGTERM", () => { void stop(0); });

console.log(`\nDemo local: ${origin}`);
console.log(`Correo: ${DEMO_CREDENTIALS.correo}\nContraseña: ${DEMO_CREDENTIALS.contrasena}`);
console.log("Datos ficticios en memoria. Se borran al reiniciar. Ctrl+C para cerrar.\n");
