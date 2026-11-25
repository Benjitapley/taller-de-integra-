import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const source = async path => (await readFile(new URL(path,import.meta.url),"utf8")).replace('import "server-only";','');
const gateway = compile(await source("../src/lib/auth/gateway.ts"));
const { handleExpulsion } = await import(compile((await source("../src/lib/recorrido/server.ts")).replace('"../auth/gateway"',JSON.stringify(gateway))));
const config = { provider:"supabase",origin:"https://web.example.org",backend:"https://api.example.org",secure:true };
const headers = { cookie:"__Host-roomies_sb_access=fixture.token.signed",origin:config.origin,"x-haycupo-csrf":"1","content-type":"application/json" };
const body = { id_usuario:2,motivo:"Incumplimiento",confirmo:true };
const request = (data=body,extra={}) => new Request(config.origin+"/web-api/arriendos/1/expulsiones",{method:"POST",headers:{...headers,...extra},body:JSON.stringify(data)});
const never = async () => { throw Error("No debe llamar al servicio"); };
test("BFF exige motivo, confirmacion estricta, identidad y CSRF",async()=>{
 for(const data of [{...body,motivo:" "},{...body,motivo:"x".repeat(501)},{...body,confirmo:false},{...body,confirmo:"true"},{...body,confirmo:undefined},{...body,id_usuario:true},{...body,id_actor:1}]) assert.equal((await handleExpulsion(request(data),"1",config,never)).status,422);
 assert.equal((await handleExpulsion(request(body,{origin:"https://evil.example.org"}),"1",config,never)).status,403);
 assert.equal((await handleExpulsion(request(body,{"x-haycupo-csrf":""}),"1",config,never)).status,403);
 assert.equal((await handleExpulsion(request(body,{cookie:""}),"1",config,never)).status,401);
});
test("BFF usa identidad de cookie y devuelve solo ocupacion confirmada",async()=>{
 const result={id_arriendo:1,id_usuario:2,estado:"Activo",integrantes_activos:1,cupos_disponibles:1};
 const response=await handleExpulsion(request({...body,motivo:" Incumplimiento "},{Authorization:"Bearer ignored"}),"1",config,async(url,options)=>{
  assert.equal(url,config.backend+"/api/arriendos/1/expulsiones"); assert.equal(options.headers.Authorization,"Bearer fixture.token.signed"); assert.equal(options.cache,"no-store"); assert.deepEqual(JSON.parse(options.body),body);
  return Response.json({...result,motivo_privado:"interno"});
 });
 assert.equal(response.status,200); assert.deepEqual(await response.json(),result); assert.equal(response.headers.get("cache-control"),"no-store");
});
test("BFF preserva denegacion del servidor y no inventa exito ante perdida de red",async()=>{
 for(const status of [403,404,409,422]) assert.equal((await handleExpulsion(request(),"1",config,async()=>Response.json({}, {status}))).status,status);
 assert.equal((await handleExpulsion(request(),"1",config,async()=>{throw Error("timeout");})).status,503);
 assert.equal((await handleExpulsion(request(),"1",config,async()=>Response.json({id_arriendo:999}))).status,503);
});
