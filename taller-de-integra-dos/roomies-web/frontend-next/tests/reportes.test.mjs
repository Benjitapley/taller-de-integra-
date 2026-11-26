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
const reportContracts = compile(await source("../src/features/reportes/contracts.ts"));
const { handleReports, handleReportMembers } = await import(compile((await source("../src/lib/reportes.ts")).replace('"./auth/gateway"', JSON.stringify(gateway)).replace('"../features/reportes/contracts"', JSON.stringify(reportContracts))));
const config = { provider: "supabase", origin: "https://web.example.org", backend: "https://api.example.org", secure: true };
const headers = { cookie: "__Host-roomies_sb_access=fixture.token.signed", origin: config.origin, "x-haycupo-csrf": "1", "Content-Type": "application/json", "Idempotency-Key": "report-operation-1" };
const data = { categoria: " Conducta inapropiada ", descripcion: "Texto ficticio", id_usuario_reportado: 42 };
const report = { id_reporte: 5, tipo: "Usuario", id_usuario_reportado: 42, id_publicacion_reportada: null, categoria: "Conducta inapropiada", descripcion: data.descripcion, estado: "Pendiente", fecha: "2026-11-20T12:00:00Z" };

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
  const response = await handleReports(post(data), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/reportes");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signed");
    assert.equal(options.headers["Idempotency-Key"], "report-operation-1");
    assert.deepEqual(JSON.parse(options.body), { ...data, categoria: "Conducta inapropiada" });
    return Response.json({ ...report, nota_interna: "reservada" }, { status: 201 });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), report);
});

test("reintentos mantienen la clave y no inventan éxito ante errores o respuesta ajena", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const post = extra => new Request(config.origin + "/web-api/reportes", { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(data) });
  const calls = [];
  const transport = async (_url, options) => {
    calls.push(options.headers["Idempotency-Key"]);
    return calls.length === 1 ? Response.json({}, { status: 503 }) : Response.json(report, { status: 201 });
  };
  assert.equal((await handleReports(post(), config, transport)).status, 503);
  assert.equal((await handleReports(post(), config, transport)).status, 201);
  assert.deepEqual(calls, ["report-operation-1", "report-operation-1"]);
  assert.equal((await handleReports(post(), config, async () => Response.json({ ...report, id_usuario_reportado: 99 }, { status: 201 }))).status, 503);
  for (const status of [401, 403, 404, 409, 422, 429, 503]) {
    const response = await handleReports(post(), config, async () => Response.json({ nota_interna: "SECRET" }, { status }));
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /SECRET/);
  }
});

test("categorías, claves, límites y campos protegidos se rechazan antes de la API", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const denied = async () => { throw new Error("No debe enviarse"); };
  for (const body of [{ ...data, categoria: "Otra inventada" }, { ...data, descripcion: " " }, { ...data, descripcion: "x".repeat(1001) }, { ...data, nota_interna: "privada" }, { ...data, id_usuario_reportado: 0 }]) {
    assert.equal((await handleReports(new Request(config.origin + "/web-api/reportes", { method: "POST", headers, body: JSON.stringify(body) }), config, denied)).status, 422);
  }
  for (const key of ["", "x".repeat(81), "bad key"]) {
    const request = new Request(config.origin + "/web-api/reportes", { method: "POST", headers: { ...headers, "Idempotency-Key": key }, body: JSON.stringify(data) });
    assert.equal((await handleReports(request, config, denied)).status, 422);
  }
});

test("historial rechaza filtros de otra cuenta y respuestas malformadas", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const denied = async () => { throw new Error("No debe consultar"); };
  for (const query of ["?id_usuario=2", "?cursor=a&cursor=b", "?cursor="]) {
    assert.equal((await handleReports(new Request(config.origin + "/web-api/reportes" + query, { headers }), config, denied)).status, 422);
  }
  for (const response of [{ items: [{ ...report, id_reporte: -1 }], siguiente_cursor: null }, { items: [], siguiente_cursor: "https://evil.invalid" }]) {
    assert.equal((await handleReports(new Request(config.origin + "/web-api/reportes", { headers }), config, async () => Response.json(response))).status, 503);
  }
  process.env.WEB_REPORTES_ENABLED = "false";
  assert.equal((await handleReports(new Request(config.origin + "/web-api/reportes", { headers }), config, denied)).status, 404);
});

test("integrantes solo se consultan con sesión y la respuesta elimina datos ajenos al selector", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const request = new Request(config.origin + "/web-api/arriendos/7/integrantes?cursor=next", { headers });
  const response = await handleReportMembers(request, "7", config, async (url, options) => {
    assert.equal(url, config.backend + "/api/arriendos/7/integrantes?cursor=next");
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signed");
    return Response.json({ items: [{ id_usuario: 2, nombre: "Integrante", activo: true, es_responsable: false, fecha_ingreso: "2026-11-20T12:00:00Z", nota_interna: "SECRET", email: "private" }], siguiente_cursor: null });
  });
  assert.deepEqual(await response.json(), { items: [{ id_usuario: 2, nombre: "Integrante", activo: true, es_responsable: false, fecha_ingreso: "2026-11-20T12:00:00Z" }], siguiente_cursor: null });
  assert.equal((await handleReportMembers(new Request(request.url), "7", config)).status, 401);
  assert.equal((await handleReportMembers(request, "7", config, async () => new Response(null, { status: 403 }))).status, 403);
  assert.equal((await handleReportMembers(request, "../7", config)).status, 422);
});

test("BFF consulta solo el historial propio y filtra campos privados", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const request = new Request(config.origin + "/web-api/reportes?cursor=abc.def", { headers });
  const response = await handleReports(request, config, async (url, options) => {
    assert.equal(url, config.backend + "/api/reportes/mios?cursor=abc.def");
    assert.equal(options.method, "GET");
    return Response.json({ items: [{ ...report, id_denunciante: 77, nota_interna: "reservada" }], siguiente_cursor: null });
  });
  assert.deepEqual(await response.json(), { items: [report], siguiente_cursor: null });
});


test("integrantes funciona sin Reportes y conserva errores y cursor sin inventar datos", async () => {
  process.env.WEB_REPORTES_ENABLED = "false";
  const request = new Request(config.origin + "/web-api/arriendos/7/integrantes?activos=true&limite=100&cursor=next", { headers });
  for (const status of [403, 404, 503]) {
    const response = await handleReportMembers(request, "7", config, async () => new Response(null, { status }));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal("items" in await response.json(), false);
  }
  const response = await handleReportMembers(request, "7", config, async (url, options) => {
    assert.equal(new URL(url).searchParams.get("limite"), "100");
    assert.equal(new URL(url).searchParams.get("activos"), "true");
    assert.equal(new URL(url).searchParams.get("cursor"), "next");
    assert.equal(options.cache, "no-store");
    return Response.json({ items: [], siguiente_cursor: null });
  });
  assert.equal(response.status, 200);
  for (const query of ["limite=0", "limite=101", "limite=1&limite=2", "activos=1"]) {
    const invalid = new Request(config.origin + "/web-api/arriendos/7/integrantes?" + query, { headers });
    assert.equal((await handleReportMembers(invalid, "7", config, async () => { throw new Error("No debe consultar"); })).status, 422);
  }
});
