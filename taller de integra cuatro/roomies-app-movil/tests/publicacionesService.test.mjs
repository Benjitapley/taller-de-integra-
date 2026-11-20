import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Ejecuta los módulos reales. Ninguna prueba tiene acceso a Supabase, .env o red.
const cache = new Map();
const rutas = {
  "@/constants/camposPublicacion": "../src/constants/camposPublicacion.ts",
  "@/constants/contratoPublicacion": "../src/constants/contratoPublicacion.ts",
  "@/mocks/publicaciones": "../src/mocks/publicaciones.ts",
};

// FormData de React Native: acepta { uri, name, type } como archivo. El de Node lo
// convertiría en texto, así que las pruebas usan esta versión para ver lo que se adjunta.
class FormDataRN {
  #entradas = [];
  append(nombre, valor) { this.#entradas.push([nombre, valor]); }
  has(nombre) { return this.#entradas.some(([n]) => n === nombre); }
  get(nombre) { return this.#entradas.find(([n]) => n === nombre)?.[1] ?? null; }
  getAll(nombre) { return this.#entradas.filter(([n]) => n === nombre).map(([, v]) => v); }
  nombres() { return this.#entradas.map(([n]) => n); }
}

function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta);
  const fuente = readFileSync(new URL(ruta, import.meta.url), "utf8");
  const compilado = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    exports: modulo.exports,
    FormData: FormDataRN,
    require(nombre) {
      if (nombre === "@/services/httpClient") return {
        solicitarFormulario: () => { throw new Error("El transporte real no está permitido en estas pruebas"); },
        solicitarJson: () => { throw new Error("El transporte real no está permitido en estas pruebas"); },
      };
      if (nombre.startsWith("@/types/")) return {}; // solo tipos: no existen en tiempo de ejecución
      assert.ok(rutas[nombre], `Dependencia inesperada: ${nombre}`);
      return cargar(rutas[nombre]);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}
// Los objetos creados dentro del vm pertenecen a otro contexto de JavaScript, y
// deepStrictEqual los vería distintos aunque tengan el mismo contenido: se pasan a planos.
const plano = (valor) => JSON.parse(JSON.stringify(valor));

const servicio = cargar("../src/services/publicacionesService.ts");
const adapter = cargar("../src/adapters/publicacionAdapter.ts");
const { publicacionesMock } = cargar(rutas["@/mocks/publicaciones"]);

// ---------------------------------------------------------------------------
// Consulta (fuente demostrativa hasta conectar el contrato de consulta)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Creación: POST /api/publicaciones (C01)
// La forma exacta de los campos está en formaListado.test.mjs; aquí se prueba el envío.
// ---------------------------------------------------------------------------

const valores = {
  tipo: "Arrendador", titulo: "Arriendo de prueba", descripcion: "Descripción de prueba",
  precio: "250000", idRegion: "9", idComuna: "9101", nombreRegion: "La Araucanía", nombreComuna: "Temuco",
  tipoVivienda: "casa", cupos: "2", enlaceReferencia: "", aceptaMascotas: false,
  permitirComentarios: true, reglas: [],
};
const creada = (datos = { id_publicacion: 123 }, estadoHttp = 201) => ({ exito: true, estadoHttp, datos });
const espia = (respuesta) => {
  const llamadas = [];
  const enviar = async (ruta, opciones) => { llamadas.push({ ruta, opciones }); return respuesta; };
  return { enviar, llamadas };
};

test("la creación usa multipart, la ruta común y el autor derivado del JWT", async () => {
  const { enviar, llamadas } = espia(creada());
  const resultado = await servicio.crearPublicacion(valores, enviar);

  assert.equal(resultado.exito, true);
  assert.equal(resultado.datos.id, 123);
  assert.equal(llamadas.length, 1);
  const { ruta, opciones } = llamadas[0];
  assert.equal(ruta, "/api/publicaciones");
  assert.equal(opciones.metodo, "POST");
  assert.ok(opciones.cuerpo instanceof FormDataRN);
  assert.equal(opciones.cuerpo.get("precio"), "250000");
  assert.equal(opciones.cuerpo.get("id_region"), "9");
  assert.equal(opciones.cuerpo.get("id_comuna"), "9101");
  assert.equal(opciones.cuerpo.get("mascota"), "no");
  assert.equal(opciones.cuerpo.has("idUsuario"), false);
  assert.equal(opciones.cuerpo.has("autor_id"), false);
  assert.equal(opciones.cuerpo.has("imagenes"), false);
  assert.equal("headers" in opciones, false, "sin clave no se envía ninguna cabecera");
});

test("la clave de idempotencia viaja en la cabecera Idempotency-Key y se repite en el reintento", async () => {
  const clave = "0b8f4a52-1c3d-4e6f-9a7b-5d2c8e1f3a40";
  const { enviar, llamadas } = espia(creada());
  await servicio.crearPublicacion(valores, enviar, { claveIdempotencia: clave });
  await servicio.crearPublicacion(valores, enviar, { claveIdempotencia: clave });

  assert.equal(llamadas.length, 2);
  for (const { opciones } of llamadas) assert.deepEqual(plano(opciones.headers), { "Idempotency-Key": clave });
});

test("las fotos se envían todas bajo `imagenes`, en orden y con su tipo", async () => {
  const { enviar, llamadas } = espia(creada());
  await servicio.crearPublicacion(valores, enviar, {
    imagenesUris: [
      "file:///cache/a.JPG",
      "file:///cache/b.png?x=1",
      "file:///cache/c.webp",
      "file:///cache/d.heic",
      "file:///cache/sin-extension",
    ],
  });

  const fotos = llamadas[0].opciones.cuerpo.getAll("imagenes");
  assert.deepEqual(
    fotos.map(({ uri, name, type }) => ({ uri, name, type })),
    [
      { uri: "file:///cache/a.JPG", name: "foto-1.jpg", type: "image/jpeg" },
      { uri: "file:///cache/b.png?x=1", name: "foto-2.png", type: "image/png" },
      { uri: "file:///cache/c.webp", name: "foto-3.webp", type: "image/webp" },
      { uri: "file:///cache/d.heic", name: "foto-4.jpg", type: "image/jpeg" },
      { uri: "file:///cache/sin-extension", name: "foto-5.jpg", type: "image/jpeg" },
    ],
  );
  assert.equal(llamadas[0].opciones.cuerpo.has("imagen"), false, "el campo antiguo `imagen` ya no existe");
});

test("una sexta foto se rechaza antes de enviar nada", async () => {
  const seis = Array.from({ length: 6 }, (_, i) => `file:///cache/${i}.jpg`);
  const { enviar, llamadas } = espia(creada());
  const resultado = await servicio.crearPublicacion(valores, enviar, { imagenesUris: seis });

  assert.equal(resultado.exito, false);
  assert.equal(resultado.codigo, "peticion_invalida");
  assert.equal(llamadas.length, 0);

  const cinco = await servicio.crearPublicacion(valores, enviar, { imagenesUris: seis.slice(0, 5) });
  assert.equal(cinco.exito, true);
  assert.equal(llamadas.length, 1);
});

test("solo un 201 cuenta como creada: 200, 202 y 204 no confirman la publicación", async () => {
  for (const estadoHttp of [200, 202, 204]) {
    const { enviar } = espia(creada({ id_publicacion: 123 }, estadoHttp));
    const resultado = await servicio.crearPublicacion(valores, enviar);
    assert.equal(resultado.exito, false, `estado ${estadoHttp}`);
    assert.equal(resultado.codigo, "respuesta_invalida");
    assert.equal(resultado.estadoHttp, estadoHttp);
  }
});

test("el 201 se lee como `id_publicacion` y se acepta `id` por compatibilidad", async () => {
  const conMensaje = await servicio.crearPublicacion(valores, espia(creada({ id_publicacion: 7, mensaje: "ok" })).enviar);
  assert.deepEqual(plano(conMensaje.datos), { id: 7, mensaje: "ok" });
  const antiguo = await servicio.crearPublicacion(valores, espia(creada({ id: 8 })).enviar);
  assert.deepEqual(plano(antiguo.datos), { id: 8 });
});

test("un 201 ilegible no es un éxito", async () => {
  for (const datos of [null, "ok", {}, { id_publicacion: "7" }, { id_publicacion: 0 }, { id_publicacion: 1.5 }, { mensaje: "creada" }]) {
    const resultado = await servicio.crearPublicacion(valores, espia(creada(datos)).enviar);
    assert.equal(resultado.exito, false, JSON.stringify(datos));
    assert.equal(resultado.codigo, "respuesta_invalida");
    assert.equal(resultado.estadoHttp, 201);
  }
});

test("un formulario inválido no llega a la red", async () => {
  const { enviar, llamadas } = espia(creada());
  for (const cambio of [{ idComuna: "" }, { idRegion: "abc" }, { precio: "-5" }, { cupos: "0" }, { titulo: "   " }, { tipoVivienda: null }, { nombreComuna: "", nombreRegion: "" }]) {
    const resultado = await servicio.crearPublicacion({ ...valores, ...cambio }, enviar);
    assert.equal(resultado.exito, false, JSON.stringify(cambio));
    assert.equal(resultado.codigo, "peticion_invalida");
  }
  assert.equal(llamadas.length, 0);
});

test("los errores del cliente se devuelven tal cual y nunca como éxito", async () => {
  const errores = [
    { exito: false, codigo: "no_autorizado", error: "Sesión rechazada", estadoHttp: 401 },
    { exito: false, codigo: "sin_permiso", error: "Sin permiso", estadoHttp: 403 },
    { exito: false, codigo: "http", error: "Revisa los datos que enviaste.", estadoHttp: 422 },
    { exito: false, codigo: "red", error: "Sin conexión" },
    { exito: false, codigo: "tiempo_agotado", error: "Tardó demasiado" },
  ];
  for (const error of errores) {
    const resultado = await servicio.crearPublicacion(valores, async () => error);
    assert.equal(resultado, error);
  }
});

// ---------------------------------------------------------------------------
// Consulta del detalle tras crear
// ---------------------------------------------------------------------------

test("tras crear se consulta el detalle público y se confirma que es la misma publicación", async () => {
  const llamadas = [];
  const solicitar = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    return { exito: true, estadoHttp: 200, datos: { id_publicacion: 123, estado: "Disponible" } };
  };
  const resultado = await servicio.consultarPublicacionCreada(123, solicitar);

  assert.deepEqual(plano(resultado), { exito: true, idPublicacion: 123, estado: "Disponible" });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].ruta, "/api/publicaciones/123");
  assert.equal(llamadas[0].opciones.autenticada, false);
});

test("el detalle de otra publicación, o sin estado legible, no confirma la creación", async () => {
  const distinta = await servicio.consultarPublicacionCreada(123, async () => ({ exito: true, estadoHttp: 200, datos: { id_publicacion: 999 } }));
  assert.equal(distinta.exito, false);
  assert.equal(distinta.codigo, "respuesta_invalida");

  const vacio = await servicio.consultarPublicacionCreada(123, async () => ({ exito: true, estadoHttp: 200, datos: null }));
  assert.equal(vacio.exito, false);

  const antiguo = await servicio.consultarPublicacionCreada(5, async () => ({ exito: true, estadoHttp: 200, datos: { id: 5, estado: 3 } }));
  assert.deepEqual(plano(antiguo), { exito: true, idPublicacion: 5, estado: null });
});

test("un id inválido no consulta nada y un error de la consulta se devuelve tal cual", async () => {
  let consultas = 0;
  const solicitar = async () => { consultas++; return { exito: true, estadoHttp: 200, datos: {} }; };
  for (const id of [0, -1, 1.5, NaN, Infinity]) {
    const resultado = await servicio.consultarPublicacionCreada(id, solicitar);
    assert.equal(resultado.exito, false);
    assert.equal(resultado.codigo, "peticion_invalida");
  }
  assert.equal(consultas, 0);

  const error = { exito: false, codigo: "http", error: "No se encontró el recurso solicitado.", estadoHttp: 404 };
  assert.equal(await servicio.consultarPublicacionCreada(123, async () => error), error);
});
