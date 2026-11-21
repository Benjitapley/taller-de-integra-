import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source.replace('import "server-only";', ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const gateway = compile(await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8"));
const contract = compile(await readFile(new URL("../src/features/publicaciones/application-contract.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/publicaciones/applications.ts", import.meta.url), "utf8"))
  .replace('"../auth/gateway"', JSON.stringify(gateway))
  .replace('"../../features/publicaciones/application-contract"', JSON.stringify(contract));
const { handleApplications, handleRental } = await import(compile(source));
const { confirmedRental, pendingAdmission } = await import(contract);
const config = { origin: "https://web.test", backend: "https://gateway.test", secure: true };
const headers = { cookie: "__Host-haycupo_session=fixture.claims.signature", origin: config.origin, "content-type": "application/json", "x-haycupo-csrf": "1" };
const req = (method, body, changes = {}) => new Request(config.origin + "/web-api/postulaciones", { method, headers: { ...headers, ...changes }, ...(body ? { body: JSON.stringify(body) } : {}) });
const row = { id_postulacion: 8, id_publicacion: 7, id_usuario: 2, estado: "Pendiente" };
test("postular deriva identidad de cookie y usa ruta fija sin aceptar IDs de usuario", async () => {
  const response = await handleApplications(req("POST", { publicacion: 7 }), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/publicaciones/7/postulaciones");
    assert.equal(options.headers.Authorization, "Bearer fixture.claims.signature");
    assert.equal(options.body, undefined);
    return Response.json({ ...row, access_token: "private" }, { status: 201 });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), row);
  assert.equal((await handleApplications(req("POST", { publicacion: 7, id_usuario: 9 }), config, () => { throw Error(); })).status, 422);
});
test("sin cookie, CSRF o ante consultas manipuladas no contacta backend", async () => {
  const transport = () => { throw Error("forbidden"); };
  assert.equal((await handleApplications(req("POST", { publicacion: 7 }, { cookie: "" }), config, transport)).status, 401);
  assert.equal((await handleApplications(req("POST", { publicacion: 7 }, { origin: "https://evil.test" }), config, transport)).status, 403);
  assert.equal((await handleApplications(new Request(config.origin + "/?publicacion=7&publicacion=8", { headers }), config, transport)).status, 422);
});
test("decisión conserva estados y motivo; campos administrativos se rechazan", async () => {
  const response = await handleApplications(req("PATCH", { id: 8, estado: "Rechazada", motivo: "Otra alternativa" }), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/postulaciones/8/estado");
    assert.deepEqual(JSON.parse(options.body), { estado: "Rechazada", motivo: "Otra alternativa" });
    return Response.json({ ...row, estado: "Rechazada", motivo: "Otra alternativa" });
  });
  assert.equal(response.status, 200);
  assert.equal((await handleApplications(req("PATCH", { id: 8, estado: "Aceptada", admin: true }), config, () => { throw Error(); })).status, 422);
});
test("errores de autorización se conservan sin detalles internos ni éxito ficticio", async () => {
  for (const status of [401, 403, 404, 409, 422, 503]) {
    const response = await handleApplications(req("GET"), config, async () => Response.json({ detail: "database-password-private" }, { status }));
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes("database-password-private"));
    assert.equal(Boolean(response.headers.get("set-cookie")), status === 401);
  }
});

test("listados usan cursor opaco, conservan el aviso y se adaptan a arreglos existentes", async () => {
  const query = new URLSearchParams({ publicacion: "7", cursor: "next+/=?", limite: "20" });
  const request = new Request(config.origin + "/web-api/postulaciones?" + query, { headers });
  const response = await handleApplications(request, config, async (url) => {
    const sent = new URL(url);
    assert.equal(sent.pathname, "/api/publicaciones/7/postulantes");
    assert.equal(sent.searchParams.get("cursor"), "next+/=?");
    assert.equal(sent.searchParams.get("limite"), "20");
    return Response.json({ items: [{ ...row, correo: "privado" }], siguiente_cursor: "fin" });
  });
  assert.deepEqual(await response.json(), { items: [row], siguiente_cursor: "fin" });
  const legacy = await handleApplications(req("GET"), config, async () => Response.json([row]));
  assert.deepEqual(await legacy.json(), { items: [row], siguiente_cursor: null });
  const wrongListing = await handleApplications(request, config, async () => Response.json([{ ...row, id_publicacion: 42 }]));
  assert.equal(wrongListing.status, 503);
});

test("una aceptación pendiente o heredada jamás confirma el ingreso", async () => {
  const accept = () => req("PATCH", { id: 8, estado: "Aceptada" }, { "Idempotency-Key": "operation-retry-8" });
  const accepted = { ...row, estado: "Aceptada" };
  for (const [fixture, expectedRental, expectedPending] of [
    [accepted, null, true],
    [{ ...accepted, id_arriendo: 10, incorporacion_pendiente: true }, null, true],
    [{ ...accepted, id_arriendo: 10 }, 10, false],
  ]) {
    const response = await handleApplications(accept(), config, async (url, options) => {
      assert.equal(url, config.backend + "/api/postulaciones/8/estado");
      assert.equal(options.headers["Idempotency-Key"], "operation-retry-8");
      return Response.json(fixture);
    });
    const body = await response.json();
    assert.equal(confirmedRental(body), expectedRental);
    assert.equal(pendingAdmission(body), expectedPending);
  }
  const pending = await handleApplications(accept(), config, async () => Response.json({}, { status: 202 }));
  assert.equal(pending.status, 202);
  assert.deepEqual(await pending.json(), { incorporacion_pendiente: true });
  const detail = await handleApplications(new Request(config.origin + "/web-api/postulaciones?id=8", { headers }),
    config, async url => {
      assert.equal(url, config.backend + "/api/postulaciones/8");
      return Response.json({ ...accepted, id_arriendo: 10 });
    });
  assert.equal(confirmedRental(await detail.json()), 10);
});

test("el retiro usa la operación del postulante y no acepta Cancelada como decisión manual", async () => {
  const cancelled = { ...row, estado: "Cancelada", motivo: "Retiro voluntario" };
  const response = await handleApplications(req("POST", { retiro: 8 }), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/postulaciones/8/retiro");
    assert.equal(options.method, "POST");
    return Response.json(cancelled);
  });
  assert.deepEqual(await response.json(), cancelled);
  assert.equal((await handleApplications(req("PATCH", { id: 8, estado: "Cancelada" }), config, () => assert.fail())).status, 422);
});

test("Mi arriendo e integrantes consultan destinos privados y explican un fallo del servicio", async () => {
  const request = new Request(config.origin + "/web-api/arriendos/mio", { headers });
  const self = await handleRental(request, "mio", config, async (url, options) => {
    assert.equal(url, config.backend + "/api/arriendos/mio");
    assert.equal(options.headers.Authorization, "Bearer fixture.claims.signature");
    return Response.json({ id_arriendo: 10, id_publicacion: 7, estado: "Activo", secret: "privado" });
  });
  assert.deepEqual(await self.json(), { id_arriendo: 10, id_publicacion: 7 });
  assert.equal((await handleRental(request, "mio", config, async () => new Response(null, { status: 503 }))).status, 503);
  assert.equal((await handleRental(request, "mio", config, async () => new Response(null, { status: 404 }))).status, 404);
  assert.equal((await handleRental(request, "mio", config, async () => Response.json({ detail: "Ruta no disponible." }, { status: 404 }))).status, 503);
  const list = await handleRental(request, "10", config, async url => {
    assert.equal(url, config.backend + "/api/arriendos/10/integrantes");
    return Response.json({ items: [{ id_usuario: 4, nombre: "Persona de prueba", fecha_salida: null, correo: "privado" }], siguiente_cursor: null });
  });
  assert.deepEqual(await list.json(), { items: [{ id_usuario: 4, nombre: "Persona de prueba", activo: true }], siguiente_cursor: null });
});
