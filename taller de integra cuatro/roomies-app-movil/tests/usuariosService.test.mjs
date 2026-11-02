import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const fuente = await readFile(new URL("../src/services/usuariosService.ts", import.meta.url), "utf8");
const compilado = ts.transpileModule(fuente, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function preparar(respuesta = { exito: true, estadoHttp: 200, datos: { ejemplo: "contrato ficticio" } }) {
  const llamadas = [];
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    exports: modulo.exports,
    require(nombre) {
      assert.equal(nombre, "@/services/httpClient");
      return { solicitarJson: async (...args) => { llamadas.push(args); return respuesta; } };
    },
    console: { log: () => assert.fail("No registrar datos"), error: () => assert.fail("No registrar datos") },
  });
  return { consultar: modulo.exports.consultarPerfilPropio, llamadas };
}

// Modelo local de la vista, NO un ejemplo del contrato HTTP de TI2.
const perfil = {
  nombre: "Persona de prueba", email: null, edad: null, ocupacion: null,
  ubicacion: null, bio: null, presupuesto: null, preferencias: null,
  buscaEn: null, fotoPerfilUrl: null,
};

test("sin adaptador confirmado devuelve pendiente y no realiza peticiones", async () => {
  const servicio = preparar();
  const resultado = await servicio.consultar();
  assert.equal(resultado.exito, false);
  assert.equal(resultado.codigo, "contrato_pendiente");
  assert.equal(servicio.llamadas.length, 0);
  assert.equal("perfil" in resultado, false);
});

test("con un adaptador explícito consulta GET protegido /usuarios/me y entrega solo su proyección", async () => {
  const datos = { ejemplo: "contrato ficticio", ignorar: "dato interno" };
  const servicio = preparar({ exito: true, datos, estadoHttp: 200 });
  let recibido;
  const resultado = await servicio.consultar((valor) => { recibido = valor; return perfil; });
  assert.equal(servicio.llamadas[0][0], "/usuarios/me");
  assert.equal(servicio.llamadas[0].length, 1, "Usa GET protegido por defecto de A07");
  assert.equal(recibido, datos);
  assert.equal(resultado.perfil, perfil);
  assert.equal("ignorar" in resultado.perfil, false);
});

test("401, 403, 404 y fallos de transporte se conservan sin inventar perfil ni interpretar 404 como alta pendiente", async () => {
  for (const error of [
    { exito: false, codigo: "no_autorizado", estadoHttp: 401, error: "Sesión no aceptada" },
    { exito: false, codigo: "sin_permiso", estadoHttp: 403, error: "Sin permiso" },
    { exito: false, codigo: "http", estadoHttp: 404, error: "No encontrado" },
    { exito: false, codigo: "red", error: "Sin conexión" },
    { exito: false, codigo: "configuracion", error: "Sin URL" },
  ]) {
    const servicio = preparar(error);
    const resultado = await servicio.consultar(() => assert.fail("No adaptar errores"));
    assert.equal(resultado, error);
  }
});

test("JSON que el adaptador rechaza nunca se muestra como perfil válido", async () => {
  const servicio = preparar();
  const resultado = await servicio.consultar(() => null);
  assert.equal(resultado.exito, false);
  assert.equal(resultado.codigo, "respuesta_invalida");
  assert.equal("perfil" in resultado, false);
});

test("null y 204 son respuestas inválidas de perfil aunque un adaptador intentase inventar datos", async () => {
  for (const respuesta of [
    { exito: true, datos: null, estadoHttp: 200 },
    { exito: true, datos: null, estadoHttp: 204 },
  ]) {
    const servicio = preparar(respuesta);
    const resultado = await servicio.consultar(() => assert.fail("No adaptar un perfil inexistente"));
    assert.equal(resultado.codigo, "respuesta_invalida");
  }
});

test("un fallo de adaptación se convierte en error genérico sin exponer datos internos", async () => {
  const servicio = preparar();
  const resultado = await servicio.consultar(() => { throw new Error("dato-sensible-ficticio"); });
  assert.equal(resultado.codigo, "respuesta_invalida");
  assert.doesNotMatch(JSON.stringify(resultado), /dato-sensible-ficticio/);
});
