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
    let aceptaSinEspecificar = false;
    let preferenciasModificadas = false;

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
    
    // 1. Detectar si estamos editando buscando el ID en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const idEdicion = urlParams.get('id');

    // 2. Si hay un ID, cambiar la interfaz y cargar los datos
    if (idEdicion) {
        // Cambiar títulos para que diga "Editar" en lugar de "Crear"
        document.title = "Editar publicación | Hay cupo";
        const h2Titulo = document.querySelector(".texto-titulo h2");
        if(h2Titulo) h2Titulo.textContent = "Editar publicación";
        
        if(btnSubmit) btnSubmit.textContent = "Guardar cambios";
        btnSubmit.disabled = true;

        // Obtener los datos y rellenar los inputs
        try {
            const respuesta = await fetch(`/api/publicaciones/${idEdicion}`);
            if (respuesta.ok) {
                const pub = await respuesta.json();
                document.getElementById("titulo").value = pub.titulo;
                document.getElementById("categoria").value = pub.categoria;
                document.getElementById("tipo").value = pub.tipo_vivienda;
                document.getElementById("ubicacion").value = pub.ubicacion;
                document.getElementById("precio").value = pub.precio;
                document.getElementById("cupos").value = pub.cupos_totales;
                
                mascotaSelect.value = pub.mascota === "si" ? "si" : "no";
                const tiposGuardados = Array.isArray(pub.tipos_mascotas_aceptadas) ? pub.tipos_mascotas_aceptadas : [];
                casillasMascotas.forEach(casilla => {
                    casilla.checked = tiposGuardados.includes(casilla.value);
                });
                condicionesMascotas.value = pub.condiciones_mascotas || "";
                aceptaSinEspecificar = mascotaSelect.value === "si" && tiposGuardados.length === 0;
                actualizarPreferencias();
                
                document.getElementById("contenido").value = pub.descripcion;
                btnSubmit.disabled = false;
            } else {
                const error = await respuesta.json().catch(() => ({}));
                alert("No se pudo cargar la publicación: " + mensajeError(error));
            }
        } catch (error) {
            console.error("Error al cargar la publicación", error);
            alert("No se pudo cargar la publicación. Revisa tu conexión y vuelve a intentarlo.");
        }
    }

    // 3. Controlar el envío (Crear o Actualizar)
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault(); 

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
        if (!formulario.reportValidity()) return;

        const formDataOriginal = new FormData(formulario);
        const formDataEnvio = new FormData();

        formDataEnvio.append("titulo", formDataOriginal.get("titulo"));
        formDataEnvio.append("categoria", formDataOriginal.get("categoria"));
        formDataEnvio.append("ubicacion", formDataOriginal.get("ubicacion"));
        formDataEnvio.append("precio", formDataOriginal.get("precio"));
        formDataEnvio.append("tipo_vivienda", formDataOriginal.get("tipo"));
        formDataEnvio.append("descripcion", formDataOriginal.get("contenido"));
        formDataEnvio.append("tipo", "Compartida");
        formDataEnvio.append("cupos_totales", formDataOriginal.get("cupos"));
        
        formDataEnvio.append("mascota", mascota);
        formDataEnvio.append("tipos_mascotas_aceptadas", JSON.stringify(tiposMascotas));
        formDataEnvio.append("condiciones_mascotas", condiciones);

        // Define si usas POST (crear) o PUT (actualizar)
        const url = idEdicion ? `/api/publicaciones/${idEdicion}` : "/api/publicaciones";
        const metodo = idEdicion ? "PUT" : "POST";

        btnSubmit.disabled = true;
        try {
            const respuesta = await fetch(url, {
                method: metodo,
                body: formDataEnvio
            });

            if (respuesta.ok) {
                // Al guardar, te devuelve a la lista de publicaciones o al inicio
                window.location.href = idEdicion ? "/mis-publicaciones" : "/inicio";
            } else {
                const error = await respuesta.json().catch(() => ({}));
                alert("Error al procesar: " + mensajeError(error));
            }
        } catch (error) {
            alert("Error de conexión con el servidor.");
        } finally {
            btnSubmit.disabled = false;
        }
    });
});
