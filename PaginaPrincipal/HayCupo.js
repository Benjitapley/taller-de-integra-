document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. MENÚ Y HEADER
    const btnAbrir = document.getElementById("btn-abrir-menu");
    const btnCerrar = document.getElementById("btn-cerrar-menu");
    const menuLateral = document.getElementById("menu-lateral");
    const fondoMenu = document.getElementById("fondo-menu");

    if (btnAbrir && btnCerrar && menuLateral && fondoMenu) {
        btnAbrir.addEventListener("click", () => {
            menuLateral.classList.add("abierto");
            fondoMenu.style.display = "block";
            btnAbrir.setAttribute("aria-expanded", "true");
            btnCerrar.focus();
        });
        btnCerrar.addEventListener("click", () => {
            menuLateral.classList.remove("abierto");
            fondoMenu.style.display = "none";
            btnAbrir.setAttribute("aria-expanded", "false");
            btnAbrir.focus();
        });
        fondoMenu.addEventListener("click", () => {
            menuLateral.classList.remove("abierto");
            fondoMenu.style.display = "none";
            btnAbrir.setAttribute("aria-expanded", "false");
        });
    }

    const perfilUsuario = document.getElementById("perfil-usuario");
    const dropdownMenu = document.getElementById("dropdown-menu");
    
    if (perfilUsuario && dropdownMenu) {
        perfilUsuario.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
            perfilUsuario.setAttribute("aria-expanded", String(dropdownMenu.style.display === "block"));
        });
        document.addEventListener("click", (event) => {
            if (!perfilUsuario.contains(event.target) && !dropdownMenu.contains(event.target)) {
                dropdownMenu.style.display = "none";
                perfilUsuario.setAttribute("aria-expanded", "false");
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        const modal = document.getElementById("modal-detalle");
        if (modal && modal.style.display === "flex") {
            if (event.key === "Escape") window.cerrarDetalle();
            if (event.key === "Tab") {
                // El único control del detalle es su botón de cierre.
                event.preventDefault();
                modal.querySelector("button").focus();
            }
            return;
        }
        if (event.key !== "Escape") return;
        if (dropdownMenu && dropdownMenu.style.display === "block") {
            dropdownMenu.style.display = "none";
            perfilUsuario.setAttribute("aria-expanded", "false");
            perfilUsuario.focus();
        }
        if (menuLateral && menuLateral.classList.contains("abierto")) btnCerrar.click();
    });

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
        btnCerrarSesion.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }

    // 2. SISTEMA DE PUBLICACIONES Y FILTROS
    const contenedorPubs = document.getElementById("contenedor-publicaciones");
    window.todasLasPublicaciones = [];
    window.publicacionesVisibles = [];

    const renderizarPublicaciones = (publicaciones) => {
        window.publicacionesVisibles = publicaciones;
        contenedorPubs.innerHTML = "";
        contenedorPubs.className = "grid-publicaciones tw:grid! tw:grid-cols-1! tw:gap-5! tw:mt-6! tw:sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]!";

        if (publicaciones.length === 0) {
            contenedorPubs.innerHTML = '<p class="tw:col-span-full! tw:mt-10! tw:text-center! tw:font-bold! tw:text-[#666]!">No se encontraron publicaciones con esos filtros.</p>';
            return;
        }

        publicaciones.forEach((pub, index) => {
            const precioClp = new Intl.NumberFormat("es-CL").format(pub.precio || 0);
            const tieneImagen = pub.imagen && pub.imagen.trim() !== "";
            
            const categoria = (pub.categoria || "").toLowerCase();
            const esBusqueda = categoria.includes("busco");
            const iconoClase = esBusqueda ? "fa-magnifying-glass" : "fa-house";
            const tituloCat = esBusqueda ? "Se busca arriendo" : "Se ofrece arriendo";
            
            const claseTarjeta = tieneImagen
                ? "tarjeta-mockup tw:flex-col! tw:sm:flex-row!"
                : "tarjeta-mockup sin-imagen tw:flex-col!";
            const imgHtml = tieneImagen ? `<div class="tarjeta-img tw:h-40! tw:w-full! tw:sm:h-auto! tw:sm:w-[40%]!" style="background-image: url('${pub.imagen}');"></div>` : "";
            
            const titulo = pub.titulo ? `<p class="tw:mb-2! tw:text-[15px]! tw:font-extrabold! tw:text-[#1a1a1a]! tw:wrap-anywhere!">${pub.titulo}</p>` : '';
            
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
                <article class="${claseTarjeta} tw:min-w-0! tw:cursor-pointer! tw:focus-visible:outline-2! tw:focus-visible:outline-offset-4! tw:focus-visible:outline-[#7557c8]! tw:motion-reduce:animate-none!" style="animation-delay: ${index * 0.05}s;" role="button" tabindex="0" aria-label="Ver detalles de la publicación" onclick="abrirDetalle(${index})">
                    ${imgHtml}
                    <div class="tarjeta-contenido tw:min-w-0! tw:p-5!">
                        <div class="tarjeta-header">
                            <div class="tarjeta-icono-cat">
                                <i class="fa-solid ${iconoClase}"></i>
                            </div>
                            <div class="tarjeta-titulo-cat">
                                <span>${tituloCat}</span>
                                <div class="linea-corta"></div>
                            </div>
                        </div>
                        <div class="tarjeta-detalles tw:wrap-anywhere!">
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
                </article>
            `;
            contenedorPubs.innerHTML += tarjetaHtml;
        });
    };

    let ultimaSolicitud = 0;

    const cargarPublicaciones = async (url) => {
        const solicitud = ++ultimaSolicitud;
        try {
            const respuesta = await fetch(url);
            if (!respuesta.ok) throw new Error("No se pudieron cargar las publicaciones.");
            const publicaciones = await respuesta.json();
            if (!Array.isArray(publicaciones)) throw new Error("Respuesta de publicaciones no válida.");
            if (solicitud !== ultimaSolicitud) return;

            if (url === "/api/publicaciones") window.todasLasPublicaciones = publicaciones;
            renderizarPublicaciones(publicaciones);
        } catch (error) {
            if (solicitud !== ultimaSolicitud) return;
            window.publicacionesVisibles = [];
            contenedorPubs.innerHTML = '<p role="alert" class="tw:col-span-full! tw:text-red-700!">Error al cargar las publicaciones. Vuelve a consultar para intentarlo de nuevo.</p>';
        }
    };

    if (contenedorPubs) {
        contenedorPubs.addEventListener("keydown", (event) => {
            const tarjeta = event.target.closest('[role="button"]');
            if (tarjeta && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                tarjeta.click();
            }
        });
    }

    // 4. BÚSQUEDA DE PUBLICACIONES EN EL BACKEND
    const btnConsultar = document.getElementById("btn-consultar");
    if (btnConsultar && contenedorPubs) {
        btnConsultar.addEventListener("click", () => {
            const parametros = new URLSearchParams();
            const filtros = {
                consulta: document.getElementById("filtro-ubicacion").value.trim(),
                personas: document.getElementById("filtro-personas").value,
                tipo: document.getElementById("filtro-tipo").value,
                mascotas: document.getElementById("filtro-mascotas").value
            };
            Object.entries(filtros).forEach(([nombre, valor]) => {
                if (valor) parametros.set(nombre, valor);
            });
            const consulta = parametros.toString();
            cargarPublicaciones(`/api/publicaciones/buscar${consulta ? `?${consulta}` : ""}`);
        });
    }

    if (contenedorPubs) await cargarPublicaciones("/api/publicaciones");
});

// LÓGICA DEL MODAL: Inyecta TODA la información corregida
let focoAntesDelDetalle = null;

window.abrirDetalle = function(index) {
    const pub = window.publicacionesVisibles[index];
    const modal = document.getElementById("modal-detalle");
    if (!pub || !modal) return;
    
    let textoPersonas = "No especificado";
    if (pub.cupos_totales) {
        textoPersonas = (String(pub.cupos_totales) === "3") ? "3 o más Personas" : `${pub.cupos_totales} Persona(s)`;
    }

    const aceptaMascotas = String(pub.mascota || "").toLowerCase() === "si";
    const nombresMascotas = {
        perro: "perro", gato: "gato", ave: "ave", tortuga: "tortuga",
        conejo: "conejo", pez: "pez", otro: "otro animal (ver condiciones)"
    };
    const tiposMascotas = Array.isArray(pub.tipos_mascotas_aceptadas) ? pub.tipos_mascotas_aceptadas : [];
    const textoMascotas = !aceptaMascotas ? "No acepta mascotas" : tiposMascotas.length > 0
        ? "Acepta: " + tiposMascotas.map(tipo => nombresMascotas[tipo] || tipo).join(", ")
        : "Acepta mascotas; tipos sin especificar";
    const categoriaTexto = String(pub.categoria || "").toLowerCase().includes("busco") ? "Busca arriendo" : "Ofrece arriendo";
    const tipoVivienda = pub.tipo_vivienda ? (pub.tipo_vivienda.charAt(0).toUpperCase() + pub.tipo_vivienda.slice(1)) : "No especificado";

    // Pasa los datos del JS al HTML del modal
    document.getElementById("modal-titulo").textContent = pub.titulo || "Sin título";
    document.getElementById("modal-categoria-badge").textContent = categoriaTexto;
    document.getElementById("modal-tipo").textContent = tipoVivienda;
    document.getElementById("modal-ubi").textContent = pub.ubicacion || "No especificada";
    document.getElementById("modal-precio").textContent = new Intl.NumberFormat("es-CL").format(pub.precio || 0) + " CLP";
    document.getElementById("modal-personas").textContent = textoPersonas;
    document.getElementById("modal-mascotas").textContent = textoMascotas;
    const condiciones = aceptaMascotas ? (pub.condiciones_mascotas || "") : "";
    document.getElementById("modal-condiciones-mascotas").textContent = condiciones;
    document.getElementById("modal-condiciones-mascotas-contenedor").hidden = !condiciones;
    
    // Usando "descripcion" en lugar de "contenido"
    document.getElementById("modal-desc").textContent = pub.descripcion || "El usuario no proporcionó una descripción detallada.";
    
    focoAntesDelDetalle = document.activeElement;
    modal.style.display = "flex";
    modal.querySelector("button").focus();
};

window.cerrarDetalle = function() {
    document.getElementById("modal-detalle").style.display = "none";
    if (focoAntesDelDetalle && focoAntesDelDetalle.isConnected) focoAntesDelDetalle.focus();
};
