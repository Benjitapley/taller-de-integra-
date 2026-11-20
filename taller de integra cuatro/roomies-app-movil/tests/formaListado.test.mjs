import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Comprueba la solicitud de creación con la forma que valida el servicio Listado de
// TI2 y la clave de idempotencia. Sin red, .env ni dispositivo.
const cache = new Map();
const rutas = {
  "@/constants/camposPublicacion": "../src/constants/camposPublicacion.ts",
  "@/constants/contratoPublicacion": "../src/constants/contratoPublicacion.ts",
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
    require(nombre) {
      if (nombre === "@/services/httpClient") return { solicitarFormulario() {}, solicitarJson() {} };
      if (nombre === "@/mocks/publicaciones") return { publicacionesMock: [] };
      if (nombre.startsWith("@/types/")) return {};
      assert.ok(rutas[nombre], `Dependencia inesperada: ${nombre}`);
      return cargar(rutas[nombre]);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}
const { armarSolicitudCreacion } = cargar("../src/services/publicacionesService.ts");

const valores = {
  tipo: "Arrendador", titulo: "Pieza en Temuco", precio: "250000",
  idRegion: "9", idComuna: "9101", nombreRegion: "La Araucanía", nombreComuna: "Temuco",
  tipoVivienda: "habitacion", cupos: "2", descripcion: "Pieza luminosa", enlaceReferencia: "",
  aceptaMascotas: false, permitirComentarios: false, reglas: ["Sin fiestas", " "],
};
const campos = (cuerpo) => Object.keys(cuerpo).sort().join(",");

test("el cuerpo lleva exactamente los campos que valida Listado", () => {
  const { cuerpo } = armarSolicitudCreacion(valores);
  assert.equal(
    campos(cuerpo),
    "categoria,cupos_totales,descripcion,id_comuna,id_region,mascota,precio,reglas,tipo,tipo_vivienda,titulo,ubicacion",
  );
  assert.equal(cuerpo.tipo, "Arrendador");
  assert.equal(cuerpo.tipo_vivienda, "habitacion");
  assert.equal(cuerpo.categoria, "ofrezco");
  assert.equal(cuerpo.ubicacion, "Temuco, La Araucanía");
  assert.equal(cuerpo.precio, 250000);
  assert.equal(cuerpo.mascota, "no");
  assert.equal(JSON.stringify(cuerpo.reglas), JSON.stringify(["Sin fiestas"]));
  assert.equal("reglas_arrendador" in cuerpo, false);
});

test("sin reglas no se envía el campo", () => {
  const { cuerpo } = armarSolicitudCreacion({ ...valores, reglas: [] });
  assert.equal("reglas" in cuerpo, false);
});

test("sin nombres de comuna ni región no hay ubicación y se rechaza", () => {
  assert.throws(
    () => armarSolicitudCreacion({ ...valores, nombreComuna: "", nombreRegion: " " }),
    (e) => e.name === "PayloadPublicacionInvalidoError" && e.campo === "nombreComuna",
  );
});

test("ubicacion se limita a 250 caracteres", () => {
  const { cuerpo } = armarSolicitudCreacion({ ...valores, nombreComuna: "x".repeat(400) });
  assert.equal(cuerpo.ubicacion.length, 250);
});

test("la clave de idempotencia es un UUID canónico y se reutiliza por huella", () => {
  rutas["@/utils/claveIdempotencia"] = "../src/utils/claveIdempotencia.ts";
  const { generarClave, claveParaBorrador } = cargar("../src/utils/claveIdempotencia.ts");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  for (let i = 0; i < 20; i++) assert.match(generarClave(), uuid);
  assert.equal(claveParaBorrador("a"), claveParaBorrador("a"));
  assert.notEqual(claveParaBorrador("a"), claveParaBorrador("b"));
});
