import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function source(path) {
  return (await readFile(new URL(path, import.meta.url), "utf8")).replace('import "server-only";', "");
}

function compile(value) {
  const code = ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

const gateway = compile(await source("../src/lib/auth/gateway.ts"));
const { handleReports } = await import(compile((await source("../src/lib/reportes.ts")).replace('"./auth/gateway"', JSON.stringify(gateway))));
const config = { provider: "supabase", origin: "https://web.example.org", backend: "https://api.example.org", secure: true };
const headers = { cookie: "__Host-roomies_sb_access=fixture.token.signed", origin: config.origin, "x-haycupo-csrf": "1", "Content-Type": "application/json" };
const data = { categoria: " Conducta ", descripcion: "Texto ficticio", id_usuario_reportado: 42 };
const report = { id_reporte: 5, tipo: "Usuario", id_usuario_reportado: 42, id_publicacion_reportada: null, categoria: "Conducta", descripcion: data.descripcion, estado: "Pendiente", fecha: "2026-11-20T12:00:00Z" };
const key = "45e291dd-5886-4a27-a652-3cb5686ce3ca";

test("BFF valida origen, sesión y objetivo antes de enviar un reporte", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const post = (body, extra) => new Request(config.origin + "/web-api/reportes", {
    method: "POST", headers: { ...headers, Authorization: "Bearer browser.token.ignored", ...extra }, body: JSON.stringify(body),
  });
  const denied = async () => { throw new Error("No se debía consultar el backend"); };
  assert.equal((await handleReports(post(data, { origin: "https://other.example.org" }), config, denied)).status, 403);
  assert.equal((await handleReports(post(data, { cookie: "" }), config, denied)).status, 401);
  assert.equal((await handleReports(post({ ...data, id_denunciante: 2 }), config, denied)).status, 422);
  assert.equal((await handleReports(post({ ...data, id_publicacion_reportada: 12 }), config, denied)).status, 422);
  assert.equal((await handleReports(post(data, { "Idempotency-Key": key + ",otra" }), config, denied)).status, 422);
  const response = await handleReports(post(data, { "Idempotency-Key": key }), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/reportes");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signed");
    assert.equal(options.headers["Idempotency-Key"], key);
    assert.deepEqual(JSON.parse(options.body), { ...data, categoria: "Conducta" });
    return Response.json({ ...report, nota_interna: "reservada" }, { status: 201 });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), report);
  const conflict = await handleReports(post(data, { "Idempotency-Key": key }), config, async () =>
    Response.json({ codigo: "CLAVE_IDEMPOTENCIA_REUTILIZADA" }, { status: 409 }));
  assert.equal(conflict.status, 409);
});

test("BFF consulta solo el historial propio y filtra campos privados", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const request = new Request(config.origin + "/web-api/reportes?cursor=abc.def", { headers: { ...headers, "Idempotency-Key": key } });
  const response = await handleReports(request, config, async (url, options) => {
    assert.equal(url, config.backend + "/api/reportes/mios?cursor=abc.def");
    assert.equal(options.method, "GET");
    assert.equal(options.headers["Idempotency-Key"], undefined);
    return Response.json({ items: [{ ...report, id_denunciante: 77, nota_interna: "reservada" }], siguiente_cursor: null });
  });
  assert.deepEqual(await response.json(), { items: [report], siguiente_cursor: null });
});
