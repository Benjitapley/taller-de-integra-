import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, readFile, rm, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = fileURLToPath(new URL("../", import.meta.url));
const legacyRoot = new URL("../../frontend/", import.meta.url);
const html = new Map([
  ["/", "PaginaPrincipal/Auth_app(login)/auth_app.html"],
  ["/inicio", "PaginaPrincipal/hayCupo.html"],
  ["/crear", "Creacion_De_publicacion/publicacion.html"],
  ["/editar-publicacion", "Creacion_De_publicacion/publicacion.html"],
  ["/perfil", "PerfilU/perfil.html"],
  ["/mis-publicaciones", "PaginaPrincipal/PublicacionesU/mis_publicaciones.html"],
]);
const assets = new Map([
  ["/static_principal/HayCupo.js", "PaginaPrincipal/HayCupo.js"],
  ["/static_principal/estilo_HayCupo.css", "PaginaPrincipal/estilo_HayCupo.css"],
  ["/static_principal/Auth_app(login)/auth_app.css", "PaginaPrincipal/Auth_app(login)/auth_app.css"],
  ["/static_principal/Auth_app(login)/auth_app.js", "PaginaPrincipal/Auth_app(login)/auth_app.js"],
  ["/static_principal/PublicacionesU/MisPublicaciones.js", "PaginaPrincipal/PublicacionesU/MisPublicaciones.js"],
  ["/static_creacion/publicacion.js", "Creacion_De_publicacion/publicacion.js"],
  ["/static_creacion/estilo_de_publicacion.css", "Creacion_De_publicacion/estilo_de_publicacion.css"],
  ["/PerfilU/perfil.js", "PerfilU/perfil.js"],
  ["/Iconos/sidebar.css", "Iconos/sidebar.css"],
]);

test("rewrites HTTP con servidor aislado: sin FastAPI, usuarios ni base de datos", { timeout: 120_000 }, async (t) => {
  // No ocupar el puerto de un servidor existente ni detener procesos ajenos.
  const portCheck = createServer();
  portCheck.listen(3000, "127.0.0.1");
  await once(portCheck, "listening");
  await new Promise((resolve) => portCheck.close(resolve));

  // Aplicación temporal: no comparte el lock de next dev ni copia archivos .env.
  const isolated = await mkdtemp(join(project, ".proxy-test-"));
  for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) {
    await cp(join(project, name), join(isolated, name), { recursive: true });
  }
  await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir");

  const received = [];
  let profileMode = "ok";
  let verificationMode = "ok";
  let profileCookie = "";
  const upstream = createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.invalid");
    const path = decodeURIComponent(url.pathname);
    received.push(path + url.search);
    response.setHeader("X-Proxy-Fixture", "transport-only");
    const file = html.get(path) ?? assets.get(path);
    if (file) {
      response.setHeader("Content-Type", html.has(path) ? "text/html; charset=utf-8" : path.endsWith(".css") ? "text/css" : "application/javascript");
      response.end(await readFile(new URL(file, legacyRoot)));
      return;
    }
    // Double of FastAPI, available only in this isolated test process.
    if (["/auth/verificar", "/auth/reenviar-codigo"].includes(path)) {
      response.setHeader("Content-Type", "application/json");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(data.correo, "pending@example.com");
      if (path === "/auth/verificar") assert.equal(data.codigo, "012345");
      const status = { invalid: 400, limited: 429, unavailable: 503 }[verificationMode] ?? 200;
      response.statusCode = status;
      if (status === 429) response.setHeader("Retry-After", "60");
      if (status === 200 && path === "/auth/verificar") {
        if (verificationMode === "ok") profileMode = "ok";
        if (verificationMode === "expire-after-verify") profileMode = "expired";
      }
      response.end(JSON.stringify(status === 200 ? { success: true } : { detail: "do-not-leak-upstream-details" }));
      return;
    }
    if (path === "/auth/login") {
      response.setHeader("Content-Type", "application/json");
      const jwt = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url")}.signature`;
      response.end(JSON.stringify({success:true,access_token:jwt,token_type:"bearer"}));
      return;
    }
    if (path === "/api/perfil") {
      response.setHeader("Content-Type", "application/json");
      const authorized = /^Bearer fixture(?:-b)?\./.test(request.headers.authorization ?? "");
      response.statusCode = authorized ? profileMode === "error" ? 500 : profileMode === "expired" ? 401 : profileMode === "empty" ? 404 : 200 : 401;
      const second = request.headers.authorization?.startsWith("Bearer fixture-b.");
      response.end(JSON.stringify({nombre:second ? "Cuenta B privada" : "Cuenta HTTP sintética", edad:profileMode === "partial" ? "" : 25, ocupacion:profileMode === "partial" ? "" : "Estudiante", ciudad:profileMode === "partial" ? "" : second ? "Ciudad B" : "Ciudad A", breve_descripcion:"Descripción del perfil", sobre_mi:"Datos exclusivos de esta cuenta", foto_perfil:profileMode === "partial" ? null : "/imagenes/fixture-avatar.png", verificado:profileMode === "pending" ? false : profileMode === "unknown" ? null : true,total_publicaciones:profileMode === "partial" ? 0 : second ? 4 : 2, access_token:"should-not-leak",contrasena:"should-not-leak"}));
      return;
    }
    if (path === "/imagenes/fixture-avatar.png") {
      response.setHeader("Content-Type", "image/png");
      response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=", "base64"));
      return;
    }
    // Solo respuestas sintéticas de transporte.
    response.setHeader("Content-Type", "application/json");
    if (path === "/auth/__proxy_probe") {
      response.statusCode = 401;
      response.setHeader("Set-Cookie", [
        "proxy_transport_probe=synthetic; HttpOnly; Path=/; SameSite=lax",
        "proxy_transport_clear=; Max-Age=0; Path=/; SameSite=lax",
      ]);
      response.end(JSON.stringify({ detail: "Transport fixture: no authentication" }));
      return;
    }
    if (path === "/api/__validation_probe") response.statusCode = 422;
    response.end(JSON.stringify({ path, search: url.search, cookie: request.headers.cookie ?? null }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamOrigin = `http://127.0.0.1:${upstream.address().port}`;
  let output = "";
  const next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
    cwd: isolated,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase()))), FASTAPI_ORIGIN: upstreamOrigin, WEB_AUTH_ENABLED: "true", WEB_AUTH_ORIGIN: "http://127.0.0.1:3000", WEB_AUTH_FASTAPI_ORIGIN: upstreamOrigin, NEXT_TELEMETRY_DISABLED: "1" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  next.stdout.on("data", (chunk) => { output += chunk.toString(); });
  next.stderr.on("data", (chunk) => { output += chunk.toString(); });
  t.after(async () => {
    if (next.exitCode === null) {
      if (process.platform === "win32") {
        const stopped = spawnSync("taskkill", ["/pid", String(next.pid), "/t", "/f"], { windowsHide: true, encoding: "utf8" });
        if (stopped.status !== 0) {
          next.stdout.destroy();
          next.stderr.destroy();
          next.unref();
          upstream.closeAllConnections();
          upstream.close();
          throw new Error(`No se pudo cerrar el servidor temporal PID ${next.pid}: ${stopped.stderr || stopped.error || stopped.stdout}`);
        }
      } else next.kill("SIGTERM");
    }
    if (next.exitCode === null) await once(next, "exit");
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
    // Desvincular dependencias antes de borrar; nunca recorrer node_modules real.
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-")) throw new Error("Directorio de limpieza fuera del proyecto");
    await unlink(join(isolated, "node_modules"));
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  const base = "http://127.0.0.1:3000";
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (next.exitCode !== null) throw new Error(`Next.js no pudo arrancar:\n${output}`);
    try {
      const response = await fetch(`${base}/api/__ready_probe`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200 && response.headers.get("x-proxy-fixture")) { ready = true; break; }
    } catch { /* Esperar el arranque del servidor, sin acceder a servicios reales. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, `Next.js no estuvo disponible:\n${output}`);

  await t.test("las rutas Next.js y los iconos locales no pasan al upstream", async () => {
    for (const path of ["/", "/registro", "/verificar", "/Iconos/casa.webp"]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-proxy-fixture"), null, path);
      if (path !== "/Iconos/casa.webp") assert.match(await response.text(), /¿Hay cupo\?/);
    }
  });

  await t.test("auth web rechaza CSRF sin contactar upstream", async () => {
    const count = received.length;
    const response = await fetch(`${base}/web-api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://foreign.example.test", "X-Haycupo-CSRF": "1" }, body: JSON.stringify({ correo: "fixture@example.com", contrasena: "fixture-only" }) });
    assert.equal(response.status, 403);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(received.length, count);
  });

  await t.test("handlers reales: cookie, sesión y navegación privada", async () => {
    assert.equal((await fetch(`${base}/inicio`, { redirect: "manual" })).status, 307);
    const login = await fetch(`${base}/web-api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, "X-Haycupo-CSRF": "1" }, body: JSON.stringify({correo:"fixture@example.com",contrasena:"fixture-only"}) });
    assert.equal(login.status,200);
    assert.deepEqual(await login.json(),{success:true});
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    profileCookie = cookie;
    assert.match(cookie,/^haycupo_dev_session=/);
    assert.match(login.headers.getSetCookie()[0],/HttpOnly; SameSite=Strict/);
    const session = await fetch(`${base}/web-api/auth/sesion`, {headers:{cookie}});
    assert.deepEqual(await session.json(),{authenticated:true,user:{nombre:"Cuenta HTTP sintética"}});
    const home = await fetch(`${base}/inicio`, {headers:{cookie},redirect:"manual"});
    assert.equal(home.status,200);
    assert.match(await home.text(),/aria-label="Navegación principal"/);
  });

  await t.test("perfil React y handler privado reemplazan HTML sin exponer JWT", async () => {
    const anonymous = await fetch(`${base}/perfil`, {redirect:"manual"});
    assert.equal(anonymous.status,307);
    assert.equal((await fetch(`${base}/web-api/perfil`)).status,401);
    const html = await fetch(`${base}/perfil`,{headers:{cookie:profileCookie},redirect:"manual"});
    assert.equal(html.status,200);
    const source = await html.text();
    assert.match(source,/Mi perfil/);
    assert.match(source,/Cargando tu perfil/);
    assert.doesNotMatch(source,/should-not-leak/);
    const response=await fetch(`${base}/web-api/perfil?id_usuario=999`,{headers:{cookie:profileCookie}});
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.nombre,"Cuenta HTTP sintética");
    assert.equal(body.total_publicaciones,2);
    assert.equal(response.headers.get("cache-control"),"no-store");
    assert.equal(body.access_token,undefined);
    assert.equal(body.contrasena,undefined);
    for(const method of ["POST","DELETE"]) assert.equal((await fetch(`${base}/web-api/perfil`,{method,headers:{cookie:profileCookie}})).status,405);
    assert.equal(received.includes("/api/perfil?id_usuario=999"),false);
  });
  if (process.env.PROFILE_BROWSER_TESTS === "1") {
    await t.test("perfil en navegador: carga, identidad, errores, teclado y resoluciones", async () => {
      const { profileBrowser } = await import("./profile-browser.mjs");
      await profileBrowser({base,cookie:profileCookie,setProfileMode:(mode)=>{profileMode=mode;},setVerificationMode:(mode)=>{verificationMode=mode;},playwrightPath:process.env.PROFILE_PLAYWRIGHT_PATH,browserPath:process.env.PROFILE_BROWSER_PATH});
    });
  }

  await t.test("páginas HTML y alias de acceso conservan sus bytes", async () => {
    for (const [path, file] of html) {
      const aliases = path === "/" ? ["/acceso", "/legacy/acceso"] : path === "/inicio" || path === "/perfil" ? [`/legacy${path}`] : [path, `/legacy${path}`];
      for (const alias of aliases) {
        const response = await fetch(`${base}${alias}`);
        assert.equal(response.status, 200, alias);
        assert.equal(await response.text(), await readFile(new URL(file, legacyRoot), "utf8"), alias);
      }
    }
  });

  await t.test("recursos antiguos, incluyendo paréntesis y mayúsculas", async () => {
    for (const [path, file] of assets) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200, path);
      assert.equal(await response.text(), await readFile(new URL(file, legacyRoot), "utf8"), path);
    }
  });

  await t.test("conserva parámetros, cookie sintética, rutas e imágenes", async () => {
    for (const path of ["/api/__proxy_probe?texto=Temuco&limite=5", "/editar-publicacion?id=123", "/legacy/editar-publicacion?id=123", "/imagenes/__proxy_probe.png", "/conexiones/usuarios/buscar?zona=Centro"]) {
      const response = await fetch(`${base}${path}`, { headers: { Cookie: "proxy_transport_probe=synthetic" }, redirect: "manual" });
      assert.equal(response.status, 200, path);
      if (path.includes("/editar-publicacion")) { assert.ok(received.includes(path.replace("/legacy", ""))); continue; }
      const body = await response.json();
      const expected = new URL(path, base);
      assert.equal(body.path, expected.pathname);
      assert.equal(body.search, expected.search);
      assert.equal(body.cookie, "proxy_transport_probe=synthetic");
    }
    for (const path of ["/conexiones", "/conexiones/"]) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      assert.equal(response.status, 200, path);
      assert.equal((await response.json()).path, "/conexiones/");
    }
  });

  await t.test("retira auth antiguo y conserva errores de la API", async () => {
    const response = await fetch(`${base}/auth/__proxy_probe`);
    assert.equal(response.status, 410);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(received.includes("/auth/__proxy_probe"), false);
    assert.equal((await fetch(`${base}/api/__validation_probe`)).status, 422);
  });

  await t.test("una ruta inexistente no se envía al backend", async () => {
    for (const path of ["/__not_implemented", "/legacy/__not_implemented"]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 404);
      assert.equal(received.includes(path), false);
    }
  });

  await t.test("el acceso no hereda Sidebar ni presenta autenticación operativa", async () => {
    const response = await fetch(base);
    const body = await response.text();
    assert.match(body, /¡Bienvenido de vuelta!/);
    assert.match(body, /Integración segura preparada/);
    assert.match(body, /type="password"/);
    assert.doesNotMatch(body, /<aside\b|aria-label="Navegación principal"/);
    assert.match(body, /href="\/registro"/);
    assert.match(body, /<fieldset[^>]*disabled/);
    const register = await (await fetch(`${base}/registro`)).text();
    assert.match(register, /Crea tu cuenta/);
    assert.match(register, /name="fecha_nacimiento"/);
    assert.match(register, /<fieldset[^>]*disabled/);
    assert.doesNotMatch(register, /<aside\b|aria-label="Navegación principal"/);
    const home = await (await fetch(`${base}/inicio`)).text();
    assert.match(home, /¡Bienvenido de vuelta!/);
    assert.doesNotMatch(home, /aria-label="Navegación principal"/);
  });

  await t.test("navegación de verificación local, sin correos ni sesión", async () => {
    for (const path of ["/", "/registro"]) {
      const html = await (await fetch(`${base}${path}`)).text();
      assert.match(html, /href="\/verificar"/);
    }
    const response = await fetch(`${base}/verificar`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.getSetCookie().length, 0);
    const html = await response.text();
    assert.match(html, /Verifica tu correo/);
    assert.match(html, /autoComplete="one-time-code"/i);
    assert.match(html, /inputMode="numeric"/i);
    assert.match(html, /<fieldset[^>]*disabled/);
    assert.match(html, /El envío requiere que el entorno de pruebas esté habilitado/);
    assert.match(html, /href="\/"/);
    assert.match(html, /href="\/registro"/);
    assert.doesNotMatch(html, /<aside\b|aria-label="Navegación principal"/);
    assert.equal(received.includes("/verificar"), false);
  });
});
