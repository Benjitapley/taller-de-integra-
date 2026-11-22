import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = fileURLToPath(new URL("../", import.meta.url));
const credentials = { correo: "demo@haycupo.test", contrasena: "DemoLocal123!" };
const systemEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function launch(t, environment) {
  const child = spawn(process.execPath, [join(project, "scripts/demo.mjs")], {
    cwd: project,
    env: { ...systemEnvironment, NEXT_TELEMETRY_DISABLED: "1", ...environment },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let spawnError;
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  child.on("error", (error) => { spawnError = error; });
  const running = () => child.exitCode === null && child.signalCode === null;
  t.after(async () => {
    if (!running() || !Number.isSafeInteger(child.pid)) return;
    const exited = once(child, "exit");
    if (process.platform === "win32") {
      // Solo el árbol del CLI creado por esta prueba; nunca buscar por nombre o puerto.
      const stopped = spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true, encoding: "utf8", timeout: 10_000,
      });
      if (stopped.status !== 0 && running()) throw new Error(`No se pudo cerrar el demo PID ${child.pid}: ${stopped.stderr || stopped.error || stopped.stdout}`);
    } else child.kill("SIGTERM");
    await Promise.race([exited, delay(10_000, undefined, { ref: false }).then(() => { throw new Error(`El demo PID ${child.pid} no terminó`); })]);
  });
  return { child, running, output: () => output, error: () => spawnError };
}

test("el demo local rechaza producción antes de iniciar servidores", { timeout: 15_000 }, async (t) => {
  const demo = launch(t, { NODE_ENV: "production", PORT: String(await freePort()) });
  for (let attempt = 0; attempt < 40 && demo.running() && !demo.error(); attempt++) await delay(100);
  assert.ifError(demo.error());
  assert.ok(!demo.running(), `El CLI no rechazó producción:\n${demo.output()}`);
  assert.notEqual(demo.child.exitCode, 0);
  assert.match(demo.output(), /production|producci[oó]n|desarrollo local/i);
});

test("demo local completo: sesión, pantallas y cambios efímeros sin backend real", { timeout: 120_000 }, async (t) => {
  const base = `http://127.0.0.1:${await freePort()}`;
  const demo = launch(t, {
    NODE_ENV: "development", PORT: new URL(base).port,
    FASTAPI_ORIGIN: "http://192.0.2.1:1", WEB_AUTH_FASTAPI_ORIGIN: "http://192.0.2.1:1",
    WEB_AUTH_PROVIDER: "supabase", WEB_AUTH_ENABLED: "false", ROOMIES_RUNTIME_MODE: "supabase",
  });
  const request = (path, options = {}) => fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(15_000), ...options });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.ifError(demo.error());
    assert.ok(demo.running(), `El demo terminó al iniciar:\n${demo.output()}`);
    try {
      const response = await request("/", { signal: AbortSignal.timeout(500) });
      await response.arrayBuffer();
      if (response.status === 200) { ready = true; break; }
    } catch { /* Solo se consulta el puerto loopback reservado para esta prueba. */ }
    await delay(250);
  }
  assert.ok(ready, `El demo no estuvo disponible:\n${demo.output()}`);
  assert.ok(demo.output().includes(base), "El CLI debe mostrar la URL local");
  assert.ok(demo.output().includes(credentials.correo), "El CLI debe mostrar la cuenta de prueba");
  const accessHtml = await (await request("/")).text();
  assert.match(accessHtml, /Modo demo local/);
  assert.match(accessHtml, /<input\b(?=[^>]*name="correo")(?=[^>]*value="demo@haycupo\.test")[^>]*>/);
  assert.match(accessHtml, /<input\b(?=[^>]*name="contrasena")(?=[^>]*value="DemoLocal123!")[^>]*>/);

  const csrf = { Origin: base, "X-Haycupo-CSRF": "1" };
  const login = (contrasena = credentials.contrasena, headers = csrf) => request("/web-api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ ...credentials, contrasena }),
  });
  assert.equal((await request("/inicio")).status, 307);
  const rejectedCsrf = await login(credentials.contrasena, { ...csrf, Origin: "https://foreign.example.test" });
  assert.equal(rejectedCsrf.status, 403);
  assert.equal(rejectedCsrf.headers.getSetCookie().length, 0);
  const rejectedPassword = await login("Incorrecta123!");
  assert.equal(rejectedPassword.status, 401);
  assert.ok(!rejectedPassword.headers.getSetCookie().some((cookie) => /haycupo_dev_session=[^;]/.test(cookie)));

  const authenticated = await login();
  assert.equal(authenticated.status, 200);
  assert.deepEqual(await authenticated.json(), { success: true });
  const sessionHeader = authenticated.headers.getSetCookie().find((cookie) => cookie.startsWith("haycupo_dev_session="));
  assert.ok(sessionHeader, "El login debe entregar la cookie local");
  assert.match(sessionHeader, /; HttpOnly/i);
  assert.match(sessionHeader, /; SameSite=Strict/i);
  const cookie = sessionHeader.split(";")[0];
  const privateRequest = (path, options = {}) => request(path, { ...options, headers: { cookie, ...options.headers } });
  const session = await privateRequest("/web-api/auth/sesion");
  assert.equal(session.status, 200);
  assert.equal((await session.json()).authenticated, true);

  for (const path of ["/inicio", "/perfil", "/mis-publicaciones", "/publicar", "/mis-conexiones", "/mis-postulaciones"]) {
    const page = await privateRequest(path);
    assert.equal(page.status, 200, path);
    const html = await page.text();
    assert.match(html, /aria-label="Navegación principal"/, path);
    assert.match(html, /Modo demo local/, path);
    assert.doesNotMatch(html, /Sesión no disponible/, path);
  }
  const profileResponse = await privateRequest("/web-api/perfil");
  assert.equal(profileResponse.status, 200);
  const profile = await profileResponse.json();
  assert.equal(typeof profile.nombre, "string");
  assert.ok(profile.nombre.length > 0);
  const publicationsResponse = await privateRequest("/web-api/mis-publicaciones");
  assert.equal(publicationsResponse.status, 200);
  const publications = await publicationsResponse.json();
  assert.ok(publications.items.length > 0, "La cuenta debe tener publicaciones sintéticas");
  for (const path of ["/web-api/conexiones?vista=recibidas", "/web-api/postulaciones"]) {
    const response = await privateRequest(path);
    assert.equal(response.status, 200, path);
    assert.ok(Array.isArray(await response.json()), path);
  }

  const profileForm = new FormData();
  for (const [key, value] of Object.entries({ edad: "25", ocupacion: "Estudiante", ciudad: "Ciudad de prueba local", breve_descripcion: "Perfil sintético", sobre_mi: "Prueba local sin base de datos" })) profileForm.set(key, value);
  const updated = await privateRequest("/web-api/perfil", { method: "PUT", headers: csrf, body: profileForm });
  assert.equal(updated.status, 200);
  assert.equal((await (await privateRequest("/web-api/perfil")).json()).ciudad, "Ciudad de prueba local");

  const publicationForm = new FormData();
  for (const [key, value] of Object.entries({ titulo: "Habitación sintética de integración", categoria: "ofrezco", ubicacion: "Centro", precio: "150000", tipo: "Arrendador", cupos_totales: "2", tipo_vivienda: "habitacion", descripcion: "Aviso creado exclusivamente dentro del demo local", mascota: "no", permitir_comentarios: "false", id_region: "9", id_comuna: "91" })) publicationForm.set(key, value);
  const created = await privateRequest("/web-api/publicaciones", { method: "POST", headers: csrf, body: publicationForm });
  assert.equal(created.status, 201);
  const { id_publicacion } = await created.json();
  assert.ok(Number.isSafeInteger(id_publicacion) && id_publicacion > 0);
  const afterCreate = await (await privateRequest("/web-api/mis-publicaciones")).json();
  assert.equal(afterCreate.items.length, publications.items.length + 1);
  assert.ok(afterCreate.items.some((item) => item.id_publicacion === id_publicacion && item.titulo === publicationForm.get("titulo")));

  const logout = await privateRequest("/web-api/auth/logout", { method: "POST", headers: { ...csrf, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.getSetCookie().join(";"), /Max-Age=0/i);
  assert.equal((await privateRequest("/web-api/auth/sesion")).status, 401, "La cookie anterior debe quedar revocada");
  assert.equal((await privateRequest("/perfil")).status, 307);
});
