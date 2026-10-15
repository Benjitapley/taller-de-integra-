document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Cargar Perfil y llenar la información visual
    async function cargarPerfil() {
        try {
            const respuesta = await fetch("/api/perfil");
            const data = await respuesta.json();

            // Llenar textos del perfil
            document.getElementById("perfil-nombre").textContent = data.nombre;
            document.getElementById("perfil-edad").textContent = data.edad || "--";
            document.getElementById("perfil-ciudad").textContent = data.ciudad || "--";
            document.getElementById("perfil-ocupacion").textContent = data.ocupacion || "--";
            document.getElementById("perfil-breve").textContent = data.breve_descripcion;
            document.getElementById("perfil-sobre-mi").textContent = data.sobre_mi;
            document.getElementById("stat-pubs").textContent = data.total_publicaciones;

            // Llenar imagen o dejar ícono por defecto
            const avatar = document.getElementById("avatar-img");
            if (data.foto_perfil) {
                avatar.innerHTML = `<img src="${data.foto_perfil}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                avatar.innerHTML = `<i class="fa-solid fa-user"></i>`;
            }

            // Llenar inputs del modal de edición para que no partan vacíos
            document.getElementById("input-edad").value = data.edad || "";
            document.getElementById("input-ciudad").value = data.ciudad || "";
            document.getElementById("input-ocupacion").value = data.ocupacion || "";
            document.getElementById("input-breve").value = data.breve_descripcion || "";
            document.getElementById("input-sobre").value = data.sobre_mi || "";

        } catch (error) {
            console.error("Error cargando perfil", error);
        }
    }

    // 2. Cargar SOLO LA ÚLTIMA publicación del usuario
    async function cargarMisTarjetas() {
        const contenedor = document.getElementById("contenedor-publicaciones-perfil");
        try {
            const respuesta = await fetch("/api/mis-publicaciones");
            const pubs = await respuesta.json();

            if (pubs.length === 0) {
                contenedor.innerHTML = "<p style='color: #888;'>No has subido ninguna publicación todavía.</p>";
                return;
            }

            // Seleccionar exclusivamente la primera publicación de la lista (la más reciente)
            const pub = pubs[0];

            const precio = new Intl.NumberFormat("es-CL").format(pub.precio || 0);
            const imagen = pub.imagen ? pub.imagen : "https://via.placeholder.com/200x150?text=Sin+Imagen";
            const tipo = pub.tipo ? pub.tipo.toUpperCase() : "VIVIENDA";
            
            // Fallbacks de seguridad por diferencias de nombres de variables
            const cuposSafe = pub.cupos || pub.cupos_totales || "1";
            const ubiSafe = pub.ubicacion || "Ubicación no especificada";

            contenedor.innerHTML = `
                <div class="tarjeta-pub tw:flex-col! tw:sm:flex-row!" style="display: flex; border: 1px solid #eee; border-radius: 12px; overflow: hidden; margin-bottom: 15px;">
                    <img src="${imagen}" class="img-pub tw:w-full! tw:shrink-0! tw:sm:w-[200px]!" style="width: 200px; height: 160px; object-fit: cover; background: #ddd;">
                    <div class="info-pub tw:min-w-0! tw:wrap-anywhere!" style="padding: 15px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <span style="background: #e6f8eb; color: #1f8b41; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold;">${tipo}</span>
                            <h4 style="margin: 10px 0 5px 0; color: #1a1a1a; font-size: 16px;">${pub.titulo}</h4>
                            <div style="color: #666; font-size: 13px; margin-bottom: 5px;"><i class="fa-solid fa-users"></i> ${cuposSafe} persona(s)</div>
                            <div style="color: #666; font-size: 13px;"><i class="fa-solid fa-location-dot"></i> ${ubiSafe}</div>
                        </div>
                        <div class="tw:flex-wrap! tw:gap-3!" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px;">
                            <span style="color: #382384; font-weight: 800; font-size: 16px;">$${precio} CLP</span>
                            <a href="/editar-publicacion?id=${pub.id}" style="background: #382384; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold;">Ver publicación</a>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            contenedor.innerHTML = "<p style='color: red;'>Error al cargar la publicación.</p>";
        }
    }

    // 3. Enviar el Formulario de Edición
    document.getElementById("form-editar-perfil").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        try {
            const respuesta = await fetch("/api/perfil", { 
                method: "PUT", 
                body: formData 
            });
            
            if (respuesta.ok) {
                document.getElementById("modal-editar").style.display = "none";
                cargarPerfil(); // Recarga los datos actualizados sin refrescar la página
            } else {
                alert("Error al guardar los cambios.");
            }
        } catch (error) {
            console.error(error);
        }
    });

    // Inicializar todo al abrir la página
    cargarPerfil();
    cargarMisTarjetas();
});
