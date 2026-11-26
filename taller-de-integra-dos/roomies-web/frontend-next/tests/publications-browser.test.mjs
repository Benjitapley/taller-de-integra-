/** S3R-E01: navegador real y HTTP simulado; no requiere PostgreSQL. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("S3R-E01: Cargar más envía cursor_p2 y aplicar cupos exactos reinicia y reemplaza el catálogo", {
  timeout: 240_000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH || "playwright");
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-publications-"));
  let next, browser, linked = false;
  const requests = [], errors = [];
  let startupLog = "";
  const upstream = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url === "/local/v1/perfil" ? { nombre: "Cuenta E01" } : []));
  });
  t.after(async () => {
    await browser?.close();
    if (next?.pid && next.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      else next.kill();
      if (next.exitCode === null) await new Promise(done => next.once("exit", done));
    }
    upstream.closeAllConnections();
    if (upstream.listening) await new Promise(done => upstream.close(done));
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-publications-")) throw new Error("Ruta de limpieza inesperada");
    if (linked) {
      if (process.platform === "win32") await rmdir(join(isolated, "node_modules"));
      else await unlink(join(isolated, "node_modules"));
    }
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  await new Promise(done => upstream.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const probe = createServer();
  await new Promise(done => probe.listen(0, "127.0.0.1", done));
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  const base = `http://127.0.0.1:${port}`;
  for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) {
    await cp(join(project, name), join(isolated, name), { recursive: true });
  }
  await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  linked = true;
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
  next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: isolated, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...clean, NEXT_TELEMETRY_DISABLED: "1", ROOMIES_LOCAL_MODE: "1", ROOMIES_RUNTIME_MODE: "disposable", WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "supabase", WEB_PROFILE_CONTRACT: "local-v1", WEB_AUTH_ORIGIN: base, WEB_AUTH_FASTAPI_ORIGIN: origin, FASTAPI_ORIGIN: origin, WEB_SUPABASE_ORIGIN: origin, WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" },
  });
  const log = chunk => { startupLog = (startupLog + chunk).slice(-6000); };
  next.stdout.on("data", log); next.stderr.on("data", log);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (next.exitCode !== null) throw new Error(`Next terminó antes de estar listo: ${startupLog}`);
    try { if ((await fetch(base, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* Startup only. */ }
    await new Promise(done => setTimeout(done, 300));
  }
  assert.ok(ready, `Next no inició: ${startupLog}`);
  browser = await chromium.launch({ headless: true, ...(process.env.REPORTS_BROWSER_PATH ? { executablePath: process.env.REPORTS_BROWSER_PATH } : {}) });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signed`;
  await context.addCookies([{ name: "roomies_sb_dev_access", value: token, url: base, httpOnly: true, sameSite: "Strict" }]);
  const row = (id, titulo, cupos) => ({ id_publicacion: id, titulo, precio: 100000, ubicacion: "Temuco", cupos_disponibles: cupos, imagenes: [] });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname !== "/api/publicaciones") return route.continue();
    requests.push(url);
    const filtered = url.searchParams.has("cupos_disponibles");
    const more = url.searchParams.has("cursor");
    return route.fulfill({ json: {
      items: [filtered ? row(3, "Nueva página uno filtrada", 2) : more ? row(2, "Publicación página dos", 3) : row(1, "Publicación página uno", 1)],
      siguiente_cursor: filtered || more ? null : "cursor_p2",
    } });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/inicio");
  const title = name => page.getByRole("link", { name, exact: true });
  await title("Publicación página uno").waitFor();
  assert.equal(requests[0].searchParams.has("cursor"), false);
  const moreRequest = page.waitForRequest(request => new URL(request.url()).pathname === "/api/publicaciones" && new URL(request.url()).searchParams.has("cursor"));
  await page.getByRole("button", { name: "Cargar más", exact: true }).click();
  assert.equal(new URL((await moreRequest).url()).searchParams.get("cursor"), "cursor_p2");
  await title("Publicación página dos").waitFor();
  assert.equal(await title("Publicación página uno").isVisible(), true);
  const beforeFilter = requests.length;
  await page.getByRole("spinbutton", { name: "Cupos exactos", exact: true }).fill("2");
  const filteredRequest = page.waitForRequest(request => new URL(request.url()).pathname === "/api/publicaciones" && new URL(request.url()).searchParams.get("cupos_disponibles") === "2");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const filteredURL = new URL((await filteredRequest).url());
  assert.equal(filteredURL.searchParams.has("cursor"), false);
  await title("Nueva página uno filtrada").waitFor();
  assert.equal(await title("Publicación página uno").count(), 0);
  assert.equal(await title("Publicación página dos").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Cargar más", exact: true }).count(), 0);
  assert.ok(requests.slice(beforeFilter).length > 0);
  assert.ok(requests.slice(beforeFilter).every(url => url.searchParams.get("cupos_disponibles") === "2" && !url.searchParams.has("cursor")));
  assert.deepEqual(errors, []);
  for (const url of requests) t.diagnostic(`GET ${url.pathname}${url.search}`);
});
