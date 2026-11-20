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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (req.method !== "GET") return error(res, 405, "metodo_no_permitido", "Método no permitido.");

  if (!/^Bearer\s+\S+$/.test(req.headers.authorization ?? "")) return error(res, 401, "no_autenticado", "Se requiere sesión válida.");

  if (escenario === "error-503") return error(res, 503, "dependencia_no_disponible", "Otro servicio no respondió.");

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
});
