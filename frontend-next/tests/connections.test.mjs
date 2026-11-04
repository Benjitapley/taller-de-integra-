import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const url=(source)=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64")}`;
const gateway=url((await readFile(new URL("../src/lib/auth/gateway.ts",import.meta.url),"utf8")).replace('import "server-only";',""));
const source=(await readFile(new URL("../src/lib/conexiones/server.ts",import.meta.url),"utf8")).replace('import "server-only";',"").replace('"../auth/gateway"',JSON.stringify(gateway));
const {handleConnections}=await import(url(source));
const config={origin:"https://web.example.com",backend:"https://api.example.com",secure:true};
const cookie="__Host-haycupo_session=header.payload.signature";
const item={id_conexion:7,id_solicitante_FK:2,id_receptor_FK:3,estado:"Pendiente",fecha_solicitud:"2026-11-04T00:00:00"};
const request=(method="GET",body,headers={})=>new Request(config.origin+"/web-api/conexiones",{method,headers:{cookie,Origin:config.origin,"X-Haycupo-CSRF":"1","Content-Type":"application/json",...headers},...(body?{body:JSON.stringify(body)}:{})});
test("conexiones usan cookie HttpOnly y destinos fijos sin mezclar postulaciones",async()=>{
  const response=await handleConnections(request(),config,async(target,options)=>{
    assert.equal(target,config.backend+"/conexiones/recibidas");
    assert.equal(options.headers.Authorization,"Bearer header.payload.signature");
    assert.equal(options.headers.Cookie,undefined);
    return Response.json([{...item,access_token:"secret",correo:"private@example.com"}]);
  });
  assert.deepEqual(await response.json(),[item]);assert.equal(response.headers.get("cache-control"),"no-store");
});
test("solicitante ajeno, origen inválido, ID manipulado y respuesta pendiente no llegan a FastAPI",async()=>{
  const deny=()=>{throw new Error("no network");};
  for(const [method,body] of [["POST",{id_solicitante_FK:999,id_receptor_FK:3}],["PUT",{id:"../auth/login",estado:"Aceptada"}],["PUT",{id:7,estado:"Pendiente"}]]) assert.equal((await handleConnections(request(method,body),config,deny)).status,422);
  assert.equal((await handleConnections(request("POST",{id_receptor_FK:3},{Origin:"https://evil.test"}),config,deny)).status,403);
  assert.equal((await handleConnections(request("GET",undefined,{cookie:""}),config,deny)).status,401);
});
test("crear deriva solicitante en FastAPI y responder solo permite estados finales",async()=>{
  const created=await handleConnections(request("POST",{id_receptor_FK:3}),config,async(target,options)=>{
    assert.equal(target,config.backend+"/conexiones/");assert.deepEqual(JSON.parse(options.body),{id_receptor_FK:3});return Response.json(item,{status:201});
  });assert.equal(created.status,201);
  const accepted=await handleConnections(request("PUT",{id:7,estado:"Aceptada"}),config,async(target,options)=>{
    assert.equal(target,config.backend+"/conexiones/7");assert.deepEqual(JSON.parse(options.body),{estado:"Aceptada"});return Response.json({...item,estado:"Aceptada"});
  });assert.equal((await accepted.json()).estado,"Aceptada");
});
test("eliminar respeta 204, 401 limpia cookie y 403 conserva sesión",async()=>{
  assert.deepEqual(await (await handleConnections(request("DELETE",{id:7}),config,async()=>new Response(null,{status:204}))).json(),{success:true});
  for(const status of [401,403]) {
    const result=await handleConnections(request(),config,async()=>Response.json({}, {status}));
    assert.equal(result.status,status);assert.equal(result.headers.has("set-cookie"),status===401);
  }
});
test("limita cuerpo y rechaza respuesta inválida sin filtrar detalles",async()=>{
  assert.equal((await handleConnections(request("POST",{id_receptor_FK:"x".repeat(1200)}),config,()=>{throw new Error();})).status,413);
  const result=await handleConnections(request(),config,async()=>Response.json({access_token:"secret"}));
  assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/secret/);
});
