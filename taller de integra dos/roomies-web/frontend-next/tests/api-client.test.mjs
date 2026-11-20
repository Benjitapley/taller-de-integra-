import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Transpilar en memoria con la dependencia existente; no requiere tsx ni Node 24.
const source = await readFile(new URL("../src/lib/api/client.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { apiRequest, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("cliente API: transporte y errores, sin red ni base de datos", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await t.test("JSON, credenciales del mismo origen y sin caché", async () => {
    globalThis.fetch = async (path, options) => {
      assert.equal(path, "/api/publicaciones");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers.get("Accept"), "application/json");
      return Response.json([]);
    };
    assert.deepEqual(await apiRequest("/api/publicaciones"), []);
  });

  await t.test("conserva FormData sin imponer Content-Type", async () => {
    const body = new FormData();
    body.set("titulo", "Solo prueba en memoria");
    globalThis.fetch = async (_path, options) => {
      assert.equal(options.body, body);
      assert.equal(options.headers.has("Content-Type"), false);
      return new Response(null, { status: 204 });
    };
    assert.equal(await apiRequest("/api/publicaciones", { method: "POST", body }), undefined);
  });

  for (const [status, payload, message] of [
    [401, { detail: "Acceso no autorizado" }, "Acceso no autorizado"],
    [422, { detail: [{ loc: ["body", "correo"], msg: "Campo obligatorio" }] }, "Campo obligatorio"],
  ]) {
    await t.test(`conserva error ${status} de FastAPI`, async () => {
      globalThis.fetch = async () => Response.json(payload, { status });
      await assert.rejects(apiRequest("/auth/login"), (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, status);
        assert.deepEqual(error.payload, payload);
        assert.equal(error.message, message);
        return true;
      });
    });
  }

  await t.test("error no JSON del proxy", async () => {
    globalThis.fetch = async () => new Response("Bad gateway", { status: 502 });
    await assert.rejects(apiRequest("/api/publicaciones"), (error) => error.status === 502 && error.payload === "Bad gateway");
  });

  await t.test("rechaza destinos externos y rutas fuera de la API", async () => {
    globalThis.fetch = async () => { throw new Error("No debe realizar peticiones"); };
    for (const path of ["https://example.com/api/test", "//example.com/api/test", "/perfil", "/api/../../perfil", "/api/\\example.com"]) {
      await assert.rejects(apiRequest(path), /ruta relativa/);
    }
  });
});
