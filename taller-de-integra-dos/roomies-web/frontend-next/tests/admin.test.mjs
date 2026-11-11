import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64")}`;
const gateway = (await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8")).replace('import "server-only";', '');
const source = (await readFile(new URL("../src/lib/admin/server.ts", import.meta.url), "utf8")).replace('import "server-only";', '').replace('"../auth/gateway"', JSON.stringify(moduleURL(gateway)));
const {handleAdmin} = await import(moduleURL(source));
const config = {origin:"https://web.example.com",backend:"https://api.example.com",secure:true};
const req = (query="", cookie="__Host-haycupo_session=a.b.c") => new Request(config.origin+"/web-api/admin"+query,{headers:{cookie,Authorization:"Bearer spoofed"}});
const summary = {usuarios:2,publicaciones:1,conexiones:0};
const publication = {id:1,titulo:"Casa",precio:100,ubicacion:"Ciudad",estado:"Disponible",cupos_totales:2};

test("admin consulta destinos fijos con cookie y filtra campos privados", async()=>{
  const calls=[];
  const response=await handleAdmin(req("?pagina=2"),config,async(url,options)=>{
    calls.push(url);
    assert.equal(options.headers.Authorization,"Bearer a.b.c");
    assert.equal(options.cache,"no-store");assert.equal(options.redirect,"error");
    return Response.json(url.endsWith("resumen")?{...summary,secret:"private"}:{items:[{...publication,correo:"private"}],pagina:2,hay_mas:false});
  });
  assert.deepEqual(calls,[config.backend+"/api/admin/resumen",config.backend+"/api/admin/publicaciones?limite=20&pagina=2"]);
  assert.deepEqual(await response.json(),{resumen:summary,items:[publication],pagina:2,hay_mas:false});
  assert.equal(response.headers.get("cache-control"),"no-store");
});
test("admin rechaza sesión ausente y parámetros no válidos antes del transporte",async()=>{
  const never=()=>{throw new Error("unexpected network");};
  assert.equal((await handleAdmin(req("",""),config,never)).status,401);
  for(const query of ["?pagina=0","?pagina=100001","?pagina=1&pagina=2","?role=admin","?pagina=1/../2"]) assert.equal((await handleAdmin(req(query),config,never)).status,422);
  assert.equal((await handleAdmin(req(),null,never)).status,503);
});
test("403 conserva sesión, 401 elimina cookie y errores no filtran datos",async()=>{
  for(const status of [401,403,500]) {
    const response=await handleAdmin(req(),config,async()=>Response.json({detail:"private-secret"},{status}));
    assert.equal(response.status,status===500?503:status);
    assert.equal(response.headers.has("set-cookie"),status===401);
    assert.doesNotMatch(await response.text(),/private-secret/);
  }
});
test("admin controla fallos de red y contratos inválidos",async()=>{
  for(const transport of [async()=>{throw new Error("secret");},async()=>Response.json({}),async()=>new Response("invalid")]) assert.equal((await handleAdmin(req(),config,transport)).status,503);
});
