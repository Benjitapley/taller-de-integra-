/** UI real de Next/BFF con transporte HTTP ficticio explícito; sin datos reales. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("SCRUM-113 en navegador: error, reintento estable, historial y contexto de integrante", {
  skip: !process.env.REPORTS_PLAYWRIGHT_PATH || !process.env.REPORTS_BROWSER_PATH, timeout: 180_000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH);
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-reportes-"));
  let next, browser, linked = false;
  const operations = new Map(), keys = [], errors = [];
  let loseResponse = true, failPage = true, created = 0;
  const records = Array.from({ length: 43 }, (_, i) => ({ id_reporte: 143 - i, tipo: "Publicacion", id_usuario_reportado: null,
    id_publicacion_reportada: 42, categoria: "Otro", descripcion: `Reporte ficticio ${i}`, estado: "Pendiente", fecha: "2026-11-20T12:00:00Z" }));
  const upstream = createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    response.setHeader("Content-Type", "application/json");
    const reply = (code, data) => { response.statusCode = code; response.end(JSON.stringify(data)); };
    if (url.pathname === "/local/v1/perfil") return reply(200, { nombre: "Cuenta ficticia SCRUM-113" });
    if (url.pathname === "/api/arriendos/mio") return reply(200, { id_arriendo: 7, id_publicacion: 42, estado: "Activo", cupos_totales: 2, integrantes_activos: 2, cupos_disponibles: 0, id_responsable: 1 });
    if (url.pathname === "/api/arriendos/7/integrantes") return reply(200, { items: [{ id_usuario: 2, nombre: "Integrante ficticio", nota_interna: "PRIVATE_SENTINEL" }], siguiente_cursor: null });
    if (url.pathname === "/api/reportes/mios") {
      const cursor = url.searchParams.get("cursor");
      if (cursor && failPage) { failPage = false; return reply(503, {}); }
      const offset = cursor ? Number(cursor) : 0;
      const items = records.slice(offset, offset + 20).map(row => ({ ...row, nota_interna: "PRIVATE_SENTINEL" }));
      return reply(200, { items, siguiente_cursor: offset + 20 < records.length ? String(offset + 20) : null });
    }
    if (url.pathname === "/api/reportes" && request.method === "POST") {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks));
      const key = request.headers["idempotency-key"]; assert.ok(key); keys.push(key);
      if (!operations.has(key)) {
        created++;
        const row = { id_reporte: 200 + created, tipo: data.id_usuario_reportado ? "Usuario" : "Publicacion",
          id_usuario_reportado: null, id_publicacion_reportada: null, ...data, estado: "Pendiente", fecha: "2026-11-22T12:00:00Z" };
        operations.set(key, row); records.unshift(row);
      }
      if (loseResponse) { loseResponse = false; return reply(503, {}); }
      return reply(201, { ...operations.get(key), nota_interna: "PRIVATE_SENTINEL" });
    }
    reply(404, {});
  });
  await new Promise(done => upstream.listen(0, "127.0.0.1", done));
  const fixture = `http://127.0.0.1:${upstream.address().port}`;
  const probe = createServer(); await new Promise(done => probe.listen(0, "127.0.0.1", done));
  const port = probe.address().port; await new Promise(done => probe.close(done));
  const base = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await browser?.close();
    if (next?.pid && next.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(next.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      else next.kill("SIGTERM");
    }
    upstream.closeAllConnections(); await new Promise(done => upstream.close(done));
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-reportes-")) throw new Error("Unsafe cleanup path");
    if (linked) await unlink(join(isolated, "node_modules"));
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) await cp(join(project, name), join(isolated, name), { recursive: true });
  // El indicador de desarrollo cubre botones al fondo de la vista móvil.
  // Esta opción no oculta errores de compilación/runtime ni cambia el producto.
  const configFile = join(isolated, "next.config.ts");
  const configText = await readFile(configFile, "utf8");
  assert.ok(configText.includes("const nextConfig: NextConfig = {"));
  await writeFile(configFile, configText.replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n  devIndicators: false,"));
  await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir"); linked = true;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
  next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: isolated, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...env, NEXT_TELEMETRY_DISABLED: "1",
      WEB_AUTH_ENABLED: "true", WEB_REPORTES_ENABLED: "true", WEB_AUTH_ORIGIN: base, WEB_AUTH_FASTAPI_ORIGIN: fixture,
      WEB_AUTH_PROVIDER: "supabase", WEB_SUPABASE_ORIGIN: fixture, WEB_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key", ROOMIES_LOCAL_MODE: "1", FASTAPI_ORIGIN: fixture },
  });
  let output = ""; next.stdout.on("data", chunk => { output += chunk; }); next.stderr.on("data", chunk => { output += chunk; });
  for (let i = 0; ; i++) {
    if (next.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base)).ok) break; } catch {}
    if (i > 150) throw new Error("Next did not start: " + output);
    await new Promise(done => setTimeout(done, 300));
  }
  browser = await chromium.launch({ executablePath: process.env.REPORTS_BROWSER_PATH, headless: true,
    args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-proxy-server"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
  await context.addCookies([{ name: "roomies_sb_dev_access", value: token, url: base, httpOnly: true, sameSite: "Strict" }]);
  await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(12_000);
  await page.goto(base + "/mis-reportes?publicacion=42");
  await page.getByText("Reporte #143 · Otro", { exact: true }).waitFor();
  // El toast «Insight» de Next cubre el botón al hacer scroll en móvil.
  // Se cierra mediante su propio control; los errores runtime siguen comprobados.
  const insight = page.locator("nextjs-portal").locator("[data-issues-collapse]");
  if (await insight.isVisible()) await insight.click();
  if (process.env.REPORTS_QA_DIR) {
    await mkdir(process.env.REPORTS_QA_DIR, { recursive: true });
    await page.screenshot({ path: join(process.env.REPORTS_QA_DIR, "reportes-mobile.png"), fullPage: true });
  }
  await page.getByRole("button", { name: "Ver más", exact: true }).click();
  await page.getByRole("button", { name: "Reintentar carga", exact: true }).waitFor();
  assert.equal(await page.getByText("Reporte #143 · Otro", { exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "Reintentar carga", exact: true }).click();
  await page.getByText("Reporte #104 · Otro", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Ver más", exact: true }).click();
  await page.getByText("Llegaste al final de tus reportes.", { exact: true }).waitFor();
  assert.equal(await page.locator("strong").filter({ hasText: /^Reporte #/ }).count(), 43);
  await page.getByLabel("Categoría", { exact: true }).selectOption("Otro");
  await page.getByLabel("Descripción", { exact: true }).fill("Reporte de prueba recuperable");
  await page.getByLabel("Confirmo que quiero enviar este reporte.", { exact: true }).check();
  await page.getByRole("button", { name: "Enviar reporte", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByLabel("Descripción", { exact: true }).inputValue(), "Reporte de prueba recuperable");
  assert.equal(await page.getByText(/Recibimos el reporte/).count(), 0);
  await page.getByRole("button", { name: "Enviar reporte", exact: true }).click();
  await page.getByText("Recibimos el reporte #201. Estado: Pendiente.", { exact: true }).waitFor();
  assert.equal(keys[0], keys[1]); assert.equal(created, 1);
  assert.doesNotMatch(await page.locator("body").innerText(), /PRIVATE_SENTINEL/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.reload(); await page.getByText("Reporte #201 · Otro", { exact: true }).waitFor();
  await page.goto(base + "/mi-arriendo");
  await page.getByRole("button", { name: "Consultar integrantes", exact: true }).waitFor();
  if (await insight.isVisible()) await insight.click();
  await page.getByRole("button", { name: "Consultar integrantes", exact: true }).click();
  await page.getByRole("link", { name: "Reportar a Integrante ficticio", exact: true }).click();
  await page.getByText("Usuario #2", { exact: true }).waitFor();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(errors, []);
});
