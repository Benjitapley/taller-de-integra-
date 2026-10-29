import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleURL = (source) => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`;
const gateway = (await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8")).replace('import "server-only";', "");
const validation = moduleURL(await readFile(new URL("../src/features/publicaciones/validation.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/publicaciones/server.ts", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('"../auth/gateway"', JSON.stringify(moduleURL(gateway)))
  .replace('"../../features/publicaciones/validation"', JSON.stringify(validation));
const { handleCreatePublication } = await import(moduleURL(source));
const config = { origin: "https://web.example.com", backend: "https://api.example.com", secure: true };
const cookie = "__Host-haycupo_session=header.payload.signature";

function validForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    titulo: "Habitación disponible", categoria: "ofrezco", ubicacion: "Centro",
    precio: "150000", tipo: "Arrendador", cupos_totales: "2",
    tipo_vivienda: "habitacion", descripcion: "Descripción de prueba",
    mascota: "no", permitir_comentarios: "false",
  })) form.set(key, value);
  return form;
}

function request(form = validForm(), headers = {}, session = cookie) {
  return new Request(`${config.origin}/web-api/publicaciones?owner=999`, {
    method: "POST",
    headers: { cookie: session, Origin: config.origin, "X-Haycupo-CSRF": "1", ...headers },
    body: form,
  });
}

test("crear publicación envía multipart al destino fijo con JWT y devuelve solo el resultado público", async () => {
  const response = await handleCreatePublication(request(), config, async (url, options) => {
    assert.equal(url, `${config.backend}/api/publicaciones`);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer header.payload.signature");
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.body.get("titulo"), "Habitación disponible");
    assert.equal(options.body.get("tipo"), "Arrendador");
    assert.equal(options.redirect, "error");
    return Response.json({ id: 42, mensaje: "Publicación creada", access_token: "private" }, { status: 201 });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: 42, mensaje: "Publicación creada" });
});

test("cookie ausente o CSRF inválido bloquean la petición sin contactar FastAPI", async () => {
  const noNetwork = () => { throw new Error("backend no debe ser contactado"); };
  const missing = await handleCreatePublication(request(validForm(), {}, ""), config, noNetwork);
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get("Set-Cookie"), /Max-Age=0; Secure/);
  const csrf = await handleCreatePublication(request(validForm(), { Origin: "https://other.example.com" }), config, noNetwork);
  assert.equal(csrf.status, 403);
});

test("campos desconocidos, campos repetidos y fotografía inválida se rechazan localmente", async () => {
  const extra = validForm();
  extra.set("id_usuario", "999");
  assert.equal((await handleCreatePublication(request(extra), config, () => { throw new Error("no-network"); })).status, 422);
  const repeated = validForm();
  repeated.append("titulo", "Otro título");
  assert.equal((await handleCreatePublication(request(repeated), config, () => { throw new Error("no-network"); })).status, 422);
  const wrongImage = validForm();
  wrongImage.set("imagen", new File(["contenido"], "foto.gif", { type: "image/gif" }));
  assert.equal((await handleCreatePublication(request(wrongImage), config, () => { throw new Error("no-network"); })).status, 422);
});

test("sesión expirada upstream limpia cookie y fallas de red no se presentan como éxito", async () => {
  const expired = await handleCreatePublication(request(), config, async () => Response.json({}, { status: 401 }));
  assert.equal(expired.status, 401);
  assert.match(expired.headers.get("Set-Cookie"), /Max-Age=0/);
  const unavailable = await handleCreatePublication(request(), config, async () => { throw new Error("network-secret"); });
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /network-secret/);
});
