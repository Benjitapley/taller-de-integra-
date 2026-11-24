import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/services/tareasService.ts", import.meta.url), "utf8");
const stub = "data:text/javascript,export const solicitarJson = () => { throw Error('Transporte no inyectado'); };";
const code = ts.transpileModule(source.replace('"@/services/httpClient"', JSON.stringify(stub)), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { obtenerArriendoActual, listarTareas, completarTarea } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const task = { id_tarea: 17, id_arriendo: 4, titulo: "Aseo", descripcion: "Cocina", estado: "Pendiente",
  id_creador: 2, id_asignado: 2, fecha_creacion: "2026-11-24T12:00:00Z" };

test("móvil consulta el contrato de tareas y envía el PATCH de completado", async () => {
  assert.deepEqual(await obtenerArriendoActual(async ruta => {
    assert.equal(ruta, "/api/arriendos/mio");
    return { exito: true, datos: { id_arriendo: 4 }, estadoHttp: 200 };
  }), { exito: true, datos: 4, estadoHttp: 200 });
  const page = await listarTareas(4, "Pendiente", undefined, async ruta => {
    assert.equal(ruta, "/api/arriendos/4/tareas?estado=Pendiente&limite=20");
    return { exito: true, datos: { items: [task], siguiente_cursor: null, id_usuario_actual: 2 }, estadoHttp: 200 };
  });
  assert.equal(page.exito, true);
  assert.equal(page.datos.items[0].id_tarea, 17);
  const result = await completarTarea(17, async (ruta, opciones) => {
    assert.equal(ruta, "/api/tareas/17/estado");
    assert.deepEqual(opciones, { metodo: "PATCH", cuerpo: { estado: "Completada" } });
    return { exito: true, datos: { ...task, estado: "Completada" }, estadoHttp: 200 };
  });
  assert.equal(result.exito, true);
});

test("fallo de PATCH y respuestas inválidas no se muestran como completadas", async () => {
  const denied = await completarTarea(17, async () => ({ exito: false, codigo: "sin_permiso", error: "No permitido", estadoHttp: 403 }));
  assert.equal(denied.exito, false);
  assert.equal(denied.estadoHttp, 403);
  const invalid = await completarTarea(17, async () => ({ exito: true, datos: { ...task, estado: "Pendiente" }, estadoHttp: 200 }));
  assert.equal(invalid.exito, false);
  const badPage = await listarTareas(4, "Pendiente", undefined, async () =>
    ({ exito: true, datos: { items: [{ ...task, id_asignado: "2" }], siguiente_cursor: null, id_usuario_actual: 2 }, estadoHttp: 200 }));
  assert.equal(badPage.exito, false);
});
