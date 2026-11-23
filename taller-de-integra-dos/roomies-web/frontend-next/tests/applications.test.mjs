import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source.replace('import "server-only";', ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const gateway = compile(await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/publicaciones/applications.ts", import.meta.url), "utf8")).replace('"../auth/gateway"', JSON.stringify(gateway));
const { handleApplications } = await import(compile(source));
const config = { origin: "https://web.test", backend: "https://gateway.test", secure: true };
const headers = { cookie: "__Host-haycupo_session=fixture.claims.signature", origin: config.origin, "content-type": "application/json", "x-haycupo-csrf": "1" };
const req = (method, body, changes = {}) => new Request(config.origin + "/web-api/postulaciones", { method, headers: { ...headers, ...changes }, ...(body ? { body: JSON.stringify(body) } : {}) });
const row = { id_postulacion: 8, id_publicacion: 7, id_usuario: 2, estado: "Pendiente" };
test("postular deriva identidad de cookie y usa ruta fija sin aceptar IDs de usuario", async () => {
  const response = await handleApplications(req("POST", { publicacion: 7 }), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/publicaciones/7/postulaciones");
    assert.equal(options.headers.Authorization, "Bearer fixture.claims.signature");
    assert.equal(options.body, undefined);
    return Response.json({ ...row, access_token: "private" }, { status: 201 });
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), row);
  assert.equal((await handleApplications(req("POST", { publicacion: 7, id_usuario: 9 }), config, () => { throw Error(); })).status, 422);
});
test("sin cookie, CSRF o ante consultas manipuladas no contacta backend", async () => {
  const transport = () => { throw Error("forbidden"); };
  assert.equal((await handleApplications(req("POST", { publicacion: 7 }, { cookie: "" }), config, transport)).status, 401);
  assert.equal((await handleApplications(req("POST", { publicacion: 7 }, { origin: "https://evil.test" }), config, transport)).status, 403);
  assert.equal((await handleApplications(new Request(config.origin + "/?publicacion=7&publicacion=8", { headers }), config, transport)).status, 422);
});
test("decisión conserva estados y motivo; campos administrativos se rechazan", async () => {
  const response = await handleApplications(req("PATCH", { id: 8, estado: "Rechazada", motivo: "Otra alternativa" }), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/postulaciones/8/estado");
    assert.deepEqual(JSON.parse(options.body), { estado: "Rechazada", motivo: "Otra alternativa" });
    return Response.json({ ...row, estado: "Rechazada", motivo: "Otra alternativa" });
  });
  assert.equal(response.status, 200);
  assert.equal((await handleApplications(req("PATCH", { id: 8, estado: "Aceptada", admin: true }), config, () => { throw Error(); })).status, 422);
});
test("errores de autorización se conservan sin detalles internos ni éxito ficticio", async () => {
  for (const status of [401, 403, 404, 409, 422, 503]) {
    const response = await handleApplications(req("GET"), config, async () => Response.json({ detail: "database-password-private" }, { status }));
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes("database-password-private"));
    assert.equal(Boolean(response.headers.get("set-cookie")), status === 401);
  }
});

test("solo una incorporación confirmada conserva el estado Aceptada", async () => {
  const accepted = { ...row, estado: "Aceptada", id_arriendo: 12, incorporacion_pendiente: false };
  const response = await handleApplications(req("GET"), config, async () => Response.json([accepted]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {items:[accepted],siguiente_cursor:null});
  for (const invalid of [{ ...accepted, incorporacion_pendiente: true }, { ...accepted, incorporacion_pendiente: "false" }, { ...accepted, id_arriendo: null }, { ...row, estado: "Aceptada" }]) {
    assert.equal((await handleApplications(req("GET"), config, async () => Response.json([invalid]))).status, 503);
  }
  for (const id of [0, -1, true, "12"]) {
    const response = await handleApplications(req("GET"), config, async () => Response.json([{ ...row, id_arriendo: id }]));
    assert.equal(response.status, 503);
  }
});

const operationKey = "aafab040-efdf-4bd0-a7ed-4dfb5e35b3bb";
const waiting = { ...row, estado: "Preseleccionada", id_arriendo: null, incorporacion_pendiente: true, operacion: { id_operacion: operationKey, estado: "Pendiente" } };

test("listas privadas conservan páginas, filtros y contexto de publicación",async()=>{
  const request=new Request(config.origin+"/web-api/postulaciones?publicacion=7&cursor=cursor_2&limite=10&estado=Pendiente",{headers});
  const response=await handleApplications(request,config,async(url)=>{
    const target=new URL(url);
    assert.equal(target.pathname,"/api/publicaciones/7/postulantes");
    assert.equal(target.searchParams.get("cursor"),"cursor_2");
    assert.equal(target.searchParams.get("limite"),"10");
    return Response.json({items:[{...row,private:"secret"}],siguiente_cursor:"cursor_3"});
  });
  assert.deepEqual(await response.json(),{items:[row],siguiente_cursor:"cursor_3"});
  assert.equal((await handleApplications(request,config,async()=>Response.json({items:[{...row,id_publicacion:9}],siguiente_cursor:null}))).status,503);
  for(const query of ["cursor=","cursor=a&cursor=b","limite=0","limite=101","estado=Admin","owner=1"]){
    assert.equal((await handleApplications(new Request(config.origin+"/?"+query,{headers}),config,()=>assert.fail())).status,422);
  }
});

test("retiro usa POST propio y Cancelada no se puede enviar como decisión del dueño",async()=>{
  const cancelled={...row,estado:"Cancelada",motivo:"Retiro voluntario"};
  const response=await handleApplications(req("POST",{retiro:8}),config,async(url,options)=>{
    assert.equal(url,config.backend+"/api/postulaciones/8/retiro");
    assert.equal(options.body,undefined);
    return Response.json(cancelled);
  });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),cancelled);
  assert.equal((await handleApplications(req("PATCH",{id:8,estado:"Cancelada"}),config,()=>assert.fail())).status,422);
});

const rentalSource=(await readFile(new URL("../src/lib/recorrido/server.ts",import.meta.url),"utf8")).replace('"../auth/gateway"',JSON.stringify(gateway));
const {handleMyArriendo}=await import(compile(rentalSource));
test("Mi arriendo adapta el DTO real de la 124 y filtra datos privados",async()=>{
  const native={id_arriendo:12,id_publicacion:7,cupos_totales:3,version_capacidad:1,ocupacion:1,private:"secret"};
  const response=await handleMyArriendo(req("GET"),config,async()=>Response.json(native));
  assert.deepEqual(await response.json(),{id_arriendo:12,id_publicacion:7,estado:"Activo",cupos_totales:3,integrantes_activos:1,cupos_disponibles:2,id_responsable:null});
  for(const ocupacion of [-1,4,"1"]){
    assert.equal((await handleMyArriendo(req("GET"),config,async()=>Response.json({...native,ocupacion}))).status,503);
  }
});

test("aceptar exige UUID y reenvía la misma clave con Bearer al reintentar", async () => {
  const transport = () => { throw Error("no-network"); };
  for (const key of [undefined, "bad-key", ""]) {
    assert.equal((await handleApplications(req("PATCH", { id: 8, estado: "Aceptada" }, key === undefined ? {} : { "Idempotency-Key": key }), config, transport)).status, 422);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await handleApplications(req("PATCH", { id: 8, estado: "Aceptada" }, { "Idempotency-Key": operationKey }), config, async (url, options) => {
      assert.equal(url, config.backend + "/api/postulaciones/8/estado");
      assert.equal(options.headers["Idempotency-Key"], operationKey);
      assert.equal(options.headers.Authorization, "Bearer fixture.claims.signature");
      assert.deepEqual(JSON.parse(options.body), { estado: "Aceptada" });
      return Response.json(waiting, { status: 202 });
    });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), waiting);
  }
});

test("consulta individual recupera la operación persistida y filtra campos privados", async () => {
  const response = await handleApplications(req("GET"), config, async (url, options) => {
    assert.equal(url, config.backend + "/api/postulaciones/8");
    assert.equal(options.headers.Authorization, "Bearer fixture.claims.signature");
    assert.equal(options.cache, "no-store");
    return Response.json({ ...waiting, internal_token: "private", operacion: { ...waiting.operacion, payload: "private" } });
  }, "8");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), waiting);
  for (const id of ["../auth/login", "0", "8?owner=999"]) assert.equal((await handleApplications(req("GET"), config, () => { throw Error("no-network"); }, id)).status, 422);
  const injected = new Request(config.origin + "/web-api/postulaciones/8?publicacion=7", { headers });
  assert.equal((await handleApplications(injected, config, () => { throw Error("no-network"); }, "8")).status, 422);
});

test("detalle ajeno y conflictos no revelan datos; un ID diferente nunca confirma éxito", async () => {
  for (const status of [401, 403, 404, 409, 503]) {
    const response = await handleApplications(req("GET"), config, async () => Response.json({ ...waiting, private: "database-password" }, { status }), "8");
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /database-password|id_operacion/);
  }
  assert.equal((await handleApplications(req("GET"), config, async () => Response.json({ ...waiting, id_postulacion: 9 }), "8")).status, 503);
  const confirmed = { ...waiting, estado: "Aceptada", id_arriendo: 12, incorporacion_pendiente: false, operacion: { id_operacion: operationKey, estado: "Confirmada" } };
  const response = await handleApplications(req("PATCH", { id: 8, estado: "Aceptada" }, { "Idempotency-Key": operationKey }), config, async () => Response.json(confirmed));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), confirmed);
  for (const operation of [{ ...confirmed.operacion, estado: "Pendiente" }, { ...confirmed.operacion, id_operacion: "private" }]) {
    assert.equal((await handleApplications(req("GET"), config, async () => Response.json({ ...confirmed, operacion: operation }), "8")).status, 503);
  }
  for (const inconsistent of [
    { ...waiting, operacion: null },
    { ...waiting, incorporacion_pendiente: false },
    { ...waiting, id_arriendo: 12 },
    { ...waiting, operacion: { id_operacion: operationKey, estado: "Rechazada" } },
    [waiting],
  ]) assert.equal((await handleApplications(req("GET"), config, async () => Response.json(inconsistent), "8")).status, 503);
});
