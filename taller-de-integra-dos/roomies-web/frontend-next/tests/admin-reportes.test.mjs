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
const reports = compile((await source("../src/lib/reportes.ts")).replace('"./auth/gateway"', JSON.stringify(gateway)).replace('"../features/reportes/contracts"', JSON.stringify(reportContracts)));
const contracts = compile(await source("../src/features/admin/reportes.ts"));
const { handleAdminReports } = await import(compile((await source("../src/lib/admin/reportes.ts"))
  .replace('"../auth/gateway"', JSON.stringify(gateway))
  .replace('"../reportes"', JSON.stringify(reports))
  .replace('"../../features/admin/reportes"', JSON.stringify(contracts))));

const config = { provider: "supabase", origin: "https://web.example.org", backend: "https://api.example.org", secure: true };
const session = "fixture.token.signed";
const url = config.origin + "/web-api/admin/reportes";
const headers = { cookie: `__Host-roomies_sb_access=${session}`, origin: config.origin, "x-haycupo-csrf": "1", "Content-Type": "application/json" };
const report = { id_reporte: 12, id_denunciante: 99, tipo: "Usuario", id_usuario_reportado: 5, id_publicacion_reportada: null, categoria: "Conducta",
  descripcion: "Texto ficticio", estado: "En_Revision", fecha: "2026-11-20T12:00:00Z" };

test("BFF fija la ruta administrativa, conserva filtros y respeta denegaciones", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  let request = new Request(url + "?estado=Pendiente&tipo=Usuario", { headers });
  const forbidden = await handleAdminReports(request, undefined, config, async (destination, options) => {
    assert.equal(destination, config.backend + "/api/admin/reportes?estado=Pendiente&tipo=Usuario");
    assert.equal(options.headers.Authorization, `Bearer ${session}`);
    return Response.json({}, { status: 403 });
  });
  assert.equal(forbidden.status, 403);
  request = new Request(url + "?estado=Pendiente&estado=Resuelto", { headers });
  assert.equal((await handleAdminReports(request, undefined, config, async () => assert.fail())).status, 422);
});

test("BFF protege la actualización y entrega la bitácora administrativa", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const request = (origin, data) => new Request(url + "/12", { method: "PATCH",
    headers: { ...headers, origin, Authorization: "Bearer ignored.browser.token" }, body: JSON.stringify(data) });
  const input = { estado: "En_Revision", nota_interna: " Privada " };
  assert.equal((await handleAdminReports(request("https://otra.example.org", input), "12", config, async () => assert.fail())).status, 403);
  assert.equal((await handleAdminReports(request(config.origin, { ...input, id_administrador: 1 }), "12", config, async () => assert.fail())).status, 422);
  const historial = [{ id_actuacion: 1, id_administrador: 7, estado_anterior: "Pendiente", estado_nuevo: "En_Revision", nota_interna: "Privada", fecha: report.fecha }];
  const response = await handleAdminReports(request(config.origin, input), "12", config, async (destination, options) => {
    assert.equal(destination, config.backend + "/api/admin/reportes/12");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, `Bearer ${session}`);
    assert.deepEqual(JSON.parse(options.body), { estado: "En_Revision", nota_interna: "Privada" });
    return Response.json({ ...report, historial, confidential: "no debe salir" });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...report, historial });
});

test("bandeja valida páginas y filtra campos ajenos sin mezclar identidades", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  for (const cookie of ["fixture.token.signed", "other.token.signed"]) {
    const request = new Request(url + "?estado=En_Revision&tipo=Usuario&cursor=signed.cursor", { headers: { cookie: `__Host-roomies_sb_access=${cookie}` } });
    const response = await handleAdminReports(request, undefined, config, async (destination, options) => {
      assert.match(destination, /cursor=signed.cursor$/);
      assert.equal(options.headers.Authorization, `Bearer ${cookie}`);
      return Response.json({ items: [{ ...report, nota_interna: "PRIVATE", correo: "PRIVATE", historial: [] }], siguiente_cursor: null, secret: "PRIVATE" });
    });
    assert.deepEqual(await response.json(), { items: [report], siguiente_cursor: null });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  for (const data of [{ items: [report, report], siguiente_cursor: null }, { items: [report], siguiente_cursor: "?bad" }, { items: [{ ...report, id_denunciante: -1 }], siguiente_cursor: null }]) {
    assert.equal((await handleAdminReports(new Request(url, { headers }), undefined, config, async () => Response.json(data))).status, 503);
  }
});

test("sesión, rol y errores del backend no devuelven notas ni detalles privados", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const request = new Request(url + "/12", { headers });
  for (const status of [401, 403, 404, 409, 422, 503]) {
    const response = await handleAdminReports(request, "12", config, async () => Response.json({ detail: "PRIVATE", historial: [{ nota_interna: "PRIVATE" }] }, { status }));
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /PRIVATE|historial|nota_interna/);
    assert.equal(Boolean(response.headers.get("set-cookie")), status === 401);
  }
  const response = await handleAdminReports(new Request(url + "/12"), "12", config, async () => assert.fail());
  assert.equal(response.status, 401);
  assert.equal((await handleAdminReports(request, "12", config, async () => { throw new Error("PRIVATE"); })).status, 503);
});

test("PATCH exige confirmación coherente y bitácora válida antes de anunciar éxito", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const entry = { id_actuacion: 1, id_administrador: 7, estado_anterior: "Pendiente", estado_nuevo: "En_Revision", nota_interna: null, fecha: report.fecha };
  const request = () => new Request(url + "/12", { method: "PATCH", headers, body: JSON.stringify({ estado: "En_Revision", nota_interna: " " }) });
  for (const data of [
    { ...report, estado: "Pendiente", historial: [entry] },
    { ...report, historial: [] },
    { ...report, id_reporte: 13, historial: [entry] },
    { ...report, historial: [entry, entry] },
    { ...report, historial: [{ ...entry, estado_anterior: "Resuelto" }] },
    { ...report, historial: [{ ...entry, nota_interna: " " }] },
  ]) assert.equal((await handleAdminReports(request(), "12", config, async () => Response.json(data))).status, 503);
  const saved = await handleAdminReports(request(), "12", config, async (_url, options) => {
    assert.equal(JSON.parse(options.body).nota_interna, null);
    return Response.json({ ...report, historial: [entry], contrasena: "PRIVATE" });
  });
  assert.equal(saved.status, 200);
  assert.doesNotMatch(await saved.text(), /PRIVATE/);
});

test("rutas, filtros, métodos y origen inválidos se rechazan antes del transporte", async () => {
  process.env.WEB_REPORTES_ENABLED = "true";
  const prevent = async () => assert.fail("No debe contactar otro recurso");
  for (const query of ["estado=Otro", "tipo=Otro", "cursor=", "limite=100", "cursor=a&cursor=b"]) {
    assert.equal((await handleAdminReports(new Request(url + "?" + query, { headers }), undefined, config, prevent)).status, 422);
  }
  for (const id of ["0", "../12", "9007199254740992"]) assert.equal((await handleAdminReports(new Request(url + "/12", { headers }), id, config, prevent)).status, 422);
  assert.equal((await handleAdminReports(new Request(url, { method: "POST", headers, body: "{}" }), undefined, config, prevent)).status, 405);
  for (const body of [{ estado: "No" }, { estado: "En_Revision", nota_interna: "a".repeat(1001) }, { estado: "En_Revision", nota_interna: "\0" }, { estado: "En_Revision", rol: "admin" }]) {
    assert.equal((await handleAdminReports(new Request(url + "/12", { method: "PATCH", headers, body: JSON.stringify(body) }), "12", config, prevent)).status, 422);
  }
});
