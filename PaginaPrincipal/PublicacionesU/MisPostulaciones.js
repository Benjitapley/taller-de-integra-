document.addEventListener("DOMContentLoaded", async () => {
    const tbody = document.getElementById("lista-mis-postulaciones");
    try {
        const respuesta = await fetch("/api/mis-postulaciones");
        const postulaciones = await respuesta.json();
        if (!respuesta.ok) throw new Error(postulaciones.detail || "No se pudieron cargar tus postulaciones.");
        tbody.replaceChildren();

        if (postulaciones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="mensaje-tabla">Todavía no has postulado a ninguna publicación.</td></tr>`;
            return;
        }

        postulaciones.forEach(postulacion => {
            const fila = document.createElement("tr");
            const fecha = new Date(postulacion.fecha).toLocaleDateString("es-CL");
            const precio = `${new Intl.NumberFormat("es-CL").format(postulacion.precio || 0)} CLP`;
            fila.innerHTML = `
                <td class="titulo-postulacion"></td>
                <td class="ubicacion-postulacion"></td>
                <td><strong>${precio}</strong></td>
                <td class="publicador-postulacion"></td>
                <td>${fecha}</td>
                <td><span class="estado-badge estado-${postulacion.estado.toLowerCase()}"></span></td>
                <td></td>`;
            fila.querySelector(".titulo-postulacion").textContent = postulacion.titulo;
            fila.querySelector(".ubicacion-postulacion").textContent = postulacion.ubicacion;
            fila.querySelector(".publicador-postulacion").textContent = postulacion.publicador;
            fila.querySelector(".estado-badge").textContent = postulacion.estado;
            if (postulacion.estado === "Pendiente") {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.className = "btn-accion btn-eliminar";
                boton.textContent = "Retirar";
                boton.addEventListener("click", () => retirarPostulacion(postulacion.id, boton));
                fila.lastElementChild.append(boton);
            } else {
                fila.lastElementChild.textContent = "—";
            }
            tbody.append(fila);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="7" class="mensaje-tabla error">Error al cargar tus postulaciones. Intenta nuevamente.</td></tr>`;
    }
});

async function retirarPostulacion(id, boton) {
    boton.disabled = true;
    try {
        const respuesta = await fetch(`/api/postulaciones/${id}`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.detail || "No se pudo retirar la postulación.");
        window.location.reload();
    } catch (error) {
        alert(error.message);
        boton.disabled = false;
    }
}
