document.addEventListener("DOMContentLoaded", async () => {
    const nombreLogueado = localStorage.getItem("nombre_usuario");
    const nombreLimpio = nombreLogueado ? nombreLogueado.charAt(0).toUpperCase() + nombreLogueado.slice(1) : "Invitado";
    const inicial = nombreLimpio.charAt(0);
    
    document.getElementById("nombre-perfil-principal").textContent = nombreLimpio;
    document.getElementById("avatar-perfil-grande").textContent = inicial;

    if(localStorage.getItem("perfil_ciudad")) document.getElementById("perfil-ciudad").textContent = localStorage.getItem("perfil_ciudad");
    if(localStorage.getItem("perfil_edad")) document.getElementById("perfil-edad").textContent = localStorage.getItem("perfil_edad") + " años";
    if(localStorage.getItem("perfil_ocupacion")) document.getElementById("perfil-ocupacion").textContent = localStorage.getItem("perfil_ocupacion");
    if(localStorage.getItem("perfil_bio")) document.getElementById("perfil-bio").textContent = localStorage.getItem("perfil_bio");

    const modal = document.getElementById("modal-editar-perfil");
    const btnAbrirModal = document.getElementById("btn-abrir-modal-editar");
    const btnCerrarModal = document.getElementById("btn-cerrar-modal");
    const formEditar = document.getElementById("form-editar-perfil");

    if (btnAbrirModal) {
        btnAbrirModal.addEventListener("click", () => {
            modal.style.display = "flex";
            document.getElementById("input-ciudad").value = localStorage.getItem("perfil_ciudad") || "";
            document.getElementById("input-edad").value = localStorage.getItem("perfil_edad") || "";
            document.getElementById("input-ocupacion").value = localStorage.getItem("perfil_ocupacion") || "";
            document.getElementById("input-bio").value = localStorage.getItem("perfil_bio") || "";
        });
    }

    if (btnCerrarModal) {
        btnCerrarModal.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    if (formEditar) {
        formEditar.addEventListener("submit", (e) => {
            e.preventDefault();
            localStorage.setItem("perfil_ciudad", document.getElementById("input-ciudad").value);
            localStorage.setItem("perfil_edad", document.getElementById("input-edad").value);
            localStorage.setItem("perfil_ocupacion", document.getElementById("input-ocupacion").value);
            localStorage.setItem("perfil_bio", document.getElementById("input-bio").value);
            window.location.reload(); 
        });
    }

    const contenedorMisPubs = document.getElementById("contenedor-mis-publicaciones");
    if (contenedorMisPubs) {
        try {
            const respuesta = await fetch("/api/publicaciones");
            const publicaciones = await respuesta.json();
            
            const misPublicaciones = publicaciones.filter(pub => pub.autor === nombreLogueado || pub.usuario_id === localStorage.getItem("user_id"));
            
            const contadorPubs = document.getElementById("contador-mis-pubs");
            if(contadorPubs) contadorPubs.textContent = misPublicaciones.length;
            
            contenedorMisPubs.innerHTML = "";

            if (misPublicaciones.length === 0) {
                contenedorMisPubs.innerHTML = "<p style='color: #666;'>No has subido ninguna publicación todavía.</p>";
            } else {
                misPublicaciones.forEach(pub => {
                    const precioClp = new Intl.NumberFormat("es-CL").format(pub.precio);
                    const tarjetaHtml = `
                        <div class="tarjeta-publicacion-horizontal" style="border: 1px solid #eae8f0; border-radius: 12px; padding: 16px; background: white;">
                            <div class="info-pub" style="width: 100%;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span class="etiqueta-busco pequeña" style="background: var(--perfil-verde-bg); color: var(--perfil-verde-texto); padding: 4px 10px; border-radius: 20px; font-size: 11px;">
                                        ${pub.categoria === 'busco' ? 'Busca' : 'Ofrece'}
                                    </span>
                                    <button style="border: none; background: transparent; color: red; cursor: pointer;"><i class="fa-solid fa-trash"></i> Eliminar</button>
                                </div>
                                <h4 style="margin: 10px 0;">${pub.titulo}</h4>
                                <div class="detalles-pub-lista" style="display: flex; gap: 15px; color: #5b5872; font-size: 13px;">
                                    <span><i class="fa-solid fa-location-dot" style="color: var(--perfil-morado);"></i> ${pub.ubicacion}</span>
                                    <span><i class="fa-solid fa-money-bill" style="color: var(--perfil-morado);"></i> $${precioClp} CLP</span>
                                </div>
                            </div>
                        </div>
                    `;
                    contenedorMisPubs.innerHTML += tarjetaHtml;
                });
            }
        } catch (error) {
            console.error("Error al cargar mis publicaciones:", error);
            contenedorMisPubs.innerHTML = "<p style='color:red;'>Error al cargar tus publicaciones.</p>";
        }
    }
});