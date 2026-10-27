document.addEventListener("DOMContentLoaded", async () => {
    const formulario = document.getElementById("form-crear");
    
    // 1. Detectar si estamos editando buscando el ID en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const idEdicion = urlParams.get("id");
    const btnSubmit = document.querySelector(".btn-publicar");
    const titulo = document.querySelector(".texto-titulo h2");

    // 2. Si hay un ID, cambiar la interfaz y cargar los datos
    if (idEdicion) {
        document.title = "Editar publicación | Hay cupo";
        if (titulo) titulo.textContent = "Editar publicación";
        if (btnSubmit) btnSubmit.textContent = "Guardar cambios";
        const volver = document.querySelector(".enlace-volver");
        if (volver) {
            volver.href = "/mis-publicaciones";
            volver.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Volver a mis publicaciones';
        }

        try {
            const respuesta = await fetch(`/api/publicaciones/${idEdicion}`);
            const pub = await respuesta.json();
            if (!respuesta.ok) throw new Error(pub.detail || "No se pudo cargar la publicación.");
            document.getElementById("titulo").value = pub.titulo || "";
            document.getElementById("categoria").value = pub.categoria || "";
            document.getElementById("tipo").value = pub.tipo_vivienda || "";
            document.getElementById("ubicacion").value = pub.ubicacion || "";
            document.getElementById("precio").value = pub.precio ?? "";
            document.getElementById("cupos").value = pub.cupos_totales ?? "";

            const mascotaSelect = document.getElementById("mascota");
            if (mascotaSelect) mascotaSelect.value = pub.mascota || "no";
            document.getElementById("contenido").value = pub.descripcion || "";
        } catch (error) {
            alert(error.message);
            if (btnSubmit) btnSubmit.disabled = true;
            return;
        }
    }

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
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
        formDataEnvio.append("mascota", formDataOriginal.get("mascota") || "no");
        formDataEnvio.append("permitir_comentarios", document.getElementById("comentarios").checked ? "true" : "false");
        const imagen = formDataOriginal.get("imagen");
        if (imagen && imagen.size > 0) formDataEnvio.append("imagen", imagen);

        const url = idEdicion ? `/api/publicaciones/${idEdicion}` : "/api/publicaciones";
        const metodo = idEdicion ? "PUT" : "POST";
        if (btnSubmit) btnSubmit.disabled = true;

        try {
            const respuesta = await fetch(url, { method: metodo, body: formDataEnvio });
            const resultado = await respuesta.json();
            if (!respuesta.ok) throw new Error(resultado.detail || "Revisa los campos ingresados.");
            window.location.href = idEdicion ? "/mis-publicaciones" : "/inicio";
        } catch (error) {
            alert(`Error al procesar: ${error.message}`);
            if (btnSubmit) btnSubmit.disabled = false;
        }
    });
});