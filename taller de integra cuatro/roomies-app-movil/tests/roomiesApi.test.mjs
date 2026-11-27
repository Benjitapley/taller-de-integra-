import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/services/roomiesApi.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
runInNewContext(compiled, { exports: module.exports, URLSearchParams, FormData, Math, Date,
  require(name) {
    assert.equal(name, "@/services/httpClient");
    return { solicitarJson: () => { throw Error("Debe inyectarse el transporte"); }, solicitarFormulario: () => { throw Error("Debe inyectarse el transporte"); } };
  } });
const api = module.exports;
const ok = datos => ({ exito: true, datos, estadoHttp: 200 });
const publication = { id_publicacion: 37, titulo: "Prueba", descripcion: "Contrato", precio: 190000, ubicacion: "Temuco", estado: "Disponible", cupos_totales: 2, cupos_disponibles: 2 };

test("catálogo conserva filtros y cursor opaco, exige el sobre paginado", async () => {
  const calls = [];
  const result = await api.pagina("/api/publicaciones?consulta=Temuco&precio_max=200000", api.publicacionValida, "abc.firma", false, true, async (path, options) => {
    calls.push({ path, options }); return ok({ items: [publication], siguiente_cursor: null });
  });
  assert.equal(result.exito, true);
  const params = new URL(calls[0].path, "https://example.invalid").searchParams;
  assert.deepEqual(Object.fromEntries(params), { consulta: "Temuco", precio_max: "200000", limite: "20", cursor: "abc.firma" });
  assert.equal(calls[0].options.autenticada, false);
  for (const body of [[publication], { items: [publication] }, { items: [publication], siguiente_cursor: "" }, { items: [{ ...publication, precio: "190000" }], siguiente_cursor: null }]) {
    assert.equal((await api.pagina("/api/publicaciones", api.publicacionValida, undefined, false, true, async () => ok(body))).codigo, "respuesta_invalida");
  }
});

test("historial usa antes y las listas privadas usan sesión", async () => {
  let called;
  const send = async (path, options) => { called = { path, options }; return ok({ items: [], siguiente_cursor: null }); };
  await api.pagina("/api/conversaciones/4/mensajes", api.mensajeValido, "cursor.firmado", true, false, send);
  assert.equal(called.path, "/api/conversaciones/4/mensajes?limite=20&antes=cursor.firmado");
  assert.equal(called.options.autenticada, true);
});

test("un error real no se transforma en éxito ni en una lista vacía", async () => {
  const failure = { exito: false, estadoHttp: 503, codigo: "servidor", error: "Dependencia no disponible" };
  assert.equal(await api.pagina("/api/reportes/mios", api.reporteValido, undefined, false, false, async () => failure), failure);
  assert.equal(await api.consultar("/api/reportes", api.reporteValido, { metodo: "POST", claveIdempotencia: "persistida" }, async (_path, options) => {
    assert.equal(options.claveIdempotencia, "persistida"); return failure;
  }), failure);
});

test("DTO de reporte requiere estado conocido e ID y fecha válidos", () => {
  const report = { id_reporte: 1, estado: "Pendiente", categoria: "Prueba", descripcion: "Seguimiento", fecha: "2026-11-27T03:00:00Z" };
  assert.equal(api.reporteValido(report), true);
  for (const change of [{ estado: "Enviado" }, { id_reporte: 0 }, { fecha: "sin fecha" }]) assert.equal(api.reporteValido({ ...report, ...change }), false);
  assert.equal(api.postulacionValida({ id_postulacion: 2, id_publicacion: 37, id_usuario: 16, estado: "Preseleccionada", fecha_postulacion: report.fecha }), true);
});

test("foto web usa multipart real y rechaza tipo/tamaño antes de enviar", async () => {
  const file = new File(["contenido de fixture"], "foto.png", { type: "image/png" });
  const photo = { uri: "blob:fixture", mimeType: "image/png", fileSize: file.size, fileName: file.name, file };
  let calls = 0;
  const result = await api.subirFoto(photo, async (path, options) => {
    calls++; assert.equal(path, "/api/usuarios/me/foto"); assert.equal(options.metodo, "PUT");
    assert.equal(options.cuerpo.get("foto").name, "foto.png");
    return ok({ foto_perfil: "https://storage.example.invalid/foto.png" });
  });
  assert.equal(result.exito, true);
  for (const change of [{ mimeType: "image/svg+xml" }, { fileSize: 5000001 }, { fileSize: 0 }]) {
    assert.equal((await api.subirFoto({ ...photo, ...change }, async () => { calls++; return ok({}); })).exito, false);
  }
  assert.equal(calls, 1);
});
