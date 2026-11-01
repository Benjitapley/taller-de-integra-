document.addEventListener("DOMContentLoaded", async () => {
    const formulario = document.getElementById("form-crear");
    if (!formulario) return;

    const mascotaSelect = document.getElementById("mascota");
    const preferenciasMascotas = document.getElementById("preferencias-mascotas");
    const casillasMascotas = Array.from(preferenciasMascotas.querySelectorAll('input[type="checkbox"]'));
    const condicionesMascotas = document.getElementById("condiciones-mascotas");
    const indicacionCondiciones = document.getElementById("condiciones-mascotas-indicacion");
    const avisoAnterior = document.getElementById("aviso-mascotas-anteriores");
    const btnSubmit = formulario.querySelector(".btn-publicar");
    const estadoFormulario = document.getElementById("estado-formulario");
    const imagenInput = document.getElementById("imagen");
    const urlParams = new URLSearchParams(window.location.search);
    const idEdicion = urlParams.get("id");
    const modoEdicion = window.location.pathname === "/editar-publicacion" || urlParams.has("id");
    let publicacionOriginal = null;
    let publicacionLista = !modoEdicion;
    let guardando = false;
    let aceptaSinEspecificar = false;
    let preferenciasModificadas = false;

    const mostrarEstado = (mensaje, esError = false) => {
        estadoFormulario.textContent = mensaje;
        estadoFormulario.hidden = !mensaje;
        estadoFormulario.classList.toggle("error", esError);
    };

    const tiposSeleccionados = () => casillasMascotas.filter(casilla => casilla.checked).map(casilla => casilla.value);

    const actualizarPreferencias = () => {
        const acepta = mascotaSelect.value === "si";
        const incluyeOtro = tiposSeleccionados().includes("otro");
        preferenciasMascotas.hidden = !acepta;
        preferenciasMascotas.disabled = !acepta;
        condicionesMascotas.required = acepta && incluyeOtro;
        indicacionCondiciones.textContent = incluyeOtro ? "(indica qué otro animal)" : "(opcional)";
        avisoAnterior.hidden = !acepta || !aceptaSinEspecificar || preferenciasModificadas;
        casillasMascotas[0].setCustomValidity("");
        condicionesMascotas.setCustomValidity("");
    };

    mascotaSelect.addEventListener("change", () => {
        preferenciasModificadas = true;
        actualizarPreferencias();
    });
    preferenciasMascotas.addEventListener("change", () => {
        preferenciasModificadas = true;
        actualizarPreferencias();
    });
    condicionesMascotas.addEventListener("input", () => {
        preferenciasModificadas = true;
        actualizarPreferencias();
    });
    actualizarPreferencias();

    const mensajeError = (error) => {
        const detalle = error && error.detail;
        if (typeof detalle === "string") return detalle;
        if (Array.isArray(detalle)) {
            return detalle.map(problema => {
                if (typeof problema === "string") return problema;
                const campo = Array.isArray(problema.loc) ? problema.loc.filter(parte => parte !== "body").join(".") : "";
                const mensaje = problema.msg || "Valor no válido";
                return campo ? `${campo}: ${mensaje}` : mensaje;
            }).join("\n");
        }
        return "Revisa los campos de la publicación.";
    };
    
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (!publicacionLista || guardando) return;

        const mascota = mascotaSelect.value;
        const tiposMascotas = mascota === "si" ? tiposSeleccionados() : [];
        const condiciones = mascota === "si" ? condicionesMascotas.value.trim() : "";
        const conservaPreferenciasAnteriores = Boolean(idEdicion && aceptaSinEspecificar && !preferenciasModificadas);

        casillasMascotas[0].setCustomValidity("");
        condicionesMascotas.setCustomValidity("");
        if (mascota === "si" && tiposMascotas.length === 0 && !conservaPreferenciasAnteriores) {
            casillasMascotas[0].setCustomValidity("Selecciona al menos un animal que se acepte.");
        }
        if (tiposMascotas.includes("otro") && !condiciones) {
            condicionesMascotas.setCustomValidity("Indica qué otro animal se acepta.");
        }
        const imagen = imagenInput.files[0];
        imagenInput.setCustomValidity(imagen && imagen.size > 5 * 1024 * 1024
            ? "La imagen debe pesar como máximo 5 MB." : "");
        if (!formulario.reportValidity()) return;

        const formDataOriginal = new FormData(formulario);
        const formDataEnvio = new FormData();

        formDataEnvio.append("titulo", formDataOriginal.get("titulo"));
        formDataEnvio.append("categoria", formDataOriginal.get("categoria"));
        formDataEnvio.append("ubicacion", formDataOriginal.get("ubicacion"));
        formDataEnvio.append("precio", formDataOriginal.get("precio"));
        formDataEnvio.append("tipo_vivienda", formDataOriginal.get("tipo"));
        formDataEnvio.append("descripcion", formDataOriginal.get("contenido"));
        formDataEnvio.append("cupos_totales", formDataOriginal.get("cupos"));
        if (!modoEdicion || publicacionOriginal.tipo) {
            formDataEnvio.append("tipo", modoEdicion ? publicacionOriginal.tipo : "Compartida");
        }
        if (!modoEdicion || typeof publicacionOriginal.permitir_comentarios === "boolean") {
            formDataEnvio.append("permitir_comentarios", modoEdicion ? publicacionOriginal.permitir_comentarios : false);
        }
        if (imagen) formDataEnvio.append("imagen", imagen);
        
        formDataEnvio.append("mascota", mascota);
        formDataEnvio.append("tipos_mascotas_aceptadas", JSON.stringify(tiposMascotas));
        formDataEnvio.append("condiciones_mascotas", condiciones);

        const url = modoEdicion ? `/api/publicaciones/${idEdicion}` : "/api/publicaciones";
        const metodo = modoEdicion ? "PUT" : "POST";

        guardando = true;
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";
        formulario.setAttribute("aria-busy", "true");
        mostrarEstado("");
        try {
            const respuesta = await fetch(url, {
                method: metodo,
                body: formDataEnvio
            });

            if (respuesta.ok) {
                window.location.href = modoEdicion ? "/mis-publicaciones" : "/inicio";
            } else {
                const error = await respuesta.json().catch(() => ({}));
                mostrarEstado("No se pudo guardar: " + mensajeError(error), true);
            }
        } catch (error) {
            mostrarEstado("No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.", true);
        } finally {
            guardando = false;
            btnSubmit.disabled = false;
            btnSubmit.textContent = modoEdicion ? "Guardar cambios" : "Publicar ahora";
            formulario.setAttribute("aria-busy", "false");
        }
    });

    imagenInput.addEventListener("change", () => imagenInput.setCustomValidity(""));

    if (modoEdicion) {
        document.title = "Editar publicación | Hay cupo";
        document.querySelector(".texto-titulo h2").textContent = "Editar publicación";
        const enlaceVolver = document.getElementById("enlace-volver");
        enlaceVolver.href = "/mis-publicaciones";
        enlaceVolver.textContent = "← Volver a mis publicaciones";
        document.getElementById("ayuda-imagen").textContent = "Si no eliges otra imagen, se conserva la actual. JPG, PNG o WEBP; máximo 5 MB.";
        btnSubmit.textContent = "Guardar cambios";
        btnSubmit.disabled = true;
        formulario.inert = true;
        mostrarEstado("Cargando publicación...");

        if (!/^[1-9]\d*$/.test(idEdicion || "") || Number(idEdicion) > 2147483647) {
            mostrarEstado("El enlace de edición no es válido. Vuelve a Mis publicaciones y selecciona Editar.", true);
            return;
        }

        formulario.setAttribute("aria-busy", "true");
        try {
            const respuesta = await fetch(`/api/publicaciones/${idEdicion}`);
            if (!respuesta.ok) {
                const error = await respuesta.json().catch(() => ({}));
                mostrarEstado("No se pudo cargar la publicación: " + mensajeError(error), true);
                return;
            }
            const pub = await respuesta.json();
            publicacionOriginal = pub;
            document.getElementById("titulo").value = pub.titulo;
            document.getElementById("categoria").value = pub.categoria;
            document.getElementById("tipo").value = pub.tipo_vivienda;
            document.getElementById("ubicacion").value = pub.ubicacion;
            document.getElementById("precio").value = pub.precio;
            document.getElementById("cupos").value = pub.cupos_totales;
            document.getElementById("contenido").value = pub.descripcion || "";

            mascotaSelect.value = pub.mascota === "si" ? "si" : "no";
            const tiposGuardados = Array.isArray(pub.tipos_mascotas_aceptadas) ? pub.tipos_mascotas_aceptadas : [];
            casillasMascotas.forEach(casilla => {
                casilla.checked = tiposGuardados.includes(casilla.value);
            });
            condicionesMascotas.value = pub.condiciones_mascotas || "";
            aceptaSinEspecificar = mascotaSelect.value === "si" && tiposGuardados.length === 0;
            actualizarPreferencias();

            publicacionLista = true;
            formulario.inert = false;
            btnSubmit.disabled = false;
            mostrarEstado(String(pub.estado).toLowerCase() === "cerrada"
                ? "Esta publicación está cerrada. Puedes editar sus datos; al guardar seguirá cerrada y sin cupos disponibles."
                : "");
        } catch (error) {
            mostrarEstado("No se pudo cargar la publicación. Revisa tu conexión y vuelve a abrirla desde Mis publicaciones.", true);
        } finally {
            formulario.setAttribute("aria-busy", "false");
        }
    }
});
