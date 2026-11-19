import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createHmac } from "node:crypto";

const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source.replace('import "server-only";', ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const adapter = compile(await readFile(new URL("../src/lib/auth/supabase.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8")).replace('import("./supabase")', `import(${JSON.stringify(adapter)})`);
const { authConfig, handleAuth, cookieName } = await import(compile(source));
const env = { WEB_AUTH_ENABLED: "true", ROOMIES_LOCAL_MODE: "1", WEB_AUTH_PROVIDER: "supabase", WEB_AUTH_ORIGIN: "http://127.0.0.1:3000", WEB_AUTH_FASTAPI_ORIGIN: "http://127.0.0.1:8000", WEB_SUPABASE_ORIGIN: "http://127.0.0.1:54321", WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" };
const config = authConfig(env);
const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+600 })).toString("base64url")}.signature`;
const session = { access_token: token, refresh_token: "fixture-refresh-123456", token_type: "bearer" };
const identity = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email_confirmed_at: "2026-01-01", user_metadata: { nombre: "Ficticio", fecha_nacimiento: "2000-01-01" } };
const credentials = { correo: "fiction@example.com", contrasena: "Test-password-123" };
const req = (action, body = {}, overrides = {}) => new Request(`${config.origin}/web-api/auth/${action}`, { method: "POST", headers: { origin: config.origin, "content-type": "application/json", "x-haycupo-csrf": "1", ...overrides }, body: JSON.stringify(body) });
const ok = data => Response.json(data);
const defaultTransport = async url => url.includes("/token?") || url.endsWith("/verify") ? ok(session) : url.endsWith("/user") ? ok(identity) : url.endsWith("/local/v1/perfil") ? ok({ nombre: "Ficticio" }) : ok({});

test("proveedor local explícito; remoto, secreto y proveedor desconocido se rechazan", () => {
  assert.equal(config.provider, "supabase");
  for (const overrides of [{ ROOMIES_LOCAL_MODE: "0" }, { WEB_SUPABASE_ORIGIN: "https://production.supabase.co" }, { WEB_AUTH_PROVIDER: "both" }, { WEB_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden" }]) assert.equal(authConfig({ ...env, ...overrides }), null);
  assert.equal(authConfig({ ...env, WEB_SUPABASE_PUBLISHABLE_KEY: `fixture.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature` }), null);
  assert.equal(authConfig({ ...env, WEB_AUTH_PROVIDER: "legacy" }).provider, undefined);
});
test("registro valida mayoría de edad y rechaza permisos y enlaces de identidad", async () => {
  const input = { ...credentials, nombre: "Ficticio", fecha_nacimiento: "2000-01-01" };
  for (const body of [{ ...input, fecha_nacimiento: "2020-01-01" }, { ...input, admin: true }, { ...input, id_usuario: 1 }]) assert.equal((await handleAuth(req("registro", body), "registro", config, () => { throw Error("no network"); })).status, 422);
  const response = await handleAuth(req("registro", input), "registro", config, async (url, options) => {
    assert.equal(url, config.supabase.origin + "/auth/v1/signup?redirect_to=" + encodeURIComponent(config.origin + "/web-api/auth/confirmar"));
    const payload = JSON.parse(options.body);
    assert.equal(payload.code_challenge_method, "s256");
    assert.match(payload.code_challenge, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(payload.data, { nombre: "Ficticio", fecha_nacimiento: input.fecha_nacimiento });
    return ok(identity);
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /roomies_pkce_dev=.+; Path=\/; HttpOnly; SameSite=Lax/);
});
test("CSRF y cookie de otro proveedor nunca acreditan sesión", async () => {
  assert.equal((await handleAuth(req("login", credentials, { origin: "http://evil.test" }), "login", config, defaultTransport)).status, 403);
  const response = await handleAuth(new Request(config.origin, { headers: { cookie: `haycupo_dev_session=${token}` } }), "sesion", config, () => { throw Error("no network"); });
  assert.equal(response.status, 401);
});
test("registro local autoconfirmado y duplicado tienen la misma respuesta sin sesión", async () => {
  const input = { ...credentials, nombre: "Ficticio", fecha_nacimiento: "2000-01-01" };
  const accepted = await handleAuth(req("registro", input), "registro", config, async () => ok(session));
  const duplicate = await handleAuth(req("registro", input), "registro", config, async () =>
    Response.json({ error_code: "user_already_exists" }, { status: 422 }));
  assert.equal(accepted.status, 200);
  assert.equal(duplicate.status, 200);
  const result = await accepted.json();
  assert.deepEqual(await duplicate.json(), result);
  assert.equal(JSON.stringify(result).includes(token), false);
  for (const response of [accepted, duplicate]) {
    assert.doesNotMatch(response.headers.get("set-cookie"), /roomies_sb_dev_(access|refresh)=/);
  }
  const confirmationRequired = { ...config, localSignupAutoconfirm: false };
  const unexpectedSession = await handleAuth(req("registro", input), "registro", confirmationRequired, async () => ok(session));
  assert.equal(unexpectedSession.status, 503);
});
test("login BFF confirma usuario y perfil; cookies HttpOnly sin tokens en JSON", async () => {
  const response = await handleAuth(req("login", credentials), "login", config, defaultTransport);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 3);
  assert.match(cookies[0], /roomies_sb_dev_access=.+; Path=\/; HttpOnly; SameSite=Strict/);
  assert.match(cookies[1], /roomies_sb_dev_refresh=.+; Path=\/; HttpOnly; SameSite=Strict/);
  assert.match(cookies[2], /haycupo_dev_session=;.*Max-Age=0/);
});
test("inicialización usa UUID acreditado, sin consulta ni unión por correo", async () => {
  const calls = [];
  const response = await handleAuth(req("login", credentials), "login", config, async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/local/v1/perfil") && calls.filter(c => c.url === url).length === 1) return new Response("{}", { status: 404 });
    return defaultTransport(url, options);
  });
  assert.equal(response.status, 200);
  const initialization = calls.find(c => c.url.endsWith("/inicializacion"));
  assert.deepEqual(JSON.parse(initialization.options.body), identity.user_metadata);
  assert.equal(initialization.options.headers.Authorization, `Bearer ${token}`);
  assert.ok(calls.every(c => !c.url.includes(credentials.correo)));
});
test("verificación no conserva sesión y rechaza código no numérico", async () => {
  assert.equal((await handleAuth(req("verificar", { correo: credentials.correo, codigo: "abcdef" }), "verificar", config, defaultTransport)).status, 422);
  const response = await handleAuth(req("verificar", { correo: credentials.correo, codigo: "123456" }), "verificar", config, defaultTransport);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /roomies_pkce_dev=;.*Max-Age=0/);
});
test("Supabase real requiere ref exacta y entorno distinto del laboratorio", () => {
  const ref = "a".repeat(20);
  const remote = { ...env, ROOMIES_LOCAL_MODE: "0", ROOMIES_RUNTIME_MODE: "supabase", ROOMIES_SUPABASE_PROJECT_REF: ref, WEB_SUPABASE_ORIGIN: `https://${ref}.supabase.co` };
  assert.equal(authConfig(remote).supabase.origin, remote.WEB_SUPABASE_ORIGIN);
  assert.equal(authConfig({ ...remote, ROOMIES_SUPABASE_PROJECT_REF: "b".repeat(20) }), null);
  assert.equal(authConfig({ ...remote, ROOMIES_LOCAL_MODE: "1" }), null);
});
test("confirmación PKCE exige comprobante HttpOnly y no entrega tokens al navegador", async () => {
  const code = "one-use-authorization-code";
  const noCookie = new Request(config.origin + "/web-api/auth/confirmar?code=" + code);
  assert.equal((await handleAuth(noCookie, "confirmar", config, () => { throw Error(); })).headers.get("location"), config.origin + "/verificar?estado=enlace-invalido");
  const verifier = "a".repeat(64);
  const response = await handleAuth(new Request(config.origin + "/web-api/auth/confirmar?code=" + code, { headers: { cookie: "roomies_pkce_dev=" + verifier } }), "confirmar", config, async (url, options) => {
    if (url.includes("grant_type=pkce")) assert.deepEqual(JSON.parse(options.body), { auth_code: code, code_verifier: verifier });
    return defaultTransport(url, options);
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), config.origin + "/?correo=verificado");
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(await response.text(), "");
});

const recoveryConfig = { ...config, recoverySecret: "test-only-secret-".repeat(4) };
test("recuperación admite cualquier correo válido y no revela existencia", async () => {
  for (const email of ["known@example.com", "unknown@another.example"]) {
    const response = await handleAuth(req("recuperar", { correo: email }), "recuperar", recoveryConfig, async (url, options) => {
      assert.ok(url.startsWith(config.supabase.origin + "/auth/v1/recover?redirect_to="));
      const data = JSON.parse(options.body);
      assert.equal(data.email, email);
      assert.equal(data.code_challenge_method, "s256");
      assert.match(data.code_challenge, /^[A-Za-z0-9_-]{43}$/);
      return ok({});
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.");
    assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
  }
  assert.equal((await handleAuth(req("recuperar", { correo: "bad" }), "recuperar", recoveryConfig, () => { throw Error(); })).status, 422);
});
test("recuperación mantiene CSRF, límites y errores de servicio sin filtraciones", async () => {
  assert.equal((await handleAuth(req("recuperar", { correo: "a@example.com" }, { origin: "https://evil.test" }), "recuperar", recoveryConfig, () => { throw Error(); })).status, 403);
  const rate = await handleAuth(req("recuperar", { correo: "a@example.com" }), "recuperar", recoveryConfig, async () => new Response("private", { status: 429, headers: { "Retry-After": "60" } }));
  assert.equal(rate.status, 429); assert.equal(rate.headers.get("retry-after"), "60");
  const outage = await handleAuth(req("recuperar", { correo: "a@example.com" }), "recuperar", recoveryConfig, async () => new Response("private", { status: 500 }));
  assert.equal(outage.status, 503); assert.ok(!(await outage.text()).includes("private"));
});
test("enlace de recuperación necesita su propio PKCE y cápsula íntegra", async () => {
  const url = config.origin + "/web-api/auth/recuperacion-callback?code=recovery-code-one-use";
  const absent = await handleAuth(new Request(url), "recuperacion-callback", recoveryConfig, () => { throw Error(); });
  assert.equal(absent.headers.get("location"), config.origin + "/recuperar-contrasena?estado=enlace-invalido");
  const signupProof = await handleAuth(new Request(url, { headers: { cookie: "roomies_pkce_dev=" + "a".repeat(64) } }), "recuperacion-callback", recoveryConfig, () => { throw Error(); });
  assert.equal(signupProof.status, 303);
  const callback = await handleAuth(new Request(url, { headers: { cookie: "roomies_recovery_pkce_dev=" + "a".repeat(64) } }), "recuperacion-callback", recoveryConfig, defaultTransport);
  assert.equal(callback.headers.get("location"), config.origin + "/restablecer-contrasena");
  const cookie = callback.headers.getSetCookie()[0].split(";")[0];
  assert.match(callback.headers.getSetCookie()[0], /HttpOnly; SameSite=Strict/);
  const status = await handleAuth(new Request(config.origin, { headers: { cookie } }), "recuperacion-estado", recoveryConfig, defaultTransport);
  assert.deepEqual(await status.json(), { valid: true });
  const tampered = await handleAuth(new Request(config.origin, { headers: { cookie: cookie.slice(0,-5)+"xxxxx" } }), "recuperacion-estado", recoveryConfig, () => { throw Error(); });
  assert.equal(tampered.status, 401);
});
test("restablecer valida confirmación, actualiza solo usuario acreditado y limpia sesión", async () => {
  const callback = await handleAuth(new Request(config.origin + "/?code=reset-password-once", { headers: { cookie: "roomies_recovery_pkce_dev=" + "b".repeat(64) } }), "recuperacion-callback", recoveryConfig, defaultTransport);
  const cookie = callback.headers.getSetCookie()[0].split(";")[0];
  const mismatch = await handleAuth(req("cambiar-contrasena", { contrasena: "new-password-123", confirmacion: "other-password" }, { cookie }), "cambiar-contrasena", recoveryConfig, () => { throw Error(); });
  assert.equal(mismatch.status, 422);
  let updates = 0;
  const changed = await handleAuth(req("cambiar-contrasena", { contrasena: "new-password-123", confirmacion: "new-password-123" }, { cookie }), "cambiar-contrasena", recoveryConfig, async (url, options) => {
    if (options.method === "PUT") { updates++; assert.equal(url, config.supabase.origin + "/auth/v1/user"); assert.equal(options.headers.Authorization, "Bearer " + token); assert.deepEqual(JSON.parse(options.body), { password: "new-password-123" }); }
    return defaultTransport(url, options);
  });
  assert.equal(changed.status, 200); assert.equal(updates, 1);
  assert.ok(changed.headers.getSetCookie().every(c => c.includes("Max-Age=0")));
  const replay = await handleAuth(req("cambiar-contrasena", { contrasena: "new-password-123", confirmacion: "new-password-123" }, { cookie }), "cambiar-contrasena", recoveryConfig, () => { throw Error(); });
  assert.equal(replay.status, 401);
});
test("recuperación expirada y cookie de sesión normal no permiten cambiar contraseña", async () => {
  const payload = Buffer.from(JSON.stringify({ access:token, subject:identity.id, expires:Math.floor(Date.now()/1000)-1, nonce:"expired-fixture" })).toString("base64url");
  const signature = createHmac("sha256",recoveryConfig.recoverySecret).update("password-recovery:"+payload).digest("base64url");
  for (const cookie of [`roomies_recovery_dev=${payload}.${signature}`,`${cookieName(config)}=${token}`]) {
    const response = await handleAuth(req("cambiar-contrasena",{contrasena:"new-password-123",confirmacion:"new-password-123"},{cookie}),"cambiar-contrasena",recoveryConfig,()=>{throw Error("no provider call");});
    assert.equal(response.status,401);
  }
});
test("renovación rota cookies, coalesce concurrencia y distingue caída de credencial inválida", async () => {
  let calls = 0;
  const transport = async (url, options) => {
    if (url.includes("grant_type=refresh_token")) calls++;
    return defaultTransport(url, options);
  };
  const request = () => req("renovar", {}, { cookie: "roomies_sb_dev_refresh=concurrent-refresh-123456" });
  const responses = await Promise.all([handleAuth(request(), "renovar", config, transport), handleAuth(request(), "renovar", config, transport)]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(calls, 1);
  const outage = await handleAuth(req("renovar", {}, { cookie: "roomies_sb_dev_refresh=outage-refresh-123456" }), "renovar", config, async () => { throw Error("offline"); });
  assert.equal(outage.status, 503);
  assert.equal(outage.headers.get("set-cookie"), null);
  const rejected = await handleAuth(req("renovar", {}, { cookie: "roomies_sb_dev_refresh=rejected-refresh-123456" }), "renovar", config, async () => new Response("{}", { status: 400 }));
  assert.equal(rejected.status, 401);
  assert.equal(rejected.headers.getSetCookie().length, 2);
});
test("logout revoca negocio y proveedor; errores se ocultan y limpian cookies", async () => {
  const calls = [];
  const response = await handleAuth(req("logout", {}, { cookie: `${cookieName(config)}=${token}` }), "logout", config, async url => { calls.push(url); return ok({}); });
  assert.equal(response.status, 200);
  assert.ok(calls[0].endsWith("/local/v1/sesion/revocar"));
  assert.ok(calls[1].endsWith("/logout?scope=local"));
  assert.equal(response.headers.getSetCookie().length, 2);
});
