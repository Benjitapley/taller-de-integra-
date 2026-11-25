/** Real Next/BFF/React in Edge; synthetic HTTP domain data, no shared accounts. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";

const edge = process.env.E05_BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const port = () => new Promise(ok => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => ok(value)); }); });
test("E05 navegador: dueño, confirmación, respuesta perdida, doble clic y revocación", { skip: !existsSync(edge), timeout: 240_000 }, async t => {
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-e05-"));
  const profile = await mkdtemp(join(tmpdir(), "roomies-e05-browser-"));
  let next, browser, ws, linked = false, owner = true, removed = false, loseResponse = true, withdrawals = 0;
  const rental = () => ({ id_arriendo: 7, id_publicacion: 42, estado: removed ? "Finalizado" : "Activo", cupos_totales: 2,
    integrantes_activos: removed ? 0 : 1, cupos_disponibles: removed ? 2 : 1, id_responsable: removed ? null : 2, puede_retirar: owner, id_usuario_actual: 2 });
  const member = { id_usuario: 2, nombre: "Alex de prueba", es_responsable: true, activo: true, fecha_ingreso: "2026-11-20T12:00:00Z" };
  const task = { id_tarea: 1, id_arriendo: 7, titulo: "Tarea privada de prueba", descripcion: null, id_creador: 2, id_asignado: null, estado: "Pendiente", fecha_creacion: member.fecha_ingreso };
  const upstream = createServer(async (request, response) => {
    const path = new URL(request.url, "http://fixture.invalid").pathname;
    const reply = (status, body) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
    if (path === "/api/perfil") return reply(200, { nombre: "Prueba E05" });
    if (path === "/api/arriendos/mio") return reply(removed ? 404 : 200, rental());
    if (path === "/api/arriendos/7") return reply(200, rental());
    if (path === "/api/arriendos/7/integrantes") return reply(200, { items: removed ? [] : [member], siguiente_cursor: null });
    if (path === "/api/arriendos/7/tareas") return reply(removed ? 403 : 200, { items: [task], siguiente_cursor: null });
    if (path === "/api/arriendos/7/expulsiones") {
      let body = ""; for await (const chunk of request) body += chunk;
      assert.deepEqual(JSON.parse(body), { id_usuario: 2, motivo: "Motivo de prueba E05", confirmo: true });
      if (!owner) return reply(403, {});
      if (!removed) { withdrawals++; removed = true; }
      if (loseResponse) { loseResponse = false; return reply(503, {}); }
      return reply(200, { id_arriendo: 7, id_usuario_retirado: 2, estado: "Finalizado", cupos_totales: 2, ocupacion: 0, sincronizacion_pendiente: false });
    }
    return reply(404, {});
  });
  await new Promise(done => upstream.listen(0, "127.0.0.1", done));
  const [appPort, debugPort] = await Promise.all([port(), port()]);
  const base = `http://127.0.0.1:${appPort}`, fixture = `http://127.0.0.1:${upstream.address().port}`;
  t.after(async () => {
    ws?.close();
    for (const process_ of [browser, next]) if (process_?.pid && process_.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(process_.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      else process_.kill("SIGTERM");
    }
    upstream.closeAllConnections(); await new Promise(done => upstream.close(done));
    assert.ok(resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-e05-"));
    assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep + "roomies-e05-browser-"));
    if (linked) await unlink(join(isolated, "node_modules"));
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) await cp(join(project, name), join(isolated, name), { recursive: true });
  const configFile = join(isolated, 'next.config.ts');
  await writeFile(configFile, (await readFile(configFile, 'utf8')).replace('const nextConfig: NextConfig = {', 'const nextConfig: NextConfig = {\n  devIndicators: false,'));
  await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir"); linked = true;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
  next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: isolated, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...env, NEXT_TELEMETRY_DISABLED: "1", WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "legacy", WEB_AUTH_ORIGIN: base, WEB_AUTH_FASTAPI_ORIGIN: fixture },
  });
  let output = ""; for (const stream of [next.stdout, next.stderr]) stream.on("data", chunk => { output = (output + chunk).slice(-4000); });
  for (let i = 0; ; i++) {
    if (next.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base)).status) break; } catch {}
    if (i > 150) throw new Error("Next no inició: " + output);
    await sleep(300);
  }
  browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let target;
  for (let i = 0; !target && i < 60; i++) {
    try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }); if (response.ok) target = await response.json(); } catch {}
    if (!target) await sleep(300);
  }
  assert.ok(target?.webSocketDebuggerUrl, "Edge no inició CDP");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener("open", ok, { once: true }); ws.addEventListener("error", fail, { once: true }); });
  const pending = new Map(), errors = []; let sequence = 0;
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    const waiting = pending.get(message.id);
    if (waiting) {
      pending.delete(message.id);
      if (message.error) waiting.reject(Error(message.error.message));
      else waiting.resolve(message.result);
    }
  });
  const cdp = (method, params = {}) => new Promise((ok, fail) => { const id = ++sequence; pending.set(id, { resolve: ok, reject: fail }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(300); }
    throw Error("No se cumplió: " + expression + "\n" + await evaluate('document.body.innerText'));
  };
  const navigate = async (path, text) => { await evaluate('window.__e05PreviousDocument = true'); await cdp("Page.navigate", { url: base + path }); await wait(`!window.__e05PreviousDocument && document.body?.innerText.includes(${JSON.stringify(text)})`); };
  const click = text => evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.trim()===${JSON.stringify(text)}).click()`);
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable");
  await cdp("Network.setCookie", { name: "haycupo_dev_session", value: "e05.local.fixture", url: base, httpOnly: true, sameSite: "Strict" });
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate("/mi-arriendo/7/integrantes", "Alex de prueba");
  await click("Retirar integrante");
  await wait("Boolean(document.querySelector('dialog[open]'))");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(button => button.type==='submit').disabled"), true);
  await evaluate("document.querySelector('#withdraw-reason').focus()");
  await cdp("Input.insertText", { text: "Motivo de prueba E05" });
  await evaluate("document.querySelector('input[type=checkbox]').click()");
  await wait("![...document.querySelectorAll('button')].find(button => button.type==='submit').disabled");
  if (process.env.E05_QA_DIR) {
    await mkdir(process.env.E05_QA_DIR, { recursive: true });
    const image = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(join(process.env.E05_QA_DIR, "retiro-confirmacion.png"), Buffer.from(image.data, "base64"));
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(200);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const mobile = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(process.env.E05_QA_DIR, 'retiro-confirmacion-mobile.png'), Buffer.from(mobile.data, 'base64'));
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  }
  await evaluate("document.querySelector('button[type=submit]').click(); document.querySelector('button[type=submit]').click()");
  await wait("document.body.innerText.includes('No pudimos confirmar')");
  assert.equal(await evaluate("document.querySelector('#withdraw-reason').value"), "Motivo de prueba E05");
  await evaluate("document.querySelector('button[type=submit]').click()");
  await wait("document.body.innerText.includes('Integrante retirado. Cupos disponibles: 2.')");
  assert.equal(withdrawals, 1);
  owner = false; removed = false;
  await navigate("/mi-arriendo/7/integrantes", "Alex de prueba");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(button => button.textContent.trim()==='Retirar integrante')"), false);
  await navigate("/mi-arriendo/tareas", "Tarea privada de prueba");
  removed = true;
  await evaluate("window.dispatchEvent(new Event('focus'))");
  await wait("document.body.innerText.includes('Acceso no disponible')");
  assert.equal(await evaluate("document.body.innerText.includes('Tarea privada de prueba')"), false);
  assert.equal(await evaluate("[...document.querySelectorAll('a')].some(link => link.textContent.includes('Nueva tarea'))"), false);
  assert.deepEqual(errors, []);
});
