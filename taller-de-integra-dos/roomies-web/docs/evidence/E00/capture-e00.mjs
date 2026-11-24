import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const frontend = resolve(process.cwd(), "taller-de-integra-dos/roomies-web/frontend-next");
const outDir = resolve(frontend, "../docs/evidence/E00");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = async () => new Promise((ok, fail) => {
  const s = createTcpServer(); s.once("error", fail); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
});
const [appPort, apiPort, debugPort] = await Promise.all([port(), port(), port()]);
const origin = `http://127.0.0.1:${appPort}`;
const mockApi = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({ nombre: "Revisión E00" }));
});
await new Promise((ok) => mockApi.listen(apiPort, "127.0.0.1", ok));
const app = spawn(process.execPath, [resolve(frontend, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: frontend, windowsHide: true, stdio: "ignore",
  env: { ...process.env, WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "legacy", WEB_AUTH_ORIGIN: origin, WEB_AUTH_FASTAPI_ORIGIN: `http://127.0.0.1:${apiPort}` },
});
const profile = mkdtempSync(join(tmpdir(), "roomies-e00-edge-"));
const browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--window-size=1440,1000", "about:blank"], { windowsHide: true, stdio: "ignore" });
let ws;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (app.exitCode !== null) throw new Error(`Next terminó antes de iniciar (código ${app.exitCode}).`);
    try { const r = await fetch(origin); if (r.status) { ready = true; break; } } catch {}
    await sleep(1000);
  }
  if (!ready) throw new Error("Next no respondió dentro de 120 segundos.");
  let target;
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) { target = await r.json(); break; }
    } catch {}
    await sleep(500);
  }
  if (!target?.webSocketDebuggerUrl) throw new Error("No se pudo abrir la sesión CDP de Edge.");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok, { once: true }); ws.addEventListener("error", fail, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); }
  });
  const cdp = (method, params = {}) => new Promise((ok, fail) => { const n = ++id; pending.set(n, { resolve: ok, reject: fail }); ws.send(JSON.stringify({ id: n, method, params })); });
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp("Network.setCookie", { name: "haycupo_dev_session", value: "e00.local.review", url: origin, path: "/", httpOnly: true, sameSite: "Lax" });
  async function waitText(expectedText, path) {
    for (let i = 0; i < 60; i++) {
      if (app.exitCode !== null) throw new Error(`Next terminó durante la navegación (código ${app.exitCode}). ${appOutput.slice(-1800)}`);
      await sleep(500);
      const { result } = await cdp("Runtime.evaluate", { expression: `document.body?.innerText || ""`, returnByValue: true });
      if (result.value?.includes(expectedText)) return;
    }
    const { result } = await cdp("Runtime.evaluate", { expression: `document.body?.innerText || ""`, returnByValue: true });
    throw new Error(`No apareció «${expectedText}» en ${path}. Texto visible: ${(result.value || "").slice(0, 300)}`);
  }
  async function navigate(path, expectedText) {
    await cdp("Page.navigate", { url: `${origin}${path}` });
    await sleep(1200);
    await waitText(expectedText, path);
    await sleep(800);
  }  async function choose(label) {
    const expression = `(() => { const s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.textContent.trim()===${JSON.stringify(label)})); if(!s) return false; s.value=[...s.options].find(o=>o.textContent.trim()===${JSON.stringify(label)}).value; s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`;
    const { result } = await cdp("Runtime.evaluate", { expression, returnByValue: true });
    if (!result.value) throw new Error(`No se encontró selector para: ${label}`);
    await sleep(900);
  }
  async function capture(name) {
    await cdp("Runtime.evaluate", { expression: `document.querySelectorAll("nextjs-portal").forEach((node) => node.style.setProperty("display", "none", "important"));` });
    await sleep(250);
    const shot = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
    writeFileSync(join(outDir, name), Buffer.from(shot.data, "base64"));
    console.log(`Captura ${name}`);
  }
  await navigate("/mi-arriendo", "Mi arriendo");
  await choose("Sin arriendo activo (404)"); await waitText("Aún no tienes un arriendo activo.", "/mi-arriendo"); await capture("01-mi-arriendo-sin-arriendo.png");
  await navigate("/mi-arriendo", "Mi arriendo"); await choose("Cargando"); await waitText("Cargando tu arriendo…", "/mi-arriendo"); await capture("02-mi-arriendo-cargando.png");
  await navigate("/mi-arriendo", "Mi arriendo"); await choose("Error recuperable (503/red)"); await waitText("No pudimos cargar tu arriendo.", "/mi-arriendo"); await capture("03-mi-arriendo-error-reintentable.png");
  await navigate("/mi-arriendo/chat", "Chat del arriendo"); await waitText("Coordinamos las tareas", "/mi-arriendo/chat"); await capture("04-chat-activo.png");
  await navigate("/mi-arriendo/chat", "Chat del arriendo"); await choose("Error recuperable"); await waitText("No pudimos cargar el chat.", "/mi-arriendo/chat"); await capture("05-chat-error-reintentable.png");
  await navigate("/mi-arriendo/chat", "Chat del arriendo"); await choose("Acceso retirado (403)"); await waitText("Acceso retirado", "/mi-arriendo/chat"); await capture("06-chat-acceso-retirado-403.png");
  await navigate("/mi-arriendo/integrantes", "Arrendador responsable"); await capture("07-integrantes-separados-de-postulantes.png");
  await navigate("/mi-arriendo/tareas", "Ordenar la cocina");
  const openTask = await cdp("Runtime.evaluate", { expression: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Nueva tarea')); if(!b) return false; b.click(); return true; })()`, returnByValue: true });
  if (!openTask.result.value) throw new Error("No se encontró el botón Nueva tarea.");
  await waitText("Se creará sin asignado", "/mi-arriendo/tareas"); await capture("08-tarea-formulario-sin-asignado.png");
  console.log(`Evidencia guardada en ${outDir}`);
} finally {
  try { ws?.close(); } catch {}
  browser.kill(); app.kill();
  await new Promise((ok) => mockApi.close(ok));

}