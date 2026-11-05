import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const fuente = await readFile(new URL("../src/components/perfil/ContenidoPerfil.tsx", import.meta.url), "utf8");
const compilado = ts.transpileModule(fuente, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const modulo = { exports: {} };
// Componentes host mínimos: se prueba el contenido real, sin fingir un entorno nativo.
const host = (tag) => function Host({ children, accessibilityLabel }) {
  return React.createElement(tag, { "aria-label": accessibilityLabel }, children);
};
runInNewContext(compilado, {
  exports: modulo.exports,
  require(nombre) {
    if (nombre === "react/jsx-runtime") return jsx;
    if (nombre === "react-native") return {
      View: host("div"), Text: host("span"), Image: host("img"),
      ActivityIndicator: () => React.createElement("span", null, "Indicador de carga"),
      StyleSheet: { create: (estilos) => estilos },
    };
    if (nombre === "@expo/vector-icons") return { Ionicons: () => null };
    if (nombre === "@/components/CustomButton") return {
      CustomButton: ({ titulo }) => React.createElement("button", null, titulo),
    };
    throw new Error(`Dependencia inesperada: ${nombre}`);
  },
});
function render(estado) {
  return renderToStaticMarkup(React.createElement(modulo.exports.ContenidoPerfil, { estado, onReintentar: () => {} }));
}

test("carga no expone información personal de demostración ni habilita edición", () => {
  const html = render({ tipo: "cargando" });
  assert.match(html, /Cargando tu perfil/);
  assert.doesNotMatch(html, /Sofía|4\.8|Verificada|Editar perfil|Guardar|pravatar|picsum/);
});

test("pendiente y errores permiten reintentar y no se representan como perfiles vacíos o exitosos", () => {
  for (const codigo of ["contrato_pendiente", "no_autorizado", "sin_permiso", "red", "respuesta_invalida"]) {
    const html = render({ tipo: "resultado", resultado: { exito: false, codigo, error: "Error controlado de prueba" } });
    assert.match(html, /Error controlado de prueba/);
    assert.match(html, /Reintentar/);
    assert.doesNotMatch(html, /Sobre mí|Sofía|sesión cerrada|Cambios guardados/);
  }
});

test("un perfil proyectado conserva cero y listas vacías; reputación y estadísticas siguen no disponibles", () => {
  const html = render({ tipo: "resultado", resultado: { exito: true, perfil: {
    nombre: "Nombre controlado", email: null, fotoPerfilUrl: null, edad: null,
    ocupacion: "Ocupación controlada", ubicacion: null, bio: null,
    presupuesto: 0, preferencias: [], buscaEn: [],
  } } });
  assert.match(html, /Nombre controlado/);
  assert.match(html, /Ocupación controlada/);
  assert.match(html, /\$0 CLP/);
  assert.match(html, /Sin preferencias indicadas/);
  assert.match(html, /Sin zonas indicadas/);
  assert.match(html, /Calificación: no disponible/);
  assert.match(html, /Estadísticas no disponibles/);
  assert.doesNotMatch(html, /Sofía|4\.8|12 evaluaciones|Verificada|220\.000/);
});

test("datos ausentes permanecen no disponibles sin inventar edad, presupuesto ni historial", () => {
  const html = render({ tipo: "resultado", resultado: { exito: true, perfil: {
    nombre: null, email: null, fotoPerfilUrl: null, edad: null, ocupacion: null,
    ubicacion: null, breveDescripcion: null, bio: null, presupuesto: null, preferencias: null, buscaEn: null,
  } } });
  assert.match(html, /No disponible/);
  assert.doesNotMatch(html, /\$0|0 años|Sin preferencias indicadas|Sin zonas indicadas|Camila Soto/);
  assert.match(html, /Reputación y evaluaciones no disponibles/);
});

test("la descripción breve se muestra en el resumen y la extensa en Sobre mí", () => {
  const html = render({ tipo: "resultado", resultado: { exito: true, perfil: {
    nombre: "Persona controlada", email: null, fotoPerfilUrl: null, edad: 24,
    ocupacion: null, ubicacion: null, breveDescripcion: "Texto breve controlado",
    bio: "Texto extenso controlado", presupuesto: null, preferencias: null, buscaEn: null,
  } } });
  assert.ok(html.indexOf("Texto breve controlado") < html.indexOf("Sobre mí"));
  assert.ok(html.indexOf("Texto extenso controlado") > html.indexOf("Sobre mí"));
  assert.doesNotMatch(html, /Sofía|Verificada|4\.8/);
});
