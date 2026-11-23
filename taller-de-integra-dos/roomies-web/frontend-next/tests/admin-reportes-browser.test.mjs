/** Next/BFF/React reales; transporte HTTP ficticio explícito y sin datos compartidos. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("SCRUM-114 navegador: permisos, páginas, borrador, conflicto y respuesta perdida", {
  skip: !process.env.REPORTS_PLAYWRIGHT_PATH || !process.env.REPORTS_BROWSER_PATH, timeout: 180_000,
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH);
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-admin-reportes-"));
  const note = "NOTA_PRIVADA_114";
  let next, browser, linked = false, failPage = true, conflict = true, loseReply = true, allowed = true, expired = false;
  let mutations = 0;
  const pageErrors = [], records = Array.from({ length: 43 }, (_, i) => ({
    id_reporte: 143 - i, id_denunciante: 20, tipo: "Publicacion", id_publicacion_reportada: 42, id_usuario_reportado: null,
    categoria: "Otro", descripcion: `Contenido reportado ${i}`, estado: "Pendiente", fecha: "2026-11-23T12:00:00Z", historial: [],
  }));
  const upstream = createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    response.setHeader("Content-Type", "application/json");
    const reply = (status, value) => { response.statusCode = status; response.end(JSON.stringify(value)); };
    const isAdmin = request.headers.authorization?.startsWith("Bearer admin.");
    if (url.pathname === "/local/v1/perfil") return reply(200, { nombre: isAdmin ? "Admin ficticio" : "Reportante ficticio" });
    if (url.pathname === "/api/reportes/mios") return reply(200, { items: records.slice(0, 20).map(row => ({ ...row, nota_interna: note })), siguiente_cursor: null });
    if (url.pathname.startsWith("/api/admin/reportes")) {
      if (expired) return reply(401, {});
      if (!isAdmin || !allowed) return reply(403, { nota_interna: note });
      if (url.pathname === "/api/admin/reportes") {
        const cursor = url.searchParams.get("cursor");
        if (cursor && failPage) { failPage = false; return reply(503, {}); }
        let rows = records.filter(row => (!url.searchParams.has("estado") || row.estado === url.searchParams.get("estado")) && (!url.searchParams.has("tipo") || row.tipo === url.searchParams.get("tipo")));
        const offset = Number(cursor ?? 0);
        return reply(200, { items: rows.slice(offset, offset + 20), siguiente_cursor: offset + 20 < rows.length ? String(offset + 20) : null });
      }
      const row = records.find(item => item.id_reporte === Number(url.pathname.split("/").at(-1)));
      if (!row) return reply(404, {});
      if (request.method === "PATCH") {
        mutations++;
        const chunks = []; for await (const chunk of request) chunks.push(chunk);
        const input = JSON.parse(Buffer.concat(chunks));
        const before = row.estado;
        if (conflict) {
          conflict = false; row.estado = "En_Revision";
          row.historial.push({ id_actuacion: 1, id_administrador: 88, estado_anterior: before, estado_nuevo: row.estado, nota_interna: "Decisión concurrente", fecha: row.fecha });
          return reply(409, {});
        }
        row.estado = input.estado;
        row.historial.push({ id_actuacion: 2, id_administrador: 7, estado_anterior: before, estado_nuevo: row.estado, nota_interna: input.nota_interna, fecha: row.fecha });
        if (loseReply) { loseReply = false; return reply(503, {}); }
      }
      return reply(200, row);
    }
    reply(404, {});
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
    async function session(who) {
      const ctx = await browser.newContext({ viewport: { width: 1360, height: 980 }, serviceWorkers: "block" });
      const token = `${who}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signed`;
      await ctx.addCookies([{ name: "roomies_sb_dev_access", value: token, url: base, httpOnly: true, sameSite: "Strict" }]);
      await ctx.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      const page = await ctx.newPage(); page.on("pageerror", error => pageErrors.push(error.message));
      return { ctx, page };
    }
    const admin = await session("admin"), user = await session("user");
    const page = admin.page;
    await page.goto(base + "/admin/reportes");
    await page.getByRole("link", { name: "#143", exact: true }).waitFor();
    await page.getByRole("button", { name: "Siguiente página", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Se conserva la página anterior" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "#143", exact: true }).isVisible(), true);
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByText("Página 2", { exact: true }).waitFor();
    assert.equal(await page.getByRole("row").count(), 21);
    await page.getByRole("button", { name: "Siguiente página", exact: true }).click();
    await page.getByText("Página 3", { exact: true }).waitFor();
    assert.equal(await page.getByRole("row").count(), 4);
    await page.getByRole("combobox", { name: /^Tipo/ }).selectOption("Usuario");
    await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
    await page.getByText("No hay reportes para estos filtros.", { exact: true }).waitFor();
    await page.goto(base + "/admin/reportes/143");
    await page.getByLabel("Nota interna (opcional)").fill(note);
    await page.getByRole("combobox", { name: /^Nuevo estado/ }).selectOption("En_Revision");
    await page.getByRole("button", { name: "Guardar cambio", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "transición" }).waitFor();
    assert.equal(await page.getByLabel("Nota interna (opcional)").inputValue(), note);
    assert.equal(await page.getByRole("button", { name: "Guardar cambio", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Actualizar reporte", exact: true }).click();
    await page.getByText("Decisión concurrente", { exact: true }).waitFor();
    await page.getByRole("combobox", { name: /^Nuevo estado/ }).selectOption("Resuelto");
    await page.getByRole("button", { name: "Guardar cambio", exact: true }).click({ clickCount: 2 });
    await page.getByRole("alert").filter({ hasText: "No se pudo confirmar" }).waitFor();
    assert.equal(mutations, 2);
    assert.equal(await page.getByLabel("Nota interna (opcional)").inputValue(), note);
    await page.getByRole("button", { name: "Actualizar reporte", exact: true }).click();
    await page.getByText("Este reporte está cerrado y no admite más transiciones.", { exact: true }).waitFor();
    assert.equal(await page.getByText("Se guardó el cambio y quedó registrado en la bitácora.", { exact: true }).count(), 0);
    assert.equal(await page.getByLabel("Nota que estabas editando").inputValue(), note);
    await user.page.goto(base + "/admin/reportes/143");
    await user.page.getByRole("heading", { name: "Acceso administrativo requerido", exact: true }).waitFor();
    assert.doesNotMatch(await user.page.content(), new RegExp(note));
    const publicResponse = await user.ctx.request.get(base + "/web-api/reportes");
    const publicData = await publicResponse.json();
    assert.equal(publicData.items[0].estado, "Resuelto");
    assert.doesNotMatch(JSON.stringify(publicData), /NOTA_PRIVADA|historial|id_denunciante/);
    allowed = false;
    await page.getByRole("button", { name: "Consultar estado actualizado", exact: true }).click();
    await page.getByRole("heading", { name: "Acceso administrativo requerido", exact: true }).waitFor();
    assert.doesNotMatch(await page.locator("body").innerText(), new RegExp(note));
    allowed = true; expired = true;
    const denied = await admin.ctx.request.get(base + "/web-api/admin/reportes");
    assert.equal(denied.status(), 401);
    assert.equal((await admin.ctx.cookies()).some(cookie => cookie.name === "roomies_sb_dev_access"), false);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser?.close();
    if (next?.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      else next.kill();
      await new Promise(resolve => next.once("exit", resolve));
    }
    upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-admin-reportes-")) throw new Error("Ruta de limpieza inesperada");
    if (linked) { if (process.platform === "win32") await rmdir(join(isolated, "node_modules")); else await unlink(join(isolated, "node_modules")); }
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
