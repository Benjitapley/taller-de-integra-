import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function source(path) { return (await readFile(new URL(path, import.meta.url), "utf8")).replace('import "server-only";', ""); }
function compile(value) {
  const code = ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const gateway = compile(await source("../src/lib/auth/gateway.ts"));
const { handleTasks, handleTaskPatch } = await import(compile((await source("../src/lib/recorrido/tasks.ts"))
  .replace('"../auth/gateway"', JSON.stringify(gateway))));
const config = { origin: "https://web.example.org", backend: "https://api.example.org", secure: true };
const cookie = "__Host-haycupo_session=fixture.token.signed";
const headers = { cookie, origin: config.origin, "x-haycupo-csrf": "1", "Content-Type": "application/json" };
const task = { id_tarea: 17, id_arriendo: 4, titulo: "Aseo", descripcion: "Cocina", estado: "Pendiente",
  id_creador: 2, id_asignado: 2, fecha_creacion: "2026-11-24T12:00:00Z" };

test("BFF envía sesión y valida asignación y origen", async () => {
  const request = (body, extra = {}) => new Request(config.origin + "/web-api/arriendos/4/tareas", {
    method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body),
  });
  const input = { titulo: "Aseo", descripcion: "Cocina", id_asignado: 2 };
  const forbidden = await handleTasks(request(input, { origin: "https://other.example.org" }), "4", config, async () => { throw Error(); });
  assert.equal(forbidden.status, 403);
  assert.equal((await handleTasks(request({ ...input, id_asignado: -1 }), "4", config, async () => { throw Error(); })).status, 422);
  const saved = await handleTasks(request(input), "4", config, async (url, options) => {
    assert.equal(url, config.backend + "/api/arriendos/4/tareas");
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signed");
    assert.deepEqual(JSON.parse(options.body), input);
    return Response.json({ ...task, internal: "secret" }, { status: 201 });
  });
  assert.equal(saved.status, 201);
  assert.deepEqual(await saved.json(), task);
});

test("PATCH rechaza actor no asignado y fallo no inventa tarea completada", async () => {
  const request = new Request(config.origin + "/web-api/tareas/17/estado", {
    method: "PATCH", headers, body: JSON.stringify({ estado: "Completada" }),
  });
  const denied = await handleTaskPatch(request, "17", true, config, async () =>
    Response.json({ detail: "Solo asignado.", internal: "secret" }, { status: 403 }));
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { detail: "Solo asignado." });
  const failed = await handleTaskPatch(new Request(config.origin + "/web-api/tareas/17/estado", {
    method: "PATCH", headers, body: JSON.stringify({ estado: "Completada" }),
  }), "17", true, config, async () => Response.json({}, { status: 503 }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /Completada/);
});
