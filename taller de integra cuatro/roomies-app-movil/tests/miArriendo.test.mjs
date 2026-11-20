import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { crearCargador, plano } from "./helpers/cargarModulos.mjs";


const destinos = [];
const host = (etiqueta, extra = () => ({})) =>
  function Host(props) { return React.createElement(etiqueta, extra(props), props.children); };

const externosUi = {
  "react-native": {
    View: host("div"),
    Text: host("span"),
    Image: (props) => React.createElement("img", { src: props.source?.uri }),
    Pressable: host("button", (p) => ({ disabled: Boolean(p.disabled), onClick: undefined })),
    ScrollView: host("main"),
    ActivityIndicator: () => React.createElement("span", null, "indicador"),
    StyleSheet: { create: (estilos) => estilos },
  },
  "@expo/vector-icons": { Ionicons: (props) => React.createElement("i", { "data-icono": props.name }) },
  "expo-router": {
    router: { push: (d) => destinos.push(["push", d]), dismissTo: (d) => destinos.push(["dismissTo", d]) },
  },
  "@/hooks/useMiArriendo": { useMiArriendo: () => { throw new Error("El hook no se usa en estas pruebas"); } },
  "@/services/httpClient": { solicitarJson: () => { throw new Error("Sin transporte real"); } },
};

const cargar = crearCargador({ externos: externosUi, entorno: { EXPO_PUBLIC_API_URL: "https://api.example.invalid" } });
const { crearAlmacenMiArriendo, estadoVisibleMiArriendo } = cargar("src/stores/miArriendo.ts");
const { PantallaMiArriendo } = cargar("src/components/convivencia/MiArriendo.tsx");
const { textoOcupacion } = cargar("src/components/convivencia/ResumenMiArriendo.tsx");

// --- Fixtures -------------------------------------------------------------

const arriendo = (cambios = {}) => ({
  idArriendo: 7, idPublicacion: 3, estado: "Activo", origen: "Arrendador", titulo: "Depto Centro", ubicacion: "Temuco",
  cuposTotales: 3, cuposDisponibles: 1, integrantesActivos: 2, fechaInicio: null, soyResponsable: false, ...cambios,
});
const integrante = (id, cambios = {}) => ({
  idUsuario: id, nombre: `Persona ${id}`, fotoUrl: null, esResponsable: false, esPropio: false, ...cambios,
});
const exito = (nombre = "A") => ({
  exito: true,
  arriendo: arriendo({ titulo: `Arriendo de ${nombre}` }),
  integrantes: [integrante(1, { esResponsable: true, esPropio: true }), integrante(2)],
  integrantesParciales: false,
});
const sinPertenencia = { exito: false, codigo: "sin_pertenencia", error: "No perteneces a un arriendo activo.", estadoHttp: 404 };
const error = (codigo, estadoHttp) => ({
  exito: false, codigo, error: "Mensaje genérico del cliente HTTP", ...(estadoHttp ? { estadoHttp } : {}),
});

function diferida() {
  let resolver;
  const promesa = new Promise((r) => { resolver = r; });
  return { promesa, resolver };
}

test("comienza en «cargando» y pasa a «datos» con una lectura exitosa", async () => {
  const almacen = crearAlmacenMiArriendo(async () => exito());
  assert.equal(almacen.obtenerEstado().tipo, "cargando");
  await almacen.recargar();
  const estado = almacen.obtenerEstado();
  assert.equal(estado.tipo, "datos");
  assert.equal(estado.arriendo.titulo, "Arriendo de A");
  assert.equal(estado.integrantes.length, 2);
  assert.equal(estado.errorActualizacion, null);
});

test("sin pertenencia, sin permiso y error sin datos tienen estados distintos", async () => {
  const casos = [
    [sinPertenencia, "sin_pertenencia"],
    [error("sin_permiso", 403), "sin_permiso"],
    [error("http", 503), "error"],
    [error("red"), "error"],
    [error("tiempo_agotado"), "error"],
    [error("respuesta_invalida", 200), "error"],
    [error("no_autorizado", 401), "error"],
    [error("sin_sesion"), "error"],
  ];
  for (const [resultado, tipo] of casos) {
    const almacen = crearAlmacenMiArriendo(async () => resultado);
    await almacen.recargar();
    assert.equal(almacen.obtenerEstado().tipo, tipo, resultado.codigo);
  }
});

test("una excepción inesperada del servicio se muestra como error recuperable, no rompe la pantalla", async () => {
  const almacen = crearAlmacenMiArriendo(async () => { throw new Error("detalle interno"); });
  await almacen.recargar();
  const estado = almacen.obtenerEstado();
  assert.equal(estado.tipo, "error");
  assert.equal(estado.error.codigo, "red");
  assert.doesNotMatch(JSON.stringify(estado), /detalle interno/);
});


test("una respuesta tardía no pisa a una lectura más nueva", async () => {
  const lenta = diferida();
  const rapida = diferida();
  const pendientes = [lenta, rapida];
  const almacen = crearAlmacenMiArriendo(() => pendientes.shift().promesa);

  const primera = almacen.recargar();
  const segunda = almacen.recargar();
  rapida.resolver(exito("nueva"));
  await segunda;
  assert.equal(almacen.obtenerEstado().arriendo.titulo, "Arriendo de nueva");

  lenta.resolver(exito("vieja"));
  await primera;
  assert.equal(almacen.obtenerEstado().arriendo.titulo, "Arriendo de nueva");
});

test("invalidar (perder el foco o desmontar) descarta la respuesta en vuelo", async () => {
  const pendiente = diferida();
  const almacen = crearAlmacenMiArriendo(() => pendiente.promesa);
  let avisos = 0;
  almacen.suscribir(() => { avisos += 1; });

  const lectura = almacen.recargar();
  almacen.invalidar();
  pendiente.resolver(exito());
  await lectura;

  assert.equal(almacen.obtenerEstado().tipo, "cargando");
  assert.equal(avisos, 0);
});

test("dos cuentas distintas usan almacenes independientes: nada se filtra de una a otra", async () => {
  const respuestaDeA = diferida();
  const almacenA = crearAlmacenMiArriendo(() => respuestaDeA.promesa);
  const almacenB = crearAlmacenMiArriendo(async () => sinPertenencia);

  const lecturaA = almacenA.recargar();
  almacenA.invalidar();
  await almacenB.recargar();
  respuestaDeA.resolver(exito("cuenta A"));
  await lecturaA;

  assert.equal(almacenB.obtenerEstado().tipo, "sin_pertenencia");
  assert.doesNotMatch(JSON.stringify(almacenB.obtenerEstado()), /cuenta A/);
  assert.equal(almacenA.obtenerEstado().tipo, "cargando", "la respuesta de A llegó tarde y se descartó");
});

test("tras un retiro, la relectura descarta los datos privados (404 y 403)", async () => {
  for (const [resultado, esperado] of [[sinPertenencia, "sin_pertenencia"], [error("sin_permiso", 403), "sin_permiso"]]) {
    const respuestas = [exito(), resultado];
    const almacen = crearAlmacenMiArriendo(async () => respuestas.shift());
    await almacen.recargar();
    assert.equal(almacen.obtenerEstado().tipo, "datos");
    await almacen.recargar();
    const estado = almacen.obtenerEstado();
    assert.equal(estado.tipo, esperado);
    assert.doesNotMatch(JSON.stringify(estado), /Arriendo de A|Persona 1/);
  }
});

test("un 401 en la relectura tampoco conserva datos privados", async () => {
  const respuestas = [exito(), error("no_autorizado", 401)];
  const almacen = crearAlmacenMiArriendo(async () => respuestas.shift());
  await almacen.recargar();
  await almacen.recargar();
  assert.equal(almacen.obtenerEstado().tipo, "error");
});

test("un fallo transitorio en la relectura conserva los últimos datos con aviso; Reintentar lo retira", async () => {
  const respuestas = [exito(), error("http", 503), exito("actualizado")];
  const almacen = crearAlmacenMiArriendo(async () => respuestas.shift());
  await almacen.recargar();

  await almacen.recargar();
  let estado = almacen.obtenerEstado();
  assert.equal(estado.tipo, "datos");
  assert.equal(estado.arriendo.titulo, "Arriendo de A");
  assert.equal(estado.errorActualizacion.estadoHttp, 503);

  const reintento = almacen.recargar({ mostrarCarga: true });
  assert.equal(almacen.obtenerEstado().errorActualizacion, null, "el aviso se retira al reintentar");
  assert.equal(almacen.obtenerEstado().tipo, "datos", "los datos no desaparecen mientras se relee");
  await reintento;
  estado = almacen.obtenerEstado();
  assert.equal(estado.arriendo.titulo, "Arriendo de actualizado");
});

test("la relectura al enfocar es silenciosa; solo se muestra «cargando» sin resultado previo o con Reintentar", async () => {
  const vistos = [];
  const respuestas = [exito(), exito("segunda"), error("http", 503), exito("tercera"), sinPertenencia, exito("cuarta")];
  const almacen = crearAlmacenMiArriendo(async () => respuestas.shift());
  almacen.suscribir(() => vistos.push(almacen.obtenerEstado().tipo));

  await almacen.recargar();                       // cargando (inicial) -> datos
  await almacen.recargar();                       // silenciosa -> datos
  assert.deepEqual(plano(vistos), ["datos", "datos"]);

  vistos.length = 0;
  await almacen.recargar();                       // 503 con datos -> datos con aviso
  await almacen.recargar();                       // datos
  await almacen.recargar();                       // sin pertenencia (silenciosa, sin pasar por cargando)
  assert.equal(vistos.includes("cargando"), false);
  assert.equal(almacen.obtenerEstado().tipo, "sin_pertenencia");

  vistos.length = 0;
  await almacen.recargar({ mostrarCarga: true }); // Reintentar sí muestra cargando
  assert.deepEqual(plano(vistos), ["cargando", "datos"]);
});

test("desde un error, relectura y Reintentar muestran «cargando» antes del resultado", async () => {
  const respuestas = [error("red"), exito()];
  const almacen = crearAlmacenMiArriendo(async () => respuestas.shift());
  const vistos = [];
  almacen.suscribir(() => vistos.push(almacen.obtenerEstado().tipo));
  await almacen.recargar();
  assert.equal(almacen.obtenerEstado().tipo, "error");
  await almacen.recargar({ mostrarCarga: true });
  assert.deepEqual(plano(vistos), ["error", "cargando", "datos"]);
});

test("las suscripciones se liberan y el estado es estable entre lecturas sin cambios", async () => {
  const almacen = crearAlmacenMiArriendo(async () => exito());
  let avisos = 0;
  const salir = almacen.suscribir(() => { avisos += 1; });
  assert.equal(almacen.obtenerEstado(), almacen.obtenerEstado());
  await almacen.recargar();
  assert.equal(avisos, 1);
  salir();
  await almacen.recargar();
  assert.equal(avisos, 1);
});


test("mientras el perfil de negocio no esté listo se muestra «cargando»; si falló, ese error; si está listo, el arriendo", () => {
  const listo = { tipo: "datos", arriendo: arriendo(), integrantes: [], integrantesParciales: false, errorActualizacion: null };
  assert.deepEqual(plano(estadoVisibleMiArriendo(null, listo)), { tipo: "cargando" });

  const fallo = error("red");
  const conError = estadoVisibleMiArriendo(fallo, listo);
  assert.equal(conError.tipo, "error");
  assert.equal(conError.error.codigo, "red");

  assert.equal(estadoVisibleMiArriendo({ exito: true }, listo), listo, "pasa el estado del almacén tal cual");
  const cargando = { tipo: "cargando" };
  assert.equal(estadoVisibleMiArriendo({ exito: true }, cargando), cargando);
});

// --- Pantalla ---------------------------------------------------------------------

const DEMO = /Benja|Vale|Pato|Meli|Providencia|Depto 4D|Pagar internet|Equipo top|Aseo|Compras/;
const pantalla = (estado, props = {}) =>
  renderToStaticMarkup(React.createElement(PantallaMiArriendo, { estado, onReintentar: () => {}, ...props }));
const datos = (cambios = {}) => ({
  tipo: "datos", arriendo: arriendo(), integrantesParciales: false, errorActualizacion: null,
  integrantes: [
    integrante(1, { nombre: "Ana Soto", esResponsable: true, esPropio: true }),
    integrante(2, { nombre: "Luis Pérez", fotoUrl: "https://cdn.example.invalid/luis.png" }),
  ],
  ...cambios,
});

test("con datos reales muestra lugar, cupos, integrantes, rol y quién es la persona con sesión", () => {
  const html = pantalla(datos());
  assert.match(html, /Depto Centro/);
  assert.match(html, /Temuco/);
  assert.match(html, /2 integrantes · 1 cupo disponible/);
  assert.match(html, /2 de 3/);
  assert.match(html, /Ana Soto/);
  assert.match(html, /Luis Pérez/);
  assert.match(html, /Responsable/);
  assert.match(html, />Tú</);
  assert.match(html, /src="https:\/\/cdn\.example\.invalid\/luis\.png"/);
  assert.match(html, />A</, "sin foto se muestra la inicial, no una imagen de relleno");
  assert.doesNotMatch(html, DEMO);
});

test("sin cupos calculados por el servidor no se inventa la cifra de disponibles", () => {
  assert.equal(textoOcupacion(arriendo({ cuposDisponibles: null })), "2 integrantes · 3 cupos en total");
  assert.equal(textoOcupacion(arriendo({ integrantesActivos: 1, cuposDisponibles: 0, cuposTotales: 1 })), "1 integrante · 0 cupos disponibles");
  assert.doesNotMatch(pantalla(datos({ arriendo: arriendo({ cuposDisponibles: null, ubicacion: null }) })), /disponible|Temuco/);
});

test("sin título de publicación se usa un rótulo genérico y, si el servidor lo informa, se indica que eres responsable", () => {
  const sinTitulo = pantalla(datos({ arriendo: arriendo({ titulo: null, ubicacion: null }) }));
  assert.match(sinTitulo, />Tu arriendo</);
  assert.doesNotMatch(sinTitulo, DEMO);
  assert.doesNotMatch(sinTitulo, /Eres el responsable/);

  assert.match(pantalla(datos({ arriendo: arriendo({ soyResponsable: true }) })), /Eres el responsable de este arriendo/);
  assert.doesNotMatch(pantalla(datos({ arriendo: arriendo({ soyResponsable: null }) })), /Eres el responsable/);
});

test("chat y tareas aparecen deshabilitados «próximamente» hasta que D02/D03 los habiliten", () => {
  const html = pantalla(datos());
  assert.equal((html.match(/Disponible próximamente/g) ?? []).length, 2);
  assert.equal((html.match(/<button disabled=""/g) ?? []).length, 2);

  const habilitadas = pantalla(datos(), { funciones: { chat: true, tareas: true } });
  assert.doesNotMatch(habilitadas, /próximamente/);
  assert.doesNotMatch(habilitadas, /<button disabled=""/);
});

test("una lista de integrantes incompleta o vacía se explica sin inventar personas", () => {
  assert.match(pantalla(datos({ integrantesParciales: true })), /Mostrando los primeros 2 integrantes/);
  const vacia = pantalla(datos({ integrantes: [] }));
  assert.match(vacia, /No hay integrantes para mostrar/);
  assert.doesNotMatch(vacia, DEMO);
});

test("sin lista de integrantes (la API aún no la entrega) se avisa y no se inventa ninguna persona", () => {
  const html = pantalla(datos({ integrantes: null }));
  assert.match(html, /La lista de integrantes todavía no está disponible/);
  assert.match(html, /2 de 3/, "los cupos que sí entrega la API se siguen mostrando");
  assert.match(html, /Depto Centro/);
  assert.doesNotMatch(html, /No hay integrantes para mostrar/, "no es lo mismo que una lista vacía");
  assert.doesNotMatch(html, /Persona|Ana Soto|<img/);
  assert.doesNotMatch(html, DEMO);
  assert.doesNotThrow(() => pantalla(datos({ integrantes: null }), { funciones: { chat: true, tareas: true } }));
});

test("una relectura fallida mantiene los datos y muestra un aviso con Reintentar", () => {
  const html = pantalla(datos({ errorActualizacion: error("http", 503) }));
  assert.match(html, /No pudimos actualizar/);
  assert.match(html, /Reintentar/);
  assert.match(html, /Ana Soto/);
});

test("cargando, sin pertenencia, sin permiso y error se distinguen y no muestran datos de demostración", () => {
  const cargando = pantalla({ tipo: "cargando" });
  assert.match(cargando, /Cargando tu arriendo/);

  const sin = pantalla({ tipo: "sin_pertenencia" });
  assert.match(sin, /Todavía no tienes un arriendo activo/);
  assert.match(sin, /Ir a Buscar/);
  assert.match(sin, /Ver mis postulaciones/);

  const prohibido = pantalla({ tipo: "sin_permiso", error: error("sin_permiso", 403) });
  assert.match(prohibido, /No tienes acceso a este arriendo/);
  assert.match(prohibido, /confirmaste tu correo/);
  assert.match(prohibido, /Reintentar/);

  const fallo = pantalla({ tipo: "error", error: error("http", 503) });
  assert.match(fallo, /No pudimos cargar tu arriendo/);
  assert.match(fallo, /Mensaje genérico del cliente HTTP/);
  assert.match(fallo, /Reintentar/);

  for (const html of [cargando, sin, prohibido, fallo]) assert.doesNotMatch(html, DEMO);
  assert.notEqual(sin, prohibido);
  assert.notEqual(prohibido, fallo);
});


test("el camino de producción no importa mocks ni el almacén demostrativo", () => {
  const produccion = [
    "src/services/arriendosService.ts", "src/stores/miArriendo.ts", "src/hooks/useMiArriendo.ts",
    "src/components/convivencia/MiArriendo.tsx", "src/components/convivencia/MensajeArriendo.tsx",
    "src/components/convivencia/ResumenMiArriendo.tsx", "src/components/convivencia/ListaIntegrantes.tsx",
    "src/components/convivencia/AvatarIntegrante.tsx", "src/types/Arriendo.ts", "src/types/api/ArriendoDto.ts",
  ];
  for (const ruta of produccion) {
    const fuente = readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
    assert.doesNotMatch(fuente, /convivenciaMock|convivenciaDemo|ConvivenciaDemo|i\.pravatar|@\/mocks|@\/data/, ruta);
  }
});

function renderizarRuta(entorno) {
  const cargarRuta = crearCargador({
    entorno,
    externos: {
      "@/components/convivencia/MiArriendo": { __esModule: true, default: () => React.createElement("i", { "data-pantalla": "real" }) },
      "@/components/convivencia/DashboardArriendoDemo": { __esModule: true, default: () => React.createElement("i", { "data-pantalla": "demo" }) },
    },
  });
  return renderToStaticMarkup(React.createElement(cargarRuta("src/app/arriendo/index.tsx").default));
}

test("la ruta Mi arriendo usa la API real salvo que se active expresamente el modo demo", () => {
  for (const entorno of [{}, { EXPO_PUBLIC_CONVIVENCIA_DEMO: "" }, { EXPO_PUBLIC_CONVIVENCIA_DEMO: "0" }, { EXPO_PUBLIC_CONVIVENCIA_DEMO: "true" }]) {
    assert.match(renderizarRuta(entorno), /data-pantalla="real"/, JSON.stringify(entorno));
  }
  assert.match(renderizarRuta({ EXPO_PUBLIC_CONVIVENCIA_DEMO: "1" }), /data-pantalla="demo"/);
});

test("package.json expone el script de pruebas de D01", () => {
  const paquete = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(paquete.scripts["test:arriendos"], /arriendosService\.test\.mjs/);
  assert.match(paquete.scripts["test:arriendos"], /miArriendo\.test\.mjs/);
});
