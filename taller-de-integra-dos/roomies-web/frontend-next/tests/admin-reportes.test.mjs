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
const reports = compile((await source("../src/lib/reportes.ts")).replace('"./auth/gateway"', JSON.stringify(gateway)));
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
