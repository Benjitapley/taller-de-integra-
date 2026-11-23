import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// M4S3-D02: pruebas del estado, las utilidades y el controlador del chat con servicios
// simulados. Sin React, sin Supabase, sin red.
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
    require(nombre) {
      assert.ok(nombre.startsWith("@/"), `Dependencia inesperada: ${nombre}`);
      return cargar(`../src/${nombre.slice(2)}.ts`);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}

const { generarUuidV4, esUuid } = cargar("../src/utils/uuid.ts");
const { horaLocal, etiquetaDia, claveDia } = cargar("../src/utils/chatFechas.ts");
const { fusionarMensajes, ordenarConPendientes } = cargar("../src/utils/chatMensajes.ts");
const { reducirChat, ESTADO_CHAT_INICIAL } = cargar("../src/stores/chatArriendoEstado.ts");
const { crearControladorChat, elegirConversacionArriendo } = cargar("../src/stores/chatArriendo.ts");

const plano = (valor) => JSON.parse(JSON.stringify(valor));
const UUID_A = "11111111-1111-4111-8111-111111111111";

// --- datos de prueba -------------------------------------------------------

function msg(idServidor, minuto, extra = {}) {
  const fechaIso = new Date(Date.UTC(2026, 10, 16, 10, minuto)).toISOString();
  return {
    id: `srv-${idServidor}`, idServidor: String(idServidor), idCliente: null, autorNombre: "Ana", autorFotoUrl: null,
    texto: `m${idServidor}`, fechaIso, hora: horaLocal(fechaIso), esPropio: false, estado: "confirmado", ...extra,
  };
}
const pagina = (mensajes, siguienteCursor = null) => ({ mensajes, siguienteCursor });
const ok = (datos, estadoHttp = 200) => ({ exito: true, datos, estadoHttp });
const fallo = (codigo, estadoHttp) => ({ exito: false, codigo, error: `fallo ${codigo}`, estadoHttp });
const CONV = { id: "5" };
const YO = "7"; // mi id_usuario, tomado del perfil propio

function diferido() {
  let resolver;
  const promesa = new Promise((r) => { resolver = r; });
  return { promesa, resolver };
}
const esperar = () => new Promise((r) => setTimeout(r, 0));
const ids = (estado) => estado.mensajes.map((m) => m.idServidor ?? `local:${m.estado}`);

/** Servicios simulados: cada metodo toma la siguiente respuesta de su cola y registra la llamada. */
function crearServicios(colas = {}) {
  const llamadas = { listarConversaciones: [], obtenerConversacion: [], obtenerMiIdUsuario: [], listarMensajes: [], enviarMensaje: [] };
  const servicios = {};
  for (const nombre of Object.keys(llamadas)) {
    servicios[nombre] = async (...args) => {
      llamadas[nombre].push(args);
      const cola = colas[nombre] ?? [];
      const siguiente = cola.length > 1 ? cola.shift() : cola[0];
      return typeof siguiente === "function" ? siguiente(...args) : siguiente;
    };
  }
  return { servicios, llamadas };
}

function controlador(colas, opciones = {}) {
  const base = crearServicios({
    listarConversaciones: [ok([CONV])],
    obtenerConversacion: [ok(CONV)],
    obtenerMiIdUsuario: [ok(YO)],
    ...colas,
  });
  let n = 0;
  const c = crearControladorChat({
    servicios: base.servicios,
    generarId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    ahoraIso: () => "2026-11-16T12:00:00.000Z",
    ...opciones,
  });
  return { c, llamadas: base.llamadas };
}

// --- utilidades ------------------------------------------------------------

test("generarUuidV4: usa randomUUID si existe y, si no, produce un UUID v4 valido y distinto", () => {
  assert.equal(generarUuidV4({ randomUUID: () => UUID_A }), UUID_A);
  const a = generarUuidV4({});
  const b = generarUuidV4({});
  assert.ok(esUuid(a) && esUuid(b));
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  // Una fuente que devuelve algo que no es UUID se ignora.
  assert.ok(esUuid(generarUuidV4({ randomUUID: () => "no-es-uuid" })));
  assert.equal(esUuid(123), false);
});

test("fechas: hora local, claves de dia y etiquetas Hoy/Ayer/fecha", () => {
  const ahora = new Date(2026, 10, 16, 15, 0);
  const a = (anio, mes, dia, h = 9, m = 5) => new Date(anio, mes, dia, h, m).toISOString();
  assert.equal(horaLocal(a(2026, 10, 16, 9, 5)), "09:05");
  assert.equal(horaLocal("no-fecha"), "");
  assert.equal(claveDia(a(2026, 10, 16)), "2026-11-16");
  assert.equal(etiquetaDia(a(2026, 10, 16), ahora), "Hoy");
  assert.equal(etiquetaDia(a(2026, 10, 15), ahora), "Ayer");
  assert.equal(etiquetaDia(a(2026, 9, 3), ahora), "3 oct");
  assert.equal(etiquetaDia(a(2025, 11, 31), ahora), "31 dic 2025");
  assert.equal(etiquetaDia("basura", ahora), "");
});

test("fusionarMensajes: sin duplicados, concilia por idCliente y deja los sin confirmar al final", () => {
  const local = msg(0, 30, { id: UUID_A, idServidor: null, idCliente: UUID_A, estado: "pendiente", esPropio: true });
  const servidor = msg(7, 31, { idCliente: UUID_A, esPropio: true });
  const r = fusionarMensajes([msg(1, 0), local], [servidor, msg(1, 0), msg(2, 1)]);
  assert.deepEqual(plano(ids({ mensajes: r })), ["1", "2", "7"]);
  // La fila conciliada conserva la clave local para no volver a montarse.
  assert.equal(r.find((m) => m.idServidor === "7").id, UUID_A);
  assert.equal(r.find((m) => m.idServidor === "7").estado, "confirmado");

  const ordenado = ordenarConPendientes([
    { ...local, fechaIso: "2026-11-16T09:00:00.000Z" }, msg(1, 5), msg(2, 1),
  ]);
  assert.deepEqual(plano(ids({ mensajes: ordenado })), ["2", "1", "local:pendiente"]);
});

// --- reducer ---------------------------------------------------------------

test("reducer: actualizar con pagina que se une conserva el cursor mas profundo", () => {
  let e = reducirChat(ESTADO_CHAT_INICIAL, { tipo: "conversacion", conversacion: CONV });
  e = reducirChat(e, { tipo: "pagina_inicial", pagina: pagina([msg(3, 3), msg(4, 4)], "c-3") });
  e = reducirChat(e, { tipo: "anteriores", pagina: pagina([msg(1, 1), msg(2, 2)], "c-1") });
  e = reducirChat(e, { tipo: "actualizado", pagina: pagina([msg(3, 3), msg(4, 4), msg(5, 5)], "c-3") });
  assert.deepEqual(plano(ids(e)), ["1", "2", "3", "4", "5"]);
  assert.equal(e.cursorAnterior, "c-1");
});

test("reducer: si la pagina nueva no comparte mensajes con el historial, lo reemplaza (sin huecos)", () => {
  let e = reducirChat(ESTADO_CHAT_INICIAL, { tipo: "conversacion", conversacion: CONV });
  e = reducirChat(e, { tipo: "pagina_inicial", pagina: pagina([msg(1, 1), msg(2, 2)], "c-1") });
  e = reducirChat(e, { tipo: "actualizado", pagina: pagina([msg(40, 40), msg(41, 41)], "c-40") });
  assert.deepEqual(plano(ids(e)), ["40", "41"]);
  assert.equal(e.cursorAnterior, "c-40");
});

test("reducer: envio_ok no deja copias, descartar solo quita lo no confirmado, sin_acceso limpia todo", () => {
  const local = msg(0, 30, { id: UUID_A, idServidor: null, idCliente: UUID_A, estado: "pendiente", esPropio: true });
  let e = reducirChat(ESTADO_CHAT_INICIAL, { tipo: "conversacion", conversacion: CONV });
  e = reducirChat(e, { tipo: "pagina_inicial", pagina: pagina([msg(1, 1)]) });
  e = reducirChat(e, { tipo: "envio_local", mensaje: local });
  // Una actualizacion trajo el mensaje sin eco de id_cliente: hay dos copias.
  e = { ...e, mensajes: [...e.mensajes, msg(9, 31, { esPropio: true })] };
  e = reducirChat(e, { tipo: "envio_ok", clave: UUID_A, mensaje: msg(9, 31, { esPropio: true }) });
  assert.deepEqual(plano(ids(e)), ["1", "9"]);

  e = reducirChat(e, { tipo: "descartar", clave: "srv-1" });
  assert.equal(e.mensajes.length, 2, "un mensaje confirmado no se descarta");

  e = reducirChat(e, { tipo: "sin_acceso" });
  assert.equal(e.fase, "sin_acceso");
  assert.equal(e.mensajes.length, 0);
  assert.equal(e.conversacion, null);
  assert.equal(e.cursorAnterior, null);
});

// --- controlador: carga inicial y acceso -------------------------------------

test("carga inicial: usa la conversacion de la lista, resuelve mi usuario y deja la primera pagina lista", async () => {
  const otra = { id: "9" };
  const { c, llamadas } = controlador({
    listarConversaciones: [ok([CONV, otra])],
    listarMensajes: [ok(pagina([msg(1, 1), msg(2, 2)], "c-1"))],
  });
  await c.alEnfocar();
  const e = c.obtenerEstado();
  assert.equal(e.fase, "listo");
  assert.equal(e.conversacion.id, "5");
  assert.deepEqual(plano(ids(e)), ["1", "2"]);
  assert.equal(e.cursorAnterior, "c-1");
  assert.equal(llamadas.obtenerConversacion.length, 0, "sin id conocido no hace falta el detalle");
  assert.equal(llamadas.obtenerMiIdUsuario.length, 1);
  assert.deepEqual(plano(llamadas.listarMensajes[0]), ["5", { limite: 20, miIdUsuario: YO }]);
  assert.equal(elegirConversacionArriendo([]), null);
  assert.equal(elegirConversacionArriendo([otra, CONV]).id, "9");
});

test("con id de conversacion conocido se salta la lista y se usa el detalle", async () => {
  const { c, llamadas } = controlador(
    { listarMensajes: [ok(pagina([msg(1, 1)]))] },
    { idConversacionInicial: "5" },
  );
  await c.alEnfocar();
  assert.equal(c.obtenerEstado().fase, "listo");
  assert.equal(llamadas.listarConversaciones.length, 0);
  assert.equal(llamadas.obtenerConversacion.length, 1);
});

test("sin conversacion de arriendo, y errores de carga con reintento", async () => {
  const sin = controlador({ listarConversaciones: [ok([])] });
  await sin.c.alEnfocar();
  assert.equal(sin.c.obtenerEstado().fase, "sin_conversacion");

  const { c, llamadas } = controlador({
    listarMensajes: [fallo("red"), ok(pagina([msg(1, 1)]))],
  });
  await c.alEnfocar();
  assert.equal(c.obtenerEstado().fase, "error");
  await c.iniciar();
  assert.equal(c.obtenerEstado().fase, "listo");
  // El reintento no vuelve a buscar la conversacion ni mi usuario.
  assert.equal(llamadas.listarConversaciones.length, 1);
  assert.equal(llamadas.obtenerMiIdUsuario.length, 1);
});

test("sin acceso: 403 limpia la vista; en la primera carga un 404 es un error que se puede reintentar", async () => {
  // Contrato v2: quien no es integrante activo recibe 403 sin_permiso; 404 es "no existe".
  const c403 = controlador({ listarMensajes: [fallo("sin_permiso", 403)] });
  await c403.c.alEnfocar();
  assert.equal(c403.c.obtenerEstado().fase, "sin_acceso");

  const c404 = controlador({ listarMensajes: [fallo("http", 404), ok(pagina([msg(1, 1)]))] });
  await c404.c.alEnfocar();
  assert.equal(c404.c.obtenerEstado().fase, "error", "conversacion inexistente o ruta sin desplegar");
  await c404.c.iniciar();
  assert.equal(c404.c.obtenerEstado().fase, "listo");

  // Con id conocido (?id=): 403 en la cabecera es perdida de acceso; 404 es un error.
  const detalle403 = controlador({ obtenerConversacion: [fallo("sin_permiso", 403)] }, { idConversacionInicial: "5" });
  await detalle403.c.alEnfocar();
  assert.equal(detalle403.c.obtenerEstado().fase, "sin_acceso");
  const detalle404 = controlador({ obtenerConversacion: [fallo("http", 404)] }, { idConversacionInicial: "5" });
  await detalle404.c.alEnfocar();
  assert.equal(detalle404.c.obtenerEstado().fase, "error");

  const lista403 = controlador({ listarConversaciones: [fallo("sin_permiso", 403)] });
  await lista403.c.alEnfocar();
  assert.equal(lista403.c.obtenerEstado().fase, "sin_acceso");
  const lista404 = controlador({ listarConversaciones: [fallo("http", 404)] });
  await lista404.c.alEnfocar();
  assert.equal(lista404.c.obtenerEstado().fase, "error");
});

test("un fallo del perfil (mi id_usuario) es un error de carga, no una perdida de acceso, y se reintenta sin volver a listar", async () => {
  for (const respuesta of [fallo("http", 404), fallo("sin_permiso", 403), fallo("red")]) {
    const { c, llamadas } = controlador({ obtenerMiIdUsuario: [respuesta, ok(YO)], listarMensajes: [ok(pagina([msg(1, 1)]))] });
    await c.alEnfocar();
    assert.equal(c.obtenerEstado().fase, "error", `status ${respuesta.estadoHttp}`);
    assert.equal(llamadas.listarMensajes.length, 0);
    await c.iniciar();
    assert.equal(c.obtenerEstado().fase, "listo");
    assert.equal(llamadas.listarConversaciones.length, 1);
    assert.equal(llamadas.obtenerMiIdUsuario.length, 2);
  }
});

test("retiro durante la lectura: 403 (o 404) en la siguiente consulta limpia todo lo privado de memoria", async () => {
  for (const respuesta of [fallo("sin_permiso", 403), fallo("http", 404)]) {
    const retiro = controlador({ listarMensajes: [ok(pagina([msg(1, 1), msg(2, 2)], "c-1")), respuesta] });
    await retiro.c.alEnfocar();
    assert.equal(retiro.c.obtenerEstado().mensajes.length, 2);
    await retiro.c.actualizar();
    const e = retiro.c.obtenerEstado();
    assert.equal(e.fase, "sin_acceso", `status ${respuesta.estadoHttp}`);
    assert.equal(e.mensajes.length, 0);
    assert.equal(e.cursorAnterior, null);
    assert.equal(e.conversacion, null);
  }

  // Si despues vuelve a entrar (p. ej. lo incorporan a otro arriendo) se resuelve todo de nuevo.
  const reingreso = controlador({
    listarMensajes: [ok(pagina([msg(1, 1)])), fallo("sin_permiso", 403), ok(pagina([msg(9, 9)]))],
    obtenerMiIdUsuario: [ok("7"), ok("8")],
  });
  await reingreso.c.alEnfocar();
  await reingreso.c.actualizar();
  assert.equal(reingreso.c.obtenerEstado().fase, "sin_acceso");
  await reingreso.c.alEnfocar();
  assert.equal(reingreso.c.obtenerEstado().fase, "listo");
  assert.equal(reingreso.llamadas.obtenerMiIdUsuario.length, 2, "tras perder el acceso se vuelve a resolver mi usuario");
  assert.deepEqual(plano(reingreso.llamadas.listarMensajes[2][1].miIdUsuario), "8");
});

test("mi id_usuario se resuelve una vez y se usa en actualizar y paginar", async () => {
  const { c, llamadas } = controlador({
    listarMensajes: [ok(pagina([msg(3, 3)], "c-3")), ok(pagina([msg(2, 2)], "c-2")), ok(pagina([msg(3, 3), msg(4, 4)], "c-3"))],
  });
  await c.alEnfocar();
  await c.cargarAnteriores();
  await c.actualizar();
  assert.equal(llamadas.obtenerMiIdUsuario.length, 1);
  assert.deepEqual(plano(llamadas.listarMensajes.map((l) => l[1].miIdUsuario)), [YO, YO, YO]);
});

test("perfil sin id_usuario: el chat funciona, el perfil se consulta una vez y actualizar/paginar siguen disponibles", async () => {
  const { c, llamadas } = controlador({
    obtenerMiIdUsuario: [ok(null)],
    listarMensajes: [ok(pagina([msg(3, 3)], "c-3")), ok(pagina([msg(2, 2)], "c-2")), ok(pagina([msg(3, 3), msg(4, 4)], "c-3"))],
  });
  await c.alEnfocar();
  assert.equal(c.obtenerEstado().fase, "listo");
  await c.cargarAnteriores();
  await c.actualizar();
  assert.equal(llamadas.obtenerMiIdUsuario.length, 1, "null cuenta como usuario resuelto: no se vuelve a pedir");
  assert.equal(llamadas.listarMensajes.length, 3, "actualizar y paginar no se bloquean por no tener id_usuario");
  assert.deepEqual(plano(llamadas.listarMensajes.map((l) => l[1].miIdUsuario)), [null, null, null]);
});

test("al perder el acceso se olvida tambien que el usuario ya estaba resuelto (null incluido)", async () => {
  const { c, llamadas } = controlador({
    obtenerMiIdUsuario: [ok(null)],
    listarMensajes: [ok(pagina([msg(1, 1)])), fallo("sin_permiso", 403), ok(pagina([msg(1, 1)]))],
  });
  await c.alEnfocar();
  await c.actualizar();
  assert.equal(c.obtenerEstado().fase, "sin_acceso");
  await c.iniciar();
  assert.equal(llamadas.obtenerMiIdUsuario.length, 2, "tras perder el acceso se vuelve a consultar el perfil");
});

// --- controlador: paginacion -------------------------------------------------

test("tres paginas hacia atras sin duplicados y con fin de lista", async () => {
  const { c, llamadas } = controlador({
    listarMensajes: [
      ok(pagina([msg(5, 5), msg(6, 6)], "c-5")),
      // La pagina anterior repite el mensaje 5 (solapamiento) y llega en orden inverso.
      ok(pagina([msg(4, 4), msg(3, 3), msg(5, 5)], "c-3")),
      ok(pagina([msg(2, 2), msg(1, 1)], null)),
    ],
  });
  await c.alEnfocar();
  await c.cargarAnteriores();
  await c.cargarAnteriores();
  const e = c.obtenerEstado();
  assert.deepEqual(plano(ids(e)), ["1", "2", "3", "4", "5", "6"]);
  assert.equal(e.cursorAnterior, null);
  assert.deepEqual(plano(llamadas.listarMensajes.map((l) => l[1].antes ?? null)), [null, "c-5", "c-3"]);

  // Sin cursor ya no hay mas historial: no se hace otra llamada.
  await c.cargarAnteriores();
  assert.equal(llamadas.listarMensajes.length, 3);
});

test("el error de la segunda pagina se puede reintentar sin perder lo cargado", async () => {
  const { c } = controlador({
    listarMensajes: [ok(pagina([msg(3, 3), msg(4, 4)], "c-3")), fallo("red"), ok(pagina([msg(1, 1), msg(2, 2)]))],
  });
  await c.alEnfocar();
  await c.cargarAnteriores();
  let e = c.obtenerEstado();
  assert.ok(e.errorAnteriores);
  assert.equal(e.cargandoAnteriores, false);
  assert.deepEqual(plano(ids(e)), ["3", "4"]);
  await c.cargarAnteriores();
  e = c.obtenerEstado();
  assert.equal(e.errorAnteriores, null);
  assert.deepEqual(plano(ids(e)), ["1", "2", "3", "4"]);
});

test("no se piden dos paginas anteriores a la vez", async () => {
  const lenta = diferido();
  const { c, llamadas } = controlador({
    listarMensajes: [ok(pagina([msg(3, 3)], "c-3")), () => lenta.promesa],
  });
  await c.alEnfocar();
  const primera = c.cargarAnteriores();
  await c.cargarAnteriores();
  assert.equal(llamadas.listarMensajes.length, 2);
  lenta.resolver(ok(pagina([msg(1, 1), msg(2, 2)])));
  await primera;
  assert.deepEqual(plano(ids(c.obtenerEstado())), ["1", "2", "3"]);
});

test("mensajes simultaneos: al actualizar se intercalan por fecha y no se duplican", async () => {
  const { c } = controlador({
    listarMensajes: [
      ok(pagina([msg(1, 1), msg(3, 3)], "c-1")),
      // Mientras tanto llego el 2 (de otra persona, con hora intermedia) y el 4.
      ok(pagina([msg(1, 1), msg(2, 2), msg(3, 3), msg(4, 4)], "c-1")),
    ],
  });
  await c.alEnfocar();
  await c.actualizar();
  assert.deepEqual(plano(ids(c.obtenerEstado())), ["1", "2", "3", "4"]);
});

test("si hay un hueco entre lo cargado y lo nuevo, se reemplaza y la pagina anterior en vuelo se descarta", async () => {
  const lenta = diferido();
  const { c } = controlador({
    listarMensajes: [
      ok(pagina([msg(1, 1), msg(2, 2)], "c-1")),
      () => lenta.promesa, // pagina anterior (antes = c-1), todavia en vuelo
      ok(pagina([msg(50, 50), msg(51, 51)], "c-50")), // actualizacion sin mensajes en comun
    ],
  });
  await c.alEnfocar();
  const anteriores = c.cargarAnteriores();
  await c.actualizar();
  assert.deepEqual(plano(ids(c.obtenerEstado())), ["50", "51"]);
  lenta.resolver(ok(pagina([msg(0, 0)], null)));
  await anteriores;
  const e = c.obtenerEstado();
  assert.deepEqual(plano(ids(e)), ["50", "51"], "la pagina vieja no se mezcla");
  assert.equal(e.cursorAnterior, "c-50");
  assert.equal(e.cargandoAnteriores, false);
});

// --- controlador: envio ------------------------------------------------------

test("envio: aparece pendiente y pasa a confirmado con el mensaje del servidor", async () => {
  const respuesta = diferido();
  const { c, llamadas } = controlador({
    listarMensajes: [ok(pagina([msg(1, 1)]))],
    enviarMensaje: [() => respuesta.promesa],
  });
  await c.alEnfocar();
  assert.deepEqual(plano(c.enviar("  hola  ")), { aceptado: true });
  let e = c.obtenerEstado();
  assert.equal(e.mensajes.at(-1).estado, "pendiente");
  assert.equal(e.mensajes.at(-1).texto, "hola");
  assert.equal(e.mensajes.at(-1).idEmisor, YO);
  const idCliente = e.mensajes.at(-1).idCliente;
  assert.deepEqual(plano(llamadas.enviarMensaje[0]), ["5", { idCliente, texto: "hola" }]);

  respuesta.resolver(ok(msg(8, 20, { idCliente, esPropio: true, texto: "hola" }), 201));
  await esperar();
  e = c.obtenerEstado();
  assert.equal(e.mensajes.length, 2);
  assert.equal(e.mensajes.at(-1).estado, "confirmado");
  assert.equal(e.mensajes.at(-1).idServidor, "8");
  assert.equal(e.mensajes.at(-1).id, idCliente, "la clave de lista no cambia");
});

test("envio: texto invalido o chat no listo no se envian y no crean mensajes", async () => {
  const { c, llamadas } = controlador({ listarMensajes: [ok(pagina([msg(1, 1)]))] });
  assert.deepEqual(plano(c.enviar("hola")), { aceptado: false, motivo: "chat_no_disponible" });
  await c.alEnfocar();
  assert.deepEqual(plano(c.enviar("   ")), { aceptado: false, motivo: "texto_invalido" });
  assert.deepEqual(plano(c.enviar("x".repeat(2001))), { aceptado: false, motivo: "texto_invalido" });
  assert.equal(c.obtenerEstado().mensajes.length, 1);
  assert.equal(llamadas.enviarMensaje.length, 0);
});

test("fallo despues del envio: queda con error y el reintento manual usa el mismo idCliente", async () => {
  const { c, llamadas } = controlador({
    listarMensajes: [ok(pagina([msg(1, 1)]))],
    enviarMensaje: [fallo("tiempo_agotado"), (_id, { idCliente }) => ok(msg(8, 20, { idCliente, esPropio: true, texto: "hola" }), 200)],
  });
  await c.alEnfocar();
  c.enviar("hola");
  await esperar();
  let e = c.obtenerEstado();
  const enError = e.mensajes.at(-1);
  assert.equal(enError.estado, "error");
  assert.equal(llamadas.enviarMensaje.length, 1, "no hay reintento automatico");

  c.reintentar(enError.id);
  assert.equal(c.obtenerEstado().mensajes.at(-1).estado, "pendiente");
  await esperar();
  e = c.obtenerEstado();
  assert.equal(e.mensajes.at(-1).estado, "confirmado");
  assert.equal(e.mensajes.length, 2, "sin duplicados");
  assert.equal(llamadas.enviarMensaje[1][1].idCliente, llamadas.enviarMensaje[0][1].idCliente);

  // Reintentar algo que no esta en error no hace nada.
  c.reintentar(e.mensajes.at(-1).id);
  assert.equal(llamadas.enviarMensaje.length, 2);
});

test("si el servidor si guardo el mensaje, la siguiente actualizacion concilia el que quedo con error", async () => {
  const idCliente = "22222222-2222-4222-8222-222222222222";
  const { c } = controlador(
    {
      listarMensajes: [
        ok(pagina([msg(1, 1)])),
        // La API devuelve el mensaje que si guardo, con el eco de id_cliente.
        ok(pagina([msg(1, 1), msg(8, 20, { idCliente, esPropio: true, texto: "hola" })])),
      ],
      enviarMensaje: [fallo("red")],
    },
    { generarId: () => idCliente },
  );
  await c.alEnfocar();
  c.enviar("hola");
  await esperar();
  assert.equal(c.obtenerEstado().mensajes.at(-1).estado, "error");

  await c.actualizar();
  const e = c.obtenerEstado();
  assert.equal(e.mensajes.length, 2, "no queda una copia con error junto a la confirmada");
  assert.equal(e.mensajes.at(-1).estado, "confirmado");
  assert.equal(e.mensajes.at(-1).idServidor, "8");
  assert.equal(e.mensajes.at(-1).id, idCliente);
});

test("descartar quita un mensaje con error; 403 al enviar (ya no es integrante) limpia la vista", async () => {
  const { c } = controlador({ listarMensajes: [ok(pagina([msg(1, 1)]))], enviarMensaje: [fallo("red")] });
  await c.alEnfocar();
  c.enviar("hola");
  await esperar();
  c.descartar(c.obtenerEstado().mensajes.at(-1).id);
  assert.equal(c.obtenerEstado().mensajes.length, 1);

  const retirado = controlador({ listarMensajes: [ok(pagina([msg(1, 1)]))], enviarMensaje: [fallo("sin_permiso", 403)] });
  await retirado.c.alEnfocar();
  retirado.c.enviar("hola");
  await esperar();
  const e = retirado.c.obtenerEstado();
  assert.equal(e.fase, "sin_acceso");
  assert.equal(e.mensajes.length, 0);
});

// --- controlador: respuestas tardias ----------------------------------------

test("al desactivar (salir o cambiar de cuenta) las respuestas en vuelo no tocan el estado", async () => {
  const lenta = diferido();
  const { c } = controlador({ listarMensajes: [() => lenta.promesa] });
  const carga = c.alEnfocar();
  await esperar();
  c.desactivar();
  lenta.resolver(ok(pagina([msg(1, 1)])));
  await carga;
  assert.notEqual(c.obtenerEstado().fase, "listo");
  assert.equal(c.obtenerEstado().mensajes.length, 0);
});

test("despues de desactivar y volver a enfocar (React StrictMode) el chat carga normalmente", async () => {
  const lenta = diferido();
  const { c } = controlador({ listarMensajes: [() => lenta.promesa, ok(pagina([msg(1, 1)]))] });
  const primera = c.alEnfocar();
  await esperar();
  c.desactivar();
  const segunda = c.alEnfocar();
  lenta.resolver(ok(pagina([msg(99, 9)])));
  await Promise.all([primera, segunda]);
  assert.equal(c.obtenerEstado().fase, "listo");
  assert.deepEqual(plano(ids(c.obtenerEstado())), ["1"]);
});

test("los oyentes se avisan en cada cambio y se pueden retirar", async () => {
  const { c } = controlador({ listarMensajes: [ok(pagina([msg(1, 1)]))], enviarMensaje: [fallo("red")] });
  let avisos = 0;
  const retirar = c.suscribir(() => { avisos += 1; });
  await c.alEnfocar();
  assert.ok(avisos >= 3);
  retirar();
  const antes = avisos;
  c.enviar("hola");
  await esperar();
  assert.equal(avisos, antes);
});
