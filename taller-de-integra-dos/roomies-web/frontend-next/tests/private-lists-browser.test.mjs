/** SCRUM-115: real Next/BFF/React/browser; HTTP fixtures on loopback, no shared data. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("SCRUM-115: cinco listas de 43 elementos, reintentos, filtros, fin vacío y cambio de cuenta", {
  skip: !process.env.REPORTS_PLAYWRIGHT_PATH || !process.env.REPORTS_BROWSER_PATH, timeout: 240_000,
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH);
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-lists-"));
  const requests = [], pageErrors = [], failed = new Set();
  let next, browser, linked = false;
  const rows = Array.from({ length: 43 }, (_, index) => ({
    id_publicacion: 100 + index, titulo: `Aviso privado A ${index}`, precio: 100000, ubicacion: "Temuco", tipo: "Arrendador", estado: "Disponible", cupos_totales: 2, cupos_disponibles: 2,
  }));
  const applications = rows.map((row, index) => ({ id_postulacion: row.id_publicacion, id_publicacion: 42, id_usuario: 7, titulo: `Postulacion A ${index}`, estado: "Pendiente", fecha_postulacion: "2026-11-23T12:00:00Z" }));
  const reports = rows.map((row, index) => ({ id_reporte: row.id_publicacion, id_denunciante: 7, tipo: "Publicacion", id_publicacion_reportada: 42, id_usuario_reportado: null, categoria: "Otro", descripcion: `Reporte privado A ${index}`, estado: "Pendiente", fecha: "2026-11-23T12:00:00Z", historial: [] }));
  const upstream = createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    const other = request.headers.authorization?.startsWith("Bearer other.");
    response.setHeader("Content-Type", "application/json");
    const reply = (status, data) => { response.statusCode = status; response.end(JSON.stringify(data)); };
    if (url.pathname === "/local/v1/perfil") return reply(200, { nombre: other ? "Otra cuenta" : "Cuenta A" });
    let data, kind;
    if (url.pathname === "/api/publicaciones/mias") { data = rows; kind = "publications"; }
    if (url.pathname === "/api/postulaciones/mias") { data = applications; kind = "mine"; }
    if (url.pathname === "/api/publicaciones/42/postulantes") { data = applications; kind = "applicants"; }
    if (url.pathname === "/api/reportes/mios") { data = reports; kind = "reports"; }
    if (url.pathname === "/api/admin/reportes") { data = reports; kind = "admin"; }
    if (!data) return reply(404, {});
    const offset = Number(url.searchParams.get("cursor") ?? 0);
    requests.push({ kind, offset, filter: url.searchParams.get("estado"), other });
    if (other) return reply(200, { items: [], siguiente_cursor: null });
    if (url.searchParams.get("estado") === "Pendiente") await new Promise(resolve => setTimeout(resolve, 350));
    if (url.searchParams.get("estado") === "Rechazada") return reply(200, { items: [], siguiente_cursor: null });
    if (offset === 20 && !failed.has(kind)) { failed.add(kind); return reply(503, {}); }
    return reply(200, { items: data.slice(offset, offset + 20), siguiente_cursor: offset < 40 ? String(offset + 20) : offset === 40 ? "43" : null });
  });
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const listen = createServer(); await new Promise(resolve => listen.listen(0, "127.0.0.1", resolve));
  const port = listen.address().port; await new Promise(resolve => listen.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  try {
    for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) await cp(join(project, name), join(isolated, name), { recursive: true });
    await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir"); linked = true;
    const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
    next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: isolated, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...clean, NEXT_TELEMETRY_DISABLED: "1", ROOMIES_LOCAL_MODE: "1", ROOMIES_RUNTIME_MODE: "disposable", WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "supabase", WEB_PROFILE_CONTRACT: "local-v1", WEB_REPORTES_ENABLED: "true", WEB_AUTH_ORIGIN: base, WEB_AUTH_FASTAPI_ORIGIN: origin, FASTAPI_ORIGIN: origin, WEB_SUPABASE_ORIGIN: origin, WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" },
    });
    next.stdout.on("data", () => {}); next.stderr.on("data", () => {});
    for (let i = 0; i < 100; i++) {
      if (next.exitCode !== null) throw new Error("Next aislado terminó antes de estar listo");
      try { if ((await fetch(base)).ok) break; } catch { /* Startup only. */ }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    browser = await chromium.launch({ executablePath: process.env.REPORTS_BROWSER_PATH, headless: true });
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1360, height: 980 } });
    const token = who => `${who}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signed`;
    await ctx.addCookies([{ name: "roomies_sb_dev_access", value: token("account"), url: base, httpOnly: true, sameSite: "Strict" }]);
    await ctx.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await ctx.newPage(); page.on("pageerror", error => pageErrors.push(error.message));
    for (const [path, kind, first, last] of [
      ["/mis-publicaciones", "publications", "Aviso privado A 0", "Aviso privado A 42"],
      ["/mis-postulaciones", "mine", "Postulacion A 0", "Postulacion A 42"],
      ["/postulantes/42", "applicants", "Postulación 100", "Postulación 142"],
      ["/mis-reportes", "reports", "Reporte #100 · Otro", "Reporte #142 · Otro"],
    ]) {
      await page.goto(base + path);
      await page.getByText(first, { exact: true }).waitFor();
      const more = page.getByRole("button", { name: "Cargar más", exact: true });
      await more.click({ clickCount: 2 });
      await page.getByRole("alert").filter({ hasText: "Se conservan los elementos" }).waitFor();
      assert.equal(await page.getByText(first, { exact: true }).isVisible(), true);
      await page.getByRole("button", { name: "Reintentar carga", exact: true }).click();
      await more.waitFor({ state: "visible" });
      await page.waitForFunction(() => !Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Cargar más")?.disabled);
      await more.click();
      await page.getByText(last, { exact: true }).waitFor();
      await more.click();
      await page.getByText("Llegaste al final de la lista.", { exact: true }).waitFor();
      assert.equal(await page.getByText(first, { exact: true }).isVisible(), true);
      assert.equal(await page.getByText(last, { exact: true }).count(), 1);
      assert.equal(requests.filter(row => row.kind === kind && row.offset === 20).length, 2);
      assert.equal(requests.filter(row => row.kind === kind && row.offset === 40).length, 1);
      assert.equal(requests.filter(row => row.kind === kind && row.offset === 43).length, 1);
    }
    await page.goto(base + "/mis-postulaciones");
    const filter = page.getByRole("combobox", { name: "Filtrar por estado", exact: true });
    await filter.selectOption("Pendiente");
    await page.waitForResponse(response => response.url().includes("estado=Pendiente"));
    // Start a delayed query again and replace it before it finishes.
    await filter.selectOption("Aceptada");
    const delayed = page.waitForRequest(request => request.url().includes("estado=Pendiente"));
    await filter.selectOption("Pendiente");
    await delayed;
    await filter.selectOption("Rechazada");
    await page.getByText("No hay postulaciones para estos filtros.", { exact: true }).waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.getByText("Postulacion A 0", { exact: true }).count(), 0);
    await page.goto(base + "/admin/reportes");
    const moreAdmin = page.getByRole("button", { name: "Siguiente página", exact: true });
    await moreAdmin.click();
    await page.getByRole("alert").filter({ hasText: "Se conserva la página anterior" }).waitFor();
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByText("Página 2", { exact: true }).waitFor();
    await moreAdmin.click(); await page.getByText("Página 3", { exact: true }).waitFor();
    assert.equal(await page.getByRole("row").count(), 4);
    await moreAdmin.click(); await page.getByText("Llegaste al final de la lista.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Anterior", exact: true }).click();
    await page.getByRole("link", { name: "#142", exact: true }).waitFor();
    const nav = page.getByRole("navigation", { name: "Navegación principal" }).first();
    assert.equal(await nav.getByRole("link", { name: "Mis reportes", exact: true }).count(), 1);
    assert.doesNotMatch(await nav.innerText(), /Mis conexiones|Favoritos|Ajustes/);
    await ctx.clearCookies();
    await page.goto(base + "/mis-postulaciones");
    await page.waitForURL(base + "/");
    assert.doesNotMatch(await page.locator("body").innerText(), /privado A|Postulacion A|Reporte #1|Postulación 1/);
    await ctx.addCookies([{ name: "roomies_sb_dev_access", value: token("other"), url: base, httpOnly: true, sameSite: "Strict" }]);
    for (const [path, empty] of [["/mis-publicaciones", "Aún no tienes publicaciones creadas."], ["/mis-postulaciones", "No hay postulaciones para estos filtros."], ["/postulantes/42", "No hay postulaciones para estos filtros."], ["/mis-reportes", "Aún no tienes reportes."], ["/admin/reportes", "No hay reportes para estos filtros."]]) {
      await page.goto(base + path);
      await page.getByText(empty, { exact: path !== "/mis-reportes" }).waitFor();
      assert.doesNotMatch(await page.locator("#contenido").innerText(), /privado A|Postulacion A|Reporte #1|Postulación 1/);
    }
    assert.ok(requests.filter(row => row.other).every(row => row.offset === 0));
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    if (next?.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); else next.kill();
      await new Promise(resolve => next.once("exit", resolve));
    }
    upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-lists-")) throw new Error("Ruta de limpieza inesperada");
    if (linked) { if (process.platform === "win32") await rmdir(join(isolated, "node_modules")); else await unlink(join(isolated, "node_modules")); }
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
