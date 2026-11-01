const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pausa = () => new Promise(resolve => setImmediate(resolve));

function crearPagina(archivo, editar = false, ausentes = []) {
    const elementos = new Map();
    function elemento(id) {
        if (!elementos.has(id)) {
            const clases = new Set();
            elementos.set(id, {
                children: [], listeners: {}, attributes: {}, files: [], value: "",
                textContent: "", hidden: false, disabled: false, style: {},
                classList: {
                    toggle(clase, activa) { activa ? clases.add(clase) : clases.delete(clase); },
                    add(clase) { clases.add(clase); }, remove(clase) { clases.delete(clase); },
                    contains(clase) { return clases.has(clase); },
                },
                append(...hijos) { this.children.push(...hijos); },
                replaceChildren(...hijos) { this.children = hijos; },
                insertCell() { const celda = elemento(Symbol("td")); this.append(celda); return celda; },
                setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
                addEventListener(nombre, accion) { this.listeners[nombre] = accion; },
                async emitir(nombre) { return this.listeners[nombre]?.({ preventDefault() {}, stopPropagation() {} }); },
                click() { return this.emitir("click"); },
                focus() { documento.activeElement = this; },
                setCustomValidity(mensaje) { this.errorValidacion = mensaje; },
                reportValidity() { return [...elementos.values()].every(campo => !campo.errorValidacion); },
                querySelector(selector) { return elemento(selector); },
                querySelectorAll() { return casillas; },
            });
        }
        return elementos.get(id);
    }
    const casillas = ["perro", "gato", "ave", "tortuga", "conejo", "pez", "otro"].map(tipo => {
        const casilla = elemento(`mascota-${tipo}`);
        casilla.value = tipo;
        return casilla;
    });
    const campos = { titulo: "titulo", categoria: "categoria", ubicacion: "ubicacion",
        precio: "precio", tipo: "tipo", contenido: "contenido", cupos: "cupos" };
    elemento("mascota").value = "no";
    class DatosFormulario extends Map {
        constructor(formulario) {
            super(formulario ? Object.entries(campos).map(([nombre, id]) => [nombre, elemento(id).value]) : []);
        }
        append(nombre, valor) { this.set(nombre, typeof valor === "object" ? valor : String(valor)); }
    }
    const solicitudes = [];
    elemento("btn-cerrar-sesion").parentElement = elemento("dropdown-menu");
    const guardado = new Map([["nombre_usuario", "Ana"], ["user_id", "9"],
        ["access_token", "token-de-prueba"], ["preferencia_ajena", "conservar"]]);
    let alCargar;
    const documento = {
        listeners: {}, activeElement: null,
        addEventListener(nombre, accion) {
            if (nombre === "DOMContentLoaded") alCargar = accion;
            else this.listeners[nombre] = accion;
        },
        getElementById: id => ausentes.includes(id) ? null : elemento(id),
        createElement: tipo => elemento(Symbol(tipo)), querySelector: elemento,
    };
    const contexto = vm.createContext({
        document: documento,
        window: { confirm: () => false, location: {
            pathname: editar ? "/editar-publicacion" : "/crear", search: editar ? "?id=42" : "",
        } },
        Intl, URLSearchParams, FormData: DatosFormulario, console,
        localStorage: { getItem: clave => guardado.get(clave) ?? null, removeItem: clave => guardado.delete(clave) },
        fetch: (url, opciones = {}) => new Promise((resolve, reject) => {
            solicitudes.push({ url, opciones, resolve, reject });
        }),
    });
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", archivo), "utf8"), contexto);
    return { elemento, documento, casillas, solicitudes, guardado, window: contexto.window, carga: alCargar(),
        async responder(indice, datos, ok = true) {
            solicitudes[indice].resolve({ ok, json: async () => datos });
            await pausa();
        } };
}

async function comprobarMisPublicaciones() {
    const archivo = "PaginaPrincipal/PublicacionesU/MisPublicaciones.js";
    const error = crearPagina(archivo);
    await error.responder(0, { detail: "Servidor ocupado" }, false);
    assert.equal(error.elemento("btn-reintentar-publicaciones").hidden, false);
    assert.equal(error.elemento("mensaje-publicaciones").textContent, "Servidor ocupado");
    const reintento = error.elemento("btn-reintentar-publicaciones").emitir("click");
    await error.responder(1, []);
    await reintento;
    assert.match(error.elemento("lista-mis-publicaciones").children[0].children[0].textContent, /Aún no has creado/);

    const pagina = crearPagina(archivo);
    const titulo = '<img src=x onerror="alert(1)">';
    await pagina.responder(0, [
        { id: 42, titulo, tipo: "casa", estado: "Disponible", cupos_totales: 6 },
        { id: 43, titulo: "Cerrada", estado: "CERRADA", cupos_totales: 9 },
    ]);
    const [fila, cerrada] = pagina.elemento("lista-mis-publicaciones").children;
    const [editar, consultar, cerrar] = fila.children[5].children;
    const estado = () => fila.children[3].children[0].textContent;
    assert.equal(fila.children[0].textContent, titulo);
    assert.equal(fila.children[0].children.length, 0);
    assert.equal(editar.href, "/editar-publicacion?id=42");
    assert.equal(fila.children[4].textContent, "6 disponibles");
    assert.equal(cerrada.children[4].textContent, "0 disponibles");
    assert.equal(cerrada.children[5].children[2].disabled, true);
    await cerrar.emitir("click");
    assert.equal(pagina.solicitudes.length, 1, "Cancelar el cierre no debe enviar PATCH");

    const consulta = consultar.emitir("click");
    assert.equal(cerrar.disabled, true);
    assert.equal(pagina.solicitudes[1].opciones.cache, "no-store");
    await cerrar.emitir("click");
    assert.equal(pagina.solicitudes.length, 2, "Consultar impide un cierre simultáneo");
    await pagina.responder(1, { estado: "Disponible", cupos_totales: 4, cupos_disponibles: 4 });
    await consulta;
    assert.equal(fila.children[4].textContent, "4 disponibles");

    pagina.window.confirm = () => true;
    const fallo = cerrar.emitir("click");
    assert.equal(pagina.solicitudes[2].opciones.method, "PATCH");
    await cerrar.emitir("click");
    assert.equal(pagina.solicitudes.length, 3, "No debe duplicar un cierre pendiente");
    await pagina.responder(2, { detail: "No se pudo guardar" }, false);
    await fallo;
    assert.equal(estado(), "Disponible");
    assert.equal(cerrar.disabled, false);
    assert.equal(consultar.disabled, false);
    assert.match(pagina.elemento("mensaje-publicaciones").textContent, /No se pudo cerrar/);

    const exito = cerrar.emitir("click");
    await pagina.responder(3, { estado: "Cerrada", cupos_totales: 4, cupos_disponibles: 0 });
    await exito;
    assert.equal(estado(), "Cerrada");
    assert.equal(fila.children[4].textContent, "0 disponibles");
    assert.equal(cerrar.disabled, true);
    await cerrar.emitir("click");
    assert.equal(pagina.solicitudes.length, 4);
}

async function comprobarFormulario() {
    const archivo = "Creacion_De_publicacion/publicacion.js";
    const pagina = crearPagina(archivo, true);
    const formulario = pagina.elemento("form-crear");
    await formulario.emitir("submit");
    assert.equal(pagina.solicitudes.length, 1, "No debe guardar mientras carga");
    assert.equal(formulario.inert, true);
    await pagina.responder(0, {
        titulo: "Habitación", categoria: "ofrezco", tipo_vivienda: "habitacion", ubicacion: "Temuco",
        precio: 150000, cupos_totales: 7, descripcion: "Lugar tranquilo", tipo: "Arrendador",
        permitir_comentarios: true, estado: "Cerrada", mascota: "si", tipos_mascotas_aceptadas: [],
    });
    await pagina.carga;
    assert.equal(pagina.elemento("cupos").value, 7);
    assert.equal(formulario.inert, false);
    assert.equal(pagina.elemento("aviso-mascotas-anteriores").hidden, false);
    assert.match(pagina.elemento("estado-formulario").textContent, /seguirá cerrada/);
    const imagen = { name: "nueva.png", size: 120 };
    pagina.elemento("imagen").files = [imagen];
    const envio = formulario.emitir("submit");
    const solicitud = pagina.solicitudes[1];
    assert.equal(solicitud.url, "/api/publicaciones/42");
    assert.equal(solicitud.opciones.method, "PUT");
    assert.equal(solicitud.opciones.body.get("cupos_totales"), "7");
    assert.equal(solicitud.opciones.body.get("tipo"), "Arrendador");
    assert.equal(solicitud.opciones.body.get("permitir_comentarios"), "true");
    assert.equal(solicitud.opciones.body.get("tipos_mascotas_aceptadas"), "[]");
    assert.equal(solicitud.opciones.body.get("imagen"), imagen);
    await formulario.emitir("submit");
    assert.equal(pagina.solicitudes.length, 2, "No debe duplicar un envío pendiente");
    await pagina.responder(1, {});
    await envio;
    assert.equal(pagina.window.location.href, "/mis-publicaciones");

    const error = crearPagina(archivo, true);
    await error.responder(0, { detail: "Publicación no encontrada" }, false);
    await error.carga;
    await error.elemento("form-crear").emitir("submit");
    assert.equal(error.solicitudes.length, 1, "Una carga fallida no habilita guardar");
    assert.equal(error.elemento(".btn-publicar").disabled, true);
    assert.match(error.elemento("estado-formulario").textContent, /Publicación no encontrada/);

    const nueva = crearPagina(archivo);
    await nueva.carga;
    nueva.elemento("imagen").files = [{ size: 5 * 1024 * 1024 + 1 }];
    await nueva.elemento("form-crear").emitir("submit");
    assert.equal(nueva.solicitudes.length, 0, "Rechaza foto mayor a 5 MB");
    nueva.elemento("imagen").files = [imagen];
    const publicando = nueva.elemento("form-crear").emitir("submit");
    assert.equal(nueva.solicitudes[0].opciones.method, "POST");
    assert.equal(nueva.solicitudes[0].opciones.body.get("imagen"), imagen);
    await nueva.responder(0, { detail: "Datos rechazados" }, false);
    await publicando;
    assert.equal(nueva.window.location.href, undefined);
    assert.equal(nueva.elemento(".btn-publicar").disabled, false);
    assert.match(nueva.elemento("estado-formulario").textContent, /Datos rechazados/);
}

async function comprobarSesionYPerfil() {
    const pagina = crearPagina("PaginaPrincipal/HayCupo.js", false, ["contenedor-publicaciones"]);
    await pagina.carga;
    const menu = pagina.elemento("menu-lateral");
    const abrir = pagina.elemento("btn-abrir-menu");
    assert.equal(menu.inert, true, "El menú oculto no recibe foco");
    for (const cierre of ["btn-cerrar-menu", "fondo-menu", "Escape"]) {
        await abrir.emitir("click");
        assert.equal(menu.inert, false);
        assert.equal(abrir.attributes["aria-expanded"], "true");
        assert.equal(pagina.documento.activeElement, pagina.elemento("btn-cerrar-menu"));
        if (cierre === "Escape") pagina.documento.listeners.keydown({ key: "Escape" });
        else await pagina.elemento(cierre).emitir("click");
        assert.equal(menu.inert, true);
        assert.equal(abrir.attributes["aria-expanded"], "false");
        assert.equal(pagina.documento.activeElement, abrir, "Cerrar el menú devuelve el foco");
    }
    const salir = pagina.elemento("btn-cerrar-sesion");
    const fallo = salir.emitir("click");
    assert.equal(salir.disabled, true);
    assert.equal(pagina.solicitudes[0].url, "/auth/logout");
    assert.equal(pagina.solicitudes[0].opciones.method, "POST");
    await salir.emitir("click");
    assert.equal(pagina.solicitudes.length, 1, "No debe duplicar el cierre de sesión");
    await pagina.responder(0, {}, false);
    await fallo;
    assert.equal(pagina.window.location.href, undefined);
    assert.equal(pagina.guardado.get("user_id"), "9");
    assert.equal(salir.disabled, false);
    const aviso = pagina.elemento("dropdown-menu").children.find(nodo => nodo.attributes.role === "alert");
    assert.equal(aviso.hidden, false);
    assert.match(aviso.textContent, /No se pudo cerrar la sesión/);
    const exito = salir.emitir("click");
    await pagina.responder(1, {});
    await exito;
    assert.equal(pagina.window.location.href, "/");
    for (const clave of ["nombre_usuario", "access_token", "user_id"]) assert.equal(pagina.guardado.has(clave), false);
    assert.equal(pagina.guardado.get("preferencia_ajena"), "conservar");

    const perfil = crearPagina("PerfilU/perfil.js");
    const malicioso = '<img src=x onerror="alert(1)">';
    await perfil.responder(0, { nombre: "Ana", foto_perfil: 'x" onerror="alert(1)' });
    await perfil.responder(1, [{ id: 42, titulo: malicioso, ubicacion: malicioso,
        estado: "CERRADA", cupos: 6, imagen: 'x" onerror="alert(1)' }]);
    const contenedor = perfil.elemento("contenedor-publicaciones-perfil");
    assert.equal(perfil.elemento(".titulo-publicacion").textContent, malicioso);
    assert.equal(perfil.elemento(".ubicacion-publicacion").textContent, malicioso);
    assert.equal(perfil.elemento(".cupos-publicacion").textContent, "0 cupos disponibles");
    assert.equal(perfil.elemento(".estado-publicacion").textContent, "Estado: CERRADA");
    assert.equal(perfil.elemento(".editar-publicacion").href, "/editar-publicacion?id=42");
    assert.equal(contenedor.innerHTML.includes(malicioso), false, "Los datos no deben interpolarse en HTML");
    assert.equal(perfil.elemento(".img-pub").src, 'x" onerror="alert(1)');
    const avatar = perfil.elemento("avatar-img").children[0];
    assert.equal(avatar.src, 'x" onerror="alert(1)');
    assert.equal(avatar.attributes.onerror, undefined);
}

async function comprobarInterfaz() {
    const raiz = path.resolve(__dirname, "..");
    const scripts = [
        "PaginaPrincipal/HayCupo.js",
        "PaginaPrincipal/PublicacionesU/MisPublicaciones.js",
        "Creacion_De_publicacion/publicacion.js",
        "PerfilU/perfil.js",
    ];
    for (const archivo of scripts) {
        new vm.Script(fs.readFileSync(path.join(raiz, archivo), "utf8"), { filename: archivo });
    }

    const elementos = new Map();
    const elemento = id => {
        if (!elementos.has(id)) elementos.set(id, {
            textContent: "", hidden: false, disabled: false, style: {},
            focus() {}, querySelector() { return { focus() {} }; },
        });
        return elementos.get(id);
    };
    let responder;
    const solicitudes = [];
    const contexto = vm.createContext({
        document: { addEventListener() {}, getElementById: elemento },
        window: { publicacionesVisibles: [{ id: 42, categoria: "ofrezco", cupos_totales: 3 }] },
        Intl,
        fetch: (url, opciones) => {
            solicitudes.push({ url, opciones });
            return new Promise(resolve => { responder = resolve; });
        },
    });
    vm.runInContext(fs.readFileSync(path.join(raiz, scripts[0]), "utf8"), contexto);
    const terminarConsulta = async datos => {
        responder({ ok: true, json: async () => datos });
        await new Promise(resolve => setImmediate(resolve));
    };

    contexto.window.abrirDetalle(0);
    assert.equal(elemento("modal-personas").textContent, "Consultando cupos…");
    assert.equal(elemento("btn-actualizar-cupos").disabled, true);
    assert.equal(solicitudes[0].url, "/api/publicaciones/42/cupos");
    assert.equal(solicitudes[0].opciones.cache, "no-store");
    await terminarConsulta({ estado: "Disponible", cupos_disponibles: 1 });
    assert.equal(elemento("modal-personas").textContent, "1 cupo disponible");
    assert.equal(elemento("modal-estado").textContent, "Estado: Disponible");
    assert.equal(elemento("btn-actualizar-cupos").disabled, false);

    const cerrada = contexto.window.consultarCuposDetalle();
    await terminarConsulta({ estado: "Cerrada", cupos_disponibles: 0 });
    await cerrada;
    assert.equal(elemento("modal-personas").textContent, "0 cupos disponibles");
    assert.equal(elemento("modal-estado").textContent, "Estado: Cerrada");

    const fallo = contexto.window.consultarCuposDetalle();
    responder({ ok: false });
    await fallo;
    assert.match(elemento("modal-personas").textContent, /No se pudieron consultar/);
    assert.equal(elemento("btn-actualizar-cupos").disabled, false);

    contexto.window.abrirDetalle(0);
    const responderAnterior = responder;
    contexto.window.cerrarDetalle();
    contexto.window.publicacionesVisibles = [{ id: 99, categoria: "busco" }];
    contexto.window.abrirDetalle(0);
    await terminarConsulta({ estado: "Disponible", cupos_disponibles: 4 });
    responderAnterior({ ok: true, json: async () => ({ estado: "Cerrada", cupos_disponibles: 0 }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elemento("modal-personas").textContent, "4 cupos solicitados");
    assert.equal(elemento("modal-estado").textContent, "Estado: Disponible");
    await comprobarMisPublicaciones();
    await comprobarFormulario();
    await comprobarSesionYPerfil();
    return "JavaScript OK: sintaxis, detalle/cupos/races, gestión/cierre/errores, formulario/imagen/legado, sesión/perfil seguro y menú accesible";
}

module.exports = comprobarInterfaz;
if (require.main === module) {
    comprobarInterfaz().then(console.log).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
