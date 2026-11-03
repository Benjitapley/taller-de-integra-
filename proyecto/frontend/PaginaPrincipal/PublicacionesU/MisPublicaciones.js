document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("lista-mis-publicaciones");
    let idPublicacionABorrar = null;

    // 1. Cargar las publicaciones del usuario autenticado
    async function cargarMisPublicaciones() {
        try {
            const respuesta = await fetch("/api/mis-publicaciones");
            const data = await respuesta.json();
            
            tbody.innerHTML = "";

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">No has creado ninguna publicación aún.</td></tr>`;
                return;
            }

            // Inyectar filas en la tabla
            data.forEach(pub => {
                const precioClp = new Intl.NumberFormat("es-CL").format(pub.precio || 0);
                const tipoVivienda = pub.tipo ? (pub.tipo.charAt(0).toUpperCase() + pub.tipo.slice(1)) : "No especificado";

                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight: 800; color: #1a1a1a;">${pub.titulo}</td>
                        <td>${tipoVivienda}</td>
                        <td><strong>${precioClp} CLP</strong></td>
                        <td><span class="estado-badge">${pub.estado}</span></td>
                        <td>
                            <!-- BOTÓN EDITAR -->
                            <button class="btn-accion btn-editar" onclick="editarPublicacion(${pub.id})">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                            <!-- BOTÓN ELIMINAR -->
                            <button class="btn-accion btn-eliminar" onclick="abrirModalBorrar(${pub.id})">
                                <i class="fa-solid fa-trash"></i> Eliminar
                            </button>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar los datos del servidor.</td></tr>`;
        }
    }

    // 2. Acción del Botón Editar (Redirige al form con el ID en la URL)
    window.editarPublicacion = (id) => {
        window.location.href = `/editar-publicacion?id=${id}`;
    };

    // 3. Abrir modal de confirmación
    window.abrirModalBorrar = (id) => {
        idPublicacionABorrar = id;
        document.getElementById("modal-borrar").style.display = "flex";
    };

    // 4. Ejecutar borrado real en base de datos
    document.getElementById("btn-confirmar-borrar").addEventListener("click", async () => {
        if (!idPublicacionABorrar) return;
        
        try {
            const respuesta = await fetch(`/api/publicaciones/${idPublicacionABorrar}`, {
                method: 'DELETE'
            });

            if (respuesta.ok) {
                document.getElementById("modal-borrar").style.display = "none";
                cargarMisPublicaciones(); // Recargar la tabla tras borrar
            } else {
                alert("Hubo un problema al intentar eliminar la publicación.");
            }
        } catch (error) {
            console.error("Error al eliminar:", error);
        }
    });

    // Iniciar la carga al abrir la pestaña
    cargarMisPublicaciones();
});