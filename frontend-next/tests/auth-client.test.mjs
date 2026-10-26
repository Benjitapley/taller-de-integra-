import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/features/auth/client.ts",import.meta.url),"utf8");
const { outputText } = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const { submitAuth } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("verificar y reenviar usan los endpoints existentes, CSRF y cookie sin Bearer del navegador",async t=>{
  for(const [action,body] of [["verificar",{correo:"test@example.com",codigo:"012345"}],["reenviar-codigo",{correo:"test@example.com"}]]) {
    t.mock.method(globalThis,"fetch",async(url,options)=>{
      assert.equal(url,`/web-api/auth/${action}`);
      assert.equal(options.method,"POST");
      assert.equal(options.credentials,"same-origin");
      assert.equal(options.cache,"no-store");
      assert.equal(options.headers["X-Haycupo-CSRF"],"1");
      assert.equal(options.headers.Authorization,undefined);
      assert.deepEqual(JSON.parse(options.body),body);
      return Response.json({success:true,message:"Operación confirmada"});
    });
    assert.equal((await submitAuth(action,body)).ok,true);
    t.mock.restoreAll();
  }
});
test("Retry-After válido se conserva y una respuesta de límite nunca acredita verificación",async t=>{
  for(const [retry,expected] of [["60",60],["invalid",0],["999999",0]]) {
    t.mock.method(globalThis,"fetch",async()=>Response.json({detail:"Espera antes de volver a intentar."},{status:429,headers:{"Retry-After":retry}}));
    const result = await submitAuth("reenviar-codigo",{correo:"test@example.com"});
    assert.equal(result.ok,false);
    assert.equal(result.retryAfter,expected);
    t.mock.restoreAll();
  }
});
test("errores y un 200 sin success no producen confirmación",async t=>{
  for(const status of [200,400,401,403,404,422,503]) {
    t.mock.method(globalThis,"fetch",async()=>Response.json({detail:"No confirmado"},{status}));
    const result=await submitAuth("verificar",{correo:"test@example.com",codigo:"012345"});
    assert.equal(result.ok,false);
    assert.equal(result.status,status);
    t.mock.restoreAll();
  }
});
test("caída de servicio y JSON inválido se manejan sin filtrar detalles internos",async t=>{
  for(const transport of [async()=>{throw new Error("internal-private-error");},async()=>new Response("invalid-json")]) {
    t.mock.method(globalThis,"fetch",transport);
    const result=await submitAuth("verificar",{correo:"test@example.com",codigo:"012345"});
    assert.equal(result.ok,false);
    assert.equal(result.status,503);
    assert.doesNotMatch(result.message,/internal-private-error|invalid-json/);
    t.mock.restoreAll();
  }
});
