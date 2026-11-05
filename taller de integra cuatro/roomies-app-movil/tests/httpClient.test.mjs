import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Ejecuta el cliente real compilado, sustituyendo únicamente SDK y transporte.
// El contexto no tiene acceso al SDK real, .env.local ni al fetch de Node.
const fuente = await readFile(new URL("../src/services/httpClient.ts", import.meta.url), "utf8");
const compilado = ts.transpileModule(fuente, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function preparar({
  base = "https://api.example.invalid/v1",
  token = "token-ficticio-para-pruebas",
  configurado = true,
  obtenerSesion,
  responder = async () => Response.json({ nombre: "Prueba" }),
} = {}) {
  const llamadas = [];
  const registros = [];
  let consultasSesion = 0;
  let cierresSesion = 0;
  const modulo = { exports: {} };
  const sdk = {
    auth: {
      getSession: async () => {
        consultasSesion++;
        return obtenerSesion ? obtenerSesion() : { data: { session: token === null ? null : { access_token: token } }, error: null };
      },
      signOut: async () => { cierresSesion++; },
    },
  };
  runInNewContext(compilado, {
    exports: modulo.exports,
    require: (nombre) => {
      assert.equal(nombre, "@/lib/supabase", "No se permiten dependencias reales adicionales");
      return { estaSupabaseConfigurado: () => configurado, getSupabaseClient: () => sdk };
    },
    process: { env: { EXPO_PUBLIC_API_URL: base } },
    URL, FormData, AbortController, setTimeout, clearTimeout,
    console: Object.fromEntries(["log", "warn", "error", "debug", "info"].map((nivel) => [nivel, (...args) => registros.push(args)])),
    fetch: async (url, opciones) => {
      llamadas.push({ url, opciones });
      return responder(url, opciones);
    },
  });
  return {
    solicitar: modulo.exports.solicitarJson,
    formulario: modulo.exports.solicitarFormulario,
    llamadas,
    registros,
    consultasSesion: () => consultasSesion,
    cierresSesion: () => cierresSesion,
  };
}

test("GET protegido obtiene la sesión y envía Bearer al destino configurado", async () => {
  const cliente = preparar();
  const resultado = await cliente.solicitar("/recurso?pagina=1");
  assert.equal(resultado.exito, true);
  assert.equal(resultado.datos.nombre, "Prueba");
  assert.equal(cliente.consultasSesion(), 1);
  assert.equal(cliente.llamadas[0].url, "https://api.example.invalid/v1/recurso?pagina=1");
  assert.equal(cliente.llamadas[0].opciones.headers.Authorization, "Bearer token-ficticio-para-pruebas");
  assert.equal(cliente.llamadas[0].opciones.credentials, "omit");
  assert.equal(cliente.llamadas[0].opciones.headers.Accept, "application/json");
  assert.equal(cliente.registros.length, 0);
});

test("URL base ausente o inválida impide consultar Auth y enviar peticiones", async () => {
  for (const base of ["", "no-es-url", "ftp://api.example.invalid", "https://usuario:clave@api.example.invalid"]) {
    const cliente = preparar({ base });
    assert.equal((await cliente.solicitar("/recurso")).codigo, "configuracion");
    assert.equal(cliente.consultasSesion(), 0);
    assert.equal(cliente.llamadas.length, 0);
  }
});

test("rechaza URLs externas y rutas que escapan del prefijo configurado", async () => {
  const cliente = preparar();
  for (const ruta of ["https://externo.example.invalid", "//externo.example.invalid", "/\\externo", "/../fuera", "recurso"]) {
    assert.equal((await cliente.solicitar(ruta)).codigo, "peticion_invalida");
  }
  assert.equal(cliente.consultasSesion(), 0);
  assert.equal(cliente.llamadas.length, 0);
});

test("sin sesión o sin configuración Supabase no hay petición protegida", async () => {
  for (const [opciones, codigo] of [[{ token: null }, "sin_sesion"], [{ configurado: false }, "configuracion"]]) {
    const cliente = preparar(opciones);
    assert.equal((await cliente.solicitar("/recurso")).codigo, codigo);
    assert.equal(cliente.llamadas.length, 0);
  }
});

test("errores del SDK se convierten en resultados sin filtrar sus detalles", async () => {
  for (const obtenerSesion of [
    async () => ({ data: { session: null }, error: new Error("detalle-sensible") }),
    async () => { throw new Error("detalle-sensible"); },
  ]) {
    const cliente = preparar({ obtenerSesion });
    const resultado = await cliente.solicitar("/recurso");
    assert.equal(resultado.codigo, "sesion_no_disponible");
    assert.ok(!JSON.stringify(resultado).includes("detalle-sensible"));
    assert.equal(cliente.llamadas.length, 0);
    assert.equal(cliente.registros.length, 0);
  }
});

test("una petición pública explícita no consulta Auth ni adjunta Bearer", async () => {
  const cliente = preparar({ configurado: false });
  assert.equal((await cliente.solicitar("/catalogo", { autenticada: false })).exito, true);
  assert.equal(cliente.consultasSesion(), 0);
  assert.equal(cliente.llamadas[0].opciones.headers.Authorization, undefined);
});

test("cada petición obtiene el token actual del SDK sin conservar uno antiguo", async () => {
  let token = "token-inicial-ficticio";
  const cliente = preparar({ obtenerSesion: async () => ({ data: { session: { access_token: token } }, error: null }) });
  await cliente.solicitar("/recurso");
  token = "token-renovado-ficticio";
  await cliente.solicitar("/recurso");
  assert.equal(cliente.llamadas[0].opciones.headers.Authorization, "Bearer token-inicial-ficticio");
  assert.equal(cliente.llamadas[1].opciones.headers.Authorization, "Bearer token-renovado-ficticio");
  assert.equal(cliente.consultasSesion(), 2);
});

test("PATCH serializa únicamente el cuerpo recibido como JSON", async () => {
  const cliente = preparar();
  await cliente.solicitar("/recurso", { metodo: "PATCH", cuerpo: { ocupacion: "Estudiante" } });
  const opciones = cliente.llamadas[0].opciones;
  assert.equal(opciones.method, "PATCH");
  assert.equal(opciones.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(opciones.body), { ocupacion: "Estudiante" });
});

test("401 y 403 tienen resultados distintos y no cierran la sesión Supabase", async () => {
  for (const [estado, codigo] of [[401, "no_autorizado"], [403, "sin_permiso"]]) {
    const cliente = preparar({ responder: async () => Response.json({ detail: "token-ficticio-para-pruebas" }, { status: estado }) });
    const resultado = await cliente.solicitar("/recurso");
    assert.equal(resultado.exito, false);
    assert.equal(resultado.codigo, codigo);
    assert.equal(resultado.estadoHttp, estado);
    assert.ok(!JSON.stringify(resultado).includes("token-ficticio-para-pruebas"));
    assert.equal(cliente.cierresSesion(), 0);
    assert.equal(cliente.registros.length, 0);
  }
});

test("un error HTTP devuelve estado y mensaje genérico, incluso sin JSON", async () => {
  for (const estado of [400, 404, 422, 429, 503]) {
    const cliente = preparar({ responder: async () => new Response("detalle-interno", { status: estado }) });
    const resultado = await cliente.solicitar("/recurso");
    assert.equal(resultado.codigo, "http");
    assert.equal(resultado.estadoHttp, estado);
    assert.ok(!JSON.stringify(resultado).includes("detalle-interno"));
  }
});

test("rechaza una respuesta exitosa que no contiene JSON válido", async () => {
  const cliente = preparar({ responder: async () => new Response("<html>Error del proxy</html>") });
  const resultado = await cliente.solicitar("/recurso");
  assert.equal(resultado.codigo, "respuesta_invalida");
  assert.equal(resultado.estadoHttp, 200);
});

test("acepta HTTP 204 sin intentar interpretar JSON", async () => {
  const cliente = preparar({ responder: async () => new Response(null, { status: 204 }) });
  const resultado = await cliente.solicitar("/recurso");
  assert.equal(resultado.exito, true);
  assert.equal(resultado.datos, null);
  assert.equal(resultado.estadoHttp, 204);
});

test("el fallo de red no expone el contenido de la excepción", async () => {
  const cliente = preparar({ responder: async () => { throw new Error("token-ficticio-para-pruebas"); } });
  const resultado = await cliente.solicitar("/recurso");
  assert.equal(resultado.codigo, "red");
  assert.ok(!JSON.stringify(resultado).includes("token-ficticio-para-pruebas"));
  assert.equal(cliente.registros.length, 0);
});

test("aborta una petición que supera el tiempo de espera", async () => {
  const cliente = preparar({ responder: async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("cancelado")), { once: true });
  }) });
  assert.equal((await cliente.solicitar("/recurso", { tiempoLimiteMs: 5 })).codigo, "tiempo_agotado");
});

test("opciones o cuerpos inválidos no consultan Auth ni envían peticiones", async () => {
  const cliente = preparar();
  const circular = {};
  circular.propio = circular;
  for (const opciones of [{ tiempoLimiteMs: 0 }, { cuerpo: {} }, { metodo: "PATCH", cuerpo: circular }]) {
    assert.equal((await cliente.solicitar("/recurso", opciones)).codigo, "peticion_invalida");
  }
  assert.equal(cliente.consultasSesion(), 0);
  assert.equal(cliente.llamadas.length, 0);
});

test("multipart conserva campos y archivo y fetch genera un boundary interpretable", async () => {
  const formulario = new FormData();
  formulario.append("titulo", "Habitación de prueba");
  formulario.append("precio", "150000");
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);
  formulario.append("imagen", new Blob([bytes], { type: "image/png" }), "prueba.png");
  const cliente = preparar({ responder: async (url, opciones) => {
    assert.equal(opciones.body, formulario);
    assert.equal(opciones.headers["Content-Type"], undefined);
    const peticion = new Request(url, opciones);
    assert.match(peticion.headers.get("content-type"), /^multipart\/form-data; boundary=/);
    const recibido = await peticion.formData();
    assert.equal(recibido.get("titulo"), "Habitación de prueba");
    assert.equal(recibido.get("precio"), "150000");
    assert.equal(recibido.get("imagen").name, "prueba.png");
    assert.equal(recibido.get("imagen").type, "image/png");
    assert.deepEqual(new Uint8Array(await recibido.get("imagen").arrayBuffer()), bytes);
    return Response.json({ id: 123 }, { status: 201 });
  } });
  const resultado = await cliente.formulario("/publicaciones", { cuerpo: formulario });
  assert.equal(resultado.exito, true);
  assert.equal(resultado.estadoHttp, 201);
  assert.equal(resultado.datos.id, 123);
  assert.equal(cliente.llamadas[0].opciones.method, "POST");
  assert.equal(cliente.llamadas[0].opciones.headers.Authorization, "Bearer token-ficticio-para-pruebas");
  assert.equal(cliente.registros.length, 0);
});

test("PUT multipart obtiene el token actual para cada envío", async () => {
  let token = "primero-ficticio";
  const cliente = preparar({ obtenerSesion: async () => ({ data: { session: { access_token: token } }, error: null }) });
  await cliente.formulario("/publicaciones/123", { metodo: "PUT", cuerpo: new FormData() });
  token = "renovado-ficticio";
  await cliente.formulario("/publicaciones/123", { metodo: "PUT", cuerpo: new FormData() });
  assert.equal(cliente.llamadas[0].opciones.method, "PUT");
  assert.equal(cliente.llamadas[0].opciones.headers.Authorization, "Bearer primero-ficticio");
  assert.equal(cliente.llamadas[1].opciones.headers.Authorization, "Bearer renovado-ficticio");
  assert.equal(cliente.consultasSesion(), 2);
});

test("multipart público explícito omite Auth y JSON rechaza FormData para evitar enviar un objeto vacío", async () => {
  const cliente = preparar({ configurado: false });
  assert.equal((await cliente.formulario("/recurso", { cuerpo: new FormData(), autenticada: false })).exito, true);
  assert.equal(cliente.llamadas[0].opciones.headers.Authorization, undefined);
  assert.equal(cliente.consultasSesion(), 0);
  assert.equal((await cliente.solicitar("/recurso", { metodo: "POST", cuerpo: new FormData() })).codigo, "peticion_invalida");
  assert.equal(cliente.llamadas.length, 1);
});

test("formularios y métodos inválidos se rechazan antes de consultar sesión o transporte", async () => {
  const cliente = preparar();
  for (const opciones of [
    { cuerpo: {} }, { cuerpo: null }, {},
    { cuerpo: new FormData(), metodo: "GET" },
    { cuerpo: new FormData(), metodo: "TRACE" },
    { cuerpo: new FormData(), tiempoLimiteMs: 0 },
  ]) assert.equal((await cliente.formulario("/recurso", opciones)).codigo, "peticion_invalida");
  assert.equal(cliente.consultasSesion(), 0);
  assert.equal(cliente.llamadas.length, 0);
});

test("multipart conserva las protecciones de destino y sesión", async () => {
  for (const [config, ruta, codigo] of [
    [{ base: "" }, "/recurso", "configuracion"],
    [{}, "https://externo.example.invalid", "peticion_invalida"],
    [{}, "/../fuera", "peticion_invalida"],
    [{ token: null }, "/recurso", "sin_sesion"],
    [{ configurado: false }, "/recurso", "configuracion"],
    [{ obtenerSesion: async () => { throw new Error("detalle-privado"); } }, "/recurso", "sesion_no_disponible"],
  ]) {
    const cliente = preparar(config);
    assert.equal((await cliente.formulario(ruta, { cuerpo: new FormData() })).codigo, codigo);
    assert.equal(cliente.llamadas.length, 0);
    assert.equal(cliente.registros.length, 0);
  }
});

test("multipart distingue errores HTTP, red, JSON inválido y timeout sin repetir ni cerrar sesión", async () => {
  const casos = [
    [async () => Response.json({ detail: "detalle-privado" }, { status: 401 }), "no_autorizado"],
    [async () => Response.json({ detail: "detalle-privado" }, { status: 403 }), "sin_permiso"],
    [async () => new Response("detalle-privado", { status: 422 }), "http"],
    [async () => new Response("<html>detalle-privado</html>"), "respuesta_invalida"],
    [async () => { throw new Error("detalle-privado"); }, "red"],
    [async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("detalle-privado")), { once: true });
    }), "tiempo_agotado"],
  ];
  for (const [responder, codigo] of casos) {
    const cliente = preparar({ responder });
    const resultado = await cliente.formulario("/publicaciones", { cuerpo: new FormData(), tiempoLimiteMs: 100 });
    assert.equal(resultado.codigo, codigo);
    assert.doesNotMatch(JSON.stringify(resultado), /detalle-privado/);
    assert.equal(cliente.llamadas.length, 1);
    assert.equal(cliente.cierresSesion(), 0);
    assert.equal(cliente.registros.length, 0);
  }
});
