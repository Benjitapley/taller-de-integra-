import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

let auth;
const cache = new Map();
const host = (tag) => function Host({ children }) { return React.createElement(tag, null, children); };
const Stack = host("main");
Stack.Protected = ({ guard, children }) => guard ? children : null;
Stack.Screen = ({ name }) => name ? React.createElement("span", { "data-route": name }) : null;

// Prueba la composición real del layout. Los componentes
// host sustituyen React Native/Expo; no se ejecutan SDK, red ni variables locales.
function cargar(ruta) {
  if (cache.has(ruta)) return cache.get(ruta);
  const fuente = readFileSync(new URL(ruta, import.meta.url), "utf8");
  const compilado = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    exports: modulo.exports,
    require(nombre) {
      if (nombre === "react") return React;
      if (nombre === "react/jsx-runtime") return jsx;
      if (nombre === "react-native") return {
        View: host("div"), Text: host("span"), ActivityIndicator: () => React.createElement("span", null, "Cargando"),
        StyleSheet: { create: (estilos) => estilos },
      };
      if (nombre === "expo-router") return { Stack };
      if (nombre === "@/hooks/useAuth") return { AuthProvider: host(React.Fragment), useAuth: () => auth };
      if (nombre === "@/lib/supabase") return {
        iniciarCicloSesionSupabase() { throw new Error("El SDK real no se permite en estas pruebas"); },
      };
      if (nombre === "@/components/CustomButton") return {
        CustomButton: ({ titulo }) => React.createElement("button", null, titulo),
      };
      throw new Error(`Dependencia inesperada: ${nombre}`);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}

const RootLayout = cargar("../src/app/_layout.tsx").default;
const privadas = ["reportes", "notificaciones", "mis-publicaciones", "postulantes/[id]", "convivencia/formulario", "(tabs)", "convivencia/tareas", "arriendo/index", "arriendo/chat", "chats/index", "chats/[id]"];
const rutaVisible = (html, ruta) => html.includes(`data-route="${ruta}"`);
function renderLayout(cambios = {}) {
  auth = { estaAutenticado: false, usuarioActual: null, restaurandoSesion: false, errorRestauracion: null, ...cambios };
  return renderToStaticMarkup(React.createElement(RootLayout));
}

test("sin sesión no se ofrecen chats, arriendo, convivencia ni las pestañas privadas", () => {
  const html = renderLayout();
  for (const ruta of privadas) assert.equal(rutaVisible(html, ruta), false, ruta);
  for (const ruta of ["login", "registro", "auth/callback"]) assert.equal(rutaVisible(html, ruta), true, ruta);
});

test("con identidad Supabase se habilitan las rutas D10 y se conservan callback y detalle público", () => {
  const html = renderLayout({ estaAutenticado: true, usuarioActual: { identidad: { id: "identidad-de-prueba" }, perfil: null } });
  for (const ruta of [...privadas, "auth/callback", "publicacion/[id]/index"]) assert.equal(rutaVisible(html, ruta), true, ruta);
  assert.equal(rutaVisible(html, "login"), false);
  assert.equal(rutaVisible(html, "registro"), false);
});

test("restaurar la sesión no monta el navegador prematuramente", () => {
  const html = renderLayout({ restaurandoSesion: true });
  assert.match(html, /Recuperando tu sesión/);
  assert.doesNotMatch(html, /data-route=/);
});

test("un error de restauración mantiene Reintentar sin habilitar pantallas privadas", () => {
  const html = renderLayout({ errorRestauracion: "No se pudo recuperar la sesión" });
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /data-route=/);
});
