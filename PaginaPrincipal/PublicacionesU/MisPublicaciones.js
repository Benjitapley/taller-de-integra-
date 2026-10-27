document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("lista-mis-publicaciones");
    const modalPostulaciones = document.getElementById("modal-postulaciones");
    let idPublicacionABorrar = null;

    async function cargarMisPublicaciones() {
        try {
            const respuesta = await fetch("/api/mis-publicaciones");
            if (!respuesta.ok) throw new Error("No se pudieron cargar tus publicaciones.");
            const publicaciones = await respuesta.json();
            tbody.replaceChildren();

            if (publicaciones.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="mensaje-tabla">Todavía no has creado publicaciones.</td></tr>`;
                return;
            }

            publicaciones.forEach(pub => {
                const fila = document.createElement("tr");
                const precioClp = new Intl.NumberFormat("es-CL").format(pub.precio || 0);
                const tipoVivienda = pub.tipo ? pub.tipo.charAt(0).toUpperCase() + pub.tipo.slice(1) : "No especificado";
                fila.innerHTML = `
                    <td class="titulo-publicacion"></td>
                    <td class="tipo-publicacion"></td>
                    <td><strong>${precioClp} CLP</strong></td>
                    <td><span class="estado-badge"></span></td>
                    <td class="acciones-publicacion">
                        <button class="btn-accion btn-editar" data-accion="editar" data-id="${pub.id}"><i class="fa-solid fa-pen"></i> Editar</button>
                        <button class="btn-accion btn-postulaciones" data-accion="postulaciones" data-id="${pub.id}"><i class="fa-solid fa-users"></i> Postulaciones (${pub.postulaciones})</button>
                        <button class="btn-accion btn-eliminar" data-accion="eliminar" data-id="${pub.id}"><i class="fa-solid fa-trash"></i> Eliminar</button>
                    </td>`;
                fila.querySelector(".titulo-publicacion").textContent = pub.titulo || "Sin título";
                fila.querySelector(".tipo-publicacion").textContent = tipoVivienda;
                fila.querySelector(".estado-badge").textContent = pub.estado || "Sin estado";
                tbody.append(fila);
            });
        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="5" class="mensaje-tabla error">Error al cargar tus publicaciones. Intenta nuevamente.</td></tr>`;
        }
    }

    async function mostrarPostulaciones(idPublicacion) {
        const lista = document.getElementById("lista-postulaciones-publicacion");
        lista.textContent = "Cargando postulaciones...";
        modalPostulaciones.style.display = "flex";
        try {
            const respuesta = await fetch(`/api/publicaciones/${idPublicacion}/postulaciones`);
            const data = await respuesta.json();
            if (!respuesta.ok) throw new Error(data.detail || "No se pudieron cargar las postulaciones.");
            lista.replaceChildren();
            if (data.length === 0) {
                lista.textContent = "Esta publicación todavía no tiene postulaciones.";
                return;
            }

            data.forEach(postulacion => {
                const elemento = document.createElement("article");
                elemento.className = "postulacion-recibida";
                const informacion = document.createElement("div");
                const nombre = document.createElement("strong");
                nombre.textContent = postulacion.nombre;
                const correo = document.createElement("p");
                correo.textContent = postulacion.correo || "Correo no disponible";
                const estado = document.createElement("span");
                estado.className = "estado-postulacion";
                estado.textContent = postulacion.estado;
                informacion.append(nombre, correo, estado);
                elemento.append(informacion);

                if (postulacion.estado === "Pendiente") {
                    ["Aceptada", "Rechazada"].forEach(nuevoEstado => {
                        const boton = document.createElement("button");
                        boton.type = "button";
                        boton.textContent = nuevoEstado === "Aceptada" ? "Aceptar" : "Rechazar";
                        boton.className = nuevoEstado === "Aceptada" ? "btn-aceptar" : "btn-rechazar";
                        boton.addEventListener("click", () => responderPostulacion(postulacion.id, nuevoEstado, idPublicacion));
                        elemento.append(boton);
                    });
                }
                lista.append(elemento);
            });
        } catch (error) {
            lista.textContent = error.message;
        }
    }

    async function responderPostulacion(id, estado, idPublicacion) {
        const datos = new FormData();
        datos.append("estado", estado);
        try {
            const respuesta = await fetch(`/api/postulaciones/${id}`, { method: "PUT", body: datos });
            const data = await respuesta.json();
            if (!respuesta.ok) throw new Error(data.detail || "No se pudo actualizar la postulación.");
            await Promise.all([mostrarPostulaciones(idPublicacion), cargarMisPublicaciones()]);
        } catch (error) {
            alert(error.message);
        }
    }

    tbody.addEventListener("click", event => {
        const boton = event.target.closest("button[data-accion]");
        if (!boton) return;
        const id = Number(boton.dataset.id);
        if (boton.dataset.accion === "editar") {
            window.location.href = `/editar-publicacion?id=${id}`;
        } else if (boton.dataset.accion === "postulaciones") {
            mostrarPostulaciones(id);
        } else if (boton.dataset.accion === "eliminar") {
            idPublicacionABorrar = id;
            document.getElementById("modal-borrar").style.display = "flex";
        }
    });

    window.cerrarPostulaciones = () => {
        modalPostulaciones.style.display = "none";
    };

    document.getElementById("btn-confirmar-borrar").addEventListener("click", async () => {
        if (!idPublicacionABorrar) return;
        try {
            const respuesta = await fetch(`/api/publicaciones/${idPublicacionABorrar}`, { method: "DELETE" });
            const data = await respuesta.json();
            if (!respuesta.ok) throw new Error(data.detail || "No se pudo eliminar la publicación.");
            document.getElementById("modal-borrar").style.display = "none";
            idPublicacionABorrar = null;
            await cargarMisPublicaciones();
        } catch (error) {
            alert(error.message);
        }
    });

    cargarMisPublicaciones();
});
