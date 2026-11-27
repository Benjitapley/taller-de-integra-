/** Real Next/BFF/React with HTTP fixtures; does not prove SQL behavior. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, rmdir, symlink, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
test("E06 web: tres páginas de tareas e integrantes, red, reintento y revocación", {
 skip: !process.env.REPORTS_PLAYWRIGHT_PATH || !process.env.REPORTS_BROWSER_PATH, timeout: 180000,
}, async () => {
 const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH);
 const project = fileURLToPath(new URL("../",import.meta.url));
 const isolated = await mkdtemp(join(project,".proxy-test-lists-e04-"));
 let next, browser, linked = false, revoked = false, createFail = true, patchStatus = 503, posts = 0, failMore = true, memberFail = true, memberReads = 0;
 const members = Array.from({length:53},(_,i)=>i+2).map(id => ({id_usuario:id,nombre:id===4?null:`Integrante ${id}`,fecha_ingreso:"2026-11-24T12:00:00Z",activo:true,es_responsable:id===2}));
 const rental = {id_arriendo:1,id_publicacion:7,cupos_totales:3,version_capacidad:1,ocupacion:3};
 const tasks = Array.from({length:43},(_,i)=>({id_tarea:i+1,id_arriendo:1,id_creador:2,id_asignado:i===2?null:i===1?3:2,titulo:`Tarea ${i+1}`,descripcion:null,estado:"Pendiente",fecha_creacion:"2026-11-24T12:00:00Z"}));
 const upstream = createServer(async (request,response) => {
  response.setHeader("Content-Type","application/json");
  const reply = (status,data) => { response.statusCode=status; response.end(JSON.stringify(data)); };
  const url = new URL(request.url,"http://fixture.invalid"), path=url.pathname;
  if(path === "/local/v1/perfil") return reply(200,{id_usuario_PK:2,nombre:"Integrante 2"});
  if(path === "/api/arriendos/mio") return revoked ? reply(404,{}) : reply(200,rental);
  if(revoked) return reply(403,{});
  if(path === "/api/arriendos/1/integrantes") {
   memberReads++;
   const start=Number((url.searchParams.get("cursor")||"members0").replace("members",""));
   if(start && memberFail) { memberFail=false; return reply(503,{}); }
   return reply(200,{items:members.slice(start,start+20),siguiente_cursor:start+20<members.length?`members${start+20}`:null,puede_retirar:false});
  }
  if(path === "/api/arriendos/1/tareas") {
   if(request.method === "POST") {
    posts++; let body=""; for await (const chunk of request) body+=chunk;
    await new Promise(resolve=>setTimeout(resolve,200));
    if(createFail) return reply(422,{});
    const task={...tasks[0],...JSON.parse(body),id_tarea:44}; tasks.push(task); return reply(201,task);
   }
   const after=Number(url.searchParams.get("cursor")||0), state=url.searchParams.get("estado");
   if(after && failMore) { failMore=false; return reply(503,{}); }
   const rows=tasks.filter(t=>t.id_tarea>after&&(!state||t.estado===state)),page=rows.slice(0,20);
   return reply(200,{items:page,siguiente_cursor:rows.length>20?String(page.at(-1).id_tarea):null,id_usuario_actual:2});
  }
  if(path.startsWith("/api/tareas/")) {
   let body=""; for await (const chunk of request) body+=chunk;
   if(patchStatus) return reply(patchStatus,{detail:"Completar requiere ser el asignado activo."});
   const task=tasks.find(t=>t.id_tarea===Number(path.split("/")[3]));
   Object.assign(task,JSON.parse(body)); return reply(200,task);
  }
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
  const errors=[]; page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/mi-arriendo/tareas");
  const item=id=>page.locator("li").filter({has:page.getByText(`Tarea ${id}`,{exact:true})});
  await item(1).waitFor();
  await page.getByRole("button",{name:/Nueva tarea/}).waitFor();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Nueva tarea"))?.disabled);
  assert.equal(memberReads,1,"La pantalla solicita una sola página inicial de integrantes");
  assert.equal(await item(1).getByRole("button",{name:"Completar",exact:true}).count(),1);
  assert.equal(await item(2).getByRole("button",{name:"Completar",exact:true}).count(),0);
  await item(1).getByRole("button",{name:"Completar",exact:true}).click();
  await page.getByRole("alert").first().waitFor();
  await item(1).getByText("Pendiente",{exact:true}).waitFor();

  // El fallo de página siguiente conserva opciones y reintenta el mismo cursor.
  await page.getByRole("button",{name:/Nueva tarea/}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"Más integrantes para asignar",exact:true}).click();
  await dialog.getByRole("button",{name:"Reintentar integrantes",exact:true}).click();
  await dialog.getByLabel("Asignar a (opcional)").locator('option[value="41"]').waitFor({state:"attached"});
  await dialog.getByRole("button",{name:"Más integrantes para asignar",exact:true}).click();
  await dialog.getByLabel("Asignar a (opcional)").locator('option[value="54"]').waitFor({state:"attached"});
  await dialog.getByRole("button",{name:"Cerrar diálogo",exact:true}).click();
  await page.getByText("Todos los integrantes cargados.",{exact:true}).waitFor();
  assert.equal(await item(1).getByRole("combobox").locator("option").count(),54);
  assert.equal(memberReads,4);

  await page.getByRole("button",{name:/Nueva tarea/}).click();
  await dialog.getByLabel("Nombre de la tarea").fill("Aseo de la cocina");
  await dialog.getByLabel("Asignar a (opcional)").selectOption("54");
  await dialog.getByRole("button",{name:"Crear tarea",exact:true}).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByLabel("Nombre de la tarea").inputValue(),"Aseo de la cocina");
  assert.equal(await dialog.getByLabel("Asignar a (opcional)").inputValue(),"54");
  createFail=false;
  await dialog.getByRole("button",{name:"Crear tarea",exact:true}).click({clickCount:2});
  await dialog.waitFor({state:"hidden"}); assert.equal(posts,2);
  await page.getByText("Tarea guardada.",{exact:true}).waitFor();

  const more=page.getByRole("button",{name:"Más tareas",exact:true});
  await more.click();
  await page.getByRole("button",{name:"Reintentar",exact:true}).click();
  await item(40).waitFor(); await item(1).waitFor();
  await more.click(); await item(43).waitFor();
  await page.getByText("Fin de la lista de tareas.",{exact:true}).waitFor();
  assert.equal(await page.locator("li").filter({has:page.locator("strong")}).count(),44);
  assert.equal(await more.count(),0);
  await page.getByRole("button",{name:"Completadas",exact:true}).click();
  await page.getByText("No hay tareas completadas para este arriendo.",{exact:true}).waitFor();
  assert.equal(await item(1).count(),0);
  tasks[0].estado="Completada";
  await page.reload();
  await page.getByRole("button",{name:"Completadas",exact:true}).click();
  await item(1).getByText("Completada",{exact:true}).waitFor();
  revoked=true;
  await page.reload();
  await page.getByRole("heading",{name:"Acceso no disponible"}).waitFor({timeout:12000});
  assert.equal(await item(1).count(),0);
  assert.deepEqual(errors,[]);
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
