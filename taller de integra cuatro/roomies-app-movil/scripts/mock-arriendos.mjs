import { createServer } from "node:http";

const PUERTO = Number(process.env.PUERTO ?? 8787);
const RETRASO_LENTO_MS = 6000;

const ESCENARIOS = {
  "base-ti2": "LO QUE TI2 TIENE HOY (18/11): /mio y /{id} responden 5 campos, errores {detail, code} y /integrantes NO existe (404).",
  "sin-ruta": "GET /mio responde 404 «Ruta no disponible.» SIN code (el Gateway aún no tiene la ruta): no es «sin arriendo».",
  "base-ti2-sin-arriendo": "Igual que «base-ti2», pero /mio responde 404 RENTAL_NOT_FOUND (sin pertenencia activa).",
  activo: "Pertenencia activa, 3 integrantes de 4 cupos; la lista llega como arreglo simple (contrato 1.3).",
  "es-yo": "Igual que «activo», pero el servidor marca es_yo en una fila (campo no definido aún por el contrato).",
  paginas: "7 integrantes en páginas de 3 con cursor {items, siguiente_cursor}.",
  "sin-arriendo": "GET /mio responde 404 (contrato 6.1): la persona no pertenece a un arriendo activo.",
  retirado: "GET /mio responde 200 pero el detalle e integrantes responden 403 (acceso revocado).",
  "error-503": "Todas las rutas responden 503.",
  lento: `El detalle tarda ${RETRASO_LENTO_MS / 1000} s: sirve para probar respuestas tardías al cambiar de cuenta o salir.`,
  finalizado: "GET /mio indica un arriendo Finalizado (no es «Mi arriendo»).",
  "sin-publicacion": "GET /api/publicaciones/3 responde 503: el arriendo se ve con el rótulo genérico «Tu arriendo».",
  invalido: "El detalle devuelve un JSON que no cumple el contrato (respuesta_invalida).",
};

let escenario = "activo";

const INTEGRANTES = [
  { id_usuario: 11, nombre: "Camila Rojas", foto: null, es_responsable: true, fecha_ingreso: "2026-11-20", fecha_salida: null },
  { id_usuario: 12, nombre: "Tomás Fuentes", foto: null, es_responsable: false, fecha_ingreso: "2026-11-21", fecha_salida: null },
  { id_usuario: 13, nombre: "Valentina Díaz", foto: null, es_responsable: false, fecha_ingreso: "2026-11-22", fecha_salida: null },
];
const MAS_INTEGRANTES = [
  ...INTEGRANTES,
  ...[14, 15, 16, 17].map((id) => ({
    id_usuario: id, nombre: `Integrante ${id}`, foto: null, es_responsable: false, fecha_ingreso: "2026-11-23", fecha_salida: null,
  })),
];
const EX_INTEGRANTE = { id_usuario: 99, nombre: "Ex Integrante", foto: null, es_responsable: false, fecha_ingreso: "2026-11-20", fecha_salida: "2026-11-24" };

function activos() {
  return escenario === "paginas" ? MAS_INTEGRANTES : INTEGRANTES;
}

function detalle() {
  const integrantes = activos().length;
  const cupos = escenario === "paginas" ? 8 : 4;
  return {
    id_arriendo: 7,
    id_publicacion: 3,
    origen: "Arrendador",
    estado: "Activo",
    cupos_totales: cupos,
    integrantes_activos: integrantes,
    cupos_disponibles: cupos - integrantes,
    id_responsable: 11,
    fecha_inicio: "2026-11-20",
    fecha_fin: null,
  };
}

const PUBLICACION = {
  id_publicacion: 3,
  tipo: "Arrendador",
  titulo: "Departamento céntrico, 3 dormitorios",
  ubicacion: "Temuco, La Araucanía",
  region: { id: 9, nombre: "La Araucanía" },
  comuna: { id: 9101, nombre: "Temuco" },
  estado: "Activa",
};

const CABECERAS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function responder(res, estado, cuerpo) {
  res.writeHead(estado, CABECERAS);
  res.end(cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
}

const esBase = () => escenario.startsWith("base-ti2");
const CODES_BASE = {
  no_encontrado: "RENTAL_NOT_FOUND", no_autenticado: "UNAUTHENTICATED", sin_permiso: "FORBIDDEN",
  dependencia_no_disponible: "DEPENDENCY_UNAVAILABLE", validacion: "INVALID_REQUEST", metodo_no_permitido: "INVALID_REQUEST",
};
const error = (res, estado, codigo, mensaje) => (esBase()
  ? responder(res, estado, { detail: mensaje, code: CODES_BASE[codigo] ?? "INVALID_REQUEST" })
  : responder(res, estado, { codigo, mensaje }));

const rental = () => ({ id_arriendo: 7, id_publicacion: 3, cupos_totales: 4, version_capacidad: 1, ocupacion: INTEGRANTES.length });

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));


// ---------------------------------------------------------------------------
// Chat del arriendo (M4S3-D02). Contrato Sprint 3 v2, cap. 6.4. SOLO DESARROLLO.
// El usuario simulado es id_usuario 7. Se cambia de escenario con GET /__chat/<nombre>
// (reinicia los mensajes). Es independiente de los escenarios de Mi arriendo.
// ---------------------------------------------------------------------------
const ESCENARIOS_CHAT = {
  chat: "Conversación con 6 mensajes de 3 integrantes; el usuario es el id 7.",
  "chat-vacio": "Conversación sin mensajes.",
  "chat-historial": "75 mensajes con días distintos: páginas de 20 hacia atrás con cursor «antes» (prueba 4 páginas).",
  "chat-ingreso-tardio": "20 mensajes, pero la API solo entrega los posteriores a tu ingreso (id 8 en adelante).",
  "chat-envio-falla-una-vez": "El primer POST de cada mensaje se guarda pero responde 503; el reintento con el mismo id_cliente devuelve el mismo mensaje (no duplica).",
  "chat-llegan-mensajes": "Cada lectura de la primera página agrega un mensaje nuevo de otro integrante (hasta 5): prueba «Actualizar».",
  "chat-sin-conversacion": "GET /api/conversaciones devuelve la lista vacía.",
  "chat-retirado": "Conversación y mensajes responden 403 sin_permiso (retiro durante la lectura).",
  "chat-perfil-sin-id": "El perfil no trae id_usuario: los mensajes propios se reconocen por id_cliente.",
};
let escenarioChat = "chat";
const YO = 7;
const OTRO = 8;
const TERCERO = 9;
const ID_CONVERSACION = 15;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let mensajes = [];
let siguienteIdMensaje = 1;
const porIdCliente = new Map();
const yaFallaron = new Set();
let nuevosEntregados = 0;

const uuidSemilla = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const errorContrato = (res, estado, codigo, mensaje) => responder(res, estado, { codigo, mensaje });

function agregarMensaje(idEmisor, contenido, idCliente = null, minutosAtras = 0) {
  const idMensaje = siguienteIdMensaje++;
  const mensaje = {
    id_mensaje: idMensaje,
    id_conversacion: ID_CONVERSACION,
    id_emisor: idEmisor,
    contenido,
    fecha: new Date(Date.now() - minutosAtras * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    // Contrato 6.4: id_cliente solo se devuelve al emisor.
    id_cliente: idEmisor === YO ? (idCliente ?? uuidSemilla(idMensaje)) : null,
  };
  mensajes.push(mensaje);
  if (mensaje.id_cliente) porIdCliente.set(mensaje.id_cliente, mensaje);
  return mensaje;
}

function reiniciarChat(nombre) {
  escenarioChat = nombre;
  mensajes = [];
  siguienteIdMensaje = 1;
  porIdCliente.clear();
  yaFallaron.clear();
  nuevosEntregados = 0;
  if (nombre === "chat-vacio" || nombre === "chat-sin-conversacion") return;
  const base = [
    [OTRO, "Hola, ¿cómo estamos con las cosas de la casa?"],
    [YO, "Bien. ¿Alguien compra pan?"],
    [TERCERO, "Yo paso por el supermercado"],
    [OTRO, "Perfecto, gracias"],
    [YO, "¿Quién saca la basura hoy?"],
    [OTRO, "Me toca a mí"],
  ];
  if (nombre === "chat-historial" || nombre === "chat-ingreso-tardio") {
    const total = nombre === "chat-historial" ? 75 : 20;
    for (let i = 0; i < total; i++) {
      agregarMensaje([OTRO, YO, TERCERO][i % 3], `Mensaje ${i + 1} del historial`, null, (total - i) * 90);
    }
    return;
  }
  base.forEach(([emisor, texto], i) => agregarMensaje(emisor, texto, null, (base.length - i) * 7));
}
reiniciarChat("chat");

async function leerCuerpo(req) {
  const partes = [];
  for await (const parte of req) partes.push(parte);
  try {
    return JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch {
    return undefined;
  }
}

async function enviarMensaje(req, res) {
  const cuerpo = await leerCuerpo(req);
  const contenido = cuerpo?.contenido;
  const idCliente = cuerpo?.id_cliente;
  const valido = typeof contenido === "string" && contenido.length >= 1 && contenido.length <= 2000
    && typeof idCliente === "string" && UUID_RE.test(idCliente);
  if (!valido) return errorContrato(res, 422, "validacion", "contenido (1-2000) e id_cliente (uuid) son obligatorios.");

  const clave = idCliente.toLowerCase();
  const previo = porIdCliente.get(clave);
  if (previo) {
    // Reintento: mismo id_cliente y mismo contenido -> el mismo mensaje, sin duplicar.
    if (previo.contenido !== contenido) return errorContrato(res, 409, "estado_invalido", "El id_cliente ya se usó con otro contenido.");
    return responder(res, 200, previo);
  }
  const nuevo = agregarMensaje(YO, contenido, clave);
  if (escenarioChat === "chat-envio-falla-una-vez" && !yaFallaron.has(clave)) {
    // El mensaje queda guardado pero la respuesta se «pierde»: el cliente debe reintentar con el mismo id_cliente.
    yaFallaron.add(clave);
    return errorContrato(res, 503, "dependencia_no_disponible", "La respuesta no pudo completarse.");
  }
  return responder(res, 201, nuevo);
}

/** Devuelve true si la petición era del chat (o del perfil que el chat consulta) y ya se respondió. */
async function manejarChat(req, res, url) {
  if (req.method === "GET" && (url.pathname === "/usuarios/me" || url.pathname === "/api/usuarios/me")) {
    responder(res, 200, {
      nombre: "Tomás Fuentes", edad: 22, ocupacion: "Estudiante", ciudad: "Temuco",
      breve_descripcion: null, sobre_mi: null, foto_perfil: null,
      ...(escenarioChat === "chat-perfil-sin-id" ? {} : { id_usuario: YO }),
    });
    return true;
  }

  const ruta = url.pathname.match(/^\/api\/conversaciones(?:\/([1-9]\d*))?(\/mensajes)?$/);
  if (!ruta) return false;
  const [, id, esMensajes] = ruta;

  if (escenarioChat === "chat-retirado") {
    errorContrato(res, 403, "sin_permiso", "No eres participante activo de esta conversación.");
    return true;
  }
  if (!id) {
    const items = escenarioChat === "chat-sin-conversacion" ? [] : [{ id_conversacion: ID_CONVERSACION, nombre: "Chat del arriendo", ultimo_mensaje: null }];
    responder(res, 200, { items, siguiente_cursor: null });
    return true;
  }
  if (Number(id) !== ID_CONVERSACION) {
    errorContrato(res, 403, "sin_permiso", "No eres participante activo de esta conversación.");
    return true;
  }
  if (!esMensajes) {
    responder(res, 200, { id_conversacion: ID_CONVERSACION, nombre: "Chat del arriendo" });
    return true;
  }
  if (req.method === "POST") {
    await enviarMensaje(req, res);
    return true;
  }

  const limite = Number(url.searchParams.get("limite") ?? 20);
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
    errorContrato(res, 422, "validacion", "limite fuera de rango (1-100).");
    return true;
  }
  const antesTexto = url.searchParams.get("antes");
  let antes = Infinity;
  if (antesTexto !== null) {
    antes = Number(antesTexto);
    if (!Number.isInteger(antes) || antes < 1) {
      errorContrato(res, 422, "validacion", "cursor inválido.");
      return true;
    }
  }
  if (escenarioChat === "chat-llegan-mensajes" && antesTexto === null && nuevosEntregados < 5) {
    nuevosEntregados += 1;
    agregarMensaje(OTRO, `Mensaje nuevo ${nuevosEntregados} (llegó mientras mirabas)`);
  }
  // Ventana de lectura: quien ingresó tarde no ve lo anterior a su ingreso (contrato 6.4).
  const desde = escenarioChat === "chat-ingreso-tardio" ? 8 : 1;
  const candidatos = mensajes
    .filter((m) => m.id_mensaje >= desde && m.id_mensaje < antes)
    .sort((a, b) => b.id_mensaje - a.id_mensaje);
  const items = candidatos.slice(0, limite);
  const hayMas = candidatos.length > limite;
  responder(res, 200, { items, siguiente_cursor: hayMas ? String(items[items.length - 1].id_mensaje) : null });
  return true;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://mock.local");

  if (req.method === "OPTIONS") return responder(res, 204);

  const cambio = url.pathname.match(/^\/__escenario\/([a-z0-9-]+)$/);
  if (cambio) {
    if (!(cambio[1] in ESCENARIOS)) return responder(res, 404, { detail: "Escenario desconocido.", disponibles: Object.keys(ESCENARIOS) });
    escenario = cambio[1];
    console.log(`Escenario: ${escenario}`);
    return responder(res, 200, { escenario, descripcion: ESCENARIOS[escenario] });
  }

  const cambioChat = url.pathname.match(/^\/__chat\/([a-z0-9-]+)$/);
  if (cambioChat) {
    if (!(cambioChat[1] in ESCENARIOS_CHAT)) return responder(res, 404, { detail: "Escenario de chat desconocido.", disponibles: Object.keys(ESCENARIOS_CHAT) });
    reiniciarChat(cambioChat[1]);
    console.log(`Escenario de chat: ${escenarioChat}`);
    return responder(res, 200, { escenario: escenarioChat, descripcion: ESCENARIOS_CHAT[escenarioChat] });
  }

  const envioChat = req.method === "POST" && /^\/api\/conversaciones\/[1-9]\d*\/mensajes$/.test(url.pathname);
  if (req.method !== "GET" && !envioChat) return error(res, 405, "metodo_no_permitido", "Método no permitido.");

  if (!/^Bearer\s+\S+$/.test(req.headers.authorization ?? "")) return error(res, 401, "no_autenticado", "Se requiere sesión válida.");

  if (escenario === "error-503") return error(res, 503, "dependencia_no_disponible", "Otro servicio no respondió.");

  if (await manejarChat(req, res, url)) return;

  if (url.pathname === "/api/arriendos/mio") {
    if (escenario === "sin-ruta") return responder(res, 404, { detail: "Ruta no disponible." });
    if (escenario === "sin-arriendo" || escenario === "base-ti2-sin-arriendo") {
      return error(res, 404, "no_encontrado", "No perteneces a un arriendo activo.");
    }
    if (esBase()) return responder(res, 200, rental());
    return responder(res, 200, {
      id_arriendo: 7,
      estado: escenario === "finalizado" ? "Finalizado" : "Activo",
      origen: "Arrendador",
      es_responsable: false,
    });
  }

  if (url.pathname === "/api/publicaciones/3") {
    if (escenario === "sin-publicacion") return error(res, 503, "dependencia_no_disponible", "Otro servicio no respondió.");
    return responder(res, 200, PUBLICACION);
  }

  const ruta = url.pathname.match(/^\/api\/arriendos\/([1-9]\d*)(\/integrantes)?$/);
  if (!ruta) return responder(res, 404, { detail: "Ruta no disponible." });
  if (ruta[1] !== "7") return error(res, 404, "no_encontrado", "Arriendo no encontrado.");
  if (escenario === "retirado") return error(res, 403, "sin_permiso", "No tienes acceso a este arriendo.");

  if (esBase() && ruta[2]) return responder(res, 404, { detail: "Ruta no disponible." });

  if (!ruta[2]) {
    if (esBase()) return responder(res, 200, rental());
    if (escenario === "lento") await esperar(RETRASO_LENTO_MS);
    if (escenario === "invalido") return responder(res, 200, { id_arriendo: 7, estado: "Activo" });
    return responder(res, 200, detalle());
  }

  const limite = Number(url.searchParams.get("limite") ?? 20);
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) return error(res, 422, "validacion", "limite fuera de rango (1-100).");
  let todos = url.searchParams.get("activos") === "true" ? activos() : [...activos(), EX_INTEGRANTE];
  if (escenario === "es-yo") todos = todos.map((i) => (i.id_usuario === 12 ? { ...i, es_yo: true } : i));

  if (escenario !== "paginas") return responder(res, 200, todos);

  const tamano = Math.min(limite, 3);
  const inicio = Number((url.searchParams.get("cursor") ?? "p0").replace(/^p/, ""));
  if (!Number.isInteger(inicio) || inicio < 0) return error(res, 422, "validacion", "cursor inválido.");
  const siguiente = inicio + tamano < todos.length ? `p${inicio + tamano}` : null;
  return responder(res, 200, { items: todos.slice(inicio, inicio + tamano), siguiente_cursor: siguiente });
}).listen(PUERTO, () => {
  console.log(`Mock de /api/arriendos en el puerto ${PUERTO} (SOLO DESARROLLO; no acredita integración).`);
  console.log("Escenarios (GET /__escenario/<nombre>):");
  for (const [nombre, descripcion] of Object.entries(ESCENARIOS)) console.log(`  ${nombre.padEnd(16)} ${descripcion}`);
  console.log(`Escenario inicial: ${escenario}`);
  console.log("Chat del arriendo (GET /__chat/<nombre>, reinicia los mensajes):");
  for (const [nombre, descripcion] of Object.entries(ESCENARIOS_CHAT)) console.log(`  ${nombre.padEnd(26)} ${descripcion}`);
  console.log(`Escenario de chat inicial: ${escenarioChat}`);
});
