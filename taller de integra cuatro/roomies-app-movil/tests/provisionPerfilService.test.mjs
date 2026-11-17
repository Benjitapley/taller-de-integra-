import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

async function compilar(ruta) {
  const fuente = await readFile(new URL(ruta, import.meta.url), "utf8");
  return ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const [servicio, fechas] = await Promise.all([
  compilar("../src/services/provisionPerfilService.ts"),
  compilar("../src/utils/fechaNacimiento.ts"),
]);
const utilFechas = {};
runInNewContext(fechas, { exports: utilFechas });

const identidad = { identidadId: "cuenta-a", correoConfirmado: true, nombre: " Persona ", fechaNacimiento: "1999-02-01" };
const noEncontrado = { exito: false, codigo: "http", estadoHttp: 404, error: "No se encontró el perfil." };

function preparar(modo, respuestas) {
  const llamadas = [];
  const exports = {};
  runInNewContext(servicio, {
    exports,
    process: { env: { EXPO_PUBLIC_CONTRATO_PERFIL: modo } },
    require(nombre) {
      if (nombre === "@/utils/fechaNacimiento") return utilFechas;
      assert.equal(nombre, "@/services/httpClient");
      return {
        solicitarJson: async (ruta, opciones) => {
          llamadas.push([ruta, JSON.parse(JSON.stringify(opciones))]);
          assert.ok(respuestas.length, "Petición imprevista");
          return respuestas.shift();
        },
      };
    },
  });
  return { asegurar: exports.asegurarPerfilPropio, llamadas };
}

test("restaurar un perfil existente lo consulta y no vuelve a crearlo", async () => {
  const { asegurar, llamadas } = preparar("render", [{ exito: true, estadoHttp: 200, datos: { nombre: "Existente" } }]);
  assert.equal((await asegurar({ ...identidad, nombre: undefined, fechaNacimiento: undefined })).exito, true);
  assert.deepEqual(llamadas, [["/usuarios/me", { identidadEsperada: "cuenta-a" }]]);
});

test("da de alta una cuenta confirmada mediante la ruta publicada", async () => {
  const { asegurar, llamadas } = preparar("render", [
    noEncontrado, { exito: true, estadoHttp: 200, datos: { id_usuario: 17, inicializado: true } },
  ]);
  assert.equal((await asegurar(identidad)).exito, true);
  assert.deepEqual(llamadas, [
    ["/usuarios/me", { identidadEsperada: "cuenta-a" }],
    ["/local/v1/perfil/inicializacion", { metodo: "POST", identidadEsperada: "cuenta-a", cuerpo: { nombre: "Persona", fecha_nacimiento: "1999-02-01" } }],
  ]);
});

test("preserva fallos de sesión o del servicio y evita altas con registro incompleto", async () => {
  for (const estadoHttp of [401, 403, 503]) {
    const error = { ...noEncontrado, estadoHttp };
    const { asegurar, llamadas } = preparar("render", [error]);
    assert.equal(await asegurar(identidad), error);
    assert.equal(llamadas.length, 1);
  }
  for (const cambios of [{ correoConfirmado: false }, { nombre: " " }, { fechaNacimiento: "2000-02-30" }, { fechaNacimiento: null }]) {
    const { asegurar, llamadas } = preparar("render", [noEncontrado]);
    assert.equal((await asegurar({ ...identidad, ...cambios })).exito, false);
    assert.equal(llamadas.length, 1);
  }
});

test("sin modo elegido no intenta un alta y una respuesta de alta inválida no da éxito", async () => {
  const sinOptIn = preparar(undefined, []);
  assert.equal((await sinOptIn.asegurar(identidad)).exito, true);
  assert.equal(sinOptIn.llamadas.length, 0);

  const modoInvalido = preparar("otro", []);
  assert.equal((await modoInvalido.asegurar(identidad)).codigo, "configuracion");
  assert.equal(modoInvalido.llamadas.length, 0);

  const altaInvalida = preparar("render", [noEncontrado, { exito: true, estadoHttp: 200, datos: { id_usuario: 0 } }]);
  assert.equal((await altaInvalida.asegurar(identidad)).codigo, "respuesta_invalida");
});
