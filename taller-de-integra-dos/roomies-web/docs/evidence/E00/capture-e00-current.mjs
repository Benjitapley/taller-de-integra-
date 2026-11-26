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
let rentalMode = "ready";
let chatMode = "ready";
let membersMode = "ready";
const rental = { id_arriendo: 101, id_publicacion: 42, estado: "Activo", cupos_totales: 4, integrantes_activos: 3, cupos_disponibles: 1, id_responsable: 1 };
const mockApi = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  let status = 200;
  let body;
  if (path === "/api/perfil") body = { nombre: "Revisión E00" };
  else if (path === "/api/arriendos/mio") {
    status = rentalMode === "forbidden" ? 403 : rentalMode === "empty" ? 404 : rentalMode === "error" ? 503 : 200;
    body = status === 200 ? rental : { codigo: status === 403 ? "sin_permiso" : status === 404 ? "no_encontrado" : "dependencia_no_disponible", mensaje: "Estado sintético E00" };
  } else if (path === "/api/arriendos/101/integrantes") {
    status = membersMode === "forbidden" ? 403 : membersMode === "error" ? 503 : 200;
    body = status === 200 ? { items: [
      { id_usuario: 1, nombre: "Pat (muestra)", es_responsable: true, fecha_ingreso: "2026-11-20T12:00:00.000Z", activo: true },
      { id_usuario: 2, nombre: "Alex (muestra)", es_responsable: false, fecha_ingreso: "2026-11-21T12:00:00.000Z", activo: true },
    ], siguiente_cursor: null } : { codigo: status === 403 ? "sin_permiso" : "dependencia_no_disponible", mensaje: "Estado sintético E00" };
  } else if (path === "/api/conversaciones") body = { items: [{ id_conversacion: 15, id_arriendo: 101, fecha_creacion: "2026-11-20T12:00:00.000Z" }], siguiente_cursor: null };
  else if (path === "/api/conversaciones/15/mensajes") {
    status = chatMode === "forbidden" ? 403 : chatMode === "error" ? 503 : 200;
    body = status === 200 ? { items: [
      { id_mensaje: 1, id_conversacion: 15, id_remitente: 2, nombre_remitente: "Alex (muestra)", contenido: "¡Hola! ¿Coordinamos las tareas de esta semana?", fecha_envio: "2026-11-22T16:10:00.000Z" },
      { id_mensaje: 2, id_conversacion: 15, id_remitente: 1, nombre_remitente: "Revisión E00", contenido: "Sí, revisemos Organización de la casa.", fecha_envio: "2026-11-22T16:12:00.000Z" },
    ], siguiente_cursor: null } : { codigo: status === 403 ? "sin_permiso" : "dependencia_no_disponible", mensaje: "Estado sintético E00" };
  } else { status = 404; body = { codigo: "no_encontrado", mensaje: "Sin fixture E00" }; }
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
});
await new Promise((ok) => mockApi.listen(apiPort, "127.0.0.1", ok));
const app = spawn(process.execPath, [resolve(frontend, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(appPort)], {
  cwd: frontend, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "legacy", WEB_AUTH_ORIGIN: origin, WEB_AUTH_FASTAPI_ORIGIN: `http://127.0.0.1:${apiPort}` },
});
let appOutput = "";
for (const stream of [app.stdout, app.stderr]) stream.on("data", (chunk) => { appOutput = (appOutput + chunk.toString()).slice(-3000); });
const profile = mkdtempSync(join(tmpdir(), "roomies-e00-edge-"));
const browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--window-size=1440,1000", "about:blank"], { windowsHide: true, stdio: "ignore" });
let ws;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (app.exitCode !== null) throw new Error(`Next terminó antes de iniciar (código ${app.exitCode}). ${appOutput}`);
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
  }
  async function choose(label) {
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
  await navigate("/mi-arriendo", "Mi arriendo"); await choose("Arriendo activo de muestra");
  await waitText("Nuestro lugar", "/mi-arriendo"); await capture("10-actual-mi-arriendo-activo.png");
  await navigate("/mi-arriendo/integrantes", "Pat (muestra)"); await capture("11-actual-integrantes.png");
  membersMode = "error";
  await navigate("/mi-arriendo/integrantes", "No pudimos cargar la lista de integrantes"); await capture("12-actual-integrantes-error.png");
  membersMode = "ready";
  const retryMembers = await cdp("Runtime.evaluate", { expression: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Reintentar'); if(!b) return false; b.click(); return true; })()`, returnByValue: true });
  if (!retryMembers.result.value) throw new Error("No se encontró Reintentar en integrantes.");
  await waitText("Pat (muestra)", "/mi-arriendo/integrantes");
  await navigate("/mi-arriendo/chat", "Coordinamos las tareas"); await capture("13-actual-chat-activo.png");
  const chatLabel = await cdp("Runtime.evaluate", { expression: `(() => { const t=document.querySelector('#chat-message'); t?.focus(); return {labels:t?.labels?.length, focus:document.activeElement===t, outline:getComputedStyle(t?.closest('form')).outlineStyle}; })()`, returnByValue: true });
  if (!chatLabel.result.value.focus || !chatLabel.result.value.labels || chatLabel.result.value.outline === "none") throw new Error(`Chat sin etiqueta o foco visible: ${JSON.stringify(chatLabel.result.value)}`);
  chatMode = "error";
  await navigate("/mi-arriendo/chat", "No se pudieron cargar los mensajes"); await capture("14-actual-chat-error.png");
  chatMode = "ready";
  const retryChat = await cdp("Runtime.evaluate", { expression: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Reintentar'); if(!b) return false; b.click(); return true; })()`, returnByValue: true });
  if (!retryChat.result.value) throw new Error("No se encontró Reintentar en chat.");
  await waitText("Coordinamos las tareas", "/mi-arriendo/chat");
  chatMode = "forbidden";
  await navigate("/mi-arriendo/chat", "Acceso retirado"); await capture("15-actual-chat-acceso-retirado.png");
  chatMode = "ready";
  await navigate("/mi-arriendo/tareas", "Ordenar la cocina");
  const openTask = await cdp("Runtime.evaluate", { expression: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Nueva tarea')); if(!b) return false; b.click(); return true; })()`, returnByValue: true });
  if (!openTask.result.value) throw new Error("No se encontró el botón Nueva tarea.");
  await waitText("Se creará sin asignado", "/mi-arriendo/tareas"); await capture("16-actual-tarea-sin-asignar.png");
  const accessibleForm = await cdp("Runtime.evaluate", { expression: `(() => { const d=document.querySelector('dialog[open]'); const fields=['task-title','task-description','task-assignee'].map(id=>document.getElementById(id)); return { open:!!d?.open, focus:document.activeElement?.getAttribute('aria-label'), labels:fields.map(x=>x?.labels?.length), assignee:document.getElementById('task-assignee')?.value, title:!!d?.getAttribute('aria-labelledby') }; })()`, returnByValue: true });
  const form = accessibleForm.result.value;
  if (!form.open || form.focus !== "Cerrar diálogo" || form.labels.some((n) => !n) || form.assignee !== "" || !form.title) throw new Error(`Foco, etiquetas o valor Sin asignar del formulario incorrectos: ${JSON.stringify(form)}`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(300);
  const closedWithEscape = await cdp("Runtime.evaluate", { expression: `!document.querySelector('dialog[open]')`, returnByValue: true });
  if (!closedWithEscape.result.value) throw new Error("Escape no cerró el formulario de tarea.");
  rentalMode = "forbidden";
  await navigate("/mi-arriendo/tareas", "Acceso no disponible"); await capture("17-actual-tareas-sin-acceso.png");
  const revokedActions = await cdp("Runtime.evaluate", { expression: `(() => ![...document.querySelectorAll('button')].some(x=>x.textContent.includes('Nueva tarea')))()`, returnByValue: true });
  if (!revokedActions.result.value) throw new Error("Nueva tarea disponible tras retirar acceso.");
  rentalMode = "empty";
  await navigate("/mi-arriendo", "Aún no tienes un arriendo activo."); await capture("18-actual-sin-arriendo.png");
  console.log(`Evidencia actual guardada en ${outDir}`);
} finally {
  try { ws?.close(); } catch {}
  browser.kill(); app.kill();
  await new Promise((ok) => mockApi.close(ok));

}
