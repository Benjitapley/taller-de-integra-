import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const gateway = (await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8")).replace('import "server-only";', "");
const source = (await readFile(new URL("../src/lib/arriendos/server.ts", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('"../auth/gateway"', JSON.stringify(moduleURL(gateway)));
const { handleMyRental, handleMembers, handleRentalById, handleOwnerRental, handleExpulsion } = await import(moduleURL(source));

const config = { origin: "https://web.test", backend: "https://gateway.test", secure: true };
const cookie = "__Host-haycupo_session=header.payload.signature";
const headers = { cookie, Origin: config.origin, "X-Haycupo-CSRF": "1" };

test("Mi arriendo y integrantes usan rutas privadas fijas y no filtran campos", async () => {
  const rental = await handleMyRental(new Request(config.origin + "/web-api/arriendos/mio", { headers: { cookie } }), config, async url => {
    assert.equal(url, config.backend + "/api/arriendos/mio");
    return Response.json({ id_arriendo: 12, id_publicacion: 7, cupos_totales: 3, ocupacion: 2, access_token: "private" });
  });
  assert.equal(rental.status, 200);
  assert.deepEqual(await rental.json(), { id_arriendo: 12, id_publicacion: 7, cupos_totales: 3, ocupacion: 2, access_token: "private" });

  const members = await handleMembers(new Request(config.origin + "/web-api/arriendos/12/integrantes", { headers: { cookie } }), "12", config, async url => {
    assert.equal(url, config.backend + "/api/arriendos/12/integrantes?activos=true&limite=20");
    return Response.json({ items: [{ id_usuario: 2, fecha_ingreso: "2026-11-20T00:00:00Z", es_responsable: true }], siguiente_cursor: null });
  });
  assert.equal(members.status, 200);
});

test("integrantes 503 y páginas inválidas nunca se convierten en listas vacías", async () => {
  const request = new Request(config.origin + "/web-api/arriendos/12/integrantes?limite=20", { headers: { cookie } });
  assert.equal((await handleMembers(request, "12", config, async () => Response.json({ detail: "down" }, { status: 503 }))).status, 503);
  assert.equal((await handleMembers(request, "12", config, async () => Response.json({ items: [] }))).status, 503);
});

test("el BFF deniega URL de arriendo ajeno y conserva indisponibilidad", async () => {
  const request = new Request(config.origin + "/web-api/arriendos/12", { headers: { cookie } });
  assert.equal((await handleRentalById(request, "12", config, async url => {
    assert.equal(url, config.backend + "/api/arriendos/12");
    return Response.json({ detail: "denied" }, { status: 403 });
  })).status, 403);
  assert.equal((await handleRentalById(request, "12", config, async () => Response.json({ detail: "down" }, { status: 503 }))).status, 503);
  assert.equal((await handleOwnerRental(new Request(config.origin + "/web-api/arriendos/por-publicacion/7", { headers: { cookie } }), "7", config,
    async () => Response.json({ id_arriendo: 12, id_publicacion: 7, cupos_totales: 3, version_capacidad: 1, ocupacion: 2, es_dueno: true }))).status, 200);
});

test("retiro exige sesión, CSRF, motivo, confirmación e identificador válido", async () => {
  const noNetwork = () => { throw new Error("no network"); };
  assert.equal((await handleExpulsion(new Request(config.origin + "/web-api/arriendos/12/expulsiones", {
    method: "POST", headers: { ...headers, cookie: "" }, body: JSON.stringify({ id_usuario: 3, motivo: "Incumple", confirmo: true }),
  }), "12", config, noNetwork)).status, 401);

  const csrf = new Request(config.origin + "/web-api/arriendos/12/expulsiones", {
    method: "POST", headers: { ...headers, Origin: "https://evil.test" }, body: JSON.stringify({ id_usuario: 3, motivo: "Incumple", confirmo: true }),
  });
  assert.equal((await handleExpulsion(csrf, "12", config, noNetwork)).status, 403);

  const invalid = new Request(config.origin + "/web-api/arriendos/12/expulsiones", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ id_usuario: 3, motivo: "", confirmo: true }),
  });
  assert.equal((await handleExpulsion(invalid, "12", config, noNetwork)).status, 422);
});

test("retiro envía solo los campos del contrato y conserva errores upstream", async () => {
  const request = new Request(config.origin + "/web-api/arriendos/12/expulsiones", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id_usuario: 3, motivo: "Incumplimiento repetido", confirmo: true, id_publicacion: 99 }),
  });
  assert.equal((await handleExpulsion(request, "12", config, async () => Response.json({ detail: "secret" }, { status: 422 }))).status, 422);
});
