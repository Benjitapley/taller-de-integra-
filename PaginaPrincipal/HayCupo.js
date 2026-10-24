document.addEventListener("DOMContentLoaded", async () => {
    
    // PROTECCIÓN DE RUTA: si no hay token, redirigir al login
    if (!localStorage.getItem('access_token')) {
        window.location.href = '/';
        return;
    }

    // 1. MENÚ Y HEADER
    const btnAbrir = document.getElementById("btn-abrir-menu");
    const btnCerrar = document.getElementById("btn-cerrar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const fondoMenu = document.getElementById("fondo-menu");

    if (btnAbrir && btnCerrar && menuLateral && fondoMenu) {
        btnAbrir.addEventListener("click", () => {
            menuLateral.classList.add("abierto");
            fondoMenu.style.display = "block";
        });
        btnCerrar.addEventListener("click", () => {
            menuLateral.classList.remove("abierto");
            fondoMenu.style.display = "none";
        });
        fondoMenu.addEventListener("click", () => {
            menuLateral.classList.remove("abierto");
            fondoMenu.style.display = "none";
        });
    }

    const perfilUsuario = document.getElementById("perfil-usuario");
    const dropdownMenu = document.getElementById("dropdown-menu");
    
    if (perfilUsuario && dropdownMenu) {
        perfilUsuario.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
        });
        document.addEventListener("click", (event) => {
            if (!perfilUsuario.contains(event.target) && !dropdownMenu.contains(event.target)) {
                dropdownMenu.style.display = "none";
            }
        });
    }

    const nombreGuardado = localStorage.getItem("nombre_usuario");
    if (nombreGuardado) {
        const nombreLimpio = nombreGuardado.charAt(0).toUpperCase() + nombreGuardado.slice(1);
        const spanNombre = document.getElementById("nombre-usuario-nav");
        const divAvatar = document.getElementById("avatar-letra");
        if (spanNombre) spanNombre.textContent = nombreLimpio;
        if (divAvatar) divAvatar.textContent = nombreLimpio.charAt(0);
    }

    const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async () => {
            // Notificar al backend (informativo, el JWT se invalida del lado del cliente)
            try {
                const token = localStorage.getItem('access_token');
                await fetch('/auth/logout', {
                    method: 'POST',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
            } catch (e) { /* ignorar errores de red */ }
            localStorage.removeItem('access_token');
            localStorage.removeItem('nombre_usuario');
            localStorage.removeItem('user_id');
            localStorage.removeItem('pending_verify_email');
            window.location.href = "/";
        });
    }

    // 2. SISTEMA DE PUBLICACIONES Y FILTROS
    const contenedorPubs = document.getElementById("contenedor-publicaciones");
    window.todasLasPublicaciones = [];

    const renderizarPublicaciones = (publicaciones) => {
        contenedorPubs.innerHTML = "";
        contenedorPubs.className = "grid-publicaciones";
        contenedorPubs.removeAttribute("style");

        if (publicaciones.length === 0) {
            contenedorPubs.innerHTML = "<p style='color: #666; text-align: center; grid-column: 1/-1; margin-top: 40px; font-weight: bold;'>No se encontraron publicaciones con esos filtros.</p>";
            return;
        }

        publicaciones.forEach((pub, index) => {
            const precioClp = new Intl.NumberFormat("es-CL").format(pub.precio || 0);
            const tieneImagen = pub.imagen && pub.imagen.trim() !== "";
            
            const categoria = (pub.categoria || "").toLowerCase();
            const esBusqueda = categoria.includes("busco");
            const iconoClase = esBusqueda ? "fa-magnifying-glass" : "fa-house";
            const tituloCat = esBusqueda ? "Se busca arriendo" : "Se ofrece arriendo";
            
            const claseTarjeta = tieneImagen ? "tarjeta-mockup" : "tarjeta-mockup sin-imagen";
            const imgHtml = tieneImagen ? `<div class="tarjeta-img" style="background-image: url('${pub.imagen}');"></div>` : "";
            
            const titulo = pub.titulo ? `<p style="font-weight: 800; color: #1a1a1a; margin-bottom: 8px; font-size: 15px;">${pub.titulo}</p>` : '';
            
            // Lógica exacta para el número de personas usando "cupos_totales" del backend
            let textoPersonas = "No especificado";
            if (pub.cupos_totales) {
                if (String(pub.cupos_totales) === "3") {
                    textoPersonas = "3 o más Personas";
                } else {
                    textoPersonas = `${pub.cupos_totales} Persona(s)`;
                }
            }

            // En la tarjeta principal (Home) ya NO ponemos la descripción, solo los datos
            const tarjetaHtml = `
                <div class="${claseTarjeta}" style="animation-delay: ${index * 0.05}s; cursor: pointer;" onclick="abrirDetalle(${index})">
                    ${imgHtml}
                    <div class="tarjeta-contenido">
                        <div class="tarjeta-header">
                            <div class="tarjeta-icono-cat">
                                <i class="fa-solid ${iconoClase}"></i>
                            </div>
                            <div class="tarjeta-titulo-cat">
                                <span>${tituloCat}</span>
                                <div class="linea-corta"></div>
                            </div>
                        </div>
                        <div class="tarjeta-detalles">
                            ${titulo}
                            <p><i class="fa-solid fa-user"></i> ${textoPersonas}</p>
                            <p><i class="fa-solid fa-money-bill"></i> <strong>${precioClp} CLP</strong></p>
                            <p><i class="fa-solid fa-location-dot"></i> <span>${pub.ubicacion || "No especificada"}</span></p>
                        </div>
                        <div class="tarjeta-footer">
                            <span><i class="fa-regular fa-calendar"></i> Reciente</span>
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </div>
                    </div>
                </div>
            `;
            contenedorPubs.innerHTML += tarjetaHtml;
        });
    };

    if (contenedorPubs) {
        try {
            const respuesta = await fetch("/api/publicaciones");
            window.todasLasPublicaciones = await respuesta.json();
            renderizarPublicaciones(window.todasLasPublicaciones);
        } catch (error) {
            contenedorPubs.innerHTML = "<p style='color:red; grid-column: 1/-1;'>Error al cargar las publicaciones.</p>";
        }
    }

    // 4. MOTOR DE FILTROS ACTUALIZADO A LAS VARIABLES DEL BACKEND
    const btnConsultar = document.getElementById("btn-consultar");
    if (btnConsultar) {
        btnConsultar.addEventListener("click", () => {
            const txtUbicacion = document.getElementById("filtro-ubicacion").value.toLowerCase().trim();
            const valPersonas = document.getElementById("filtro-personas").value;
            const valTipo = document.getElementById("filtro-tipo").value;
            const valMascotas = document.getElementById("filtro-mascotas").value;

            const filtradas = window.todasLasPublicaciones.filter(pub => {
                const pubUbi = (pub.ubicacion || "").toLowerCase();
                const coincideUbicacion = txtUbicacion === "" || pubUbi.includes(txtUbicacion);
                
                // Usando cupos_totales
                const pubPersonas = String(pub.cupos_totales || "").trim();
                const coincidePersonas = valPersonas === "" || (valPersonas === "3" ? Number(pubPersonas) >= 3 : pubPersonas === valPersonas);
                
                // Usando tipo_vivienda
                const pubTipo = String(pub.tipo_vivienda || "").toLowerCase().trim();
                const coincideTipo = valTipo === "" || pubTipo === valTipo;
                
                const pubMascotas = String(pub.mascota || "").toLowerCase().trim();
                const coincideMascotas = valMascotas === "" || pubMascotas === valMascotas;

                return coincideUbicacion && coincidePersonas && coincideTipo && coincideMascotas;
            });

            renderizarPublicaciones(filtradas);
        });
    }
});

// LÓGICA DEL MODAL: Inyecta TODA la información corregida
window.abrirDetalle = function(index) {
    const pub = window.todasLasPublicaciones[index];
    const modal = document.getElementById("modal-detalle");
    
    let textoPersonas = "No especificado";
    if (pub.cupos_totales) {
        textoPersonas = (String(pub.cupos_totales) === "3") ? "3 o más Personas" : `${pub.cupos_totales} Persona(s)`;
    }

    const aceptaMascotas = String(pub.mascota || "").toLowerCase() === "si" ? "Sí acepta" : "No acepta";
    const categoriaTexto = String(pub.categoria || "").toLowerCase().includes("busco") ? "Busca arriendo" : "Ofrece arriendo";
    const tipoVivienda = pub.tipo_vivienda ? (pub.tipo_vivienda.charAt(0).toUpperCase() + pub.tipo_vivienda.slice(1)) : "No especificado";

    // Pasa los datos del JS al HTML del modal
    document.getElementById("modal-titulo").textContent = pub.titulo || "Sin título";
    document.getElementById("modal-categoria-badge").textContent = categoriaTexto;
    document.getElementById("modal-tipo").textContent = tipoVivienda;
    document.getElementById("modal-ubi").textContent = pub.ubicacion || "No especificada";
    document.getElementById("modal-precio").textContent = new Intl.NumberFormat("es-CL").format(pub.precio || 0) + " CLP";
    document.getElementById("modal-personas").textContent = textoPersonas;
    document.getElementById("modal-mascotas").textContent = aceptaMascotas;
    
    // Usando "descripcion" en lugar de "contenido"
    document.getElementById("modal-desc").textContent = pub.descripcion || "El usuario no proporcionó una descripción detallada.";
    
    modal.style.display = "flex";
};

window.cerrarDetalle = function() {
    document.getElementById("modal-detalle").style.display = "none";
};