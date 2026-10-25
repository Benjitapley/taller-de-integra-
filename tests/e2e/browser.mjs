import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const resultFile = process.argv[2];
let config;
for (let i=0; i<50; i++) {
  try { config=JSON.parse(await readFile(join(dirname(resultFile),"browser-config.json"),"utf8")); break; }
  catch { await new Promise((resolve)=>setTimeout(resolve,100)); }
}
if (!config) throw new Error("Missing isolated browser configuration");
const require = createRequire(import.meta.url);
const { chromium } = require(config.playwright);
const checks = [], external = [], leaks = [], browserErrors = [], contexts = [], pending = [];
const pass = async(name,fn)=> {
  try { await fn(); checks.push({name,passed:true}); }
  catch(error) { checks.push({name,passed:false,error:String(error.message).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,"[redacted JWT]").slice(0,600)}); }
};
const fixture = async(action,body={})=>{
  const response = await fetch(config.control,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${config.controlKey}`},body:JSON.stringify({action,...body})});
  assert.equal(response.status,200,"fixture control response");
  return response.json();
};
const browser = await chromium.launch({executablePath:config.browser,headless:true,args:["--disable-background-networking","--disable-component-update","--disable-sync","--disable-default-apps","--no-proxy-server"]});
async function context() {
  const ctx = await browser.newContext({baseURL:config.web,viewport:{width:1440,height:1000},serviceWorkers:"block"});
  contexts.push(ctx);
  await ctx.route("**/*",async(route)=>{
    if(new URL(route.request().url()).origin !== config.web) { external.push("blocked external request"); await route.abort(); }
    else await route.continue();
  });
  if (ctx.routeWebSocket) await ctx.routeWebSocket("**/*",ws=>{
    if(new URL(ws.url()).host !== new URL(config.web).host) { external.push("blocked external websocket"); ws.close(); }
    else ws.connectToServer();
  });
  ctx.on("page",page=>{
    page.on("pageerror",error=>browserErrors.push(error.message));
    page.on("response",response=>{
      const task=(async()=>{
        const content=response.headers()["content-type"]??"";
        if(!/json|text\/html|text\/x-component/.test(content)) return;
        const text=await response.text();
        if(/"access_token"|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text)) leaks.push(new URL(response.url()).pathname);
      })().catch(()=>{});
      pending.push(task);
    });
    page.on("request",request=>{ if(request.headers().authorization) leaks.push("browser sent Authorization"); });
  });
  return ctx;
}
async function webJSON(page, action, body) {
  return page.evaluate(async({action,body})=>{
    const response=await fetch(`/web-api/auth/${action}`,{method:body===undefined?"GET":"POST",headers:body===undefined?{}:{"Content-Type":"application/json","X-Haycupo-CSRF":"1"},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  },{action,body});
}
async function webProfile(page, query="") {
  return page.evaluate(async(query)=>{
    const response=await fetch(`/web-api/perfil${query}`,{cache:"no-store",credentials:"same-origin"});
    return {status:response.status,body:await response.json(),cache:response.headers.get("cache-control"),vary:response.headers.get("vary")};
  },query);
}
const A={nombre:"Cuenta A E2E",correo:"cuenta-a@example.com",contrasena:"E2E-only-password-A",fecha_nacimiento:"2000-01-01"};
const B={...A,nombre:"Cuenta B E2E",correo:"cuenta-b@example.com",contrasena:"E2E-only-password-B"};
const C={...A,nombre:"Cuenta SMTP E2E",correo:"smtp-failure@example.com"};
async function clickResponse(page,button,path) {
  const ready=page.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==="POST");
  await page.getByRole("button",{name:button,exact:true}).click();
  return ready;
}
async function register(page,user,status=200) {
  await page.goto(config.web+"/registro");
  await page.getByLabel("Nombre completo",{exact:true}).fill(user.nombre);
  await page.getByLabel("Correo electrónico",{exact:true}).fill(user.correo);
  await page.getByLabel("Fecha de nacimiento",{exact:true}).fill(user.fecha_nacimiento);
  await page.getByLabel("Contraseña",{exact:true}).fill(user.contrasena);
  assert.equal((await clickResponse(page,"Crear cuenta","/web-api/auth/registro")).status(),status);
  if(status===200) await page.waitForURL(config.web+"/verificar");
}
async function verify(page,user,code,status=200) {
  await page.getByLabel("Correo electrónico",{exact:true}).fill(user.correo);
  await page.getByLabel("Código de verificación",{exact:true}).fill(code);
  assert.equal((await clickResponse(page,"Verificar correo","/web-api/auth/verificar")).status(),status);
  if(status===200) await page.waitForURL(config.web+"/");
}
async function login(page,user,status=200) {
  await page.goto(config.web+"/");
  await page.getByLabel("Correo electrónico",{exact:true}).fill(user.correo);
  await page.getByLabel("Contraseña",{exact:true}).fill(user.contrasena);
  const response=await clickResponse(page,"Iniciar sesión","/web-api/auth/login");
  assert.equal(response.status(),status);
  if(status===200) { assert.deepEqual(await response.json(),{success:true}); await page.waitForURL(config.web+"/inicio"); }
}
const tokenOf=async(ctx)=>(await ctx.cookies()).find(cookie=>cookie.name==="haycupo_dev_session")?.value;
async function privateAPI(path,token,method="GET",data) {
  const response=await fetch(config.web+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:new URLSearchParams(data)}:{})});
  return {status:response.status,body:await response.json()};
}
let tokenA,tokenB,pubA,pubB;
try {
  const ctxA=await context(), pageA=await ctxA.newPage();
  pageA.setDefaultTimeout(15_000);
  await pass("private Next pages reject anonymous users",async()=>{
    for(const path of ["/inicio","/publicar","/navegacion","/perfil"]) {
      const response=await ctxA.request.get(config.web+path,{maxRedirects:0});
      assert.equal(response.status(),307);
      assert.equal(new URL(response.headers().location,config.web).pathname,"/");
    }
    assert.equal((await ctxA.request.get(config.web+"/web-api/auth/sesion")).status(),401);
    assert.equal((await ctxA.request.get(config.web+"/web-api/perfil")).status(),401);
  });
  await pass("browser registration persists Argon2 account and delivers STARTTLS SMTP locally",async()=>{
    await register(pageA,A);
    const state=await fixture("db-state",{correo:A.correo});
    assert.deepEqual(state,{exists:true,verified:false,argon2:true,attempts:0,used:false,delivered:true});
    assert.equal((await fixture("mail",{correo:A.correo})).codes.length,1);
    assert.equal(await tokenOf(ctxA),undefined);
  });
  await pass("wrong code is rejected and attempts commit in PostgreSQL",async()=>{
    const {codes}=await fixture("mail",{correo:A.correo});
    const incorrect=codes.at(-1)==="000000"?"111111":"000000";
    await verify(pageA,A,incorrect,400);
    assert.equal((await fixture("db-state",{correo:A.correo})).attempts,1);
  });
  await pass("resend enforces cooldown, then sends a new real SMTP code",async()=>{
    const early=await webJSON(pageA,"reenviar-codigo",{correo:A.correo});
    assert.equal(early.status,429);
    await fixture("cooldown",{correo:A.correo});
    // Browser state is fresh; cooldown is advanced only in the synthetic DB.
    await pageA.reload();
    await pageA.getByLabel("Correo electrónico",{exact:true}).fill(A.correo);
    assert.equal((await clickResponse(pageA,"Reenviar código","/web-api/auth/reenviar-codigo")).status(),200);
    assert.equal((await fixture("mail",{correo:A.correo})).codes.length,2);
  });
  await pass("browser verification changes real account state without creating a session",async()=>{
    const {codes}=await fixture("mail",{correo:A.correo});
    await verify(pageA,A,codes.at(-1));
    assert.equal((await fixture("db-state",{correo:A.correo})).verified,true);
    assert.equal(await tokenOf(ctxA),undefined);
  });
  await pass("wrong password does not create a session",async()=>{
    await login(pageA,{...A,contrasena:"incorrect-only-test"},401);
    assert.equal(await tokenOf(ctxA),undefined);
  });
  await pass("browser login, HttpOnly cookie, private home and real session",async()=>{
    await login(pageA,A);
    tokenA=await tokenOf(ctxA);
    assert.ok(tokenA);
    const cookie=(await ctxA.cookies()).find(cookie=>cookie.name==="haycupo_dev_session");
    assert.equal(cookie.httpOnly,true);
    assert.equal(cookie.sameSite,"Strict");
    assert.equal(cookie.secure,false); // Explicit development loopback exception.
    const session=await webJSON(pageA,"sesion");
    assert.deepEqual(session,{status:200,body:{authenticated:true,user:{nombre:A.nombre}}});
    assert.ok(await pageA.getByRole("navigation",{name:"Navegación principal"}).isVisible());
  });
  const ctxB=await context(),pageB=await ctxB.newPage();
  pageB.setDefaultTimeout(15_000);
  await pass("second independent browser account registers, verifies and logs in",async()=>{
    await register(pageB,B);
    await verify(pageB,B,(await fixture("mail",{correo:B.correo})).codes.at(-1));
    await login(pageB,B);
    tokenB=await tokenOf(ctxB);
    assert.ok(tokenB);
    assert.notEqual(tokenB,tokenA);
    assert.equal((await webJSON(pageB,"sesion")).body.user.nombre,B.nombre);
  });
  await pass("React profile opens from Sidebar and UserMenu through the real HttpOnly handler",async()=>{
    const response=pageA.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/perfil"&&r.status()===200);
    await pageA.getByRole("navigation",{name:"Navegación principal"}).getByRole("link",{name:"Perfil",exact:true}).click();
    await pageA.waitForURL(config.web+"/perfil");
    await pageA.getByRole("heading",{name:A.nombre,exact:true}).waitFor();
    const body=await (await response).json();
    assert.deepEqual(Object.keys(body).sort(),["nombre","edad","ocupacion","ciudad","breve_descripcion","sobre_mi","foto_perfil","total_publicaciones"].sort());
    assert.equal(body.nombre,A.nombre);
    assert.equal(body.total_publicaciones,0);
    assert.equal(body.edad,null);
    assert.equal(await pageA.getByRole("img",{name:"Sin fotografía de perfil"}).isVisible(),true);
    assert.equal(await pageA.getByRole("button",{name:/Editar perfil/}).count(),0);
    await pageA.goto(config.web+"/inicio");
    await pageA.getByRole("button",{name:"Información de cuenta",exact:true}).click();
    await pageA.getByRole("link",{name:"Ver mi perfil",exact:true}).click();
    await pageA.waitForURL(config.web+"/perfil");
    await pageA.getByRole("heading",{name:A.nombre,exact:true}).waitFor();
  });
  await pass("profile web responses and rendered pages stay isolated between real accounts",async()=>{
    await pageB.goto(config.web+"/perfil");
    await pageB.getByRole("heading",{name:B.nombre,exact:true}).waitFor();
    const [a,b]=await Promise.all([webProfile(pageA,"?id_usuario=2"),webProfile(pageB,"?id_usuario=1")]);
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.equal(a.body.nombre,A.nombre);assert.equal(b.body.nombre,B.nombre);
    assert.equal(a.cache,"no-store");assert.equal(b.cache,"no-store");
    assert.match(a.vary,/Cookie/);assert.match(b.vary,/Cookie/);
    assert.doesNotMatch(await pageA.locator("main").innerText(),/Cuenta B E2E/);
    assert.doesNotMatch(await pageB.locator("main").innerText(),/Cuenta A E2E/);
    for(const method of ["POST","PUT","DELETE"]) {
      const status=await pageA.evaluate(async(method)=>(await fetch("/web-api/perfil",{method})).status,method);
      assert.equal(status,405);
    }
  });
  const publication={titulo:"Publicación A sintética",categoria:"ofrezco",ubicacion:"Ciudad de prueba",precio:"100000",tipo:"Compartida",cupos_totales:"1",tipo_vivienda:"casa",descripcion:"Datos sintéticos para E2E",mascota:"no"};
  await pass("profile identity comes from JWT, never a supplied user ID",async()=>{
    assert.equal((await privateAPI("/api/perfil",null)).status,401);
    const a=await privateAPI("/api/perfil?id_usuario=999999",tokenA);
    const b=await privateAPI("/api/perfil?id_usuario=1",tokenB);
    assert.equal(a.status,200); assert.equal(b.status,200);
    assert.equal(a.body.nombre,A.nombre); assert.equal(b.body.nombre,B.nombre);
    assert.equal((await privateAPI("/api/perfil",tokenA,"PUT",{edad:"25",ciudad:"Ciudad A",id_usuario:"999999"})).status,200);
    assert.equal((await privateAPI("/api/perfil",tokenA)).body.ciudad,"Ciudad A");
    assert.equal((await privateAPI("/api/perfil",tokenB)).body.ciudad,"");
  });
  await pass("real publication creation and private lists remain scoped to owner",async()=>{
    const a=await privateAPI("/api/publicaciones",tokenA,"POST",publication);
    const b=await privateAPI("/api/publicaciones",tokenB,"POST",{...publication,titulo:"Publicación B sintética"});
    assert.equal(a.status,201); assert.equal(b.status,201);
    pubA=a.body.id;pubB=b.body.id;
    assert.deepEqual((await privateAPI("/api/mis-publicaciones",tokenA)).body.map(p=>p.id),[pubA]);
    assert.deepEqual((await privateAPI("/api/mis-publicaciones",tokenB)).body.map(p=>p.id),[pubB]);
    assert.equal((await privateAPI("/api/mis-publicaciones",null)).status,401);
  });
  await pass("profile reload renders real PostgreSQL fields and publication totals",async()=>{
    await pageA.reload();
    await pageA.getByRole("heading",{name:A.nombre,exact:true}).waitFor();
    assert.equal(await pageA.getByText("Ciudad A",{exact:true}).isVisible(),true);
    assert.equal(await pageA.getByText("25 años",{exact:true}).isVisible(),true);
    assert.equal(await pageA.locator("main strong").innerText(),"1");
    const b=await webProfile(pageB);
    assert.equal(b.status,200);
    assert.equal(b.body.ciudad,null);
    assert.equal(b.body.edad,null);
    assert.equal(b.body.total_publicaciones,1);
  });
  await pass("publication editing detail requires authentication and owner",async()=>{
    assert.equal((await privateAPI(`/api/publicaciones/${pubA}`,null)).status,401);
    assert.equal((await privateAPI(`/api/publicaciones/${pubA}`,tokenB)).status,404);
    assert.equal((await privateAPI(`/api/publicaciones/${pubA}`,tokenA)).status,200);
  });
  await pass("foreign update/delete rejected; owner can update/delete without harming B",async()=>{
    assert.equal((await privateAPI(`/api/publicaciones/${pubB}`,tokenA,"PUT",publication)).status,404);
    assert.equal((await privateAPI(`/api/publicaciones/${pubB}`,tokenA,"DELETE")).status,404);
    assert.equal((await privateAPI(`/api/publicaciones/${pubA}`,tokenA,"PUT",{...publication,titulo:"A actualizada"})).status,200);
    assert.equal((await privateAPI(`/api/publicaciones/${pubA}`,tokenA,"DELETE")).status,200);
    assert.equal((await privateAPI("/api/mis-publicaciones",tokenA)).body.length,0);
    assert.equal((await privateAPI("/api/mis-publicaciones",tokenB)).body[0].titulo,"Publicación B sintética");
  });
  await pass("profile statistics refresh independently without a shared user cache",async()=>{
    const [a,b]=await Promise.all([webProfile(pageA),webProfile(pageB)]);
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.equal(a.body.total_publicaciones,0);
    assert.equal(b.body.total_publicaciones,1);
  });
  await pass("public discovery catalog remains public and contains no credentials",async()=>{
    const response=await privateAPI("/api/publicaciones",null);
    assert.equal(response.status,200);
    assert.ok(Array.isArray(response.body));
    assert.doesNotMatch(JSON.stringify(response.body),/access_token|contrasena|codigo_hash/);
  });
  await pass("cryptographically expired JWT rejected through Next and FastAPI",async()=>{
    const {token}=await fixture("expire",{token:tokenA});
    const expired=await context();
    await expired.addCookies([{name:"haycupo_dev_session",value:token,url:config.web,httpOnly:true,sameSite:"Strict"}]);
    const page=await expired.newPage();await page.goto(config.web+"/");
    assert.equal((await webProfile(page)).status,401);
    assert.equal((await webJSON(page,"sesion")).status,401);
    assert.equal((await privateAPI("/api/perfil",token)).status,401);
    await page.goto(config.web+"/inicio");
    assert.equal(new URL(page.url()).pathname,"/");
    await page.goto(config.web+"/perfil");
    assert.equal(new URL(page.url()).pathname,"/");
  });
  await pass("revoked real session rejected despite valid JWT signature",async()=>{
    await fixture("revoke",{token:tokenB});
    assert.equal((await webProfile(pageB)).status,401);
    assert.equal((await webJSON(pageB,"sesion")).status,401);
    assert.equal((await privateAPI("/api/perfil",tokenB)).status,401);
    await pageB.goto(config.web+"/inicio");
    assert.equal(new URL(pageB.url()).pathname,"/");
    await pageB.goto(config.web+"/perfil");
    assert.equal(new URL(pageB.url()).pathname,"/");
    assert.equal((await webProfile(pageA)).status,200);
  });
  await pass("browser logout revokes PostgreSQL session and removes cookie",async()=>{
    await pageA.getByRole("button",{name:"Información de cuenta",exact:true}).click();
    assert.equal((await clickResponse(pageA,"Cerrar sesión","/web-api/auth/logout")).status(),200);
    await pageA.waitForURL(config.web+"/");
    assert.equal(await tokenOf(ctxA),undefined);
    assert.equal((await fixture("session-state",{token:tokenA})).revoked,true);
    assert.equal((await privateAPI("/api/perfil",tokenA)).status,401);
    assert.equal((await webJSON(pageA,"sesion")).status,401);
    assert.equal((await webProfile(pageA)).status,401);
    await pageA.goto(config.web+"/perfil");
    assert.equal(new URL(pageA.url()).pathname,"/");
  });
  await pass("same browser login as another account never reuses the previous profile",async()=>{
    await login(pageA,B);
    await pageA.getByRole("navigation",{name:"Navegación principal"}).getByRole("link",{name:"Perfil",exact:true}).click();
    await pageA.waitForURL(config.web+"/perfil");
    await pageA.getByRole("heading",{name:B.nombre,exact:true}).waitFor();
    const profile=await webProfile(pageA);
    assert.equal(profile.status,200);
    assert.equal(profile.body.nombre,B.nombre);
    assert.equal(profile.body.ciudad,null);
    assert.doesNotMatch(await pageA.locator("main").innerText(),/Cuenta A E2E|Ciudad A/);
    assert.equal((await webJSON(pageA,"logout",{})).status,200);
    await pageA.goto(config.web+"/perfil");
    assert.equal(new URL(pageA.url()).pathname,"/");
  });
  const ctxC=await context(),pageC=await ctxC.newPage();
  await pass("SMTP 451 gives 503, preserves pending account and invalidates undelivered code",async()=>{
    await fixture("smtp-fail",{enabled:true});
    try { await register(pageC,C,503); } finally { await fixture("smtp-fail",{enabled:false}); }
    assert.equal(new URL(pageC.url()).pathname,"/registro");
    assert.deepEqual(await fixture("db-state",{correo:C.correo}),{exists:true,verified:false,argon2:true,attempts:0,used:true,delivered:false});
    assert.equal((await fixture("mail",{correo:C.correo})).codes.length,0);
    assert.equal(await tokenOf(ctxC),undefined);
  });
  await pass("pending account recovers by resend and verification after SMTP recovery",async()=>{
    await fixture("cooldown",{correo:C.correo});
    await pageC.goto(config.web+"/verificar");
    await pageC.getByLabel("Correo electrónico",{exact:true}).fill(C.correo);
    assert.equal((await clickResponse(pageC,"Reenviar código","/web-api/auth/reenviar-codigo")).status(),200);
    await verify(pageC,C,(await fixture("mail",{correo:C.correo})).codes.at(-1));
    await login(pageC,C);
    assert.equal((await webJSON(pageC,"sesion")).body.user.nombre,C.nombre);
  });
  await pass("CSRF origin or missing header rejects without changing session",async()=>{
    for(const headers of [{Origin:"https://foreign.example.com","X-Haycupo-CSRF":"1"},{Origin:config.web}]) {
      const response=await ctxC.request.post(config.web+"/web-api/auth/logout",{headers,data:{}});
      assert.equal(response.status(),403);
    }
    assert.equal((await webJSON(pageC,"sesion")).status,200);
  });
  await pass("legacy auth aliases cannot expose JWT to browser JavaScript",async()=>{
    for(const path of ["/auth/login","/auth/login/","/auth/%6cogin",
      "/api/..%2fauth/login", "/api/%2e%2e%2fauth/login",
      "/static_principal/..%2f..%2fauth/login", "/conexiones/..%2fauth/login"]) {
      const status=await pageC.evaluate(async({path,credentials})=>{
        const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(credentials)});
        const text=await response.text();
        return {status:response.status,leaked:/access_token|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(text)};
      },{path,credentials:{correo:C.correo,contrasena:C.contrasena}});
      assert.equal(status.leaked,false,`${path}: JWT must never be exposed`);
      // Invalid encoded paths may be rejected by routing with 405 as well.
      assert.ok([400,404,405,410].includes(status.status),`${path}: unexpected status ${status.status}`);
    }
  });
  await pass("JWT absent from local/session storage, document.cookie and public response bodies",async()=>{
    for(const ctx of [ctxA,ctxB,ctxC]) {
      for(const page of ctx.pages()) {
        const state=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},cookie:document.cookie}));
        assert.deepEqual(state.local,{});
        assert.deepEqual(state.session,{});
        assert.doesNotMatch(state.cookie,/haycupo.*session|eyJ/);
      }
    }
    await Promise.all(pending);
    assert.deepEqual(leaks,[]);
  });
  await pass("no browser JavaScript errors or external application requests",async()=>{
    assert.deepEqual(browserErrors,[]);
    assert.deepEqual(external,[]);
  });
} finally {
  await browser.close();
  await writeFile(resultFile,JSON.stringify({checks,externalRequests:external.length},null,2));
}
if(checks.some(check=>!check.passed)) {
  for(const check of checks.filter(check=>!check.passed)) console.error(check.name+": "+check.error);
  process.exitCode=1;
}
