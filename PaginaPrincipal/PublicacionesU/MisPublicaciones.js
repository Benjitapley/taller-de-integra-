document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("lista-mis-publicaciones");
    const mensaje = document.getElementById("mensaje-publicaciones");
    const reintentar = document.getElementById("btn-reintentar-publicaciones");
    const formatoPrecio = new Intl.NumberFormat("es-CL");

    function avisar(texto, error = false) {
        mensaje.textContent = texto;
        mensaje.classList.toggle("mensaje-error", error);
    }

    async function consultar(url, opciones) {
        const respuesta = await fetch(url, { cache: "no-store", ...opciones });
        const datos = await respuesta.json().catch(() => null);
        if (!respuesta.ok) {
            throw new Error(typeof datos?.detail === "string" ? datos.detail : "No se pudo completar la solicitud.");
        }
        if (datos === null) throw new Error("El servidor devolvió una respuesta inválida.");
        return datos;
    }

    function mostrarFilaMensaje(texto) {
        const fila = document.createElement("tr");
        const celda = fila.insertCell();
        celda.colSpan = 6;
        celda.className = "tabla-mensaje";
        celda.textContent = texto;
        tbody.replaceChildren(fila);
    }

    function crearFila(pub) {
        const fila = document.createElement("tr");
        const agregarCelda = texto => {
            const celda = fila.insertCell();
            celda.textContent = texto;
            return celda;
        };
        agregarCelda(pub.titulo).className = "titulo-publicacion";
        agregarCelda(pub.tipo ? pub.tipo.charAt(0).toUpperCase() + pub.tipo.slice(1) : "No especificado");
        agregarCelda(`${formatoPrecio.format(pub.precio || 0)} CLP`);
        const estado = document.createElement("span");
        estado.className = "estado-badge";
        agregarCelda("").append(estado);
        const cupos = agregarCelda("");
        const acciones = agregarCelda("");
        acciones.className = "acciones-publicacion";

        const editar = document.createElement("a");
        editar.className = "btn-accion btn-editar";
        editar.href = `/editar-publicacion?id=${encodeURIComponent(pub.id)}`;
        editar.textContent = "Editar";
        editar.setAttribute("aria-label", `Editar ${pub.titulo}`);
        acciones.append(editar);

        const boton = (texto, clase, accion) => {
            const elemento = document.createElement("button");
            elemento.type = "button";
            elemento.className = `btn-accion ${clase}`;
            elemento.textContent = texto;
            elemento.setAttribute("aria-label", `${texto}: ${pub.titulo}`);
            elemento.addEventListener("click", accion);
            acciones.append(elemento);
            return elemento;
        };

        const actualizarEstado = datos => {
            Object.assign(pub, datos);
            const cerrada = String(pub.estado).toLowerCase() === "cerrada";
            const cantidad = pub.cupos_totales ?? pub.cupos;
            const disponibles = cerrada ? 0 : (pub.cupos_disponibles ?? cantidad);
            estado.textContent = pub.estado;
            estado.classList.toggle("estado-cerrada", cerrada);
            cupos.textContent = `${disponibles} disponibles`;
            cupos.title = `Cantidad anunciada: ${cantidad}`;
            cerrar.disabled = cerrada;
            cerrar.textContent = cerrada ? "Cerrada" : "Cerrar publicación";
        };

        const consultarCupos = boton("Consultar cupos", "btn-cupos", async () => {
            if (consultarCupos.disabled) return;
            consultarCupos.disabled = true;
            cerrar.disabled = true;
            consultarCupos.textContent = "Consultando...";
            try {
                const datos = await consultar(`/api/publicaciones/${encodeURIComponent(pub.id)}/cupos`);
                actualizarEstado(datos);
                avisar(`${pub.titulo}: ${datos.cupos_disponibles} cupos disponibles. Estado: ${datos.estado}.`);
            } catch (error) {
                avisar(`No se pudieron consultar los cupos de «${pub.titulo}». ${error.message}`, true);
            } finally {
                consultarCupos.disabled = false;
                consultarCupos.textContent = "Consultar cupos";
                actualizarEstado({});
            }
        });

        const cerrar = boton("Cerrar publicación", "btn-cerrar", async () => {
            if (cerrar.disabled || !window.confirm(`¿Cerrar «${pub.titulo}»? Dejará de aparecer en el inicio y conservarás sus datos en Mis publicaciones.`)) return;
            cerrar.disabled = true;
            consultarCupos.disabled = true;
            cerrar.textContent = "Cerrando...";
            try {
                const datos = await consultar(`/api/publicaciones/${encodeURIComponent(pub.id)}/cerrar`, { method: "PATCH" });
                actualizarEstado(datos);
                avisar(`La publicación «${pub.titulo}» está cerrada. Conservas sus datos y puedes editarla.`);
            } catch (error) {
                actualizarEstado({});
                avisar(`No se pudo cerrar «${pub.titulo}». ${error.message}`, true);
            } finally {
                consultarCupos.disabled = false;
            }
        });

        actualizarEstado({});
        return fila;
    }

    async function cargarMisPublicaciones() {
        reintentar.hidden = true;
        tbody.setAttribute("aria-busy", "true");
        avisar("");
        mostrarFilaMensaje("Cargando tus publicaciones...");
        try {
            const datos = await consultar("/api/mis-publicaciones");
            if (!Array.isArray(datos)) throw new Error("El servidor devolvió una respuesta inválida.");
            if (datos.length === 0) {
                mostrarFilaMensaje("Aún no has creado publicaciones. Usa Nueva para publicar tu primer anuncio.");
            } else {
                tbody.replaceChildren(...datos.map(crearFila));
            }
        } catch (error) {
            mostrarFilaMensaje("No se pudieron cargar tus publicaciones.");
            avisar(error.message, true);
            reintentar.hidden = false;
        } finally {
            tbody.setAttribute("aria-busy", "false");
        }
    }

    reintentar.addEventListener("click", cargarMisPublicaciones);
    cargarMisPublicaciones();
});
