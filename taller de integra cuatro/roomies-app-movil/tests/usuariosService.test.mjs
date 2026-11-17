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
    URL,
    process: { env: { EXPO_PUBLIC_API_URL: "https://api.example.invalid" } },
    require(nombre) {
      if (nombre === "@/services/provisionPerfilService") {
        return { rutasPerfilPropio: () => ({ consulta: "/usuarios/me", alta: null }) };
      }
      assert.equal(nombre, "@/services/httpClient");
      return { solicitarJson: async (...args) => {
        llamadas.push(args);
        return typeof respuesta === "function" ? respuesta(...args) : respuesta;
      } };
    },
    console: { log: () => assert.fail("No registrar datos"), error: () => assert.fail("No registrar datos") },
  });
  return {
    consultar: modulo.exports.consultarPerfilPropio,
    actualizar: modulo.exports.actualizarPerfilPropio,
    adaptar: modulo.exports.adaptarPerfilTi2,
    crearBorrador: modulo.exports.crearBorradorPerfilPropio,
    obtenerCambios: modulo.exports.obtenerCambiosPerfilPropio,
    llamadas,
  };
}

// Modelo local de la vista, NO un ejemplo del contrato HTTP de TI2.
const perfil = {
  nombre: "Persona de prueba", email: null, edad: null, ocupacion: null,
  ubicacion: null, bio: null, presupuesto: null, preferencias: null,
  buscaEn: null, fotoPerfilUrl: null, breveDescripcion: null,
};

// Datos ficticios que respetan el esquema publicado; no son una cuenta real.
const dto = {
  nombre: "Persona de prueba", edad: 24, ocupacion: "Estudiante", ciudad: "Temuco",
  breve_descripcion: "Presentación breve", sobre_mi: "Descripción personal extensa",
  foto_perfil: null,
};

test("un adaptador deshabilitado explícitamente devuelve pendiente y no realiza peticiones", async () => {
  const servicio = preparar();
  const resultado = await servicio.consultar(null);
  assert.equal(resultado.exito, false);
  assert.equal(resultado.codigo, "contrato_pendiente");
  assert.equal(servicio.llamadas.length, 0);
  assert.equal("perfil" in resultado, false);
});

test("el adaptador real por defecto consulta /usuarios/me y distingue las dos descripciones", async () => {
  const servicio = preparar({ exito: true, datos: dto, estadoHttp: 200 });
  const resultado = await servicio.consultar();
  assert.equal(servicio.llamadas[0][0], "/usuarios/me");
  assert.equal(servicio.llamadas[0].length, 1);
  assert.equal(resultado.exito, true);
  assert.equal(resultado.perfil.nombre, dto.nombre);
  assert.equal(resultado.perfil.edad, dto.edad);
  assert.equal(resultado.perfil.ubicacion, dto.ciudad);
  assert.equal(resultado.perfil.ocupacion, dto.ocupacion);
  assert.equal(resultado.perfil.breveDescripcion, dto.breve_descripcion);
  assert.equal(resultado.perfil.bio, dto.sobre_mi);
});

test("DTO incompletos, tipos incorrectos y edades inválidas no se presentan como perfil", async () => {
  const servicio = preparar();
  for (const campo of Object.keys(dto)) {
    const incompleto = { ...dto }; delete incompleto[campo];
    assert.equal(servicio.adaptar(incompleto), null, `Falta ${campo}`);
    assert.equal(servicio.adaptar({ ...dto, [campo]: {} }), null, `Tipo de ${campo}`);
  }
  for (const valor of [null, [], "perfil", { ...dto, nombre: " " }, { ...dto, nombre: null },
    ...[-1, 121, 18.5, "24", NaN, Infinity].map(edad => ({ ...dto, edad }))]) {
    assert.equal(servicio.adaptar(valor), null);
  }
});

test("nulabilidad y vacíos no se convierten en información inventada ni se aceptan campos ajenos al contrato", () => {
  const servicio = preparar();
  const resultado = servicio.adaptar({ nombre: " Nombre ", edad: null, ocupacion: "  ", ciudad: null,
    breve_descripcion: "", sobre_mi: null, foto_perfil: null,
    email: "ignorar@example.com", presupuesto: 250000, preferencias: ["dato no acordado"], calificacion: 5 });
  assert.equal(resultado.nombre, "Nombre");
  for (const campo of ["email", "edad", "ocupacion", "ubicacion", "breveDescripcion", "bio", "fotoPerfilUrl", "presupuesto", "preferencias", "buscaEn"]) {
    assert.equal(resultado[campo], null, campo);
  }
  assert.equal("calificacion" in resultado, false);
});

test("foto admite HTTP(S) y referencias raíz de la API, omitiendo esquemas y credenciales inapropiados", () => {
  const servicio = preparar();
  for (const [foto, esperado] of [
    ["https://imagenes.example.invalid/foto.png", "https://imagenes.example.invalid/foto.png"],
    ["/imagenes/persona.png", "https://api.example.invalid/imagenes/persona.png"],
    ["javascript:alert(1)", null], ["data:image/png;base64,AAAA", null],
    ["file:///foto.png", null], ["https://usuario:clave@imagenes.example.invalid/foto", null],
    ["//imagenes.example.invalid/foto.png", null], ["", null],
  ]) assert.equal(servicio.adaptar({ ...dto, foto_perfil: foto }).fotoPerfilUrl, esperado);
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

test("el borrador conserva los valores existentes y envía solo los cambios, incluido el borrado", async () => {
  const actualizado = { ...dto, ciudad: "Padre Las Casas", sobre_mi: null };
  const servicio = preparar((_ruta, opciones) => ({
    exito: true, estadoHttp: 200, datos: opciones.metodo === "PATCH" ? dto : actualizado,
  }));
  const inicial = servicio.crearBorrador(servicio.adaptar({ ...dto, ocupacion: "Ocupación previa de Render" }));
  const cambios = servicio.obtenerCambios(inicial, { ...inicial, ciudad: " Padre Las Casas ", sobre_mi: " " });
  assert.equal(JSON.stringify(servicio.obtenerCambios(inicial, inicial)), "{}");
  const resultado = await servicio.actualizar(cambios, "cuenta-a");

  assert.equal(servicio.llamadas.length, 2);
  assert.equal(JSON.stringify(servicio.llamadas), JSON.stringify([
    ["/usuarios/me", { metodo: "PATCH", cuerpo: { ciudad: "Padre Las Casas", sobre_mi: null }, identidadEsperada: "cuenta-a" }],
    ["/usuarios/me", { identidadEsperada: "cuenta-a" }],
  ]));
  assert.equal(resultado.exito, true);
  assert.equal(resultado.perfil.ubicacion, "Padre Las Casas");
  assert.equal(resultado.perfil.bio, null);
});

test("no envía un PATCH vacío, fuera de límite o con datos protegidos", async () => {
  const servicio = preparar();
  for (const cambios of [
    {}, { edad: 30, ciudad: "Temuco" }, { nombre: "Otro nombre" }, { correo: null },
    { foto_perfil: "foto.jpg" }, { ciudad: "a".repeat(101) }, { sobre_mi: "a\0b" },
  ]) {
    const resultado = await servicio.actualizar(cambios, "cuenta-a");
    assert.equal(resultado.exito, false);
    assert.equal(resultado.guardado, false);
  }
  assert.equal(servicio.llamadas.length, 0);
});

test("distingue un PATCH rechazado de un guardado que solo necesita repetir la consulta", async () => {
  const rechazo = { exito: false, estadoHttp: 422, codigo: "http", error: "Revisa los datos que enviaste." };
  const rechazado = preparar(rechazo);
  const falloPatch = await rechazado.actualizar({ ciudad: "Temuco" }, "cuenta-a");
  assert.equal(falloPatch.guardado, false);
  assert.equal(falloPatch.error, rechazo.error);
  assert.equal(rechazado.llamadas.length, 1);

  const guardado = preparar((_ruta, opciones) => opciones.metodo === "PATCH"
    ? { exito: true, estadoHttp: 200, datos: dto }
    : { exito: false, codigo: "red", error: "Revisa la conexión." });
  const falloConsulta = await guardado.actualizar({ ciudad: "Temuco" }, "cuenta-a");
  assert.equal(falloConsulta.exito, false);
  assert.equal(falloConsulta.guardado, true);
  assert.equal(guardado.llamadas.length, 2);
});
