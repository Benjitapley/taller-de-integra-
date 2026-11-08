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
  const check=checks.at(-1);
  console.log(`${check.passed ? "PASS" : "FAIL"} ${name}${check.error ? ": "+check.error : ""}`);
  await writeFile(resultFile,JSON.stringify({checks,externalRequests:external.length},null,2));
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
  const [response]=await Promise.all([
    page.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==="POST"),
    page.getByRole("button",{name:button,exact:true}).click(),
  ]);
  return response;
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
    for(const path of ["/inicio","/publicar","/navegacion","/perfil","/admin","/mis-publicaciones","/editar-publicacion","/crear","/publicaciones/1","/mis-conexiones"]) {
      const response=await ctxA.request.get(config.web+path,{maxRedirects:0});
      assert.equal(response.status(),307);
      assert.equal(new URL(response.headers().location,config.web).pathname,"/");
    }
    assert.equal((await ctxA.request.get(config.web+"/web-api/auth/sesion")).status(),401);
    assert.equal((await ctxA.request.get(config.web+"/web-api/perfil")).status(),401);
    assert.equal((await ctxA.request.get(config.web+"/web-api/admin")).status(),401);
    assert.equal((await privateAPI("/api/admin/resumen",null)).status,401);
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
  await pass("admin empty state uses real PostgreSQL totals",async()=>{
    await pageA.goto(config.web+"/admin");
    await pageA.getByText("No hay publicaciones en esta página.",{exact:true}).waitFor();
    const response=await ctxA.request.get(config.web+"/web-api/admin");
    assert.equal(response.status(),200);
    assert.deepEqual(await response.json(),{resumen:{usuarios:1,publicaciones:0,conexiones:0},items:[],pagina:1,hay_mas:false});
    await pageA.goto(config.web+"/inicio");
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
    assert.deepEqual(Object.keys(body).sort(),["nombre","edad","ocupacion","ciudad","breve_descripcion","sobre_mi","foto_perfil","total_publicaciones","verificado"].sort());
    assert.equal(body.nombre,A.nombre);
    assert.equal(body.total_publicaciones,0);
    assert.equal(body.edad,null);
    assert.equal(await pageA.getByRole("img",{name:"Sin fotografía de perfil"}).isVisible(),true);
    assert.equal(await pageA.getByRole("button",{name:/Editar perfil/}).count(),1);
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
    for(const method of ["POST","DELETE"]) {
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
  await pass("admin shows real publications, validates pagination and remains read only",async()=>{
    const api=await privateAPI("/api/admin/resumen",tokenA);
    assert.equal(api.status,200);assert.deepEqual(api.body,{usuarios:2,publicaciones:2,conexiones:0});
    const list=await privateAPI("/api/admin/publicaciones?limite=1&pagina=1",tokenA);
    assert.equal(list.status,200);assert.equal(list.body.items[0].id,pubB);assert.equal(list.body.hay_mas,true);
    assert.equal((await privateAPI("/api/admin/publicaciones?limite=1&pagina=2",tokenA)).body.items[0].id,pubA);
    assert.equal((await privateAPI("/api/admin/publicaciones?limite=101",tokenA)).status,422);
    assert.equal((await privateAPI("/api/admin/resumen",tokenA,"DELETE")).status,405);
    await pageA.goto(config.web+"/admin");
    await pageA.getByRole("cell",{name:"Ciudad de prueba",exact:true}).first().waitFor();
    assert.equal(await pageA.getByRole("rowheader",{name:publication.titulo,exact:true}).count(),1);
    assert.equal(await pageA.getByRole("button",{name:"Siguiente",exact:true}).isDisabled(),true);
    assert.equal(await pageA.getByRole("button",{name:"Anterior",exact:true}).isDisabled(),true);
    await pageA.getByRole("button",{name:"Actualizar panel",exact:true}).click();
    await pageA.getByRole("rowheader",{name:publication.titulo,exact:true}).waitFor();
    await pageA.goto(config.web+"/perfil");
    await pageA.getByRole("heading",{name:A.nombre,exact:true}).waitFor();
  });
  await pass("ordinary account cannot read admin through backend, BFF or page",async()=>{
    assert.equal((await privateAPI("/api/admin/resumen?role=admin",tokenB)).status,403);
    assert.equal((await privateAPI("/api/admin/publicaciones",tokenB)).status,403);
    const denied=await ctxB.request.get(config.web+"/web-api/admin");
    assert.equal(denied.status(),403);assert.equal(denied.headers()["set-cookie"],undefined);
    await pageB.goto(config.web+"/admin");
    await pageB.getByRole("alert").filter({hasText:"Tu cuenta no tiene acceso administrativo."}).waitFor();
    assert.equal(await pageB.getByRole("table").count(),0);
    assert.equal((await webJSON(pageB,"sesion")).status,200);
    await pageB.goto(config.web+"/perfil");
    await pageB.getByRole("heading",{name:B.nombre,exact:true}).waitFor();
  });
  await pass("admin browser handles service failure and retry without showing stale data",async()=>{
    await pageA.route("**/web-api/admin?*",route=>route.fulfill({status:503,contentType:"application/json",body:'{"detail":"Unavailable"}'}));
    await pageA.goto(config.web+"/admin");
    await pageA.getByRole("alert").filter({hasText:"No se pudo consultar el panel."}).waitFor();
    assert.equal(await pageA.getByRole("table").count(),0);
    await pageA.unroute("**/web-api/admin?*");
    await pageA.getByRole("button",{name:"Reintentar",exact:true}).click();
    await pageA.getByRole("rowheader",{name:publication.titulo,exact:true}).waitFor();
    await pageA.goto(config.web+"/perfil");
    await pageA.getByRole("heading",{name:A.nombre,exact:true}).waitFor();
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
  await pass("verification section confirms email without requesting another code or claiming legal identity",async()=>{
    assert.equal((await webProfile(pageA)).body.verificado,true);
    await pageA.getByRole("heading",{name:"Verificación de cuenta",exact:true}).waitFor();
    assert.equal(await pageA.getByText("Correo verificado",{exact:true}).isVisible(),true);
    assert.match(await pageA.locator("main").innerText(),/No verifica tu identidad legal/);
    assert.equal(await pageA.getByRole("link",{name:"Completar verificación de correo"}).count(),0);
  });
  await pass("profile editor preloads fields, previews photo and discards cancelled edits",async()=>{
    await pageA.getByRole("button",{name:"Editar perfil",exact:true}).click();
    assert.equal(await pageA.getByLabel("Ciudad",{exact:true}).inputValue(),"Ciudad A");
    await pageA.getByLabel("Ciudad",{exact:true}).fill("Cancelada");
    await pageA.getByRole("button",{name:"Cancelar",exact:true}).click();
    assert.equal((await webProfile(pageA)).body.ciudad,"Ciudad A");
    await pageA.getByRole("button",{name:"Editar perfil",exact:true}).click();
    assert.equal(await pageA.getByLabel("Ciudad",{exact:true}).inputValue(),"Ciudad A");
    await pageA.keyboard.press("Escape");
    assert.equal(await pageA.getByRole("dialog").isVisible(),false);
  });
  await pass("profile editing validates, retains fields after failure and persists photo through real HttpOnly PUT",async()=>{
    await pageA.getByRole("button",{name:"Editar perfil",exact:true}).click();
    await pageA.getByLabel("Edad",{exact:true}).fill("121");
    await pageA.getByRole("button",{name:"Guardar cambios",exact:true}).click();
    await pageA.getByRole("alert").filter({hasText:"La edad"}).waitFor();
    await pageA.getByLabel("Edad",{exact:true}).fill("25");
    await pageA.getByLabel("Ocupación",{exact:true}).fill("Profesional E2E");
    await pageA.getByLabel("Descripción breve",{exact:true}).fill("Descripción guardada");
    await pageA.getByLabel("Sobre mí (biografía)",{exact:true}).fill("Biografía guardada");
    await pageA.getByLabel("Fotografía",{exact:true}).setInputFiles({name:"photo.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGNsYGhggAEmOAsvBwAzBAEI14KrBQAAAABJRU5ErkJggg==","base64")});
    const preview=pageA.getByRole("img",{name:"Vista previa de fotografía"});
    await preview.waitFor();
    assert.equal(await preview.evaluate(async image=>{await image.decode();return image.naturalWidth;}),4);
    await pageA.setViewportSize({width:390,height:844});
    assert.equal(await pageA.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    let releaseFailure;
    const failureGate=new Promise(resolve=>{releaseFailure=resolve;});
    await pageA.route("**/web-api/perfil",async route=>{
      if(route.request().method()!=="PUT") return route.continue();
      await failureGate;
      return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({detail:"Fallo sintético de guardado"})});
    });
    await pageA.getByRole("button",{name:"Guardar cambios",exact:true}).click();
    await pageA.getByRole("button",{name:"Guardando…",exact:true}).waitFor();
    assert.equal(await pageA.getByRole("button",{name:"Guardando…",exact:true}).isDisabled(),true);
    assert.equal(await pageA.getByRole("button",{name:"Cancelar",exact:true}).isDisabled(),true);
    releaseFailure();
    await pageA.getByRole("alert").filter({hasText:"Fallo sintético"}).waitFor();
    assert.equal(await pageA.getByLabel("Ocupación",{exact:true}).inputValue(),"Profesional E2E");
    await pageA.unroute("**/web-api/perfil");
    const saved=pageA.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/perfil"&&r.request().method()==="PUT");
    await pageA.getByRole("button",{name:"Guardar cambios",exact:true}).click();
    assert.equal((await saved).status(),200);
    await pageA.getByText("Perfil guardado correctamente.",{exact:true}).waitFor();
    await pageA.getByText("Profesional E2E",{exact:true}).waitFor();
    const after=(await webProfile(pageA)).body;
    assert.equal(after.sobre_mi,"Biografía guardada");
    assert.match(after.foto_perfil,/^\/imagenes\/[a-f0-9]+\.png$/);
    assert.equal((await webProfile(pageB)).body.ciudad,null);
    await pageA.reload();
    await pageA.getByText("Profesional E2E",{exact:true}).waitFor();
    await pageA.getByRole("img",{name:`Fotografía de ${A.nombre}`}).evaluate(async image=>{await image.decode();});
    await pageA.setViewportSize({width:1440,height:1000});
  });
  await pass("profile PUT rejects cross origin, missing CSRF and foreign identity fields before mutation",async()=>{
    const statuses=await pageA.evaluate(async()=>{
      const send=async(headers,extra={})=>{
        const form=new FormData();
        for(const [k,v] of Object.entries({edad:"25",ocupacion:"",ciudad:"Sin permiso",breve_descripcion:"",sobre_mi:"",...extra}))form.set(k,v);
        return (await fetch("/web-api/perfil?id_usuario=2",{method:"PUT",headers,body:form})).status;
      };
      return [await send({}),await send({"X-Haycupo-CSRF":"1"},{id_usuario:"2"}),await send({"X-Haycupo-CSRF":"1"},{verificado:"true"})];
    });
    assert.deepEqual(statuses,[403,422,422]);
    assert.equal((await webProfile(pageA)).body.ciudad,"Ciudad A");
    assert.equal((await webProfile(pageB)).body.ciudad,null);
  });
  await pass("Next publication list keeps session and separates accounts",async()=>{
    await pageA.getByRole("navigation",{name:"Navegación principal"}).getByRole("link",{name:"Mis publicaciones",exact:true}).click();
    await pageA.waitForURL(config.web+"/mis-publicaciones");
    await pageA.getByRole("heading",{name:publication.titulo,exact:true}).waitFor();
    assert.doesNotMatch(await pageA.locator("main").innerText(),/Publicación B sintética/);
    assert.equal(await pageA.getByRole("navigation",{name:"Navegación principal"}).getByRole("link",{name:/Mis publicaciones.*HTML/}).count(),0);
    const mine=await pageB.evaluate(async()=>{const r=await fetch("/web-api/mis-publicaciones?id_usuario=1");return {status:r.status,items:await r.json()};});
    assert.equal(mine.status,200);assert.deepEqual(mine.items.map(p=>p.id),[pubB]);
  });
  await pass("native Next creation, detail, edit and close preserve Arrendador and history",async()=>{
    let created;
    try {
      await pageA.goto(config.web+"/publicar");
      await pageA.getByRole("heading",{name:"Publicar un arriendo",exact:true}).locator("..").getByRole("button",{name:"Continuar →",exact:true}).click();
      await pageA.getByLabel("Título",{exact:true}).fill("Arriendo UI sintético");
      await pageA.getByRole("combobox",{name:/^Tipo de vivienda/}).selectOption("casa");
      await pageA.getByLabel("Región y comuna",{exact:true}).fill("La Araucanía, Temuco");
      await pageA.getByLabel("Precio del arriendo (CLP)",{exact:true}).fill("123456");
      await pageA.getByLabel("Capacidad total del espacio",{exact:true}).fill("2");
      await pageA.getByLabel("Descripción",{exact:true}).fill("Solo base desechable");
      await pageA.getByLabel("Permitir comentarios en esta publicación").check();
      await pageA.locator('input[name="imagen"]').setInputFiles({name:"publication.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGNsYGhggAEmOAsvBwAzBAEI14KrBQAAAABJRU5ErkJggg==","base64")});
      const saved=await clickResponse(pageA,"Publicar ahora","/web-api/publicaciones");
      assert.equal(saved.status(),201);
      await pageA.waitForURL(config.web+"/inicio");
      // La navegación destruye el cuerpo CDP de la respuesta anterior.
      // Confirmar la fila creada consultando la API real del propietario.
      created=(await privateAPI("/api/mis-publicaciones",tokenA)).body.find(p=>p.titulo==="Arriendo UI sintético").id;
      await pageA.getByRole("link",{name:"Arriendo UI sintético",exact:true}).click();
      await pageA.waitForURL(config.web+`/publicaciones/${created}`);
      await pageA.getByRole("heading",{name:"Arriendo UI sintético",exact:true}).waitFor();
      assert.match(await pageA.locator("main").innerText(),/Arrendador/);
      await pageA.getByRole("img",{name:"Fotografía de la publicación"}).waitFor();
      assert.equal((await privateAPI(`/api/publicaciones/${created}/detalle`,null)).status,200);
      assert.equal((await privateAPI(`/api/publicaciones/${created}`,tokenB)).status,404);
      await pageA.goto(config.web+`/editar-publicacion?id=${created}`);
      await pageA.getByLabel("Título",{exact:true}).fill("Arriendo UI actualizado");
      assert.equal(await pageA.getByLabel("Permitir comentarios",{exact:true}).isChecked(),true);
      const edited=pageA.waitForResponse(r=>new URL(r.url()).pathname===`/web-api/publicaciones/${created}`&&r.request().method()==="PUT");
      await pageA.getByRole("button",{name:"Guardar cambios",exact:true}).click();
      assert.equal((await edited).status(),200);
      await pageA.waitForURL(config.web+"/mis-publicaciones");
      const own=(await privateAPI(`/api/publicaciones/${created}`,tokenA)).body;
      assert.equal(own.tipo,"Arrendador");assert.equal(own.permitir_comentarios,true);
      const card=pageA.getByRole("heading",{name:"Arriendo UI actualizado",exact:true}).locator("..").locator("..").locator("..");
      const [closed]=await Promise.all([
        pageA.waitForResponse(r=>new URL(r.url()).pathname===`/web-api/publicaciones/${created}/cerrar`&&r.request().method()==="PATCH"),
        card.getByRole("button",{name:"Cerrar publicación",exact:true}).click(),
      ]);
      assert.equal(closed.status(),200);
      await card.getByText("Cerrada",{exact:true}).waitFor();
      const cupos=(await privateAPI(`/api/publicaciones/${created}/cupos`,null)).body;
      assert.equal(cupos.cupos_totales,2);assert.equal(cupos.cupos_disponibles,0);
      assert.ok((await privateAPI("/api/mis-publicaciones",tokenA)).body.some(p=>p.id===created));
      assert.ok(!(await privateAPI("/api/publicaciones",null)).body.some(p=>p.id===created));
      await pageA.setViewportSize({width:390,height:844});
      assert.equal(await pageA.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    } finally {
      await pageA.setViewportSize({width:1440,height:1000});
      if(!created) created=(await privateAPI("/api/mis-publicaciones",tokenA)).body.find(p=>["Arriendo UI sintético","Arriendo UI actualizado"].includes(p.titulo))?.id;
      if(created) await privateAPI(`/api/publicaciones/${created}`,tokenA,"DELETE");
    }
  });
  await pass("publication filters work against PostgreSQL and expose one cover per listing",async()=>{
    const filtered=await privateAPI("/api/publicaciones?tipo_vivienda=casa&mascota=no&cupos_min=1&precio_max=100000",null);
    assert.equal(filtered.status,200);assert.equal(filtered.body.length,2);
    assert.equal(new Set(filtered.body.map(p=>p.id)).size,2);
    assert.equal((await privateAPI("/api/publicaciones?precio_min=200000&precio_max=1",null)).status,422);
  });
  await pass("connection lifecycle uses real JWT, rejects spoofing and preserves domain separation",async()=>{
    const people=(await privateAPI("/conexiones/usuarios/buscar",null)).body;
    const a=people.find(p=>p.nombre===A.nombre).id_usuario_PK;
    const b=people.find(p=>p.nombre===B.nombre).id_usuario_PK;
    const send=async(path,token,method="GET",body)=>{
      const r=await fetch(config.web+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:r.status,body:r.status===204?null:await r.json()};
    };
    assert.equal((await send("/conexiones/",null,"POST",{id_receptor_FK:b})).status,401);
    assert.equal((await send("/conexiones/",tokenA,"POST",{id_solicitante_FK:b,id_receptor_FK:a})).status,403);
    assert.equal((await send("/conexiones/",tokenA,"POST",{id_receptor_FK:a})).status,422);
    const created=await send("/conexiones/",tokenA,"POST",{id_receptor_FK:b});
    assert.equal(created.status,201);const id=created.body.id_conexion;
    try {
      assert.equal(created.body.id_solicitante_FK,a);
      assert.equal((await send("/conexiones/",tokenB,"POST",{id_receptor_FK:a})).status,400);
      assert.equal((await send(`/conexiones/recibidas/${a}`,tokenB)).status,403);
      assert.equal((await send("/conexiones/recibidas",tokenB)).body[0].id_conexion,id);
      assert.equal((await send("/conexiones/enviadas",tokenA)).body[0].id_conexion,id);
      assert.equal((await send(`/conexiones/${id}`,tokenA,"PUT",{estado:"Aceptada"})).status,403);
      assert.equal((await send(`/conexiones/${id}`,tokenB,"PUT",{estado:"Pendiente"})).status,422);
      assert.equal((await send(`/conexiones/${id}`,tokenB,"PUT",{estado:"Aceptada"})).status,200);
      assert.equal((await send("/conexiones/aceptadas",tokenA)).body[0].id_conexion,id);
      assert.equal((await send(`/conexiones/${id}`,tokenB,"PUT",{estado:"Rechazada"})).status,400);
      const profile=(await send(`/conexiones/usuarios/${a}`,null)).body;
      assert.equal(profile.nombre,A.nombre);assert.ok(!("correo" in profile));
    } finally { assert.equal((await send(`/conexiones/${id}`,tokenA,"DELETE")).status,204); }
    const rejected=await send("/conexiones/",tokenA,"POST",{id_receptor_FK:b});
    assert.equal(rejected.status,201);
    try { assert.equal((await send(`/conexiones/${rejected.body.id_conexion}`,tokenB,"PUT",{estado:"Rechazada"})).body.estado,"Rechazada"); }
    finally { await send(`/conexiones/${rejected.body.id_conexion}`,tokenB,"DELETE"); }
    assert.deepEqual((await send("/conexiones/aceptadas",tokenA)).body,[]);
    assert.equal((await send("/api/postulaciones/mias",tokenA)).status,404);
  });
  await pass("Next connection send, acceptance, rejection and deletion use HttpOnly BFF",async()=>{
    await pageA.goto(config.web+"/inicio?vista=personas");
    const profile=pageA.getByRole("heading",{name:B.nombre,exact:true}).locator("..").locator("..");
    const sent=pageA.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/conexiones"&&r.request().method()==="POST");
    await profile.getByRole("button",{name:"Conectar",exact:true}).click();
    assert.equal((await sent).status(),201);
    await pageB.goto(config.web+"/mis-conexiones");
    await pageB.getByRole("heading",{name:`${A.nombre} → ${B.nombre}`,exact:true}).waitFor();
    const accepted=pageB.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/conexiones"&&r.request().method()==="PUT");
    await pageB.getByRole("button",{name:"Aceptar",exact:true}).click();
    assert.equal((await accepted).status(),200);
    await pageB.getByRole("tab",{name:"Aceptadas",exact:true}).click();
    await pageB.getByText("Aceptada",{exact:true}).waitFor();
    const deleted=pageB.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/conexiones"&&r.request().method()==="DELETE");
    await pageB.getByRole("button",{name:"Eliminar conexión",exact:true}).click();
    assert.equal((await deleted).status(),200);
    await pageB.getByText("No hay conexiones en esta vista.",{exact:true}).waitFor();
    const resend=pageA.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/conexiones"&&r.request().method()==="POST");
    await profile.getByRole("button",{name:"Conectar",exact:true}).click();
    assert.equal((await resend).status(),201);
    await pageB.getByRole("tab",{name:"Recibidas",exact:true}).click();
    const rejected=pageB.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/conexiones"&&r.request().method()==="PUT");
    await pageB.getByRole("button",{name:"Rechazar",exact:true}).click();
    assert.equal((await rejected).status(),200);
    await pageA.goto(config.web+"/mis-conexiones");
    await pageA.getByRole("tab",{name:"Enviadas",exact:true}).click();
    await pageA.getByText("Rechazada",{exact:true}).waitFor();
    const cleanup=pageA.waitForResponse(r=>new URL(r.url()).pathname==="/web-api/conexiones"&&r.request().method()==="DELETE");
    await pageA.getByRole("button",{name:"Eliminar conexión",exact:true}).click();
    assert.equal((await cleanup).status(),200);
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
    assert.equal((await privateAPI("/api/admin/resumen",tokenA)).status,401);
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
        const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(credentials),signal:AbortSignal.timeout(10_000)});
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
    // End development RSC/prefetch streams before awaiting their body readers.
    // Completed public responses have already been inspected by the listener.
    await Promise.all(contexts.map(ctx=>ctx.close()));
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
