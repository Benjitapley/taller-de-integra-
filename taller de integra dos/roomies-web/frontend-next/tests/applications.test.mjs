import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source.replace('import "server-only";', ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const gateway = compile(await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/publicaciones/applications.ts", import.meta.url), "utf8")).replace('"../auth/gateway"', JSON.stringify(gateway));
const { handleApplications } = await import(compile(source));
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
