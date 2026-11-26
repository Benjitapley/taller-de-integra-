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
const { handleCreatePublication, handleSavePublication, handlePublicationRequest } = await import(moduleURL(source));
const { validatePublicationForm, publicationError } = await import(validation);
const { publicationPage, appendPublications, publicImageURL } = await import(moduleURL(await readFile(new URL("../src/features/publicaciones/contracts.ts", import.meta.url), "utf8")));

test("propias valida cursores, límites y páginas antes de devolver resultados", async () => {
  for (const query of ["cursor=a&cursor=b","limite=0","limite=101","limite=2&limite=3","cursor=%0A"]) {
    const response=await handlePublicationRequest(new Request(`${config.origin}/web-api/mis-publicaciones?${query}`,{headers:{cookie}}),"mine",undefined,config,async()=>{throw new Error("No debe acceder al backend");});
    assert.equal(response.status,422);
  }
  for (const payload of [{items:[{id_publicacion:1},{id_publicacion:1}],siguiente_cursor:null},{items:Array.from({length:21},(_,i)=>({id_publicacion:i+1})),siguiente_cursor:null},{items:[],siguiente_cursor:""}]) {
    const response=await handlePublicationRequest(new Request(`${config.origin}/web-api/mis-publicaciones`,{headers:{cookie}}),"mine",undefined,config,async()=>Response.json(payload));
    assert.equal(response.status,503);
  }
});
const config = { origin: "https://web.example.com", backend: "https://api.example.com", secure: true };
const cookie = "__Host-haycupo_session=header.payload.signature";

function validForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    titulo: "Habitación disponible",
    precio: "150000", tipo: "Arrendador", cupos_totales: "2",
    tipo_vivienda: "Habitacion", descripcion: "Descripción de prueba",
    mascota: "no", id_region: "9", id_comuna: "91101",
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
    return Response.json({ id_publicacion: 42, titulo: "Aviso canónico", precio: 150000, tipo: "Arrendador", cupos_totales: 2, cupos_disponibles: 2, imagenes: [], access_token: "private" }, { status: 201 });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id_publicacion: 42, titulo: "Aviso canónico", precio: 150000, tipo: "Arrendador", cupos_totales: 2, cupos_disponibles: 2, imagenes: [] });
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
  wrongImage.set("imagenes", new File(["contenido"], "foto.gif", { type: "image/gif" }));
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


test("editar usa identidad HttpOnly, destino fijo y validación completa", async () => {
  const edit = new Request(`${config.origin}/web-api/publicaciones/42`, {method:"PUT",headers:{cookie,Origin:config.origin,"X-Haycupo-CSRF":"1"},body:validForm()});
  const result = await handleSavePublication(edit,config,async(url,options)=>{
    assert.equal(url,`${config.backend}/api/publicaciones/42`);
    assert.equal(options.method,"PUT");
    assert.equal(options.body.get("tipo"),"Arrendador");
    return Response.json({id_publicacion:42,titulo:"Aviso canónico",precio:150000,tipo:"Arrendador",cupos_totales:2,cupos_disponibles:2,imagenes:[],access_token:"private"});
  },"42");
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{id_publicacion:42,titulo:"Aviso canónico",precio:150000,tipo:"Arrendador",cupos_totales:2,cupos_disponibles:2,imagenes:[]});
});

test("listado propio ignora propietario suministrado, filtra campos y no se almacena", async () => {
  const req=new Request(`${config.origin}/web-api/mis-publicaciones?id_usuario=999`,{headers:{cookie}});
  const result=await handlePublicationRequest(req,"mine",undefined,config,async(url,options)=>{
    assert.equal(url,`${config.backend}/api/publicaciones/mias`);
    assert.equal(options.headers.Authorization,"Bearer header.payload.signature");
    assert.equal(options.headers.Cookie,undefined);
    return Response.json({items:[{id_publicacion:42,titulo:"Propia",access_token:"secret",correo:"private@example.com"}],siguiente_cursor:null});
  });
  assert.deepEqual(await result.json(),{items:[{id_publicacion:42,titulo:"Propia"}],siguiente_cursor:null});
  assert.equal(result.headers.get("Cache-Control"),"no-store");
});

test("cierre bloquea CSRF e identificadores manipulados antes de contactar backend", async () => {
  const deny=()=>{throw new Error("no-network");};
  const req=new Request(`${config.origin}/web-api/publicaciones/42/cerrar`,{method:"PATCH",headers:{cookie}});
  assert.equal((await handlePublicationRequest(req,"close","42",config,deny)).status,403);
  assert.equal((await handlePublicationRequest(req,"close","../auth/login",config,deny)).status,400);
});

test("cierre preserva capacidad y limpia sesión solo ante 401, no ante 403", async () => {
  const req=()=>new Request(`${config.origin}/web-api/publicaciones/42/cerrar`,{method:"PATCH",headers:{cookie,Origin:config.origin,"X-Haycupo-CSRF":"1"}});
  const ok=await handlePublicationRequest(req(),"close","42",config,async(url,options)=>{
    assert.equal(url,`${config.backend}/api/publicaciones/42/cerrar`);
    assert.equal(options.method,"PATCH");
    return Response.json({id_publicacion:42,estado:"Cerrada",cupos_totales:4,cupos_disponibles:0});
  });
  assert.equal((await ok.json()).cupos_totales,4);
  for(const status of [401,403,404]) {
    const result=await handlePublicationRequest(req(),"close","42",config,async()=>Response.json({}, {status}));
    assert.equal(result.status,status);
    assert.equal(result.headers.has("Set-Cookie"),status===401);
  }
});

test("listado no presenta respuesta malformada ni errores internos como éxito", async () => {
  const req=new Request(`${config.origin}/web-api/mis-publicaciones`,{headers:{cookie}});
  for(const body of [{detail:"private"},[{access_token:"secret"}]]) {
    const result=await handlePublicationRequest(req,"mine",undefined,config,async()=>Response.json(body));
    assert.equal(result.status,503);
    assert.doesNotMatch(await result.text(),/private|secret/);
  }
});

test("precio CLP conserva extremos y rechaza fracciones, negativos y exceso", () => {
  for (const price of ["0", "999999999999"]) {
    const form = validForm(); form.set("precio", price);
    assert.equal(validatePublicationForm(form), null);
  }
  for (const price of ["-1", "1.5", "1000000000000", "1e3"]) {
    const form = validForm(); form.set("precio", price);
    assert.match(validatePublicationForm(form), /precio/);
  }
});

test("máximo de cinco imágenes incluye conservadas; límites decimales de bytes y tipos", () => {
  const form = validForm();
  form.set("imagenes_conservar", "[1,2,3,4]");
  form.append("imagenes", new File([new Uint8Array(5_000_000)], "foto.png", { type: "image/png" }));
  assert.equal(validatePublicationForm(form), null);
  form.append("imagenes", new File(["x"], "foto.webp", { type: "image/webp" }));
  assert.match(validatePublicationForm(form), /hasta 5/);
  form.set("imagenes_conservar", "[]");
  form.set("imagenes", new File([new Uint8Array(5_000_001)], "foto.png", { type: "image/png" }));
  assert.match(validatePublicationForm(form), /5000000/);
  form.set("imagenes", new File(["x"], "foto.gif", { type: "image/gif" }));
  assert.match(validatePublicationForm(form), /JPG/);
  form.delete("imagenes"); form.set("imagenes_conservar", "[1,1]");
  assert.match(validatePublicationForm(form), /conservadas/);
});

test("BFF admite cinco archivos de 5 MB y mantiene clave al reintentar", async () => {
  const key = "329f21d1-fb14-4ce7-84b5-041f7d227c77";
  for (let attempt = 0; attempt < 2; attempt++) {
    const form = validForm();
    for (let i = 0; i < 5; i++) form.append("imagenes", new File([new Uint8Array(5_000_000)], `foto${i}.png`, { type: "image/png" }));
    const result = await handleCreatePublication(request(form, { "Idempotency-Key": key }), config, async (_url, options) => {
      assert.equal(options.headers["Idempotency-Key"], key);
      assert.equal(options.body.getAll("imagenes").length, 5);
      return Response.json({ id_publicacion: 42 }, { status: 201 });
    });
    assert.equal(result.status, 201);
  }
});

test("crear y editar sin selección omiten el placeholder de archivo del navegador", async () => {
  for (const method of ["POST", "PUT"]) {
    const form = validForm();
    form.set("imagenes", new File([], "", { type: "application/octet-stream" }));
    form.set("imagenes_conservar", method === "PUT" ? "[3]" : "[]");
    const encoded = new Request(`${config.origin}/web-api/publicaciones${method === "PUT" ? "/42" : ""}`, { method, headers: { cookie, Origin: config.origin, "X-Haycupo-CSRF": "1" }, body: form });
    // Node omits filename="" when encoding empty Files; browsers send it explicitly.
    const browserBody = (await encoded.text()).replace('name="imagenes"\r\n', 'name="imagenes"; filename=""\r\n');
    const req = new Request(encoded.url, { method, headers: encoded.headers, body: browserBody });
    const response = await handleSavePublication(req, config, async (_url, options) => {
      assert.equal(options.body.has("imagenes"), false);
      assert.equal(options.body.get("imagenes_conservar"), method === "PUT" ? "[3]" : "[]");
      return Response.json({ id_publicacion: 42 }, { status: method === "POST" ? 201 : 200 });
    }, method === "PUT" ? "42" : undefined);
    assert.equal(response.status, method === "POST" ? 201 : 200);
  }
});

test("un archivo seleccionado vacío se rechaza y no se confunde con falta de selección", async () => {
  const form = validForm();
  form.set("imagenes", new File([], "foto.png", { type: "image/png" }));
  assert.match(validatePublicationForm(form), /vacía/);
  const response = await handleCreatePublication(request(form), config, () => { throw new Error("no-network"); });
  assert.equal(response.status, 422);
});

test("editar solo confirma DTO canónico del mismo aviso", async () => {
  for (const body of [{ mensaje: "ok" }, { id_publicacion: 99 }]) {
    const edit = new Request(`${config.origin}/web-api/publicaciones/42`, { method: "PUT", headers: { cookie, Origin: config.origin, "X-Haycupo-CSRF": "1" }, body: validForm() });
    assert.equal((await handleSavePublication(edit, config, async () => Response.json(body), "42")).status, 503);
  }
});

test("propias transmite cursor y límite sin aceptar otra identidad", async () => {
  const req = new Request(`${config.origin}/web-api/mis-publicaciones?cursor=abc%2B123&limite=2&id_usuario=999`, { headers: { cookie } });
  const response = await handlePublicationRequest(req, "mine", undefined, config, async url => {
    assert.equal(url, `${config.backend}/api/publicaciones/mias?limite=2&cursor=abc%2B123`);
    return Response.json({ items: [], siguiente_cursor: "next" });
  });
  assert.deepEqual(await response.json(), { items: [], siguiente_cursor: "next" });
});

test("adaptador recorre tres páginas sin duplicar avisos y conserva ocupación desconocida", () => {
  const item = id => ({ id_publicacion: id, titulo: "Aviso", precio: 999999999999, cupos_disponibles: null, imagenes: [{ id_imagen: id, url: `https://example.supabase.co/storage/v1/object/public/publicaciones/${id}.png`, orden: 0 }] });
  let rows = [];
  for (const [ids, cursor] of [[[5,4], "a"], [[4,3,2], "b"], [[2,1], null]]) {
    const page = publicationPage({ items: ids.map(item), siguiente_cursor: cursor });
    rows = appendPublications(rows, page.items);
    assert.equal(page.siguiente_cursor, cursor);
  }
  assert.deepEqual(rows.map(row => row.id_publicacion), [5,4,3,2,1]);
  assert.equal(rows[0].cupos_disponibles, null);
  assert.equal(rows[0].precio, 999999999999);
  for (const url of ["data:image/png,a", "blob:local", "file:///photo.png", "https://user:secret@example.com/a"]) assert.equal(publicImageURL(url), null);
  assert.throws(() => publicationPage([item(1)]));
});


test("BFF conserva el DTO canónico y filtra los campos privados anidados", async () => {
  const form = validForm();
  form.delete("ubicacion");
  form.delete("categoria");
  form.delete("mascota");
  form.set("reglas_arrendador", '["Sin humo"]');
  const result = await handleCreatePublication(request(form), config, async (_, options) => {
    assert.equal(options.body.get("reglas_arrendador"), '["Sin humo"]');
    return Response.json({
      id_publicacion: 42, fecha_publicacion: "2026-11-24T18:00:00Z",
      region: { id: 9, nombre: "La Araucanía", private: "discard" },
      comuna: { id: 9101, nombre: "Temuco" },
      autor: { id_usuario: 52, nombre: "Autora", foto: null, correo: "discard" },
    }, { status: 201 });
  });
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), {
    id_publicacion: 42, fecha_publicacion: "2026-11-24T18:00:00Z",
    region: { id: 9, nombre: "La Araucanía" },
    comuna: { id: 9101, nombre: "Temuco" },
    autor: { id_usuario: 52, nombre: "Autora", foto: null },
  });
  form.set("reglas_arrendador", JSON.stringify(["x".repeat(301)]));
  assert.equal((await handleCreatePublication(request(form), config, () => assert.fail("No se debe llamar a Listado"))).status, 422);
});

test("Mis publicaciones conserva filtro de estado y cursor", async () => {
  const req = params => new Request(config.origin + "/web-api/mis-publicaciones?" + params, { headers: { cookie } });
  const result = await handlePublicationRequest(req("estado=Cerrada&cursor=siguiente"), "mine", undefined, config, async url => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("estado"), "Cerrada");
    assert.equal(query.get("cursor"), "siguiente");
    return Response.json({ items: [{ id_publicacion: 42, estado: "Cerrada", id_arriendo: 10 }], siguiente_cursor: null });
  });
  assert.deepEqual((await result.json()).items, [{ id_publicacion: 42, estado: "Cerrada", id_arriendo: 10 }]);
  for (const params of ["estado=archivada", "estado=Cerrada&estado=Activa"]) {
    assert.equal((await handlePublicationRequest(req(params), "mine", undefined, config, () => assert.fail("No se debe llamar a Listado"))).status, 422);
  }
});


test("errores canónicos conservan código, mensaje y detalles en crear, editar, leer y cerrar", async () => {
  for (const [status, codigo] of [[401, "no_autenticado"], [403, "correo_no_verificado"], [403, "sin_permiso"],
    [409, "estado_invalido"], [409, "configuracion_bloqueada"], [409, "sin_cupos"], [409, "publicacion_cerrada"],
    [413, "archivo_muy_grande"], [415, "tipo_archivo_no_permitido"], [422, "validacion"], [503, "dependencia_no_disponible"]]) {
    const body = { codigo, mensaje: `Mensaje ${codigo}`, ...(status === 422 ? { detalles: [{ campo: "id_comuna", mensaje: "No pertenece a la región." }] } : {}) };
    const upstream = async () => Response.json({ ...body, private: "discard" }, { status });
    const create = await handleCreatePublication(request(), config, upstream);
    assert.equal(create.status, status);
    assert.deepEqual(await create.json(), body);
    assert.equal(create.headers.has("Set-Cookie"), status === 401);
    const editRequest = new Request(`${config.origin}/web-api/publicaciones/42`, { method: "PUT", body: validForm(), headers: { cookie, Origin: config.origin, "X-Haycupo-CSRF": "1" } });
    assert.deepEqual(await (await handleSavePublication(editRequest, config, upstream, "42")).json(), body);
    for (const operation of ["edit", "close", "mine"]) {
      const req = new Request(`${config.origin}/web-api/publicaciones/42`, { method: operation === "close" ? "PATCH" : "GET", headers: { cookie, Origin: config.origin, "X-Haycupo-CSRF": "1" } });
      assert.deepEqual(await (await handlePublicationRequest(req, operation, "42", config, upstream)).json(), body);
    }
  }
  assert.equal(publicationError(409, { codigo: "configuracion_bloqueada" }).mensaje, "Las reglas solo se pueden editar mientras el aviso esté Disponible.");
  assert.deepEqual(publicationError(422, { codigo: "validacion", mensaje: "Revisa", detalles: [{ campo: "precio", mensaje: "Entero" }, { campo: "bad token", mensaje: "discard" }, null] }), { codigo: "validacion", mensaje: "Revisa", detalles: [{ campo: "precio", mensaje: "Entero" }] });
});

test("multipart de edición conserva archivos, IDs y boundary generado por el transporte", async () => {
  const form = validForm();
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10]);
  form.set("imagenes_conservar", "[12,15]");
  form.append("imagenes", new File([bytes], "nueva.png", { type: "image/png" }));
  const req = new Request(`${config.origin}/web-api/publicaciones/42`, { method: "PUT", body: form, headers: { cookie, Origin: config.origin, "X-Haycupo-CSRF": "1" } });
  const response = await handleSavePublication(req, config, async (url, options) => {
    assert.equal(new Headers(options.headers).has("Content-Type"), false);
    const wire = new Request(url, options);
    assert.match(wire.headers.get("Content-Type"), /^multipart\/form-data; boundary=/);
    const received = await wire.formData();
    assert.equal(received.get("imagenes_conservar"), "[12,15]");
    assert.equal(received.get("tipo_vivienda"), "Habitacion");
    assert.deepEqual(new Uint8Array(await received.get("imagenes").arrayBuffer()), bytes);
    return Response.json({ id_publicacion: 42, imagenes: [{ id_imagen: 12, url: "https://images.example.test/12.png" }] });
  }, "42");
  assert.equal(response.status, 200);
});

test("solo se envían campos y enumeraciones del contrato Sprint 3 v2", () => {
  for (const field of ["categoria", "ubicacion", "permitir_comentarios", "cupos_min", "cupos_disponibles", "ids_atributos_evaluables"]) {
    const form = validForm(); form.set(field, "1");
    assert.match(validatePublicationForm(form), /no permitidos/);
  }
  const form = validForm(); form.set("tipo", "Compartida");
  assert.match(validatePublicationForm(form), /arrendador/);
  form.set("tipo", "Arrendador"); form.set("tipo_vivienda", "habitacion");
  assert.match(validatePublicationForm(form), /vivienda/);
});
