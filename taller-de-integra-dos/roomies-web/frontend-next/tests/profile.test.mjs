import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transpile=(source)=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleURL=(source)=>`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`;
const gateway=(await readFile(new URL("../src/lib/auth/gateway.ts",import.meta.url),"utf8")).replace('import "server-only";','');
const validation=moduleURL(await readFile(new URL("../src/features/perfil/validation.ts",import.meta.url),"utf8"));
const source=(await readFile(new URL("../src/lib/perfil/server.ts",import.meta.url),"utf8")).replace('import "server-only";','').replace('"../auth/gateway"',JSON.stringify(moduleURL(gateway))).replace('"../../features/perfil/validation"',JSON.stringify(validation));
const {handleProfile,handleProfilePhoto,normalizeProfile,profilePhoto}=await import(moduleURL(source));
const config={origin:"https://web.example.com",backend:"https://api.example.com",secure:true};
const profile={nombre:"Perfil A",edad:25,ocupacion:"Estudiante",ciudad:"Ciudad A",breve_descripcion:"Descripción A",sobre_mi:"Información A",foto_perfil:"/imagenes/a.png",total_publicaciones:2,verificado:true};
const req=(token="header.payload.signature",query="")=>new Request(`${config.origin}/web-api/perfil${query}`,{headers:{cookie:`__Host-haycupo_session=${token}`,Authorization:"Bearer ignored-client-token"}});

test("el estado de correo solo acepta booleanos del perfil autenticado",()=>{
  assert.equal(normalizeProfile({...profile,verificado:true}).verificado,true);
  assert.equal(normalizeProfile({...profile,verificado:false}).verificado,false);
  for(const value of [undefined,null,"true","false",1,0,{}]) assert.equal(normalizeProfile({...profile,verificado:value}).verificado,null);
});

test("perfil autoriza desde cookie, consulta destino fijo y permite solo campos públicos",async()=>{
  const response=await handleProfile(req(undefined,"?id_usuario=999"),config,async(url,options)=>{
    assert.equal(url,`${config.backend}/api/perfil`);
    assert.equal(options.headers.Authorization,"Bearer header.payload.signature");
    assert.equal(options.headers.Cookie,undefined);
    assert.equal(options.cache,"no-store");
    assert.equal(options.redirect,"error");
    return Response.json({...profile,access_token:"private-token",contrasena:"private-password",id_usuario:999,correo:"private@example.com"});
  });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),profile);
  assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.equal(response.headers.get("Vary"),"Cookie");
  assert.equal(response.headers.get("Set-Cookie"),null);
});
test("sin configuración, cookie inválida, duplicada o usuario ID no se contacta backend",async()=>{
  const noNetwork=()=>{throw new Error("must not contact backend");};
  assert.equal((await handleProfile(req(),null,noNetwork)).status,503);
  for(const cookie of ["roomies_id=1","__Host-haycupo_session=demo","__Host-haycupo_session=a.b.c; __Host-haycupo_session=d.e.f",""]) {
    const response=await handleProfile(new Request(config.origin,{headers:{cookie,Authorization:"Bearer ignored"}}),config,noNetwork);
    assert.equal(response.status,401);
    assert.match(response.headers.get("Set-Cookie"),/HttpOnly; SameSite=Strict; Max-Age=0; Secure/);
  }
});
for(const status of [401,403]) test(`backend ${status} elimina cookie y devuelve sesión expirada sin filtrar errores`,async()=>{
  const response=await handleProfile(req(),config,async()=>Response.json({detail:"do-not-reflect",access_token:"private"},{status}));
  assert.equal(response.status,status);
  assert.match(response.headers.get("Set-Cookie"),/Max-Age=0/);
  const body=await response.text();
  assert.match(body,/sesión ha expirado/);
  assert.doesNotMatch(body,/do-not-reflect|access_token/);
});
test("perfil inexistente se distingue de errores de servicio",async()=>{
  const response=await handleProfile(req(),config,async()=>Response.json({detail:"database-secret"},{status:404}));
  assert.equal(response.status,404);
  assert.match((await response.json()).detail,/No hay un perfil/);
});
test("errores de red, HTTP y respuestas inválidas son controlados sin inventar perfil",async()=>{
  for(const transport of [async()=>{throw new Error("network-secret");},async()=>new Response("invalid-json"),async()=>Response.json({}, {status:500}),async()=>Response.json({}, {status:503}),async()=>Response.json(null),async()=>Response.json({}),async()=>Response.json({...profile,total_publicaciones:-1}),async()=>Response.json({...profile,edad:"invalid"})]){
    const response=await handleProfile(req(),config,transport);
    assert.equal(response.status,503);
    assert.equal(response.headers.get("Set-Cookie"),null);
    assert.doesNotMatch(await response.text(),/network-secret|invalid-json/);
  }
});
test("campos vacíos, edad textual y cero publicaciones mantienen su significado",()=>{
  assert.deepEqual(normalizeProfile({nombre:"",edad:"",total_publicaciones:0}),{nombre:"",edad:null,ocupacion:null,ciudad:null,breve_descripcion:null,sobre_mi:null,foto_perfil:null,total_publicaciones:0,verificado:null});
  assert.equal(normalizeProfile({...profile,edad:"25"}).edad,25);
});
test("foto solo permite imágenes existentes locales sin URL externa ni credenciales",()=>{
  for(const value of ["https://remote.example.com/avatar.png","//remote.example.com/avatar.png","data:image/png,anything","javascript:alert(1)","/imagenes/../avatar.png","/imagenes/a.svg","/imagenes/a.png?token=secret","/imagenes/a%2f..png",null])assert.equal(profilePhoto(value),null);
  assert.equal(profilePhoto("/imagenes/abc-123.webp"),"/imagenes/abc-123.webp");
});
test("dos usuarios no comparten caché ni pueden elegir el ID consultado",async()=>{
  const transport=async(url,options)=>{
    assert.equal(url,`${config.backend}/api/perfil`);
    return Response.json({...profile,nombre:options.headers.Authorization.endsWith("userA.payload.sig")?"Usuario A":"Usuario B"});
  };
  const [a,b]=await Promise.all([handleProfile(req("userA.payload.sig","?id_usuario=B"),config,transport),handleProfile(req("userB.payload.sig","?id_usuario=A"),config,transport)]);
  assert.equal((await a.json()).nombre,"Usuario A");
  assert.equal((await b.json()).nombre,"Usuario B");
});
test("el adaptador de perfil rechaza métodos fuera del contrato",async()=>{
  const response=await handleProfile(new Request(config.origin,{method:"POST"}),config);
  assert.equal(response.status,405);
  assert.equal(response.headers.get("Allow"),"GET, PUT");
});

const validForm = () => {
  const form = new FormData();
  for(const [key,value] of Object.entries({edad:"25",ocupacion:"Estudiante",ciudad:"Temuco",breve_descripcion:"Descripción",sobre_mi:"Biografía"})) form.set(key,value);
  return form;
};
const putRequest = (form=validForm(),headers={},cookie="__Host-haycupo_session=header.payload.signature") => new Request(`${config.origin}/web-api/perfil?id_usuario=999`,{method:"PUT",headers:{cookie,Origin:config.origin,"X-Haycupo-CSRF":"1",...headers},body:form});
test("PUT transmite multipart y Bearer solo al perfil propio sin ID ni credenciales del navegador",async()=>{
  const response=await handleProfile(putRequest(),config,async(url,options)=>{
    assert.equal(url,config.backend+"/api/perfil");
    assert.equal(options.method,"PUT");
    assert.equal(options.headers.Authorization,"Bearer header.payload.signature");
    assert.equal(options.headers["Content-Type"],undefined);
    assert.equal(options.body.get("ciudad"),"Temuco");
    assert.equal(options.body.has("id_usuario"),false);
    return Response.json({mensaje:"Perfil actualizado permanentemente"});
  });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{success:true});
});
test("PUT rechaza CSRF, campos ajenos, repetidos, edad y fotos inválidas antes de acceder al servicio",async()=>{
  const noNetwork=()=>{throw new Error("no network expected");};
  for(const headers of [{Origin:"https://evil.example.com"},{"X-Haycupo-CSRF":""},{"Sec-Fetch-Site":"cross-site"}]) {
    const rejected=await handleProfile(putRequest(validForm(),headers),config,noNetwork);
    assert.equal(rejected.status,403);
    assert.equal((await rejected.json()).code,"CSRF_REJECTED");
    assert.equal(rejected.headers.get("Set-Cookie"),null);
  }
  assert.equal((await handleProfile(putRequest(validForm(),{},""),config,noNetwork)).status,401);
  for(const [key,value] of [["id_usuario","999"],["verificado","true"],["edad","21 años"],["edad","121"],["ciudad","x".repeat(101)],["sobre_mi","x".repeat(5001)]]) {
    const form=validForm();form.set(key,value);
    assert.equal((await handleProfile(putRequest(form),config,noNetwork)).status,422);
  }
  const repeated=validForm();repeated.append("ciudad","Otra");
  assert.equal((await handleProfile(putRequest(repeated),config,noNetwork)).status,422);
  const photo=validForm();photo.set("foto",new File(["<svg/>"],"a.svg",{type:"image/svg+xml"}));
  assert.equal((await handleProfile(putRequest(photo),config,noNetwork)).status,422);
  const large=validForm();large.set("foto",new File([new Uint8Array(6*1024*1024)],"a.png",{type:"image/png"}));
  const encoded=putRequest(large);
  const streamed=new Request(encoded.url,{method:"PUT",headers:encoded.headers,body:await encoded.arrayBuffer()});
  assert.equal((await handleProfile(streamed,config,noNetwork)).status,413);
});
test("PUT conserva errores útiles y no filtra detalles internos; expiración borra cookie",async()=>{
  for(const status of [401,403,413,422,500]) {
    const response=await handleProfile(putRequest(),config,async()=>Response.json({detail:"database-secret"},{status}));
    assert.equal(response.status,status===500?503:status);
    assert.doesNotMatch(await response.text(),/database-secret/);
    assert.equal(Boolean(response.headers.get("Set-Cookie")),status===401);
  }
});

test("PUT distingue permiso denegado de sesión inválida sin exponer el error del backend",async()=>{
  const forbidden=await handleProfile(putRequest(),config,async()=>Response.json({detail:"private permission error"},{status:403}));
  assert.equal(forbidden.status,403);
  assert.equal(forbidden.headers.get("Set-Cookie"),null);
  assert.deepEqual(await forbidden.json(),{code:"FORBIDDEN",detail:"No tienes permiso para guardar estos cambios."});
  const expired=await handleProfile(putRequest(),config,async()=>Response.json({detail:"private session error"},{status:401}));
  assert.equal(expired.status,401);
  assert.match(expired.headers.get("Set-Cookie"),/Max-Age=0/);
  assert.match((await expired.json()).detail,/sesión ha expirado/);
});

const canonical = { ...config, provider: "supabase", profileContract: "v1", supabase: { origin: "https://proyecto.supabase.co" } };
const storagePhoto = canonical.supabase.origin + "/storage/v1/object/public/perfiles/17/new.webp";
const canonicalHeaders = { cookie: "__Host-roomies_sb_access=fixture.token.signature", Origin: canonical.origin, "X-Haycupo-CSRF": "1" };

test("SCRUM-94 mantiene perfil y edad desconocida aunque Listado no responda", async () => {
  const transition = { ...config, provider: "supabase" };
  const response = await handleProfile(new Request(config.origin, { headers: canonicalHeaders }), transition, async url => {
    if (url.endsWith("/api/v1/perfil")) return Response.json({ ...profile, edad: null, edad_calculada: false });
    assert.equal(url, config.backend + "/api/v1/publicaciones/resumen");
    return Response.json({}, { status: 503 });
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.nombre, profile.nombre);
  assert.equal(result.edad, null);
  assert.equal(result.edad_calculada, false);
  assert.equal(result.total_publicaciones, null);
});

test("el despliegue local-v1 usa solo las rutas configuradas sin fallback de identidad", async () => {
  const transition = { ...config, provider: "supabase", profileContract: "local-v1" };
  const visited = [];
  const response = await handleProfile(new Request(config.origin, { headers: canonicalHeaders }), transition, async url => {
    visited.push(url);
    return url.endsWith("/perfil") ? Response.json({ ...profile, edad_calculada: true })
      : Response.json({ total_publicaciones: 2 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(visited, [config.backend + "/local/v1/perfil", config.backend + "/local/v1/publicaciones/resumen"]);
});

test("el perfil común consulta un solo endpoint y adapta el correo y la foto de Storage", async () => {
  const response = await handleProfile(new Request(canonical.origin, { headers: canonicalHeaders }), canonical, async (url, options) => {
    assert.equal(url, canonical.backend + "/api/usuarios/me");
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signature");
    return Response.json({ ...profile, foto_perfil: storagePhoto, correo_verificado: true, genero: "Otro", id_region_interes: 9 });
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.foto_perfil, storagePhoto);
  assert.equal(result.edad_calculada, true);
  assert.equal(result.verificado, true);
  assert.equal(result.id_region_interes, 9);
  assert.equal(normalizeProfile({ ...profile, foto_perfil: storagePhoto + "?secret=x" }, canonical).foto_perfil, null);
  assert.equal(normalizeProfile({ ...profile, foto_perfil: storagePhoto.replace("/perfiles/", "/avisos/") }, canonical).foto_perfil, null);
});

test("PATCH entrega solo campos editables, conserva null y comunica fallos del Gateway", async () => {
  const patch = (changes, headers = {}) => new Request(canonical.origin, {
    method: "PATCH", headers: { ...canonicalHeaders, "Content-Type": "application/json", ...headers }, body: JSON.stringify(changes),
  });
  const changes = { ocupacion: "Ambos", sobre_mi: null, id_region_interes: 9, id_comuna_interes: 9101 };
  const response = await handleProfile(patch(changes), canonical, async (url, options) => {
    assert.equal(url, canonical.backend + "/api/usuarios/me");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signature");
    assert.deepEqual(JSON.parse(options.body), changes);
    return Response.json({ detail: "no devolver" }, { status: 422 });
  });
  assert.equal(response.status, 422);
  assert.doesNotMatch(await response.text(), /no devolver|success/);
  const prevent = async () => { assert.fail("No debe contactar el Gateway"); };
  assert.equal((await handleProfile(patch(changes, { Origin: "https://otro.example" }), canonical, prevent)).status, 403);
  for (const invalid of [{ edad: 21 }, { nombre: "Otra persona" }, { ocupacion: "Cualquiera" }, { breve_descripcion: "a".repeat(161) }, { id_region_interes: "9" }]) {
    assert.equal((await handleProfile(patch(invalid), canonical, prevent)).status, 422);
  }
});

test("PUT foto conserva el boundary y solo confirma una URL pública válida del bucket perfiles", async () => {
  const upload = (size = 10, type = "image/webp", headers = canonicalHeaders) => {
    const form = new FormData();
    form.set("foto", new File([new Uint8Array(size)], "new.webp", { type }));
    return new Request(canonical.origin + "/web-api/perfil/foto", { method: "PUT", headers, body: form });
  };
  const request = upload();
  const contentType = request.headers.get("content-type");
  const response = await handleProfilePhoto(request, canonical, async (url, options) => {
    assert.equal(url, canonical.backend + "/api/usuarios/me/foto");
    assert.equal(options.headers["Content-Type"], contentType);
    const form = await new Response(options.body, { headers: { "Content-Type": contentType } }).formData();
    assert.deepEqual(Array.from(form.keys()), ["foto"]);
    assert.equal(form.get("foto").size, 10);
    assert.equal(options.headers.Authorization, "Bearer fixture.token.signature");
    return Response.json({ foto_perfil: storagePhoto, token: "privado" });
  });
  assert.deepEqual(await response.json(), { foto_perfil: storagePhoto });
  const prevent = async () => { assert.fail("No debe contactar el Gateway"); };
  assert.equal((await handleProfilePhoto(upload(5_000_001), canonical, prevent)).status, 413);
  assert.equal((await handleProfilePhoto(upload(10, "image/svg+xml"), canonical, prevent)).status, 415);
  assert.equal((await handleProfilePhoto(upload(10, "image/webp", {}), canonical, prevent)).status, 401);
  assert.equal((await handleProfilePhoto(upload(), canonical, async () => Response.json({ foto_perfil: "blob:temporal" }))).status, 503);
});
