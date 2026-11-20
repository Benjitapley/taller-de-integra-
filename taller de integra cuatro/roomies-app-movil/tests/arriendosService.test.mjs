import assert from "node:assert/strict";
import test from "node:test";
import { crearCargador, plano } from "./helpers/cargarModulos.mjs";


const BASE_API = "https://api.example.invalid";
const cargar = crearCargador({
  entorno: { EXPO_PUBLIC_API_URL: BASE_API },
  externos: {
    "@/services/httpClient": {
      solicitarJson: () => { throw new Error("El transporte real no está permitido en estas pruebas"); },
    },
  },
});
const servicio = cargar("src/services/arriendosService.ts");


const referencia = { id_arriendo: 7, estado: "Activo", es_responsable: false, origen: "Arrendador" };
const detalle = {
  id_arriendo: 7, id_publicacion: 3, origen: "Arrendador", estado: "Activo",
  cupos_totales: 3, cupos_disponibles: 1, integrantes_activos: 2,
  id_responsable: 1, fecha_inicio: "2026-11-20", fecha_fin: null,
};
const publicacion = {
  id_publicacion: 3, titulo: "Depto Centro", ubicacion: "Temuco, La Araucanía",
  region: { id: 9, nombre: "La Araucanía" }, comuna: { id: 99, nombre: "Temuco" },
};
const integrante = (id, extra = {}) => ({
  id_usuario: id, nombre: `Persona ${id}`, foto: null, es_responsable: false,
  fecha_ingreso: "2026-11-20", fecha_salida: null, ...extra,
});
const pagina = (items, siguiente = null) => ({ items, siguiente_cursor: siguiente });
const ok = (datos, estadoHttp = 200) => ({ exito: true, datos, estadoHttp });
const fallo = (estadoHttp, codigo = "http") => ({ exito: false, codigo, error: "Mensaje genérico", estadoHttp });
const noEncontrado = (code = "RENTAL_NOT_FOUND") => ({ ...fallo(404), codigoServicio: code });

const RUTA_DETALLE = "/api/arriendos/7";
const RUTA_PUBLICACION = "/api/publicaciones/3";
const RUTA_INTEGRANTES = "/api/arriendos/7/integrantes?activos=true&limite=50";

function transporte(respuestas) {
  const llamadas = [];
  const enviar = async (...args) => {
    llamadas.push(args);
    const respuesta = respuestas[args[0]];
    assert.ok(respuesta !== undefined, `Ruta no esperada: ${args[0]}`);
    return typeof respuesta === "function" ? respuesta(llamadas.length) : respuesta;
  };
  return { enviar, llamadas, rutas: () => llamadas.map((l) => l[0]) };
}

function escenario(extra = {}) {
  return transporte({
    "/api/arriendos/mio": ok(referencia),
    [RUTA_DETALLE]: ok(detalle),
    [RUTA_PUBLICACION]: ok(publicacion),
    [RUTA_INTEGRANTES]: ok(pagina([integrante(1, { es_responsable: true, es_yo: true }), integrante(2)])),
    ...extra,
  });
}


test("consulta /mio, luego detalle, integrantes y publicación, y proyecta el modelo de la pantalla", async () => {
  const t = escenario();
  const r = await servicio.consultarMiArriendo(t.enviar);

  assert.equal(r.exito, true);
  assert.equal(t.rutas()[0], "/api/arriendos/mio");
  assert.deepEqual([...t.rutas().slice(1)].sort(), [RUTA_DETALLE, RUTA_INTEGRANTES, RUTA_PUBLICACION].sort());
  assert.deepEqual(plano(r.arriendo), {
    idArriendo: 7, idPublicacion: 3, estado: "Activo", origen: "Arrendador", titulo: "Depto Centro",
    ubicacion: "Temuco, La Araucanía", cuposTotales: 3, cuposDisponibles: 1, integrantesActivos: 2,
    fechaInicio: "2026-11-20", soyResponsable: false,
  });
  assert.deepEqual(plano(r.integrantes), [
    { idUsuario: 1, nombre: "Persona 1", fotoUrl: null, esResponsable: true, esPropio: true },
    { idUsuario: 2, nombre: "Persona 2", fotoUrl: null, esResponsable: false, esPropio: false },
  ]);
  assert.equal(r.integrantesParciales, false);
});

test("solo hace GET sin cuerpo a rutas permitidas y no registra datos", async () => {
  const t = escenario();
  await servicio.consultarMiArriendo(t.enviar);
  for (const llamada of t.llamadas) {
    assert.equal(llamada.length, 1, "No se envían opciones: GET protegido por defecto");
    assert.match(
      llamada[0],
      /^\/api\/(arriendos\/(mio|[1-9]\d*(\/integrantes\?activos=true&limite=\d+(&cursor=[^&\s]+)?)?)|publicaciones\/[1-9]\d*)$/,
    );
  }
});

test("con identidad, cada petición viaja atada a la cuenta (identidadEsperada) y sin otras opciones", async () => {
  const t = escenario();
  const r = await servicio.consultarMiArriendo(t.enviar, "cuenta-a");
  assert.equal(r.exito, true);
  assert.equal(t.llamadas.length, 4, "/mio, detalle, integrantes y publicación");
  for (const llamada of t.llamadas) {
    assert.equal(llamada.length, 2, llamada[0]);
    assert.deepEqual(plano(llamada[1]), { identidadEsperada: "cuenta-a" }, llamada[0]);
  }
  // Sin identidad no se agrega ninguna opción.
  const sin = escenario();
  await servicio.consultarMiArriendo(sin.enviar);
  assert.ok(sin.llamadas.every((llamada) => llamada.length === 1));
});

test("si la cuenta cambió antes de enviar (sesion_no_disponible) no se interpreta como «sin arriendo» ni se pide nada más", async () => {
  const t = transporte({
    "/api/arriendos/mio": { exito: false, codigo: "sesion_no_disponible", error: "La cuenta cambió antes de completar la solicitud." },
  });
  const r = await servicio.consultarMiArriendo(t.enviar, "cuenta-a");
  assert.equal(r.exito, false);
  assert.equal(r.codigo, "sesion_no_disponible");
  assert.deepEqual(plano(t.rutas()), ["/api/arriendos/mio"]);
});

test("es_responsable de /mio se informa como relación de la sesión", async () => {
  const r = await servicio.consultarMiArriendo(escenario({ "/api/arriendos/mio": ok({ ...referencia, es_responsable: true }) }).enviar);
  assert.equal(r.arriendo.soyResponsable, true);

  const sinDato = await servicio.consultarMiArriendo(escenario({ "/api/arriendos/mio": ok({ id_arriendo: 7, estado: "Activo" }) }).enviar);
  assert.equal(sinDato.arriendo.soyResponsable, null);

  const invalido = await servicio.consultarMiArriendo(escenario({ "/api/arriendos/mio": ok({ ...referencia, es_responsable: "si" }) }).enviar);
  assert.equal(invalido.codigo, "respuesta_invalida");
});


test("si el detalle trae la publicación embebida no se consulta /api/publicaciones", async () => {
  const t = transporte({
    "/api/arriendos/mio": ok(referencia),
    [RUTA_DETALLE]: ok({ ...detalle, publicacion: { titulo: "  Casa Norte ", ubicacion: "Osorno" } }),
    [RUTA_INTEGRANTES]: ok(pagina([integrante(1)])),
  });
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.exito, true);
  assert.equal(r.arriendo.titulo, "Casa Norte");
  assert.equal(r.arriendo.ubicacion, "Osorno");
  assert.equal(t.rutas().includes(RUTA_PUBLICACION), false);
});

test("sin ubicación textual se deriva de comuna y región, tal como las define el contrato 4.1", async () => {
  const sinUbicacion = { ...publicacion }; delete sinUbicacion.ubicacion;
  const r = await servicio.consultarMiArriendo(escenario({ [RUTA_PUBLICACION]: ok(sinUbicacion) }).enviar);
  assert.equal(r.arriendo.ubicacion, "Temuco, La Araucanía");
  const soloRegion = await servicio.consultarMiArriendo(escenario({ [RUTA_PUBLICACION]: ok({ titulo: "X", region: { nombre: "Los Ríos" } }) }).enviar);
  assert.equal(soloRegion.arriendo.ubicacion, "Los Ríos");
});

test("si la publicación no se puede obtener, el arriendo se muestra igual sin título ni ubicación", async () => {
  const casos = [
    fallo(404), fallo(403, "sin_permiso"), fallo(503), { exito: false, codigo: "red", error: "x" },
    ok(null), ok("texto"), ok({ id_publicacion: 99, titulo: "De otra publicación" }), ok({ titulo: 12 }),
  ];
  for (const respuesta of casos) {
    const r = await servicio.consultarMiArriendo(escenario({ [RUTA_PUBLICACION]: respuesta }).enviar);
    assert.equal(r.exito, true, JSON.stringify(respuesta));
    assert.equal(r.arriendo.titulo, null, JSON.stringify(respuesta));
    assert.equal(r.arriendo.ubicacion, null, JSON.stringify(respuesta));
    assert.equal(r.integrantes.length, 2);
  }
});

test("lo opcional ausente queda como no disponible; los cupos libres se calculan (BR-14) solo si el servidor no los envía", async () => {
  const minimo = { id_arriendo: 7, id_publicacion: 3, estado: "Activo", cupos_totales: 3, integrantes_activos: 2, campo_extra: "ignorado" };
  const r = await servicio.consultarMiArriendo(escenario({ [RUTA_DETALLE]: ok(minimo) }).enviar);
  assert.equal(r.exito, true);
  assert.equal(r.arriendo.cuposDisponibles, 1, "cupos_totales − integrantes_activos");
  assert.equal(r.arriendo.fechaInicio, null);
  assert.equal(r.arriendo.origen, null);
  assert.equal("campo_extra" in r.arriendo, false);
  assert.equal(servicio.adaptarArriendo({ ...minimo, cupos_disponibles: null }).cuposDisponibles, null);
  assert.equal(servicio.adaptarArriendo({ ...minimo, cupos_disponibles: 0 }).cuposDisponibles, 0);
});

test("la base de TI2 del 18/11 (5 campos, sin estado ni /integrantes) se muestra sin inventar nada", async () => {
  const rental = { id_arriendo: 7, id_publicacion: 3, cupos_totales: 3, version_capacidad: 1, ocupacion: 2 };
  const t = escenario({
    "/api/arriendos/mio": ok(rental),
    [RUTA_DETALLE]: ok(rental),
    [RUTA_INTEGRANTES]: fallo(404),
  });
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.exito, true);
  assert.deepEqual(plano(r.arriendo), {
    idArriendo: 7, idPublicacion: 3, estado: "Activo", origen: null, titulo: "Depto Centro",
    ubicacion: "Temuco, La Araucanía", cuposTotales: 3, cuposDisponibles: 1, integrantesActivos: 2,
    fechaInicio: null, soyResponsable: null,
  });
  assert.equal(r.integrantes, null, "sin /integrantes la lista queda NO DISPONIBLE (no vacía)");
  assert.equal(r.integrantesParciales, false);
  assert.equal(t.rutas().filter((ruta) => ruta.includes("/integrantes")).length, 1);
});

test("ocupacion e integrantes_activos son equivalentes: al menos uno, y si llegan ambos deben coincidir", () => {
  const base = { id_arriendo: 7, id_publicacion: 3, cupos_totales: 3 };
  assert.equal(servicio.adaptarArriendo({ ...base, ocupacion: 2 }).integrantesActivos, 2);
  assert.equal(servicio.adaptarArriendo({ ...base, integrantes_activos: 2 }).integrantesActivos, 2);
  assert.equal(servicio.adaptarArriendo({ ...base, ocupacion: 0 }).integrantesActivos, 0);
  assert.equal(servicio.adaptarArriendo({ ...base, ocupacion: 2, integrantes_activos: 2 }).integrantesActivos, 2);
  for (const extra of [{}, { ocupacion: 2, integrantes_activos: 1 }, { ocupacion: -1 }, { ocupacion: "2" }, { ocupacion: null },
    { ocupacion: 4 }, { integrantes_activos: 4 }, { ocupacion: 2, version_capacidad: 0 }, { ocupacion: 2, version_capacidad: "1" }]) {
    assert.equal(servicio.adaptarArriendo({ ...base, ...extra }), null, JSON.stringify(extra));
  }
  assert.notEqual(servicio.adaptarArriendo({ ...base, ocupacion: 2, version_capacidad: 5 }), null);
});


test("404 en /mio es «sin pertenencia» y no se consulta nada más", async () => {
  const t = transporte({ "/api/arriendos/mio": noEncontrado() });
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.exito, false);
  assert.equal(r.codigo, "sin_pertenencia");
  assert.equal(r.estadoHttp, 404);
  assert.deepEqual(plano(t.rutas()), ["/api/arriendos/mio"]);
});

test("un 404 SIN código es el del Gateway (ruta ausente): no se dice «no tienes arriendo»", async () => {
  const enMio = transporte({ "/api/arriendos/mio": fallo(404) });
  const a = await servicio.consultarMiArriendo(enMio.enviar);
  assert.equal(a.exito, false);
  assert.equal(a.codigo, "http");
  assert.equal(a.estadoHttp, 404);
  assert.match(a.error, /todavía no está disponible/);
  assert.deepEqual(plano(enMio.rutas()), ["/api/arriendos/mio"]);

  const enDetalle = await servicio.consultarMiArriendo(escenario({ [RUTA_DETALLE]: fallo(404) }).enviar);
  assert.equal(enDetalle.codigo, "http");
  assert.match(enDetalle.error, /todavía no está disponible/);

  for (const code of ["RENTAL_NOT_FOUND", "no_encontrado"]) {
    const r = await servicio.consultarMiArriendo(transporte({ "/api/arriendos/mio": noEncontrado(code) }).enviar);
    assert.equal(r.codigo, "sin_pertenencia", code);
  }
});

test("un codigoServicio vacío o que no es texto se trata como ausente", async () => {
  for (const codigoServicio of [undefined, null, "", 404, {}, ["RENTAL_NOT_FOUND"]]) {
    const r = await servicio.consultarMiArriendo(transporte({ "/api/arriendos/mio": { ...fallo(404), codigoServicio } }).enviar);
    assert.equal(r.codigo, "http", JSON.stringify(codigoServicio));
  }
});

test("el 404 de la primera página de /integrantes es «lista no disponible» con o sin código", async () => {
  for (const respuesta of [fallo(404), noEncontrado()]) {
    const r = await servicio.consultarMiArriendo(escenario({ [RUTA_INTEGRANTES]: respuesta }).enviar);
    assert.equal(r.exito, true);
    assert.equal(r.integrantes, null);
  }
});

test("un arriendo que no está Activo no es «Mi arriendo»", async () => {
  const enMio = transporte({ "/api/arriendos/mio": ok({ ...referencia, estado: "Finalizado" }) });
  const a = await servicio.consultarMiArriendo(enMio.enviar);
  assert.equal(a.codigo, "sin_pertenencia");
  assert.deepEqual(plano(enMio.rutas()), ["/api/arriendos/mio"]);

  const enDetalle = escenario({ [RUTA_DETALLE]: ok({ ...detalle, estado: "Finalizado", fecha_fin: "2026-12-01" }) });
  const b = await servicio.consultarMiArriendo(enDetalle.enviar);
  assert.equal(b.codigo, "sin_pertenencia");
});

test("404 en el detalle tras /mio (el arriendo desapareció) es «sin pertenencia»", async () => {
  const r = await servicio.consultarMiArriendo(escenario({ [RUTA_DETALLE]: noEncontrado() }).enviar);
  assert.equal(r.codigo, "sin_pertenencia");
});

test("404 en la primera página de /integrantes significa «lista no disponible», no «sin arriendo»", async () => {
  const r = await servicio.consultarMiArriendo(escenario({ [RUTA_INTEGRANTES]: fallo(404) }).enviar);
  assert.equal(r.exito, true, "la pertenencia ya se confirmó con /mio y el detalle");
  assert.equal(r.integrantes, null);
  assert.equal(r.arriendo.titulo, "Depto Centro");
  for (const respuesta of [fallo(403, "sin_permiso"), fallo(503), { exito: false, codigo: "red", error: "x" }, ok({ items: "x" })]) {
    const f = await servicio.consultarMiArriendo(escenario({ [RUTA_INTEGRANTES]: respuesta }).enviar);
    assert.equal(f.exito, false, JSON.stringify(respuesta));
  }
});

test("un 404 en una página posterior de integrantes sí indica que el arriendo ya no es de la persona", async () => {
  const r = await servicio.consultarMiArriendo(escenario({
    [RUTA_INTEGRANTES]: ok(pagina([integrante(1)], "c2")),
    [`${RUTA_INTEGRANTES}&cursor=c2`]: noEncontrado(),
  }).enviar);
  assert.equal(r.exito, false);
  assert.equal(r.codigo, "sin_pertenencia");
});

test("401, 403, 503, red y tiempo agotado se propagan sin reinterpretarse", async () => {
  const casos = [
    [fallo(403, "sin_permiso"), "sin_permiso", 403],
    [fallo(401, "no_autorizado"), "no_autorizado", 401],
    [fallo(503), "http", 503],
    [{ exito: false, codigo: "red", error: "Sin conexión" }, "red", undefined],
    [{ exito: false, codigo: "tiempo_agotado", error: "Tardó" }, "tiempo_agotado", undefined],
  ];
  for (const [respuesta, codigo, estado] of casos) {
    for (const ruta of ["/api/arriendos/mio", RUTA_DETALLE, RUTA_INTEGRANTES]) {
      const r = await servicio.consultarMiArriendo(escenario({ [ruta]: respuesta }).enviar);
      assert.equal(r.exito, false, `${ruta} ${codigo}`);
      assert.equal(r.codigo, codigo, `${ruta} ${codigo}`);
      assert.equal(r.estadoHttp, estado, `${ruta} ${codigo}`);
    }
  }
});

test("un 404 que no es HTTP (p. ej. red) nunca se interpreta como «sin pertenencia»", async () => {
  const r = await servicio.consultarMiArriendo(
    transporte({ "/api/arriendos/mio": { exito: false, codigo: "red", error: "x", estadoHttp: 404 } }).enviar,
  );
  assert.equal(r.codigo, "red");
});

// --- Validacion de respuestas -------------------------------------------------

test("referencia ilegible, 200 vacío o 204 no se anuncian como arriendo", async () => {
  for (const datos of [null, [], "arriendo", {}, { id_arriendo: 0, estado: "Activo" }, { id_arriendo: 1.5, estado: "Activo" },
    { id_arriendo: "7", estado: "Activo" }, { id_arriendo: 7, estado: "Otro" }, { estado: "Activo" }]) {
    const r = await servicio.consultarMiArriendo(transporte({ "/api/arriendos/mio": ok(datos) }).enviar);
    assert.equal(r.exito, false, JSON.stringify(datos));
    assert.equal(r.codigo, "respuesta_invalida", JSON.stringify(datos));
    assert.equal(r.estadoHttp, 200);
  }
  const sinCuerpo = await servicio.consultarMiArriendo(transporte({ "/api/arriendos/mio": ok(null, 204) }).enviar);
  assert.equal(sinCuerpo.codigo, "respuesta_invalida");
});

test("sin `estado` (base de TI2) un 200 de /mio equivale a pertenencia activa; con estado, se respeta", () => {
  assert.deepEqual(plano(servicio.adaptarReferenciaArriendo({ id_arriendo: 7 })), { idArriendo: 7, estado: "Activo", soyResponsable: null });
  assert.equal(servicio.adaptarReferenciaArriendo({ id_arriendo: 7, estado: "Finalizado" }).estado, "Finalizado");
});

test("el detalle exige sus campos, tipos y coherencia (contrato 6.3, BR-14/BR-15)", async () => {
  for (const campo of ["id_arriendo", "id_publicacion", "cupos_totales"]) {
    const incompleto = { ...detalle }; delete incompleto[campo];
    assert.equal(servicio.adaptarArriendo(incompleto), null, `Falta ${campo}`);
    assert.equal(servicio.adaptarArriendo({ ...detalle, [campo]: {} }), null, `Tipo de ${campo}`);
  }
  const sinActivos = { ...detalle }; delete sinActivos.integrantes_activos;
  assert.equal(servicio.adaptarArriendo(sinActivos), null, "Falta integrantes_activos u ocupacion");
  assert.equal(servicio.adaptarArriendo({ ...detalle, integrantes_activos: {} }), null);
  assert.equal(servicio.adaptarArriendo({ ...detalle, estado: {} }), null);

  const invalidos = [
    null, [], "x", { ...detalle, cupos_totales: 0 },
    { ...detalle, integrantes_activos: -1 }, { ...detalle, integrantes_activos: 4 },
    { ...detalle, cupos_disponibles: -1 }, { ...detalle, cupos_disponibles: 4 },
    { ...detalle, cupos_disponibles: 0.5 }, { ...detalle, estado: "Pausado" },
    { ...detalle, origen: "Otro" }, { ...detalle, id_responsable: 0 }, { ...detalle, id_responsable: "1" },
    { ...detalle, fecha_inicio: {} }, { ...detalle, fecha_fin: 3 },
    { ...detalle, cupos_totales: Number.MAX_SAFE_INTEGER + 2 },
  ];
  for (const datos of invalidos) assert.equal(servicio.adaptarArriendo(datos), null, JSON.stringify(datos));
  // Durante una vacancia de responsable el contrato permite id_responsable null.
  assert.notEqual(servicio.adaptarArriendo({ ...detalle, id_responsable: null }), null);
});

test("el detalle debe corresponder al arriendo pedido", async () => {
  const r = await servicio.consultarMiArriendo(escenario({ [RUTA_DETALLE]: ok({ ...detalle, id_arriendo: 8 }) }).enviar);
  assert.equal(r.exito, false);
  assert.equal(r.codigo, "respuesta_invalida");
});

test("textos con espacios se recortan y los vacíos opcionales quedan como no disponibles", () => {
  const a = servicio.adaptarArriendo({ ...detalle, fecha_inicio: "", publicacion: { titulo: "  Casa Norte  ", ubicacion: "   " } });
  assert.equal(a.titulo, "Casa Norte");
  assert.equal(a.ubicacion, null);
  assert.equal(a.fechaInicio, null);
  assert.deepEqual(plano(servicio.leerTituloUbicacion(null)), { titulo: null, ubicacion: null });
  assert.deepEqual(plano(servicio.leerTituloUbicacion({ titulo: "   " })), { titulo: null, ubicacion: null });
});

// --- Integrantes: personas, fotos, salida y filas invalidas -----------------------

test("las fotos relativas se resuelven con la base de la API y las inseguras se descartan", () => {
  const p = servicio.adaptarPaginaIntegrantes(pagina([
    integrante(1, { foto: "/imagenes/u_" + "a".repeat(32) + ".jpg" }),
    integrante(2, { foto: "https://cdn.example.invalid/f.png" }),
    integrante(3, { foto: "javascript:alert(1)" }),
    integrante(4, { foto: "https://usuario:clave@cdn.example.invalid/f.png" }),
    integrante(5, { foto: "//otro-host.example.invalid/f.png" }),
    integrante(6, { foto: "   " }),
    integrante(7),
  ]));
  const fotos = p.integrantes.map((i) => i.fotoUrl);
  assert.equal(fotos[0], `${BASE_API}/imagenes/u_${"a".repeat(32)}.jpg`);
  assert.equal(fotos[1], "https://cdn.example.invalid/f.png");
  assert.deepEqual(plano(fotos.slice(2)), [null, null, null, null, null]);
});

test("nombre y foto pueden venir planos o dentro de `usuario`, como el resumen de conexiones", () => {
  const p = servicio.adaptarPaginaIntegrantes([
    integrante(1),
    { id_usuario: 2, es_responsable: true, fecha_salida: null, usuario: { id_usuario: 2, nombre: " Ana ", foto: "https://cdn.example.invalid/a.png" } },
  ]);
  assert.deepEqual(plano(p.integrantes.map((i) => [i.idUsuario, i.nombre, i.fotoUrl, i.esResponsable])), [
    [1, "Persona 1", null, false],
    [2, "Ana", "https://cdn.example.invalid/a.png", true],
  ]);
  assert.equal(servicio.adaptarPaginaIntegrantes([{ id_usuario: 3, nombre: "Plano", es_responsable: false, usuario: {} }]), null);
});

test("quien ya salió (fecha_salida) no se muestra como residente aunque el filtro activos no se aplique", () => {
  const p = servicio.adaptarPaginaIntegrantes(pagina([
    integrante(1), integrante(2, { fecha_salida: "2026-11-25" }), integrante(3, { fecha_salida: null }), integrante(4, { fecha_salida: "" }),
  ]));
  assert.deepEqual(plano(p.integrantes.map((i) => i.idUsuario)), [1, 3, 4]);
});

test("una fila ilegible invalida toda la respuesta; no se muestra una lista a medias", () => {
  const sin = (campo) => { const f = integrante(1); delete f[campo]; return f; };
  const filasInvalidas = [
    null, "x", {}, integrante(0), integrante(1.5), integrante("1"), integrante(1, { nombre: "  " }),
    integrante(1, { nombre: 5 }), sin("nombre"), sin("id_usuario"), sin("es_responsable"),
    integrante(1, { es_responsable: "si" }), integrante(1, { foto: 3 }), integrante(1, { es_yo: "si" }),
    integrante(1, { fecha_salida: {} }),
  ];
  for (const fila of filasInvalidas) {
    assert.equal(servicio.adaptarPaginaIntegrantes(pagina([integrante(9), fila])), null, JSON.stringify(fila));
    assert.equal(servicio.adaptarPaginaIntegrantes([integrante(9), fila]), null, JSON.stringify(fila));
  }
  for (const datos of [null, {}, { items: "x" }, { siguiente_cursor: null }, "x", 5]) {
    assert.equal(servicio.adaptarPaginaIntegrantes(datos), null, JSON.stringify(datos));
  }
});

test("el responsable puede venir como es_responsable (contrato 6.1) o como rol (MER / ficha F03)", () => {
  const sin = (fila) => { const f = { ...fila }; delete f.es_responsable; return f; };
  const p = servicio.adaptarPaginaIntegrantes([
    sin(integrante(1, { rol: "Responsable" })),
    sin(integrante(2, { rol: "Integrante" })),
    integrante(3, { es_responsable: true, rol: "Responsable" }),
    integrante(4, { es_responsable: false, rol: null }),
  ]);
  assert.deepEqual(plano(p.integrantes.map((i) => [i.idUsuario, i.esResponsable])), [[1, true], [2, false], [3, true], [4, false]]);

  for (const fila of [
    sin(integrante(1)), sin(integrante(1, { rol: null })), sin(integrante(1, { rol: "Dueño" })),
    integrante(1, { es_responsable: true, rol: "Integrante" }), integrante(1, { es_responsable: false, rol: "Responsable" }),
    integrante(1, { es_responsable: true, rol: "Dueño" }),
  ]) {
    assert.equal(servicio.adaptarPaginaIntegrantes([integrante(9), fila]), null, JSON.stringify(fila));
  }
});

test("/mio informa la relación de la sesión con es_responsable o con rol", () => {
  const leer = (extra) => servicio.adaptarReferenciaArriendo({ id_arriendo: 7, estado: "Activo", ...extra });
  assert.equal(leer({ rol: "Responsable" }).soyResponsable, true);
  assert.equal(leer({ rol: "Integrante" }).soyResponsable, false);
  assert.equal(leer({ es_responsable: true, rol: "Responsable" }).soyResponsable, true);
  assert.equal(leer({ rol: null }).soyResponsable, null);
  assert.equal(leer({}).soyResponsable, null);
  assert.equal(leer({ rol: "Dueño" }), null);
  assert.equal(leer({ es_responsable: true, rol: "Integrante" }), null);
});

test("acepta un arreglo simple (lista pequeña) o {items, siguiente_cursor}", () => {
  const simple = servicio.adaptarPaginaIntegrantes([integrante(1), integrante(2)]);
  assert.equal(simple.integrantes.length, 2);
  assert.equal(simple.siguienteCursor, null);
  assert.equal(servicio.adaptarPaginaIntegrantes([]).integrantes.length, 0);
  assert.equal(servicio.adaptarPaginaIntegrantes(pagina([integrante(1)], "c1")).siguienteCursor, "c1");
});

test("cursores con forma inválida invalidan la respuesta", () => {
  for (const cursor of ["", " ", "a b", "a\nb", "a\u0000b", 5, {}, "x".repeat(513)]) {
    assert.equal(servicio.adaptarPaginaIntegrantes(pagina([integrante(1)], cursor)), null, JSON.stringify(cursor));
  }
  assert.equal(servicio.adaptarPaginaIntegrantes(pagina([integrante(1)], "x".repeat(512))).siguienteCursor, "x".repeat(512));
  assert.equal(servicio.adaptarPaginaIntegrantes({ items: [] }).siguienteCursor, null);
});

// --- Paginacion ----------------------------------------------------------------

test("un servicio que devuelve el arreglo completo se lee en una sola llamada", async () => {
  const t = escenario({ [RUTA_INTEGRANTES]: ok([integrante(1, { es_responsable: true }), integrante(2), integrante(3)]) });
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.integrantes.length, 3);
  assert.equal(t.rutas().filter((ruta) => ruta.includes("/integrantes")).length, 1);
});

test("lee tres páginas en orden, sin duplicados y codifica el cursor", async () => {
  const t = escenario({
    [RUTA_INTEGRANTES]: ok(pagina([integrante(1), integrante(2)], "c/1+=")),
    [`${RUTA_INTEGRANTES}&cursor=c%2F1%2B%3D`]: ok(pagina([integrante(2), integrante(3)], "c2")),
    [`${RUTA_INTEGRANTES}&cursor=c2`]: ok(pagina([integrante(4)])),
  });
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.exito, true);
  assert.deepEqual(plano(r.integrantes.map((i) => i.idUsuario)), [1, 2, 3, 4]);
  assert.equal(r.integrantesParciales, false);
  assert.equal(t.rutas().filter((ruta) => ruta.includes("/integrantes")).length, 3);
});

test("un cursor repetido no se sigue consultando", async () => {
  const t = escenario({
    [RUTA_INTEGRANTES]: ok(pagina([integrante(1)], "mismo")),
    [`${RUTA_INTEGRANTES}&cursor=mismo`]: ok(pagina([integrante(2)], "mismo")),
  });
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.exito, false);
  assert.equal(r.codigo, "respuesta_invalida");
  assert.equal(t.rutas().filter((ruta) => ruta.includes("/integrantes")).length, 2);
});

test("al llegar al tope de páginas se avisa que la lista es parcial", async () => {
  const extra = { [RUTA_INTEGRANTES]: ok(pagina([integrante(1)], "p1")) };
  for (let n = 1; n <= servicio.MAX_PAGINAS_INTEGRANTES; n++) {
    extra[`${RUTA_INTEGRANTES}&cursor=p${n}`] = ok(pagina([integrante(n + 1)], `p${n + 1}`));
  }
  const t = escenario(extra);
  const r = await servicio.consultarMiArriendo(t.enviar);
  assert.equal(r.exito, true);
  assert.equal(r.integrantesParciales, true);
  assert.equal(r.integrantes.length, servicio.MAX_PAGINAS_INTEGRANTES);
  assert.equal(t.rutas().filter((ruta) => ruta.includes("/integrantes")).length, servicio.MAX_PAGINAS_INTEGRANTES);
});

test("un fallo en la segunda página no entrega una lista incompleta como si fuera completa", async () => {
  const base = { [RUTA_INTEGRANTES]: ok(pagina([integrante(1)], "c2")) };
  const r503 = await servicio.consultarMiArriendo(escenario({ ...base, [`${RUTA_INTEGRANTES}&cursor=c2`]: fallo(503) }).enviar);
  assert.equal(r503.exito, false);
  assert.equal(r503.estadoHttp, 503);
  const r403 = await servicio.consultarMiArriendo(escenario({ ...base, [`${RUTA_INTEGRANTES}&cursor=c2`]: fallo(403, "sin_permiso") }).enviar);
  assert.equal(r403.codigo, "sin_permiso");
});

test("las rutas arman filtro, límite y cursor de forma segura", () => {
  assert.equal(servicio.rutaIntegrantes(7), "/api/arriendos/7/integrantes?activos=true&limite=50");
  assert.equal(servicio.rutaIntegrantes(7, 20, "a&b=c"), "/api/arriendos/7/integrantes?activos=true&limite=20&cursor=a%26b%3Dc");
  assert.equal(servicio.rutaPublicacion(3), "/api/publicaciones/3");
});
