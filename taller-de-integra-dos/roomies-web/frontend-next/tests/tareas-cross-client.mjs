/** Driver E04: BFF y adaptador móvil reales, HTTP loopback, identidad ficticia.
 * Lo ejecuta test_tareas_cross_client.py dentro de PostgreSQL desechable.
 * No inicia Expo ni acredita una prueba en dispositivo físico.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const backend = process.env.E04_TEST_GATEWAY;
assert.match(backend ?? "", /^http:\/\/127\.0\.0\.1:\d+$/);
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString("base64")}`;
const source = async path => (await readFile(new URL(path, import.meta.url), "utf8")).replace('import "server-only";', "");
const gateway = compile(await source("../src/lib/auth/gateway.ts"));
const { handleTasks, handleTaskPatch, handleTaskMembers } = await import(compile(
  (await source("../src/lib/recorrido/tasks.ts")).replace('"../auth/gateway"', JSON.stringify(gateway))));
const mobileSource = await source("../../../../taller de integra cuatro/roomies-app-movil/src/services/tareasService.ts");
const { obtenerArriendoActual, listarTareas, completarTarea } = await import(compile(mobileSource.replace(
  '"@/services/httpClient"', JSON.stringify("data:text/javascript,export const solicitarJson=()=>{throw Error('Inyectar transporte local')};"))));

const config = { origin: "https://web.example.org", backend, secure: true };
const request = (path, method = "GET", body, actor = 2) => new Request(config.origin + path, {
  method, headers: { cookie: `__Host-haycupo_session=e04.actor-${actor}.fixture`, origin: config.origin,
    "x-haycupo-csrf": "1", "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const mobile = actor => async (path, options = {}) => {
  const response = await fetch(backend + path, { method: options.metodo ?? "GET", redirect: "error",
    signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer e04.actor-${actor}.fixture`,
      "Content-Type": "application/json" },
    ...(options.cuerpo === undefined ? {} : { body: JSON.stringify(options.cuerpo) }),
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const datos = await response.json();
  return response.ok ? { exito: true, datos, estadoHttp: response.status }
    : { exito: false, codigo: "http", error: datos.detail, estadoHttp: response.status };
};
const rental = await obtenerArriendoActual(mobile(2));
assert.equal(rental.exito, true);
const id = String(rental.datos);
const path = `/web-api/arriendos/${id}/tareas`;
const create = async (titulo, assignee) => {
  const response = await handleTasks(request(path, "POST", { titulo, descripcion: "Cocina", id_asignado: assignee }), id, config);
  assert.equal(response.status, 201);
  return response.json();
};
const listWeb = async (state, cursor) => {
  const params = new URLSearchParams({ estado: state });
  if (cursor) params.set("cursor", cursor);
  const response = await handleTasks(request(`${path}?${params}`), id, config);
  assert.equal(response.status, 200);
  return response.json();
};
const patch = (task, assignee, transport) => handleTaskPatch(request(`/web-api/tareas/${task}`, "PATCH", { id_asignado: assignee }), String(task), false, config, transport);

if (process.env.E04_TEST_RETIRED_TASK) {
  const taskId = Number(process.env.E04_TEST_RETIRED_TASK);
  assert.equal((await listarTareas(Number(id), "Pendiente", undefined, mobile(3))).estadoHttp, 403);
  assert.equal((await completarTarea(taskId, mobile(3))).estadoHttp, 403);
  let pending = await listWeb("Pendiente");
  const items = [...pending.items];
  while (pending.siguiente_cursor) {
    pending = await listWeb("Pendiente", pending.siguiente_cursor);
    items.push(...pending.items);
  }
  assert.equal(items.find(row => row.id_tarea === taskId).id_asignado, null);
  assert.equal((await patch(taskId, 3)).status, 422);
  const members = await handleTaskMembers(request(`/web-api/arriendos/${id}/tareas-integrantes`), id, config);
  assert.deepEqual((await members.json()).items.map(row => row.id_usuario), [2]);
  assert.equal((await patch(taskId, 2)).status, 200);
  console.log(JSON.stringify({ retired403: true, unassigned: true, reassigned: true }));
} else {
  const task = await create("E04 cruzada", null);
  assert.equal((await patch(task.id_tarea, 3)).status, 200);
  const pending = await listarTareas(Number(id), "Pendiente", undefined, mobile(3));
  assert.equal(pending.exito, true);
  assert.equal(pending.datos.items.find(row => row.id_tarea === task.id_tarea).id_asignado, 3);
  assert.equal((await completarTarea(task.id_tarea, mobile(2))).estadoHttp, 403);
  assert.equal((await patch(task.id_tarea, 99)).status, 422);
  // Fallo antes de escribir: no inventar confirmación ni modificar la tarea.
  const failed = await handleTaskPatch(request(`/web-api/tareas/${task.id_tarea}/estado`, "PATCH", { estado: "Completada" }, 3),
    String(task.id_tarea), true, config, async () => { throw new Error("Fallo de red ficticio"); });
  assert.equal(failed.status, 503);
  assert.equal((await listWeb("Pendiente")).items.find(row => row.id_tarea === task.id_tarea).estado, "Pendiente");
  assert.equal((await completarTarea(task.id_tarea, mobile(3))).datos.estado, "Completada");
  assert.equal((await listWeb("Completada")).items.find(row => row.id_tarea === task.id_tarea).estado, "Completada");
  const toRetire = await create("E04 retiro", 3);
  for (let index = 0; index < 21; index++) await create(`E04 página ${index}`, null);
  const first = await listWeb("Pendiente");
  assert.equal(first.items.length, 20);
  assert.ok(first.siguiente_cursor);
  const second = await listarTareas(Number(id), "Pendiente", first.siguiente_cursor, mobile(2));
  assert.equal(second.exito, true);
  assert.equal(second.datos.items.length, 2);
  assert.equal(new Set([...first.items, ...second.datos.items].map(row => row.id_tarea)).size, 22);
  assert.equal((await listarTareas(Number(id), "Completada", first.siguiente_cursor, mobile(2))).estadoHttp, 422);
  assert.equal((await listarTareas(Number(id), "Pendiente", first.siguiente_cursor, mobile(3))).estadoHttp, 422);
  console.log(JSON.stringify({ completed: task.id_tarea, pending: toRetire.id_tarea, paginated: 22 }));
}
