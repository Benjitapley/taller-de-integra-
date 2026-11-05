import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

let auth;
let chatId;
const cache = new Map();
const rutas = {
  "@/data/convivenciaMock": "../src/data/convivenciaMock.ts",
  "@/data/chatsMock": "../src/data/chatsMock.ts",
  "@/stores/convivenciaDemo": "../src/stores/convivenciaDemo.ts",
  "@/components/convivencia/ConvivenciaDemoProvider": "../src/components/convivencia/ConvivenciaDemoProvider.tsx",
};
const host = (tag) => function Host({ children }) { return React.createElement(tag, null, children); };
const Stack = host("main");
Stack.Protected = ({ guard, children }) => guard ? children : null;
Stack.Screen = ({ name }) => name ? React.createElement("span", { "data-route": name }) : null;

// Prueba la composición real del layout y los módulos de demo. Los componentes
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
      if (nombre === "expo-router") return { Stack, useLocalSearchParams: () => ({ id: chatId }) };
      if (nombre === "@/hooks/useAuth") return { AuthProvider: host(React.Fragment), useAuth: () => auth };
      if (nombre === "@/lib/supabase") return {
        iniciarCicloSesionSupabase() { throw new Error("El SDK real no se permite en estas pruebas"); },
      };
      if (nombre === "@/components/CustomButton") return {
        CustomButton: ({ titulo }) => React.createElement("button", null, titulo),
      };
      if (nombre === "@/components/chat/ContenedorChat") return {
        default: ({ mensajes }) => React.createElement("section", { "data-compositor": true }, mensajes.map((m) => m.texto).join(" ")),
        __esModule: true,
      };
      if (nombre === "@/components/chat/EncabezadoContextual") return { default: () => null, __esModule: true };
      assert.ok(rutas[nombre], `Dependencia inesperada: ${nombre}`);
      return cargar(rutas[nombre]);
    },
  });
  cache.set(ruta, modulo.exports);
  return modulo.exports;
}

const { crearAlmacenConvivenciaDemo } = cargar(rutas["@/stores/convivenciaDemo"]);
const datos = cargar(rutas["@/data/convivenciaMock"]);
const RootLayout = cargar("../src/app/_layout.tsx").default;
const ChatContextual = cargar("../src/app/chats/[id].tsx").default;
const privadas = ["(tabs)", "convivencia/tareas", "arriendo/index", "arriendo/chat", "chats/index", "chats/[id]"];
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

test("dashboard y detalle pueden compartir las altas sin modificar los mocks originales", () => {
  const antes = JSON.stringify(datos.TAREAS_MOCK);
  const almacen = crearAlmacenConvivenciaDemo();
  const inicial = almacen.obtenerEstado();
  assert.equal(almacen.obtenerEstado(), inicial);
  almacen.agregarTarea({ nombre: "Tarea de prueba", fechaTexto: "Viernes", responsable: datos.INTEGRANTES_MOCK[0] });
  const actualizado = almacen.obtenerEstado();
  assert.notEqual(actualizado, inicial);
  assert.equal(actualizado.tareas.length, inicial.tareas.length + 1);
  assert.equal(actualizado.tareas.at(-1).categoria, "Tarea de prueba");
  assert.equal(JSON.stringify(datos.TAREAS_MOCK), antes);
});

test("las suscripciones comparten cambios y liberan oyentes al desmontar una pantalla", () => {
  const almacen = crearAlmacenConvivenciaDemo();
  let dashboard = 0;
  let detalle = 0;
  const salir = almacen.suscribir(() => dashboard++);
  almacen.suscribir(() => detalle++);
  almacen.agregarRecordatorio({ titulo: "Prueba", fechaTexto: "Lunes" });
  assert.equal(dashboard, 1);
  assert.equal(detalle, 1);
  salir();
  almacen.agregarRecordatorio({ titulo: "Otra prueba", fechaTexto: "Martes" });
  assert.equal(dashboard, 1);
  assert.equal(detalle, 2);
});

test("dos almacenes de sesión no comparten tareas o recordatorios creados", () => {
  const primeraSesion = crearAlmacenConvivenciaDemo();
  const segundaSesion = crearAlmacenConvivenciaDemo();
  const inicial = segundaSesion.obtenerEstado();
  primeraSesion.agregarRecordatorio({ titulo: "Solo primera sesión", fechaTexto: "Lunes" });
  assert.equal(segundaSesion.obtenerEstado(), inicial);
  assert.equal(segundaSesion.obtenerEstado().recordatorios.some((r) => r.titulo === "Solo primera sesión"), false);
});

test("los recordatorios conservan campos opcionales y generan IDs distintos", () => {
  const almacen = crearAlmacenConvivenciaDemo();
  almacen.agregarRecordatorio({ titulo: "Uno", fechaTexto: "Lunes", horaTexto: "09:30", descripcion: "Detalle" });
  almacen.agregarRecordatorio({ titulo: "Dos", fechaTexto: "Martes" });
  const [uno, dos] = almacen.obtenerEstado().recordatorios.slice(-2);
  assert.notEqual(uno.id, dos.id);
  assert.equal(uno.horaTexto, "09:30");
  assert.equal(uno.descripcion, "Detalle");
  assert.equal(dos.horaTexto, undefined);
});

test("el chat pendiente no habilita el compositor de demostración", () => {
  chatId = "camila-soto";
  const html = renderToStaticMarkup(React.createElement(ChatContextual));
  assert.match(html, /preseleccionada/);
  assert.doesNotMatch(html, /data-compositor/);
});

test("el chat preseleccionado muestra su conversación y el compositor", () => {
  chatId = "sofia-munoz";
  const html = renderToStaticMarkup(React.createElement(ChatContextual));
  assert.match(html, /data-compositor/);
  assert.match(html, /Gracias por escribirme/);
});

test("un chat desconocido muestra el estado vacío", () => {
  chatId = "inexistente";
  const html = renderToStaticMarkup(React.createElement(ChatContextual));
  assert.match(html, /No se encontró esta conversación/);
  assert.doesNotMatch(html, /data-compositor/);
});
