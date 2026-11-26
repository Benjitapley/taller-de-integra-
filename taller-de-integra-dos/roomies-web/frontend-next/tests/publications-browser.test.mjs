/** S3R-E01: navegador real y HTTP simulado; no requiere PostgreSQL. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("S3R-E01: cursor, errores canónicos, fotos recuperables, edición y cierre en navegador", {
  timeout: 240_000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH || "playwright");
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-publications-"));
  let next, browser, linked = false;
  const requests = [], errors = [];
  const fixture = { id_publicacion: 42, titulo: "Aviso E01 con fotografías", descripcion: "Descripción que debe conservarse", precio: 999999999999,
    tipo: "Arrendador", tipo_vivienda: "Habitacion", mascota: "no", estado: "Disponible", cupos_totales: 3, cupos_disponibles: 2,
    id_arriendo: null, region: { id: 9, nombre: "La Araucanía" }, comuna: { id: 9101, nombre: "Temuco" },
    imagenes: [12, 15].map(id_imagen => ({ id_imagen, url: `https://images.example.test/${id_imagen}.png`, orden: id_imagen === 12 ? 0 : 1 })),
    autor: { id_usuario: 1, nombre: "Equipo E01", foto: null }, reglas_arrendador: ["Sin humo"], fecha_publicacion: "2026-11-26T12:00:00Z" };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN8AAAAASUVORK5CYII=", "base64");
  let startupLog = "";
  const upstream = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    const path = new URL(request.url, "http://fixture.local").pathname;
    const body = path === "/local/v1/perfil" ? { nombre: "Cuenta E01" } :
      path === "/api/regiones" ? [{ id_region: 9, nombre: "La Araucanía" }, { id_region: 8, nombre: "Biobío" }] :
      path === "/api/regiones/9/comunas" ? [{ id_comuna: 9101, nombre: "Temuco", id_region: 9 }] :
      path === "/api/publicaciones/42" ? fixture : [];
    response.end(JSON.stringify(body));
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
  const configFile = join(isolated, "next.config.ts");
  await writeFile(configFile, (await readFile(configFile, "utf8")).replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n  devIndicators: false,"));
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
  const row = (id, titulo, cupos) => ({ ...fixture, id_publicacion: id, titulo, precio: 100000, cupos_disponibles: cupos });
  let failNextPage = true;
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "images.example.test") return route.fulfill({ contentType: "image/png", body: png });
    if (url.origin !== base) return route.abort();
    if (url.pathname !== "/api/publicaciones") return route.continue();
    requests.push(url);
    const filtered = url.searchParams.has("cupos_disponibles");
    const more = url.searchParams.has("cursor");
    if (more && failNextPage) {
      failNextPage = false;
      return route.fulfill({ status: 503, json: { codigo: "dependencia_no_disponible", mensaje: "Página no disponible." } });
    }
    const last = url.searchParams.get("cursor") === "cursor_p3";
    return route.fulfill({ json: {
      items: [filtered ? row(3, "Nueva página uno filtrada", 2) : last ? row(4, "Publicación página tres", 2) : more ? row(2, "Publicación página dos", 3) : row(1, "Publicación página uno", 1)],
      siguiente_cursor: filtered || last ? null : more ? "cursor_p3" : "cursor_p2",
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
  await page.getByRole("alert").filter({ hasText: "No se pudo cargar la siguiente página" }).waitFor();
  assert.equal(await title("Publicación página uno").isVisible(), true);
  await page.getByRole("button", { name: "Cargar más", exact: true }).click();
  await title("Publicación página dos").waitFor();
  assert.equal(await title("Publicación página uno").isVisible(), true);
  await page.getByRole("button", { name: "Cargar más", exact: true }).click();
  await title("Publicación página tres").waitFor();
  await page.getByText("No hay más publicaciones.", { exact: true }).waitFor();
  const beforeFilter = requests.length;
  await page.getByRole("spinbutton", { name: "Cupos exactos", exact: true }).fill("2");
  const filteredRequest = page.waitForRequest(request => new URL(request.url()).pathname === "/api/publicaciones" && new URL(request.url()).searchParams.get("cupos_disponibles") === "2");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const filteredURL = new URL((await filteredRequest).url());
  assert.equal(filteredURL.searchParams.has("cursor"), false);
  await title("Nueva página uno filtrada").waitFor();
  assert.equal(await title("Publicación página uno").count(), 0);
  assert.equal(await title("Publicación página dos").count(), 0);
  assert.equal(await title("Publicación página tres").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Cargar más", exact: true }).count(), 0);
  assert.ok(requests.slice(beforeFilter).length > 0);
  assert.ok(requests.slice(beforeFilter).every(url => url.searchParams.get("cupos_disponibles") === "2" && !url.searchParams.has("cursor")));
  const screenshot = async name => {
    if (process.env.PUBLICATIONS_QA_DIR) {
      await mkdir(process.env.PUBLICATIONS_QA_DIR, { recursive: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(process.env.PUBLICATIONS_QA_DIR, name + ".png"), fullPage: true });
    }
  };
  await screenshot("catalogo");
  const mutations = [];
  let failure = 409;
  await context.route("**/web-api/publicaciones**", async route => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: fixture });
    const url = new URL(req.url());
    if (req.method() === "PATCH") {
      fixture.estado = "Cerrada";
      return route.fulfill({ json: fixture });
    }
    const data = await new Response(req.postDataBuffer(), { headers: { "Content-Type": req.headers()["content-type"] } }).formData();
    mutations.push({ method: req.method(), path: url.pathname, key: req.headers()["idempotency-key"], title: data.get("titulo"),
      price: data.get("precio"), retained: data.get("imagenes_conservar"), files: await Promise.all(data.getAll("imagenes").map(async file => ({ name: file.name, bytes: Buffer.from(await file.arrayBuffer()).toString("base64") }))) });
    if (failure === "network") return route.abort("failed");
    if (failure) return route.fulfill({ status: failure, json: { codigo: failure === 409 ? "configuracion_bloqueada" : failure === 422 ? "validacion" : "dependencia_no_disponible",
      mensaje: failure === 409 ? "Las reglas están bloqueadas." : failure === 422 ? "Comuna inválida." : "Storage temporalmente no disponible.",
      ...(failure === 422 ? { detalles: [{ campo: "id_comuna", mensaje: "La comuna no pertenece a la región." }] } : {}) } });
    fixture.imagenes = [{ id_imagen: 12, url: "https://images.example.test/12.png", orden: 0 }, { id_imagen: 16, url: "https://images.example.test/16.png", orden: 1 }];
    return route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: fixture });
  });
  await page.goto(base + "/publicar");
  await page.getByRole("button", { name: "Continuar →", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Título conservado ante fallos");
  await page.getByLabel("Tipo de vivienda").selectOption("Habitacion");
  await page.getByLabel("Comuna de La Araucanía").selectOption("9101");
  await page.getByLabel("Precio del arriendo (CLP)", { exact: true }).fill("999999999999");
  await page.getByLabel("Capacidad total", { exact: true }).fill("3");
  await page.getByLabel("Descripción", { exact: true }).fill("Descripción que debe conservarse");
  await page.getByLabel("Regla 1", { exact: true }).fill("Sin humo");
  await page.locator('input[type="file"]').setInputFiles({ name: "equipo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Las reglas están bloqueadas." }).waitFor();
  assert.equal(await page.getByLabel("Título", { exact: true }).inputValue(), "Título conservado ante fallos");
  assert.equal(await page.locator('input[type="file"]').evaluate(input => input.files[0].name), "equipo.png");
  assert.equal(await page.getByRole("img", { name: "Portada de la vista previa", exact: true }).isVisible(), true);
  failure = 503;
  await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Storage temporalmente no disponible." }).waitFor();
  failure = "network";
  await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Conservamos tus datos" }).waitFor();
  assert.deepEqual(mutations[0], mutations[1]);
  assert.deepEqual(mutations[1], mutations[2]);
  assert.equal(mutations[0].files[0].bytes, png.toString("base64"));
  assert.equal(mutations[0].price, "999999999999");
  await screenshot("crear-error-recuperable");
  failure = 422;
  await page.getByRole("button", { name: "Publicar ahora", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Comuna: La comuna no pertenece a la región." }).waitFor();
  await page.goto(base + "/editar-publicacion?id=42");
  await page.getByLabel("Título", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Precio del arriendo (CLP)", { exact: true }).inputValue(), "999999999999");
  await page.getByRole("checkbox", { name: "Conservar imagen", exact: true }).nth(1).uncheck();
  await page.locator('input[type="file"]').setInputFiles({ name: "nueva.png", mimeType: "image/png", buffer: png });
  failure = 503;
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Storage temporalmente no disponible." }).waitFor();
  const failedEdit = mutations.at(-1);
  assert.equal(failedEdit.retained, "[12]");
  assert.equal(failedEdit.files[0].name, "nueva.png");
  assert.equal(await page.getByRole("checkbox", { name: "Conservar imagen", exact: true }).nth(0).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "Conservar imagen", exact: true }).nth(1).isChecked(), false);
  failure = 409;
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Las reglas están bloqueadas." }).waitFor();
  assert.deepEqual(mutations.at(-1), failedEdit);
  failure = 0;
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await page.waitForURL("**/mis-publicaciones");
  assert.deepEqual(mutations.at(-1), failedEdit);
  await page.goto(base + "/publicaciones/42");
  await page.getByRole("heading", { name: fixture.titulo, exact: true }).waitFor();
  await screenshot("detalle");
  let confirmations = 0;
  page.on("dialog", async dialog => { confirmations++; if (confirmations === 1) await dialog.dismiss(); else await dialog.accept(); });
  await page.getByRole("button", { name: "Cerrar aviso", exact: true }).click();
  assert.equal(confirmations, 1);
  assert.equal(fixture.estado, "Disponible");
  await page.getByRole("button", { name: "Cerrar aviso", exact: true }).click();
  await page.getByText("Este aviso está cerrado y no recibe postulaciones.", { exact: true }).waitFor();
  assert.equal(confirmations, 2);
  assert.equal(await page.getByRole("img", { name: "Fotografía de la publicación", exact: true }).count(), 2);
  await page.reload();
  assert.equal(await page.getByText("Este aviso está cerrado y no recibe postulaciones.", { exact: true }).isVisible(), true);
  assert.equal(await page.getByRole("img", { name: "Fotografía de la publicación", exact: true }).count(), 2);
  assert.deepEqual(errors, []);
  t.diagnostic("409/422/503 y red: datos, archivos, IDs y clave preservados; editar y cerrar reflejan DTO sintético. No acredita Storage/Gateway reales.");
  for (const url of requests) t.diagnostic(`GET ${url.pathname}${url.search}`);
});
