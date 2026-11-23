import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Ejecuta los módulos reales. Ninguna prueba tiene acceso a Supabase, .env o red.
let ultimaRuta = null;
let ultimasOpciones = null;
let respuestaListado = null;

const cache = new Map();
const rutas = {
  "@/constants/camposPublicacion": "../src/constants/camposPublicacion.ts",
  "@/mocks/publicaciones": "../src/mocks/publicaciones.ts",
  "@/adapters/publicacionAdapter": "../src/adapters/publicacionAdapter.ts",
};
function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta);
  const fuente = readFileSync(new URL(ruta, import.meta.url), "utf8");
  const compilado = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    exports: modulo.exports,
    FormData,
    process,
    require(nombre) {
      if (nombre === "@/services/httpClient") return {
        solicitarFormulario: () => { throw new Error("El transporte real no está permitido en estas pruebas"); },
        solicitarJson: async (ruta, opciones) => { ultimaRuta = ruta; ultimasOpciones = opciones; return respuestaListado; },
      };
      assert.ok(rutas[nombre], `Dependencia inesperada: ${nombre}`);
      return cargar(rutas[nombre]);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}
const servicio = cargar("../src/services/publicacionesService.ts");
const adapter = cargar("../src/adapters/publicacionAdapter.ts");
const { publicacionesMock } = cargar(rutas["@/mocks/publicaciones"]);

test("el listado demostrativo conserva IDs numéricos y tipos de las publicaciones de ejemplo", async () => {
  const listado = await servicio.obtenerPublicaciones();
  assert.equal(listado.length, publicacionesMock.length);
  for (const publicacion of listado) {
    assert.equal(typeof publicacion.idPublicacion, "number");
  }
});

test("los filtros de precio y zona se combinan sin modificar la fuente de Inicio", async () => {
  const antes = JSON.stringify(publicacionesMock);
  const filtradas = await servicio.obtenerPublicaciones({ precioMin: 170000, precioMax: 230000, comuna: "  TEMUCO  " });
  assert.ok(filtradas.length > 0);
  assert.ok(filtradas.every((p) => p.precio >= 170000 && p.precio <= 230000 && /temuco/i.test(p.ubicacion)));
  assert.equal((await servicio.obtenerPublicaciones({ precioMax: 0 })).length, 0);
  assert.equal((await servicio.obtenerPublicaciones({ comuna: "Zona inexistente de prueba" })).length, 0);
  assert.equal(JSON.stringify(publicacionesMock), antes);
});

test("el detalle devuelve null para IDs inválidos sin consultar al servidor", async () => {
  for (const id of ["", "invalido", 0, -1, 1.5]) {
    assert.equal(await servicio.obtenerPublicacionPorId(id), null);
  }
});

test("el adaptador orientativo conserva el ID numérico y no inventa autor, origen o estado", () => {
  const resumen = adapter.adaptarPublicacion({
    id: 7, title: "Título", description: "Descripción", location_address: "Temuco",
    monthly_price: "250000", available_spots: 2, created_at: "2026-11-05",
  });
  assert.equal(resumen.idPublicacion, 7);
  assert.equal(resumen.precio, 250000);
  assert.equal(resumen.cuposDisponibles, 2);
  for (const campo of ["idUsuario", "tipo", "estado", "cuposTotales"]) assert.equal(campo in resumen, false);
});

const valores = {
  tipo: "Arrendador", titulo: "Arriendo de prueba", descripcion: "Descripción de prueba",
  precio: "250000", ubicacion: "Temuco", tipoVivienda: "casa", cupos: "2",
  enlaceReferencia: "", aceptaMascotas: false, tiposMascotas: [], condicionesMascotas: "",
  permitirComentarios: true,
};

test("la creación conserva multipart, la ruta común y el autor derivado del JWT", async () => {
  let llamada;
  const resultado = await servicio.crearPublicacion(valores, async (ruta, opciones) => {
    llamada = { ruta, opciones };
    return { exito: true, estadoHttp: 201, datos: { id: 123 } };
  });
  assert.equal(resultado.exito, true);
  assert.equal(resultado.datos.id, 123);
  assert.equal(llamada.ruta, "/api/publicaciones");
  assert.equal(llamada.opciones.metodo, "POST");
  assert.ok(llamada.opciones.cuerpo instanceof FormData);
  assert.equal(llamada.opciones.cuerpo.get("precio"), "250000");
  assert.equal(llamada.opciones.cuerpo.get("categoria"), "ofrezco");
  assert.equal(llamada.opciones.cuerpo.has("idUsuario"), false);
  assert.equal(llamada.opciones.cuerpo.has("autor_id"), false);
});

test("la creación mantiene el error de sesión sin tratarlo como éxito", async () => {
  const error = { exito: false, codigo: "no_autorizado", error: "Sesión rechazada", estadoHttp: 401 };
  const resultado = await servicio.crearPublicacion(valores, async () => error);
  assert.equal(resultado, error);
});

const publicacionApi = (id) => ({
  id,
  titulo: `Publicación ${id}`,
  tipo: "Arrendador",
  descripcion: "Casa",
  precio: 120000.0,
  ubicacion: "Temuco",
  estado: "Disponible",
  cupos_totales: 2,
  cupos_disponibles: 1,
  imagen: "/imagenes/p_ejemplo.png",
});

test("listarPublicaciones envía filtros y paginación y adapta la respuesta", async () => {
  process.env.EXPO_PUBLIC_IMAGENES_URL = "https://imagenes.ejemplo.test";
  respuestaListado = { exito: true, estadoHttp: 200, datos: [publicacionApi(33)] };

  const resultado = await servicio.listarPublicaciones(
    { consulta: "  Temuco ", precioMax: 200000, personas: "2" },
    3,
  );

  assert.equal(ultimaRuta, "/api/publicaciones?limite=10&offset=20&consulta=Temuco&precio_max=200000&personas=2");
  assert.equal(ultimasOpciones.autenticada, false);
  assert.equal(resultado.exito, true);
  assert.equal(resultado.publicaciones[0].idPublicacion, 33);
  assert.equal(resultado.publicaciones[0].cuposDisponibles, 1);
  assert.equal(resultado.publicaciones[0].imagenPrincipalUrl, "https://imagenes.ejemplo.test/imagenes/p_ejemplo.png");
  assert.equal(resultado.hayMas, false);
});

test("listarPublicaciones indica que hay más cuando llega una página completa", async () => {
  respuestaListado = {
    exito: true,
    estadoHttp: 200,
    datos: Array.from({ length: 10 }, (_, i) => publicacionApi(i + 1)),
  };
  const resultado = await servicio.listarPublicaciones();
  assert.equal(ultimaRuta, "/api/publicaciones?limite=10&offset=0");
  assert.equal(resultado.hayMas, true);
});

test("listarPublicaciones propaga el error y rechaza formatos inesperados", async () => {
  respuestaListado = { exito: false, codigo: "red", error: "Sin conexión" };
  const conError = await servicio.listarPublicaciones();
  assert.equal(conError.exito, false);
  assert.equal(conError.error, "Sin conexión");

  respuestaListado = { exito: true, estadoHttp: 200, datos: { no: "es una lista" } };
  assert.equal((await servicio.listarPublicaciones()).exito, false);
});

test("listarPublicaciones avisa si ninguna publicación tiene el formato esperado", async () => {
  respuestaListado = { exito: true, estadoHttp: 200, datos: [{ id_publicacion: 7, titulo: "X" }] };
  const resultado = await servicio.listarPublicaciones();
  assert.equal(resultado.exito, false);
});

test("obtenerPublicacionPorId pide el detalle real y adapta la respuesta", async () => {
  process.env.EXPO_PUBLIC_IMAGENES_URL = "https://imagenes.ejemplo.test";
  respuestaListado = { exito: true, estadoHttp: 200, datos: publicacionApi(33) };

  const publicacion = await servicio.obtenerPublicacionPorId("33");

  assert.equal(ultimaRuta, "/api/publicaciones/33/detalle");
  assert.equal(ultimasOpciones.autenticada, false);
  assert.equal(publicacion.idPublicacion, 33);
  assert.equal(publicacion.cuposDisponibles, 1);
  assert.equal(publicacion.imagenPrincipalUrl, "https://imagenes.ejemplo.test/imagenes/p_ejemplo.png");
});

test("obtenerPublicacionPorId devuelve null en 404 y falla con otros errores o formatos", async () => {
  respuestaListado = { exito: false, codigo: "http", error: "No existe", estadoHttp: 404 };
  assert.equal(await servicio.obtenerPublicacionPorId(999999), null);

  respuestaListado = { exito: false, codigo: "red", error: "Sin conexión" };
  await assert.rejects(() => servicio.obtenerPublicacionPorId(33), /Sin conexión/);

  respuestaListado = { exito: true, estadoHttp: 200, datos: { id: 33 } };
  await assert.rejects(() => servicio.obtenerPublicacionPorId(33), /formato/);
});