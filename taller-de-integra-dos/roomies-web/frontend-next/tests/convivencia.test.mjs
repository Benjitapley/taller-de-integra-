import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = async path => (await readFile(new URL(path, import.meta.url), "utf8")).replace('import "server-only";', "");
const compile = text => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const gateway = compile(await source("../src/lib/auth/gateway.ts"));
const { handleConvivencia } = await import(compile((await source("../src/lib/recorrido/convivencia.ts")).replace('"../auth/gateway"', JSON.stringify(gateway))));
const config = { provider: "supabase", origin: "https://web.example.org", backend: "https://api.example.org", secure: true };
const headers = { cookie: "__Host-roomies_sb_access=fixture.token.signed", origin: config.origin, "x-haycupo-csrf": "1", "Content-Type": "application/json" };
const path = "/api/arriendos/7/expulsiones";
const data = { id_usuario: 2, motivo: "Incumplimiento de reglas", confirmo: true };
const request = (body = data, extra = {}) => new Request(config.origin + path, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
const saved = { id_arriendo: 7, id_usuario_retirado: 2, estado: "Activo", cupos_totales: 3, ocupacion: 1, sincronizacion_pendiente: true };

test("E05 BFF exige sesión, origen, motivo y confirmación sin contactar upstream", async () => {
  const forbidden = () => { throw new Error("No debe contactar la API"); };
  for (const [req, status] of [
    [request(data, { cookie: "" }), 401], [request(data, { origin: "https://other.test" }), 403],
    [request(data, { "x-haycupo-csrf": "" }), 403], [request({ ...data, confirmo: false }), 422],
    [request({ ...data, motivo: "  " }), 422], [request({ ...data, motivo: "x".repeat(501) }), 422],
    [request({ ...data, id_usuario: true }), 422], [request({ ...data, id_actor: 1 }), 422],
  ]) assert.equal((await handleConvivencia(req, path, config, forbidden)).status, status);
});

test("E05 reintento envía el mismo integrante y solo usa el token de cookie", async () => {
  const calls = [];
  const transport = async (url, options) => {
    assert.equal(url, config.backend + path);
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signed");
    calls.push(JSON.parse(options.body));
    return calls.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ ...saved, audit: "PRIVATE_SENTINEL" });
  };
  assert.equal((await handleConvivencia(request(), path, config, transport)).status, 503);
  const retry = await handleConvivencia(request(data, { Authorization: "Bearer untrusted" }), path, config, transport);
  assert.deepEqual(await retry.json(), { id_arriendo: 7, id_usuario_retirado: 2, estado: "Activo", integrantes_activos: 1, cupos_disponibles: 2, sincronizacion_pendiente: true });
  assert.deepEqual(calls, [data, data]);
  assert.equal(retry.headers.get("cache-control"), "no-store");
});

test("E05 errores y confirmaciones ajenas no muestran éxito ni datos internos", async () => {
  for (const status of [401, 403, 404, 409, 422, 503]) {
    const response = await handleConvivencia(request(), path, config, async () => Response.json({ detail: "PRIVATE_SENTINEL" }, { status }));
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /PRIVATE_SENTINEL/);
  }
  for (const invalid of [{ ...saved, id_usuario_retirado: 99 }, { ...saved, id_arriendo: 99 }, { ...saved, ocupacion: 4 }]) {
    assert.equal((await handleConvivencia(request(), path, config, async () => Response.json(invalid))).status, 503);
  }
});

test("tareas permiten solo reasignación y completar; rechazan reapertura y campos extra", async () => {
  for (const [route, body] of [["/api/tareas/4", { titulo: "Otro" }], ["/api/tareas/4/estado", { estado: "Pendiente" }]]) {
    const req = new Request(config.origin + route, { method: "PATCH", headers, body: JSON.stringify(body) });
    assert.equal((await handleConvivencia(req, route, config, () => { throw Error(); })).status, 422);
  }
});
