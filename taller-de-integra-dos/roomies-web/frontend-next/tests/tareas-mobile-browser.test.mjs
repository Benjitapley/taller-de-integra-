/** E04: React real en navegador con hosts RN/Router y HTTP simulados.
 * No inicia Expo ni sustituye la aceptación en celular físico.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, rmdir, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("E06 móvil simulado: tres páginas, red, retiro, cambio de cuenta y desenfoque", {
  skip: !process.env.REPORTS_PLAYWRIGHT_PATH || !process.env.REPORTS_BROWSER_PATH, timeout: 180_000,
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.REPORTS_PLAYWRIGHT_PATH);
  const project = fileURLToPath(new URL("../", import.meta.url));
  const isolated = await mkdtemp(join(project, ".proxy-test-e04-mobile-"));
  const probe = createServer();
  await new Promise(done => probe.listen(0, "127.0.0.1", done));
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  const origin = `http://127.0.0.1:${port}`;
  let next, browser, linked = false;
  try {
    for (const name of ["next.config.ts", "package.json", "tsconfig.json", "src", "public"]) {
      await cp(join(project, name), join(isolated, name), { recursive: true });
    }
    await symlink(join(project, "node_modules"), join(isolated, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    linked = true;
    const route = join(isolated, "src/app/e04-mobile-test");
    await mkdir(route);
    const mobile = await readFile(new URL("../../../../taller de integra cuatro/roomies-app-movil/src/app/convivencia/tareas.tsx", import.meta.url), "utf8");
    await writeFile(join(route, "screen.tsx"), '"use client";\n' + mobile
      .replaceAll('"expo-router"', '"./hosts"').replaceAll('"react-native"', '"./hosts"')
      .replaceAll('"@/components/convivencia/AccesoArriendo"', '"./access"').replaceAll('"@/hooks/useAuth"', '"./hosts"').replaceAll('"@/services/tareasService"', '"./transport"'));
    await writeFile(join(route, "hosts.tsx"), `"use client";
import {createContext,useContext,useEffect} from "react";
export const Auth = createContext({sesion:{user:{id:"A"},access_token:"A"}});
export const Focus = createContext(true);
export const useAuth = () => useContext(Auth);
export function useFocusEffect(effect:any){const focused=useContext(Focus);useEffect(()=>focused?effect():undefined,[effect,focused]);}
export const router = {push:()=>{}};
export const StyleSheet = {create:(value:any)=>value};
export function View({children}:any){return <div>{children}</div>;}
export const ScrollView=View;
export function Text({children}:any){return <span>{children}</span>;}
export function ActivityIndicator(){return <span>Cargando tareas</span>;}
export function Pressable({children,onPress,disabled}:any){return <button onClick={onPress} disabled={disabled}>{children}</button>;}
`);
    await writeFile(join(route, "access.tsx"), "export default function Access({children}:any){return children}");
    await writeFile(join(route, "transport.ts"), `
export type EstadoTarea="Pendiente"|"Completada";
export type PaginaTareas=any;
const call=async(path:string)=>{const response=await fetch("/e04-fixture/"+path);return response.json()};
export const obtenerArriendoActual=()=>call("mine");
export const listarTareas=(id:number,estado:string,cursor?:string)=>call("tasks?"+new URLSearchParams({estado,...(cursor?{cursor}:{})}));
export const completarTarea=()=>call("complete");
`);
    await writeFile(join(route, "page.tsx"), `"use client";
import {useState} from "react";
import Screen from "./screen";
import {Auth,Focus} from "./hosts";
export default function Harness(){const [actor,setActor]=useState("A"),[focus,setFocus]=useState(true);
return <Auth.Provider value={{sesion:{user:{id:actor},access_token:actor}}}><Focus.Provider value={focus}>
<button onClick={()=>setActor("B")}>Cuenta B</button><button onClick={()=>setFocus(!focus)}>Cambiar foco</button>
<Screen/></Focus.Provider></Auth.Provider>}
`);
    const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"].includes(key.toUpperCase())));
    next = spawn(process.execPath, [join(project, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: isolated, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...clean, NEXT_TELEMETRY_DISABLED: "1" },
    });
    let logs = "";
    for (const stream of [next.stdout, next.stderr]) stream.on("data", data => { logs = (logs + data).slice(-4000); });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (next.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(origin + "/e04-mobile-test")).ok) { ready = true; break; } } catch { /* Inicio local. */ }
      await new Promise(done => setTimeout(done, 200));
    }
    assert.ok(ready, logs);
    browser = await chromium.launch({ executablePath: process.env.REPORTS_BROWSER_PATH, headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    let retired = false, other = false, completion = "fail", release, starts, taskReads = 0, failMore = true;
    const task = { id_tarea: 17, titulo: "Privada cuenta A", descripcion: "Cocina", estado: "Pendiente", id_asignado: 2 };
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/e04-fixture/")) return route.continue();
      const reply = data => route.fulfill({ json: data });
      const denied = { exito: false, estadoHttp: 403, error: "Ya no perteneces al arriendo." };
      if (url.pathname.endsWith("/mine")) return reply(retired ? denied : { exito: true, datos: 4, estadoHttp: 200 });
      if (url.pathname.endsWith("/tasks")) {
        taskReads++;
        const start=Number(url.searchParams.get("cursor")||0);
        if(start && failMore){failMore=false;return reply({exito:false,estadoHttp:503,error:"Sin red al cargar más."});}
        const rows=other||url.searchParams.get("estado")==="Completada"?[]:[task,...Array.from({length:52},(_,i)=>({...task,id_tarea:100+i,titulo:`Volumen ${i+1}`,id_asignado:3}))];
        return reply({exito:true,datos:{items:rows.slice(start,start+20),siguiente_cursor:start+20<rows.length?String(start+20):null,id_usuario_actual:2},estadoHttp:200});
      }
      if (completion === "wait") { await new Promise(done => { release = done; starts?.(); }); return reply({ exito: true, datos: { ...task, estado: "Completada" }, estadoHttp: 200 }); }
      if (completion === "retire") { retired = true; return reply(denied); }
      return reply({ exito: false, estadoHttp: 503, error: "No se pudo guardar la tarea." });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/e04-mobile-test");
    const complete = page.getByRole("button", { name: "Completar tarea", exact: true });
    const more=page.getByRole("button",{name:"Más tareas",exact:true});
    await more.click();
    await page.getByText("Sin red al cargar más.",{exact:true}).waitFor();
    assert.equal(await page.getByText(task.titulo,{exact:true}).count(),1);
    await page.getByRole("button",{name:"Reintentar",exact:true}).click();
    await page.getByText("Volumen 39",{exact:true}).waitFor();
    await more.click(); await page.getByText("Volumen 52",{exact:true}).waitFor();
    await page.getByText("Fin de la lista.",{exact:true}).waitFor();
    assert.equal(await page.getByText(task.titulo,{exact:true}).count(),1);
    assert.equal(await more.count(),0);
    await page.getByRole("button",{name:"Completadas",exact:true}).click();
    await page.getByText("No hay tareas completadas.",{exact:true}).waitFor();
    assert.equal(await page.getByText(task.titulo,{exact:true}).count(),0);
    await page.getByRole("button",{name:"Pendientes",exact:true}).click();
    await complete.click();
    await page.getByText("No se pudo guardar la tarea.", { exact: true }).waitFor();
    assert.equal(await page.getByText(task.titulo, { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Tarea completada y guardada.", { exact: true }).count(), 0);

    completion = "wait";
    let started = new Promise(done => { starts = done; });
    await complete.click(); await started;
    const readsBefore = taskReads;
    await page.getByRole("button", { name: "Cambiar foco", exact: true }).click();
    let finished = page.waitForResponse(response => response.url().endsWith("/e04-fixture/complete"));
    release(); await finished;
    await page.waitForTimeout(100);
    assert.equal(taskReads, readsBefore, "La respuesta tras desenfoque no debe recargar ni confirmar");
    assert.equal(await page.getByText("Tarea completada y guardada.", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Cambiar foco", exact: true }).click();
    await complete.waitFor();

    started = new Promise(done => { starts = done; });
    await complete.click(); await started;
    other = true;
    await page.getByRole("button", { name: "Cuenta B", exact: true }).click();
    await page.getByText("No hay tareas pendientes.", { exact: true }).waitFor();
    finished = page.waitForResponse(response => response.url().endsWith("/e04-fixture/complete"));
    release(); await finished;
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(task.titulo, { exact: true }).count(), 0);
    assert.equal(await page.getByText("Tarea completada y guardada.", { exact: true }).count(), 0);

    other = false; completion = "retire";
    await page.reload(); await complete.click();
    await page.getByText("Ya no perteneces al arriendo.", { exact: true }).waitFor();
    assert.equal(await page.getByText(task.titulo, { exact: true }).count(), 0);
    assert.equal(await complete.count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (next?.exitCode === null) {
      const exited = new Promise(done => next.once("exit", done));
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); else next.kill();
      await exited;
    }
    if (!resolve(isolated).startsWith(resolve(project) + sep + ".proxy-test-e04-mobile-")) throw new Error("Ruta de limpieza inesperada");
    if (linked) { if (process.platform === "win32") await rmdir(join(isolated, "node_modules")); else await unlink(join(isolated, "node_modules")); }
    await rm(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
