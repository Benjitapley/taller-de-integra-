import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CREDENTIALS, startDemoApi } from "../scripts/demo-api.mjs";

const jsonHeaders = { "Content-Type": "application/json" };
async function login(api, credentials = DEMO_CREDENTIALS) {
  return fetch(`${api.origin}/auth/login`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(credentials) });
}
async function authorized(api) {
  const response = await login(api);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.token_type, "bearer");
  return { Authorization: `Bearer ${body.access_token}` };
}
function publicationForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ titulo: "Nuevo aviso demo", ubicacion: "Temuco", descripcion: "Una publicación de prueba local.", tipo: "Arrendador", tipo_vivienda: "habitacion", precio: "150000", cupos_totales: "2", id_region: "9", id_comuna: "91", mascota: "no" })) form.set(key, value);
  return form;
}

test("la API demo rechaza producción y usa únicamente loopback", async t => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await assert.rejects(startDemoApi(), /desarrollo local/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
  const api = await startDemoApi();
  t.after(api.close);
  assert.match(api.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal((await fetch(`${api.origin}/api/publicaciones`)).status, 200);
});

test("login valida credenciales, emite sesiones independientes y logout las revoca", async t => {
  const api = await startDemoApi();
  t.after(api.close);
  assert.equal((await login(api, { ...DEMO_CREDENTIALS, contrasena: "incorrecta" })).status, 401);
  assert.equal((await login(api, { correo: "camila@haycupo.test" })).status, 401);
  assert.equal((await login(api, { ...DEMO_CREDENTIALS, contrasena: "a".repeat(17000) })).status, 413);
  assert.equal((await fetch(`${api.origin}/api/perfil`)).status, 401);
  const first = await authorized(api), second = await authorized(api);
  assert.notEqual(first.Authorization, second.Authorization);
  assert.equal((await fetch(`${api.origin}/api/perfil`, { headers: first })).status, 200);
  assert.equal((await fetch(`${api.origin}/auth/logout`, { method: "POST", headers: first })).status, 200);
  assert.equal((await fetch(`${api.origin}/api/perfil`, { headers: first })).status, 401);
  assert.equal((await fetch(`${api.origin}/api/perfil`, { headers: second })).status, 200);
  assert.equal((await fetch(`${api.origin}/api/funcion-inexistente`, { headers: second })).status, 404);
});

test("los cambios e imágenes viven en memoria y cada inicio conserva su propio estado", async t => {
  const first = await startDemoApi(), second = await startDemoApi();
  t.after(first.close); t.after(second.close);
  const firstHeaders = await authorized(first), secondHeaders = await authorized(second);
  const profile = new FormData();
  for (const [key, value] of Object.entries({ edad: "26", ocupacion: "Trabajador", ciudad: "Ciudad de prueba", breve_descripcion: "Perfil actualizado", sobre_mi: "Datos ficticios" })) profile.set(key, value);
  const image = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082", "hex");
  profile.set("foto", new Blob([image], { type: "image/png" }), "foto.png");
  assert.equal((await fetch(`${first.origin}/api/perfil`, { method: "PUT", headers: firstHeaders, body: profile })).status, 200);
  const saved = await (await fetch(`${first.origin}/api/perfil`, { headers: firstHeaders })).json();
  const untouched = await (await fetch(`${second.origin}/api/perfil`, { headers: secondHeaders })).json();
  assert.equal(saved.ciudad, "Ciudad de prueba");
  assert.equal(untouched.ciudad, "Temuco");
  assert.equal(saved.correo, undefined); assert.equal(saved.contrasena, undefined);
  const photo = await fetch(first.origin + saved.foto_perfil);
  assert.equal(photo.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), image);
  assert.equal((await fetch(second.origin + saved.foto_perfil)).status, 404);

  const created = await fetch(`${first.origin}/api/publicaciones`, { method: "POST", headers: firstHeaders, body: publicationForm() });
  assert.equal(created.status, 201);
  const publication = await created.json();
  assert.equal(publication.owner, undefined);
  assert.equal((await (await fetch(`${first.origin}/api/publicaciones`)).json()).items.length, 4);
  assert.equal((await (await fetch(`${second.origin}/api/publicaciones`)).json()).items.length, 3);
  assert.equal((await fetch(`${first.origin}/api/publicaciones/2/cerrar`, { method: "PATCH", headers: firstHeaders })).status, 403);
  assert.equal((await fetch(`${first.origin}/api/publicaciones/${publication.id_publicacion}/cerrar`, { method: "PATCH", headers: firstHeaders })).status, 200);
});

test("postulaciones y conexiones conservan las decisiones y rechazan duplicados", async t => {
  const api = await startDemoApi();
  t.after(api.close);
  const headers = { ...(await authorized(api)), ...jsonHeaders };
  const people = await (await fetch(`${api.origin}/conexiones/usuarios/otros?ocupacion=Ambos`, { headers })).json();
  assert.deepEqual(people.map(person => person.id_usuario_PK), [4]);
  assert.equal((await fetch(`${api.origin}/conexiones/`, { method: "POST", headers, body: JSON.stringify({ id_receptor_FK: 4 }) })).status, 201);
  assert.equal((await fetch(`${api.origin}/conexiones/`, { method: "POST", headers, body: JSON.stringify({ id_receptor_FK: 4 }) })).status, 409);
  const accepted = await fetch(`${api.origin}/conexiones/1`, { method: "PUT", headers, body: JSON.stringify({ estado: "Aceptada" }) });
  assert.equal((await accepted.json()).estado, "Aceptada");
  const applied = await fetch(`${api.origin}/api/publicaciones/3/postulaciones`, { method: "POST", headers });
  assert.equal(applied.status, 201);
  assert.equal((await fetch(`${api.origin}/api/publicaciones/3/postulaciones`, { method: "POST", headers })).status, 409);
  assert.equal((await fetch(`${api.origin}/api/postulaciones/1/estado`, { method: "PATCH", headers, body: JSON.stringify({ estado: "Preseleccionada" }) })).status, 200);
  const decision = await fetch(`${api.origin}/api/postulaciones/1/estado`, { method: "PATCH", headers, body: JSON.stringify({ estado: "Aceptada" }) });
  assert.equal((await decision.json()).incorporacion_pendiente, true);
});

test("registro y verificación solo crean cuentas efímeras con el código demo", async t => {
  const api = await startDemoApi();
  t.after(api.close);
  const account = { correo: "nuevo@haycupo.test", contrasena: "CuentaDemo123!", nombre: "Cuenta nueva", fecha_nacimiento: "2000-01-01" };
  const post = (path, input) => fetch(api.origin + path, { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) });
  assert.equal((await post("/auth/registro", account)).status, 200);
  assert.equal((await login(api, account)).status, 403);
  assert.equal((await post("/auth/reenviar-codigo", { correo: account.correo })).status, 200);
  assert.equal((await post("/auth/verificar", { correo: account.correo, codigo: "000000" })).status, 400);
  assert.equal((await post("/auth/verificar", { correo: account.correo, codigo: "123456" })).status, 200);
  assert.equal((await login(api, account)).status, 200);
});
