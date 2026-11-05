import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Ejecuta los módulos reales. Ninguna prueba tiene acceso a Supabase, .env o red.
const cache = new Map();
const rutas = {
  "@/constants/camposPublicacion": "../src/constants/camposPublicacion.ts",
  "@/mocks/publicaciones": "../src/mocks/publicaciones.ts",
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
    require(nombre) {
      if (nombre === "@/services/httpClient") return {
        solicitarFormulario: () => { throw new Error("El transporte real no está permitido en estas pruebas"); },
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

test("listado y detalle comparten IDs, datos y tipos de las publicaciones demostrativas", async () => {
  const listado = await servicio.obtenerPublicaciones();
  assert.equal(listado.length, publicacionesMock.length);
  for (const publicacion of listado) {
    assert.equal(await servicio.obtenerPublicacionPorId(String(publicacion.idPublicacion)), publicacion);
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

test("el detalle devuelve null para IDs ausentes o inválidos", async () => {
  for (const id of ["", "invalido", 0, -1, 1.5, 999999]) {
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
