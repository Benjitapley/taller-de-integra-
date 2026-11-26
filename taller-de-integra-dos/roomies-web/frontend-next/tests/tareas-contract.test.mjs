import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const source = async path => (await readFile(new URL(path,import.meta.url),"utf8")).replace('import "server-only";','');
const gateway = compile(await source("../src/lib/auth/gateway.ts"));
const { getSession } = await import(gateway);
const { handleTasks, handleTaskPatch } = await import(compile((await source("../src/lib/recorrido/tasks.ts")).replace('"../auth/gateway"',JSON.stringify(gateway))));
const config = { provider:"supabase",origin:"https://web.example.org",backend:"https://api.example.org",secure:true };
const token = `fixture.${Buffer.from(JSON.stringify({exp:2000000000})).toString("base64url")}.signed`;
const headers = { cookie:`__Host-roomies_sb_access=${token}`,origin:config.origin,"x-haycupo-csrf":"1","content-type":"application/json" };
const request = (method="GET",body,query="",extra={}) => new Request(config.origin+"/web-api/arriendos/1/tareas"+query,{method,headers:{...headers,...extra},...(body === undefined ? {} : {body:JSON.stringify(body)})});
const row = {id_tarea:1,id_arriendo:1,id_creador:2,id_asignado:3,titulo:"Cocina",descripcion:null,estado:"Pendiente",fecha_creacion:"2026-11-25T12:00:00Z"};
const never = async () => { throw Error("Transporte no esperado"); };

test("E04 BFF transporta filtro y cursor, crea, reasigna y completa sin aceptar actor del cliente", async () => {
 const list=await handleTasks(request("GET",undefined,"?estado=Pendiente&cursor=MS4xLjE&id_asignado=3"),"1",config,async(url,options)=>{
  assert.equal(url,config.backend+"/api/arriendos/1/tareas?estado=Pendiente&cursor=MS4xLjE&id_asignado=3");
  assert.equal(options.headers.Authorization,`Bearer ${token}`); assert.equal(options.cache,"no-store");
  return Response.json({items:[row],siguiente_cursor:null,id_usuario_actual:2});
 });
 assert.deepEqual(await list.json(),{items:[row],siguiente_cursor:null,id_usuario_actual:2});
 for(const [method,op,body,path] of [["POST","rental",{titulo:"Cocina",id_asignado:3},"/api/arriendos/1/tareas"],["PATCH","assign",{id_asignado:null},"/api/tareas/1"],["PATCH","complete",{estado:"Completada"},"/api/tareas/1/estado"]]) {
  const transport=async(url,options)=>{
   assert.equal(url,config.backend+path); assert.deepEqual(JSON.parse(options.body),body);
   return Response.json({...row,privado:"oculto"},{status:method==="POST"?201:200});
  };
  const response = op === "rental" ? await handleTasks(request(method,body),"1",config,transport) : await handleTaskPatch(request(method,body),"1",op === "complete",config,transport);
  assert.deepEqual(await response.json(),row); assert.equal(response.headers.get("cache-control"),"no-store");
 }
});
test("E04 BFF rechaza payload, consulta, identidad y CSRF inválidos antes del Gateway", async()=>{
 for(const body of [{titulo:" "},{titulo:"x".repeat(121)},{titulo:"A",id_asignado:true},{titulo:"A",id_asignado:-1},{titulo:"A",descripcion:1},{titulo:"A",id_creador:9}]) {
  assert.equal((await handleTasks(request("POST",body),"1",config,never)).status,422);
 }
 for(const body of [{},{id_asignado:0},{id_asignado:2,titulo:"Fuera de D04"}]) assert.equal((await handleTaskPatch(request("PATCH",body),"1",false,config,never)).status,422);
 assert.equal((await handleTaskPatch(request("PATCH",{estado:"Pendiente"}),"1",true,config,never)).status,422);
 for(const query of ["?estado=otra","?estado=Pendiente&estado=Completada","?cursor=!","?id_actor=3","?id_asignado=-1","?id_asignado=9007199254740992"]) assert.equal((await handleTasks(request("GET",undefined,query),"1",config,never)).status,422);
 assert.equal((await handleTasks(request("POST",{titulo:"A"},"",{origin:"https://evil.invalid"}),"1",config,never)).status,403);
 assert.equal((await handleTasks(request("GET",undefined,"",{cookie:""}),"1",config,never)).status,401);
});
test("E04 errores del servicio y pérdida de respuesta nunca producen éxito",async()=>{
 for(const status of [401,403,404,409,422,503]) assert.equal((await handleTaskPatch(request("PATCH",{id_asignado:3}),"1",false,config,async()=>Response.json({detail:"secreto"},{status}))).status,status);
 assert.equal((await handleTasks(request(),"1",config,never)).status,503);
 assert.equal((await handleTasks(request(),"1",config,async()=>Response.json({items:[{...row,estado:"inventado"}],siguiente_cursor:null}))).status,503);
});
test("E04 sesión expone solo id numérico confirmado por perfil, sin usar claims como id de negocio",async()=>{
 for(const field of ["id_usuario","id_usuario_PK"]) {
  const response=await getSession(config,token,async()=>Response.json({nombre:"Integrante",[field]:2,secreto:"oculto"}));
  const session=await response.json(); assert.deepEqual(session.user,{nombre:"Integrante",id_usuario:2});
 }
 const response=await getSession(config,token,async()=>Response.json({nombre:"Integrante",id_usuario:"2"}));
 assert.deepEqual((await response.json()).user,{nombre:"Integrante"});
});
