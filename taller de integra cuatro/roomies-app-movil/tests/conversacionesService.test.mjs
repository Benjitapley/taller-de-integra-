import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// M4S3-D02: ejecuta el servicio real de conversaciones con un transporte simulado.
// Ninguna prueba toca Supabase, .env ni la red.
const cache = new Map();
function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta);
  const fuente = readFileSync(new URL(ruta, import.meta.url), "utf8");
  const compilado = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    exports: modulo.exports,
    URL,
    process: { env: {} },
    require(nombre) {
      if (nombre === "@/services/httpClient") {
        return { solicitarJson: () => { throw new Error("El transporte real no esta permitido en estas pruebas"); } };
      }
      assert.ok(nombre.startsWith("@/"), `Dependencia inesperada: ${nombre}`);
      return cargar(`../src/${nombre.slice(2)}.ts`);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}

const servicio = cargar("../src/services/conversacionesService.ts");
const plano = (valor) => JSON.parse(JSON.stringify(valor));

const UUID = "3f8a1c52-9d4e-4b6a-8c1f-2e7d5a9b0c34";
const YO = "7"; // id_usuario de quien usa la app
const CONV = "15";

function transporte(...respuestas) {
  const llamadas = [];
  const enviar = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    return respuestas.length > 1 ? respuestas.shift() : respuestas[0];
  };
  return { enviar, llamadas };
}
const ok = (datos, estadoHttp = 200) => ({ exito: true, datos, estadoHttp });
const fallo = (codigo, estadoHttp) => ({ exito: false, codigo, error: "fallo simulado", estadoHttp });

// Forma del contrato v2 (6.4): id_mensaje, id_conversacion, id_emisor, contenido, fecha, id_cliente.
function dtoMensaje(id, fecha, extra = {}) {
  return { id_mensaje: id, id_conversacion: 15, id_emisor: 2, contenido: `mensaje ${id}`, fecha, ...extra };
}

test("listarMensajes pide limite 20 por defecto y arma antes con el cursor codificado", async () => {
  const t = transporte(ok({ items: [], siguiente_cursor: null }));
  await servicio.listarMensajes(CONV, { miIdUsuario: YO }, t.enviar);
  await servicio.listarMensajes(CONV, { antes: "a b/c=", limite: 50, miIdUsuario: YO }, t.enviar);
  assert.equal(t.llamadas[0].ruta, "/api/conversaciones/15/mensajes?limite=20");
  assert.equal(t.llamadas[1].ruta, "/api/conversaciones/15/mensajes?limite=50&antes=a%20b%2Fc%3D");
});

test("listarMensajes rechaza limite, cursor, ids y usuario invalidos sin llamar a la red", async () => {
  const t = transporte(ok({ items: [], siguiente_cursor: null }));
  for (const limite of [0, 101, 1.5, -1]) {
    assert.equal((await servicio.listarMensajes(CONV, { limite, miIdUsuario: YO }, t.enviar)).codigo, "peticion_invalida");
  }
  assert.equal((await servicio.listarMensajes(CONV, { antes: "   ", miIdUsuario: YO }, t.enviar)).codigo, "peticion_invalida");
  assert.equal((await servicio.listarMensajes("../x", { miIdUsuario: YO }, t.enviar)).codigo, "peticion_invalida");
  assert.equal((await servicio.listarMensajes(CONV, { miIdUsuario: "" }, t.enviar)).codigo, "peticion_invalida");
  assert.equal((await servicio.listarMensajes(CONV, {}, t.enviar)).codigo, "peticion_invalida");
  assert.equal(t.llamadas.length, 0);
});

test("la pagina se entrega en orden cronologico sin importar el orden de la API", async () => {
  const items = [
    dtoMensaje(3, "2026-11-16T10:05:00Z"),
    dtoMensaje(1, "2026-11-16T10:00:00Z"),
    dtoMensaje(2, "2026-11-16T10:00:00Z"),
  ];
  const r = await servicio.listarMensajes(CONV, { miIdUsuario: YO }, transporte(ok({ items, siguiente_cursor: "c1" })).enviar);
  assert.equal(r.exito, true);
  assert.deepEqual(plano(r.datos.mensajes.map((m) => m.idServidor)), ["1", "2", "3"]);
  assert.equal(r.datos.siguienteCursor, "c1");
});

test("esPropio sale de comparar id_emisor con el usuario de la app; id_cliente solo viene en los propios; no se inventan nombres ni fotos", async () => {
  const items = [
    dtoMensaje(1, "2026-11-16T10:00:00Z", { id_emisor: 7, id_cliente: UUID.toUpperCase() }),
    dtoMensaje(2, "2026-11-16T10:01:00Z", { id_emisor: 9 }), // de otra persona: sin id_cliente
  ];
  const r = await servicio.listarMensajes(CONV, { miIdUsuario: YO }, transporte(ok({ items, siguiente_cursor: null })).enviar);
  const [propio, ajeno] = plano(r.datos.mensajes);
  assert.equal(propio.esPropio, true);
  assert.equal(propio.idCliente, UUID);
  assert.equal(propio.idEmisor, "7");
  assert.equal(propio.autorNombre, "Tú");
  assert.equal(ajeno.esPropio, false);
  assert.equal(ajeno.idCliente, null);
  assert.equal(ajeno.idEmisor, "9");
  assert.equal(ajeno.autorNombre, "Integrante");
  assert.equal(ajeno.autorFotoUrl, null);
  assert.equal(ajeno.id, "srv-2");
  assert.equal(ajeno.texto, "mensaje 2");
  assert.equal(ajeno.fechaIso, "2026-11-16T10:01:00Z");
  assert.equal(ajeno.estado, "confirmado");
});

test("sin id_usuario del perfil (miIdUsuario null) son propios los mensajes que traen id_cliente", async () => {
  const items = [
    dtoMensaje(1, "2026-11-16T10:00:00Z", { id_emisor: 7, id_cliente: UUID }),
    dtoMensaje(2, "2026-11-16T10:01:00Z", { id_emisor: 9 }),
    dtoMensaje(3, "2026-11-16T10:02:00Z", { id_emisor: 9, id_cliente: "no-es-un-uuid" }),
  ];
  const r = await servicio.listarMensajes(CONV, { miIdUsuario: null }, transporte(ok({ items, siguiente_cursor: null })).enviar);
  assert.equal(r.exito, true);
  assert.deepEqual(plano(r.datos.mensajes.map((m) => m.esPropio)), [true, false, false]);
  assert.equal(r.datos.mensajes[0].autorNombre, "Tú");

  // Con id_usuario conocido, manda la comparacion de id_emisor: un id_cliente ajeno no cambia nada.
  const conId = await servicio.listarMensajes(CONV, { miIdUsuario: "9" }, transporte(ok({ items, siguiente_cursor: null })).enviar);
  assert.deepEqual(plano(conId.datos.mensajes.map((m) => m.esPropio)), [false, true, true]);

  // Solo null activa el respaldo: un usuario ausente o mal formado sigue siendo una peticion invalida.
  const t = transporte(ok({ items, siguiente_cursor: null }));
  for (const mal of [undefined, "", "x/y", 0]) {
    const invalida = await servicio.listarMensajes(CONV, { miIdUsuario: mal }, t.enviar);
    assert.equal(invalida.exito, false, String(mal));
  }
  assert.equal(t.llamadas.length, 0, "no se pide nada con un usuario invalido");
});

test("las fechas UTC del contrato (con o sin fracciones) se entienden y dan la hora local", async () => {
  const items = [
    dtoMensaje(1, "2026-11-18T15:04:05Z"),
    dtoMensaje(2, "2026-11-17T21:00:05.123456+00:00"),
  ];
  const r = await servicio.listarMensajes(CONV, { miIdUsuario: YO }, transporte(ok({ items, siguiente_cursor: null })).enviar);
  assert.equal(r.exito, true);
  const dosDigitos = (n) => String(n).padStart(2, "0");
  const esperada = (d) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
  assert.equal(r.datos.mensajes[0].hora, esperada(new Date(Date.UTC(2026, 10, 17, 21, 0, 5))));
  assert.equal(r.datos.mensajes[1].hora, esperada(new Date(Date.UTC(2026, 10, 18, 15, 4, 5))));
});

test("una respuesta con forma inesperada no se muestra a medias", async () => {
  const bueno = dtoMensaje(1, "2026-11-16T10:00:00Z");
  const casos = [
    { items: "no es lista", siguiente_cursor: null },
    { items: [bueno] }, // falta siguiente_cursor
    { items: [bueno], siguiente_cursor: "" },
    { items: [bueno, { ...bueno, id_mensaje: 2, id_emisor: "abc/def" }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 2, id_emisor: undefined }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 2, fecha: "ayer" }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 2, fecha: undefined }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 2, contenido: "" }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 2, contenido: 5 }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 0 }], siguiente_cursor: null },
    // Un mensaje de otra conversacion (o sin id_conversacion) no se mezcla con esta.
    { items: [bueno, { ...bueno, id_mensaje: 2, id_conversacion: 99 }], siguiente_cursor: null },
    { items: [bueno, { ...bueno, id_mensaje: 2, id_conversacion: undefined }], siguiente_cursor: null },
    [],
    null,
  ];
  for (const datos of casos) {
    const r = await servicio.listarMensajes(CONV, { miIdUsuario: YO }, transporte(ok(datos)).enviar);
    assert.equal(r.exito, false, JSON.stringify(datos));
    assert.equal(r.codigo, "respuesta_invalida");
  }
});

test("los errores del transporte se propagan tal cual", async () => {
  for (const [codigo, estado] of [["sin_permiso", 403], ["http", 404], ["red", undefined], ["no_autorizado", 401]]) {
    const r = await servicio.listarMensajes(CONV, { miIdUsuario: YO }, transporte(fallo(codigo, estado)).enviar);
    assert.equal(r.exito, false);
    assert.equal(r.codigo, codigo);
    assert.equal(r.estadoHttp, estado);
  }
});

test("enviarMensaje manda POST con { contenido, id_cliente } y el contenido sin espacios en los extremos", async () => {
  const t = transporte(ok(dtoMensaje(481, "2026-11-18T15:04:05Z", { id_emisor: 7, id_cliente: UUID, contenido: "hola" }), 201));
  const r = await servicio.enviarMensaje(CONV, { idCliente: UUID.toUpperCase(), texto: "  hola  " }, t.enviar);
  assert.equal(t.llamadas[0].ruta, "/api/conversaciones/15/mensajes");
  assert.equal(t.llamadas[0].opciones.metodo, "POST");
  // Contrato 6.4: el cuerpo lleva solo estos dos campos y no hay Idempotency-Key.
  assert.deepEqual(plano(t.llamadas[0].opciones.cuerpo), { contenido: "hola", id_cliente: UUID });
  assert.equal(Object.keys(t.llamadas[0].opciones).includes("headers"), false);
  assert.equal(r.exito, true);
  assert.equal(r.datos.esPropio, true);
  assert.equal(r.datos.idServidor, "481");
  assert.equal(r.datos.texto, "hola");
});

test("enviarMensaje conserva el idCliente enviado aunque la respuesta no lo devuelva", async () => {
  const r = await servicio.enviarMensaje(
    CONV, { idCliente: UUID, texto: "hola" },
    transporte(ok(dtoMensaje(9, "2026-11-16T10:00:00Z", { id_emisor: 7 }), 201)).enviar,
  );
  assert.equal(r.exito, true);
  assert.equal(r.datos.idCliente, UUID);
});

test("un reintento ya procesado devuelve el mismo mensaje (200 o 201) y se acepta igual", async () => {
  const dto = dtoMensaje(481, "2026-11-18T15:04:05Z", { id_emisor: 7, id_cliente: UUID });
  for (const estado of [200, 201]) {
    const r = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "hola" }, transporte(ok(dto, estado)).enviar);
    assert.equal(r.exito, true);
    assert.equal(r.datos.idServidor, "481");
  }
});

test("enviarMensaje valida texto e id_cliente antes de enviar", async () => {
  const t = transporte(ok({}, 201));
  for (const texto of ["", "   ", "x".repeat(2001), "hola\u0000"]) {
    assert.equal((await servicio.enviarMensaje(CONV, { idCliente: UUID, texto }, t.enviar)).codigo, "peticion_invalida");
  }
  assert.equal((await servicio.enviarMensaje(CONV, { idCliente: "no-uuid", texto: "hola" }, t.enviar)).codigo, "peticion_invalida");
  assert.equal(t.llamadas.length, 0);
  // Los limites exactos si se aceptan.
  const limite = dtoMensaje(9, "2026-11-16T10:00:00Z", { id_emisor: 7 });
  const rUno = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "x" }, transporte(ok(limite, 201)).enviar);
  const rMax = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "x".repeat(2000) }, transporte(ok(limite, 201)).enviar);
  assert.equal(rUno.exito, true);
  assert.equal(rMax.exito, true);
});

test("enviarMensaje: 403 y 409 se propagan; un 201 ilegible o de otra conversacion es respuesta invalida", async () => {
  const r403 = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "hola" }, transporte(fallo("sin_permiso", 403)).enviar);
  assert.equal(r403.codigo, "sin_permiso");
  const r409 = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "hola" }, transporte(fallo("http", 409)).enviar);
  assert.equal(r409.estadoHttp, 409);
  const rMalo = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "hola" }, transporte(ok({ ok: true }, 201)).enviar);
  assert.equal(rMalo.codigo, "respuesta_invalida");
  const rOtra = await servicio.enviarMensaje(
    CONV, { idCliente: UUID, texto: "hola" },
    transporte(ok(dtoMensaje(9, "2026-11-16T10:00:00Z", { id_conversacion: 99 }), 201)).enviar,
  );
  assert.equal(rOtra.codigo, "respuesta_invalida");
  const r204 = await servicio.enviarMensaje(CONV, { idCliente: UUID, texto: "hola" }, transporte(ok(null, 204)).enviar);
  assert.equal(r204.codigo, "respuesta_invalida");
});

test("conversaciones: la lista usa id_conversacion (campos extra se ignoran) y el detalle debe ser de la pedida", async () => {
  const lista = await servicio.listarConversaciones(
    transporte(ok({ items: [{ id_conversacion: 15, nombre: "Depto Centro", ultimo_mensaje: null }], siguiente_cursor: null })).enviar,
  );
  assert.equal(lista.exito, true);
  assert.deepEqual(plano(lista.datos), [{ id: "15" }]);

  const mala = await servicio.listarConversaciones(transporte(ok({ items: [{ nombre: "sin id" }] })).enviar);
  assert.equal(mala.codigo, "respuesta_invalida");
  const noEsLista = await servicio.listarConversaciones(transporte(ok([{ id_conversacion: 15 }])).enviar);
  assert.equal(noEsLista.codigo, "respuesta_invalida");

  const t = transporte(ok({ id_conversacion: 15 }));
  const detalle = await servicio.obtenerConversacion("15", t.enviar);
  assert.equal(t.llamadas[0].ruta, "/api/conversaciones/15");
  assert.deepEqual(plano(detalle.datos), { id: "15" });

  const otra = await servicio.obtenerConversacion("15", transporte(ok({ id_conversacion: 99 })).enviar);
  assert.equal(otra.codigo, "respuesta_invalida");

  const invalida = await servicio.obtenerConversacion("a/b", t.enviar);
  assert.equal(invalida.codigo, "peticion_invalida");
  assert.equal(t.llamadas.length, 1);
});

test("obtenerMiIdUsuario lee id_usuario del perfil propio (contrato v2); sin el devuelve null y no inventa nada", async () => {
  const t = transporte(ok({ id_usuario: 7, nombre: "Ana", edad: 22 }));
  const r = await servicio.obtenerMiIdUsuario(t.enviar, "/usuarios/me");
  assert.equal(r.exito, true);
  assert.equal(r.datos, "7");
  assert.equal(t.llamadas[0].ruta, "/usuarios/me");

  // Perfil con el DTO anterior (sin id_usuario) o con id_usuario null: sigue el chat, sin id (respaldo por id_cliente).
  for (const perfil of [{ nombre: "Ana", edad: 22 }, { id_usuario: null, nombre: "Ana" }]) {
    const sin = await servicio.obtenerMiIdUsuario(transporte(ok(perfil)).enviar, "/usuarios/me");
    assert.equal(sin.exito, true, JSON.stringify(perfil));
    assert.equal(sin.datos, null, JSON.stringify(perfil));
  }
  // Un id_usuario presente pero mal formado es una respuesta invalida: no se ignora en silencio.
  for (const id of [0, -1, 1.5, "x/y", ""]) {
    const mal = await servicio.obtenerMiIdUsuario(transporte(ok({ id_usuario: id })).enviar, "/usuarios/me");
    assert.equal(mal.codigo, "respuesta_invalida", String(id));
  }
  const noObjeto = await servicio.obtenerMiIdUsuario(transporte(ok(null, 204)).enviar, "/usuarios/me");
  assert.equal(noObjeto.codigo, "respuesta_invalida");

  const propagado = await servicio.obtenerMiIdUsuario(transporte(fallo("red")).enviar, "/usuarios/me");
  assert.equal(propagado.codigo, "red");

  // Sin ruta de perfil configurada no se hace ninguna peticion.
  const t2 = transporte(ok({ id_usuario: 7 }));
  assert.equal((await servicio.obtenerMiIdUsuario(t2.enviar, null)).codigo, "configuracion");
  assert.equal(t2.llamadas.length, 0);

  // Por defecto usa la misma ruta de perfil que el resto de la app.
  const porDefecto = transporte(ok({ id_usuario: 7 }));
  await servicio.obtenerMiIdUsuario(porDefecto.enviar);
  assert.equal(porDefecto.llamadas[0].ruta, "/usuarios/me");
});

test("crearServiciosChat envia identidadEsperada en cada peticion (otra cuenta no reutiliza el token)", async () => {
  const llamadas = [];
  const solicitar = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    if (ruta === "/api/conversaciones") return ok({ items: [{ id_conversacion: 15 }], siguiente_cursor: null });
    if (ruta === "/usuarios/me") return ok({ id_usuario: 7 });
    if (ruta.startsWith("/api/conversaciones/15/mensajes") && opciones?.metodo === "POST") {
      return ok(dtoMensaje(1, "2026-11-18T15:04:05Z", { id_emisor: 7 }), 201);
    }
    if (ruta.startsWith("/api/conversaciones/15/mensajes")) return ok({ items: [], siguiente_cursor: null });
    return ok({ id_conversacion: 15 });
  };
  const servicios = servicio.crearServiciosChat("uuid-de-la-cuenta-a", solicitar);
  await servicios.listarConversaciones();
  await servicios.obtenerConversacion("15");
  await servicios.obtenerMiIdUsuario();
  await servicios.listarMensajes("15", { miIdUsuario: "7" });
  await servicios.enviarMensaje("15", { idCliente: UUID, texto: "hola" });
  assert.equal(llamadas.length, 5);
  for (const llamada of llamadas) {
    assert.equal(llamada.opciones.identidadEsperada, "uuid-de-la-cuenta-a", llamada.ruta);
  }
  // El cuerpo del POST se conserva junto a la identidad.
  assert.deepEqual(plano(llamadas[4].opciones.cuerpo), { contenido: "hola", id_cliente: UUID });
});
