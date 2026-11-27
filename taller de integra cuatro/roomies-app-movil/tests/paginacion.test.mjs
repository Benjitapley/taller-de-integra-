import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function modulo(path) {
  const source = (await readFile(new URL(path, import.meta.url), "utf8"))
    .replace('"@/services/httpClient"', JSON.stringify("data:text/javascript,export const solicitarJson=()=>{throw Error('Falta transporte')};"));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { ListaPaginada } = await modulo("../src/services/listaPaginada.ts");
const { obtenerMisPostulaciones } = await modulo("../src/services/postulacionesService.ts");
const ok = (items, cursor = null) => ({ exito: true, datos: { items, siguiente_cursor: cursor }, estadoHttp: 200 });
const fila = id => ({ id_postulacion: id, id_publicacion: id, id_usuario: 2, estado: "Pendiente", fecha_postulacion: "2026-11-26T12:00:00Z" });

test("postulaciones solicita páginas al servidor y valida el sobre canónico", async () => {
  const result = await obtenerMisPostulaciones("cursor.firmado", async path => {
    assert.equal(path, "/api/postulaciones/mias?limite=20&cursor=cursor.firmado");
    return ok([fila(1)]);
  });
  assert.equal(result.datos.items[0].idPostulacion, 1);
  for (const datos of [[fila(1)], { items: [fila(1)] }, { items: [fila(1)], siguiente_cursor: "" }, { items: [{ ...fila(1), estado: "Inventado" }], siguiente_cursor: null }]) {
    assert.equal((await obtenerMisPostulaciones(undefined, async () => ({ exito: true, datos, estadoHttp: 200 }))).exito, false);
  }
});

test("tres páginas, fallo de red conserva avance, reintento, fin y doble carga", async () => {
  let calls = 0, fail = true;
  const lista = new ListaPaginada(async cursor => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    if (cursor === "20" && fail) { fail = false; throw Error("offline"); }
    const start = Number(cursor ?? 0), end = Math.min(start + 20, 53);
    return ok(Array.from({ length: end - start }, (_, i) => fila(start + i + 1)), end < 53 ? String(end) : null);
  }, item => item.id_postulacion);
  await Promise.all([lista.cargar(), lista.cargar()]);
  assert.equal(calls, 1);
  await lista.cargar();
  assert.equal(lista.estado().items.length, 20);
  assert.equal(lista.estado().cursor, "20");
  assert.equal(lista.estado().error.codigo, "red");
  await lista.cargar(); await lista.cargar(); await lista.cargar();
  assert.equal(calls, 4);
  assert.equal(lista.estado().items.length, 53);
  assert.equal(new Set(lista.estado().items.map(x => x.id_postulacion)).size, 53);
  assert.equal(lista.estado().cursor, null);
});

test("cambio de sesión/filtro ignora respuesta anterior y permite una petición nueva", async () => {
  let finish, count = 0;
  const lista = new ListaPaginada(() => ++count === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(ok([fila(99)])), item => item.id_postulacion);
  const old = lista.cargar();
  lista.reiniciar();
  await lista.cargar();
  finish(ok([fila(1)], "old")); await old;
  assert.deepEqual(lista.estado().items.map(x => x.id_postulacion), [99]);
  assert.equal(lista.estado().cursor, null);
});

test("revocación elimina filas; cursor repetido y errores recuperables conservan página", async () => {
  let result = ok([fila(1)], "next");
  const lista = new ListaPaginada(async () => result, item => item.id_postulacion);
  await lista.cargar(); await lista.cargar();
  assert.equal(lista.estado().error.codigo, "respuesta_invalida");
  assert.equal(lista.estado().items.length, 1);
  result = { exito: false, codigo: "sin_permiso", error: "Retirado", estadoHttp: 403 };
  await lista.cargar();
  assert.deepEqual(lista.estado().items, []);
  assert.equal(lista.estado().cursor, null);
});
