/** Real Next/BFF/React with HTTP fixtures; does not prove SQL behavior. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
test("E05 owner confirmation, double click, hidden action and active revocation", {
 skip: !process.env.REPORTS_PLAYWRIGHT_PATH || !process.env.REPORTS_BROWSER_PATH, timeout: 180000,
}, async () => {
 const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH);
 const project = fileURLToPath(new URL("../",import.meta.url));
 const isolated = await mkdtemp(join(project,".proxy-test-lists-e05-"));
 let next, browser, linked = false, revoked = false, posts = 0;
 const removed = new Set();
 const member = {id_usuario:2,nombre:"Integrante de prueba",fecha_ingreso:"2026-11-24T12:00:00Z",activo:true,es_responsable:true};
 const other = {...member,id_usuario:3,nombre:"Otra integrante",es_responsable:false};
 const rental = {id_arriendo:1,id_publicacion:7,cupos_totales:2,version_capacidad:1,ocupacion:2};
 const upstream = createServer(async (request,response) => {
  response.setHeader("Content-Type","application/json");
  const reply = (status,data) => { response.statusCode=status; response.end(JSON.stringify(data)); };
  const path = new URL(request.url,"http://fixture.invalid").pathname;
  const owner = request.headers.authorization?.startsWith("Bearer account.");
  if(path === "/local/v1/perfil") return reply(200,{nombre: owner ? "Due?o de prueba" : "Integrante de prueba"});
  if(path === "/api/arriendos/mio") return revoked ? reply(404,{}) : reply(200,rental);
  if(path === "/api/arriendos/1") return reply(200,rental);
  if(path === "/api/arriendos/1/integrantes") return reply(200,{items:[member,other].filter(m=>!removed.has(m.id_usuario)),siguiente_cursor:null,puede_retirar:owner});
  if(path === "/api/arriendos/1/expulsiones") {
   posts++;
   let body=""; for await (const chunk of request) body+=chunk;
   const input=JSON.parse(body);
   assert.equal(input.confirmo,true); assert.equal(input.motivo,"Incumplimiento");
   await new Promise(resolve=>setTimeout(resolve,300)); removed.add(input.id_usuario);
   return reply(200,{id_arriendo:1,id_usuario:input.id_usuario,estado:removed.size===2?"Finalizado":"Activo",integrantes_activos:2-removed.size,cupos_disponibles:removed.size});
  }
  if(path === "/api/arriendos/1/tareas") return revoked ? reply(403,{}) : reply(200,{items:[{id_tarea:1,id_arriendo:1,id_creador:2,id_asignado:2,titulo:"Tarea privada",descripcion:null,estado:"Pendiente",fecha_creacion:"2026-11-24T12:00:00Z"}],siguiente_cursor:null});
  if(path === "/api/conversaciones") return reply(200,{items:[{id_conversacion:1,id_arriendo:1,fecha_creacion:"2026-11-24T12:00:00Z"}]});
  if(path === "/api/conversaciones/1/mensajes") return revoked ? reply(403,{}) : reply(200,{items:[{id_mensaje:1,id_conversacion:1,id_remitente:3,nombre_remitente:"Otra integrante",contenido:"Mensaje privado",fecha_envio:"2026-11-24T12:00:00Z"}],siguiente_cursor:null});
  return reply(404,{});
 });
 await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
 const origin=`http://127.0.0.1:${upstream.address().port}`;
 const listen=createServer(); await new Promise(resolve=>listen.listen(0,"127.0.0.1",resolve));
 const port=listen.address().port; await new Promise(resolve=>listen.close(resolve));
 const base=`http://127.0.0.1:${port}`;
 try {
    for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) await cp(join(project, name), join(isolated, name), { recursive: true });
    await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir"); linked = true;
    const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
    next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: isolated, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...clean, NEXT_TELEMETRY_DISABLED: "1", ROOMIES_LOCAL_MODE: "1", ROOMIES_RUNTIME_MODE: "disposable", WEB_AUTH_ENABLED: "true", WEB_AUTH_PROVIDER: "supabase", WEB_PROFILE_CONTRACT: "local-v1", WEB_REPORTES_ENABLED: "true", WEB_AUTH_ORIGIN: base, WEB_AUTH_FASTAPI_ORIGIN: origin, FASTAPI_ORIGIN: origin, WEB_SUPABASE_ORIGIN: origin, WEB_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" },
    });
    next.stdout.on("data", () => {}); next.stderr.on("data", () => {});
    for (let i = 0; i < 100; i++) {
      if (next.exitCode !== null) throw new Error("Next aislado terminó antes de estar listo");
      try { if ((await fetch(base)).ok) break; } catch { /* Startup only. */ }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    browser = await chromium.launch({ executablePath: process.env.REPORTS_BROWSER_PATH, headless: true });
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1360, height: 980 } });
    const token = who => `${who}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signed`;
    await ctx.addCookies([{ name: "roomies_sb_dev_access", value: token("account"), url: base, httpOnly: true, sameSite: "Strict" }]);
    await ctx.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());

  const page=await ctx.newPage();
  await page.goto(base+"/mi-arriendo/1/integrantes");
  await page.getByRole("button",{name:"Retirar a Integrante de prueba"}).click();
  const confirm=page.getByRole("button",{name:"Confirmar retiro",exact:true});
  assert.equal(await confirm.isDisabled(),true);
  await page.getByLabel("Motivo del retiro").fill("Incumplimiento");
  assert.equal(await confirm.isDisabled(),true);
  await page.getByRole("checkbox").check();
  const evidence=join(project,"../docs/evidence/E05"); await mkdir(evidence,{recursive:true});
  await page.screenshot({path:join(evidence,"01-confirmacion-retiro.png"),fullPage:true});
  await confirm.click({clickCount:2});
  await page.getByRole("status").filter({hasText:"Cupos disponibles: 1"}).waitFor();
  assert.equal(posts,1);
  await page.getByRole("button",{name:"Retirar a Otra integrante"}).click();
  await page.getByLabel("Motivo del retiro").fill("Incumplimiento");
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:"Confirmar retiro",exact:true}).click();
  await page.getByRole("status").filter({hasText:"El arriendo finaliz"}).waitFor();
  assert.equal(posts,2);
  await ctx.addCookies([{name:"roomies_sb_dev_access",value:token("resident"),url:base,httpOnly:true,sameSite:"Strict"}]);
  removed.clear();
  await page.goto(base+"/mi-arriendo/1/integrantes");
  await page.getByRole("heading",{name:"Otros integrantes residentes"}).waitFor();
  assert.equal(await page.getByRole("button",{name:/Retirar a/}).count(),0);
  await page.goto(base+"/mi-arriendo/tareas");
  await page.getByText("Tarea privada",{exact:true}).waitFor();
  revoked=true;
  await page.getByRole("heading",{name:"Acceso no disponible"}).waitFor({timeout:12000});
  assert.equal(await page.getByText("Tarea privada",{exact:true}).count(),0);
  await page.screenshot({path:join(evidence,"02-acceso-revocado.png"),fullPage:true});
  revoked=false;
  await page.goto(base+"/mi-arriendo/chat");
  await page.getByText("Mensaje privado",{exact:true}).waitFor();
  await page.getByLabel("Escribe un mensaje").fill("Borrador privado");
  revoked=true;
  await page.getByRole("heading",{name:"Acceso no disponible"}).waitFor({timeout:12000});
  assert.equal(await page.getByText("Mensaje privado",{exact:true}).count(),0);
  assert.equal(await page.getByLabel("Escribe un mensaje").count(),0);
  await page.screenshot({path:join(evidence,"03-chat-revocado.png"),fullPage:true});
  await page.reload();
  await page.getByRole("heading",{name:"Acceso no disponible"}).waitFor();
  revoked=false;
  await page.goto(base+"/mi-arriendo");
  await page.getByRole("link",{name:/Chat del arriendo/}).waitFor();
  revoked=true;
  await page.getByText("Aún no tienes un arriendo activo.",{exact:true}).waitFor({timeout:12000});
  assert.equal(await page.getByRole("link",{name:/Chat del arriendo|Ver tareas|Abrir tareas/}).count(),0);
  } finally {
    await browser?.close();
    if (next?.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); else next.kill();
      await new Promise(resolve => next.once("exit", resolve));
    }
    upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-lists-")) throw new Error("Ruta de limpieza inesperada");
    if (linked) { if (process.platform === "win32") await rmdir(join(isolated, "node_modules")); else await unlink(join(isolated, "node_modules")); }
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
