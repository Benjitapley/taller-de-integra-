import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { createInterface } from "node:readline";
import test from "node:test";
import ts from "typescript";

const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source.replace('import "server-only";', ""),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const gateway = compile(await readFile(new URL("../src/lib/auth/gateway.ts", import.meta.url), "utf8"));
const validation = compile(await readFile(new URL("../src/features/perfil/validation.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/perfil/server.ts", import.meta.url), "utf8"))
  .replace('"../auth/gateway"', JSON.stringify(gateway))
  .replace('"../../features/perfil/validation"', JSON.stringify(validation));
const { handleProfile } = await import(compile(source));

test("BFF y router real de SCRUM-94 guardan datos y foto sin mezclar cuentas", { timeout: 30_000 }, async t => {
  const python = process.env.ROOMIES_TEST_PYTHON ??
    fileURLToPath(new URL("../../../../.venv/Scripts/python.exe", import.meta.url));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"].includes(key.toUpperCase())));
  const child = spawn(python, ["-B", fileURLToPath(new URL("./profile-scrum94-fixture.py", import.meta.url))], {
    env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  const lines = createInterface({ input: child.stdout });
  const [backend] = await Promise.race([
    once(lines, "line"),
    once(child, "exit").then(() => { throw new Error("No arrancó el servicio de prueba de SCRUM-94."); }),
    once(child, "error").then(([error]) => { throw error; }),
  ]);
  const config = { origin: "http://127.0.0.1:3000", backend, provider: "supabase", secure: false };
  for (let attempt = 0; ; attempt++) {
    try { await fetch(backend + "/openapi.json"); break; }
    catch (error) {
      if (attempt >= 30) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  const request = (account, form) => new Request(config.origin + "/web-api/perfil", {
    method: form ? "PUT" : "GET",
    headers: {
      cookie: `roomies_sb_dev_access=fixture.${account}.signature`,
      origin: config.origin, "X-Haycupo-CSRF": "1",
    },
    ...(form ? { body: form } : {}),
  });
  const get = async account => {
    const response = await handleProfile(request(account), config);
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await get("userA");
  assert.equal(first.nombre, "Cuenta 1");
  assert.equal(first.total_publicaciones, null);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    edad: String(first.edad), ocupacion: "Estudiante", ciudad: "Temuco",
    breve_descripcion: "Perfil de prueba", sobre_mi: "Prueba HTTP local.",
  })) form.set(key, value);
  const png = await (await fetch(backend + "/test-image")).arrayBuffer();
  form.set("foto", new File([png], "test.png", { type: "image/png" }));
  const saved = await handleProfile(request("userA", form), config);
  assert.equal(saved.status, 200);
  const after = await get("userA");
  assert.equal(after.ciudad, "Temuco");
  assert.match(after.foto_perfil, /^\/imagenes\/u_[a-f0-9]{32}\.png$/);
  assert.equal((await fetch(backend + after.foto_perfil)).status, 200);
  assert.equal((await get("userB")).foto_perfil, null);
  form.set("foto", new File(["invalid"], "broken.png", { type: "image/png" }));
  assert.equal((await handleProfile(request("userA", form), config)).status, 422);
  assert.equal((await get("userA")).foto_perfil, after.foto_perfil);
});
