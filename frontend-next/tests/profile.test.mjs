import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transpile=(source)=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleURL=(source)=>`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`;
const gateway=(await readFile(new URL("../src/lib/auth/gateway.ts",import.meta.url),"utf8")).replace('import "server-only";','');
const source=(await readFile(new URL("../src/lib/perfil/server.ts",import.meta.url),"utf8")).replace('import "server-only";','').replace('"../auth/gateway"',JSON.stringify(moduleURL(gateway)));
const {handleProfile,normalizeProfile,profilePhoto}=await import(moduleURL(source));
const config={origin:"https://web.example.com",backend:"https://api.example.com",secure:true};
const profile={nombre:"Perfil A",edad:25,ocupacion:"Estudiante",ciudad:"Ciudad A",breve_descripcion:"Descripción A",sobre_mi:"Información A",foto_perfil:"/imagenes/a.png",total_publicaciones:2};
const req=(token="header.payload.signature",query="")=>new Request(`${config.origin}/web-api/perfil${query}`,{headers:{cookie:`__Host-haycupo_session=${token}`,Authorization:"Bearer ignored-client-token"}});

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
  assert.deepEqual(normalizeProfile({nombre:"",edad:"",total_publicaciones:0}),{nombre:"",edad:null,ocupacion:null,ciudad:null,breve_descripcion:null,sobre_mi:null,foto_perfil:null,total_publicaciones:0});
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
test("el adaptador de perfil no admite escritura",async()=>{
  const response=await handleProfile(new Request(config.origin,{method:"POST"}),config);
  assert.equal(response.status,405);
  assert.equal(response.headers.get("Allow"),"GET");
});
