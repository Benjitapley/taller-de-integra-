import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import ts from "typescript";

const source = (await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8")).replace('import "server-only";', '');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { authConfig, handleAuth, cookieName, readToken } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const secure = { origin: "https://web.example.test", backend: "https://api.example.test", secure: true };
const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url")}.signature`;
const headers = { origin: secure.origin, "content-type": "application/json", "x-haycupo-csrf": "1", "sec-fetch-site": "same-origin" };
const request = (action, body = {}, overrides = {}) => new Request(`${secure.origin}/web-api/auth/${action}`, { method: "POST", headers: { ...headers, ...overrides }, body: JSON.stringify(body) });
const credentials = { correo: "fixture@example.com", contrasena: "only-fixture" };
const ok = (body) => Response.json(body);

test("configuración requiere opt-in y orígenes explícitos seguros", () => {
  assert.equal(authConfig({}), null);
  assert.equal(authConfig({WEB_AUTH_ENABLED:"true"}), null);
  for (const origin of ["http://remote.test", "https://u:p@web.test", "https://web.test/path"]) assert.equal(authConfig({ WEB_AUTH_ENABLED: "true", WEB_AUTH_ORIGIN: origin, WEB_AUTH_FASTAPI_ORIGIN: secure.backend }), null);
  assert.deepEqual(authConfig({WEB_AUTH_ENABLED:"true", WEB_AUTH_ORIGIN:secure.origin, WEB_AUTH_FASTAPI_ORIGIN:secure.backend}), secure);
  assert.equal(authConfig({NODE_ENV:"production",WEB_AUTH_ENABLED:"true", WEB_AUTH_ORIGIN:"http://localhost:3000", WEB_AUTH_FASTAPI_ORIGIN:"http://localhost:8000"}),null);
});
test("deshabilitado y CSRF/origen/método bloquean antes del transporte", async () => {
  const noNetwork = () => { throw new Error("must not call transport"); };
  assert.equal((await handleAuth(request("login",credentials),"login",null,noNetwork)).status,503);
  for (const override of [{origin:"https://evil.test"},{origin:"null"},{"x-haycupo-csrf":""},{"sec-fetch-site":"cross-site"},{origin:""}]) assert.equal((await handleAuth(request("login",credentials,override),"login",secure,noNetwork)).status,403);
  assert.equal((await handleAuth(new Request(secure.origin),"login",secure,noNetwork)).status,405);
  assert.equal((await handleAuth(request("unknown"),"unknown",secure,noNetwork)).status,404);
});
test("JSON inválido, campos ajenos, tipo y límite de body", async () => {
  const noNetwork = () => { throw new Error("must not call transport"); };
  for (const body of [{}, {...credentials,id_usuario:1},{...credentials,contrasena:"a".repeat(17000)}]) assert.equal((await handleAuth(request("login",body),"login",secure,noNetwork)).status,422);
  assert.equal((await handleAuth(request("login",credentials,{"content-type":"text/plain"}),"login",secure,noNetwork)).status,422);
});
test("login guarda solo cookie host HttpOnly Secure Strict, sin JWT en JSON", async () => {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({url,options});
    return url.endsWith("/api/perfil") ? ok({nombre:"Cuenta sintética",access_token:"must-not-leak"}) : ok({success:true,access_token:token,token_type:"bearer",user:{id:1}});
  };
  const response = await handleAuth(request("login",credentials,{Authorization:"Bearer attacker",Cookie:"roomies_id=1"}),"login",secure,transport);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{success:true});
  assert.match(response.headers.get("set-cookie"),/^__Host-haycupo_session=.+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
  assert.equal(calls[0].options.headers.Authorization,undefined);
  assert.equal(calls[1].options.headers.Authorization,`Bearer ${token}`);
  assert.equal(calls[1].options.headers.Cookie,undefined);
  assert.equal(calls[0].options.redirect,"error");
  assert.equal(response.headers.get("cache-control"),"no-store");
});
for (const status of [401,403,409,422,429,503]) test(`HTTP ${status} se conserva sin filtrar detalles del upstream`, async () => {
  const response = await handleAuth(request("login",credentials),"login",secure,async()=>Response.json({detail:"secret-from-upstream",access_token:token},{status,headers:{"Retry-After":"60"}}));
  assert.equal(response.status,status);
  assert.doesNotMatch(await response.text(),/secret-from-upstream|signature/);
  assert.equal(response.headers.get("set-cookie"),null);
  if(status===429) assert.equal(response.headers.get("retry-after"),"60");
});
test("caída, redirección, JSON o JWT malformados y sesión rechazada nunca acreditan login", async () => {
  for(const transport of [async()=>{throw new Error("offline");},async()=>new Response("not json"),async()=>ok({success:true,access_token:"demo",token_type:"bearer"}), async(url)=>url.endsWith("/api/perfil")?Response.json({}, {status:401}):ok({success:true,access_token:token,token_type:"bearer"})]) {
    const response=await handleAuth(request("login",credentials),"login",secure,transport);
    assert.equal(response.status,503);
    assert.equal(response.headers.get("set-cookie"),null);
  }
});
test("consulta de sesión exige cookie válida y confirma vigencia en FastAPI",async()=>{
  const sessionRequest=(cookie)=>new Request(secure.origin,{headers:{cookie}});
  assert.equal((await handleAuth(sessionRequest("roomies_id=1"),"sesion",secure)).status,401);
  assert.equal(readToken(`${cookieName(secure)}=${token}; ${cookieName(secure)}=${token}`,secure),"");
  const response=await handleAuth(sessionRequest(`${cookieName(secure)}=${token}`),"sesion",secure,async(url,opts)=>{
    assert.equal(url,`${secure.backend}/api/perfil`);
    assert.equal(opts.headers.Authorization,`Bearer ${token}`);
    return ok({nombre:"Sintético",contrasena:"must-not-leak"});
  });
  assert.deepEqual(await response.json(),{authenticated:true,user:{nombre:"Sintético"}});
});
test("logout revoca antes de borrar; 503 conserva cookie y no afirma éxito",async()=>{
  const req=()=>request("logout",{},{cookie:`${cookieName(secure)}=${token}`});
  const success=await handleAuth(req(),"logout",secure,async()=>ok({success:true}));
  assert.match(success.headers.get("set-cookie"),/Max-Age=0/);
  const failure=await handleAuth(req(),"logout",secure,async()=>Response.json({}, {status:503}));
  assert.equal(failure.status,503);
  assert.equal(failure.headers.get("set-cookie"),null);
  const revoked=await handleAuth(req(),"logout",secure,async()=>Response.json({}, {status:401}));
  assert.match(revoked.headers.get("set-cookie"),/Max-Age=0/);
});
test("registro, verificar y reenviar usan contratos distintos y no crean cookie",async()=>{
  for(const [action,body] of [["registro",{...credentials,nombre:"Prueba",fecha_nacimiento:"2000-01-01"}],["verificar",{correo:credentials.correo,codigo:"012345"}],["reenviar-codigo",{correo:credentials.correo}]]){
    const response=await handleAuth(request(action,body),action,secure,async(url,opts)=>{
      assert.equal(url,`${secure.backend}/auth/${action}`);
      assert.deepEqual(JSON.parse(opts.body),body);
      return ok({success:true,access_token:"must-not-leak"});
    });
    assert.equal(response.status,200);
    assert.equal(response.headers.get("set-cookie"),null);
    assert.doesNotMatch(await response.text(),/must-not-leak/);
  }
});
test("transporte HTTP contra doble local de FastAPI, sin servicios externos",async(t)=>{
  const received=[];
  const server=createServer(async(req,res)=>{
    let body="";for await(const chunk of req)body+=chunk;
    received.push({url:req.url,headers:req.headers,body});
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(req.url==="/auth/login"?{success:true,access_token:token,token_type:"bearer"}:{nombre:"Fixture HTTP"}));
  });
  server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(()=>{server.closeAllConnections();server.close();});
  const config={...secure,backend:`http://127.0.0.1:${server.address().port}`};
  const response=await handleAuth(request("login",credentials),"login",config);
  assert.equal(response.status,200);
  assert.equal(received[1].headers.authorization,`Bearer ${token}`);
  assert.equal(received[1].headers.cookie,undefined);
});
