document.addEventListener("DOMContentLoaded", async () => {
    const formulario = document.getElementById("form-crear");
    
    // 1. Detectar si estamos editando buscando el ID en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const idEdicion = urlParams.get('id');

    // 2. Si hay un ID, cambiar la interfaz y cargar los datos
    if (idEdicion) {
        // Cambiar títulos para que diga "Editar" en lugar de "Crear"
        document.title = "Editar publicación | Hay cupo";
        const h2Titulo = document.querySelector(".texto-titulo h2");
        if(h2Titulo) h2Titulo.textContent = "Editar publicación";
        
        const btnSubmit = document.querySelector(".btn-publicar");
        if(btnSubmit) btnSubmit.textContent = "Guardar cambios";

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
                
                const mascotaSelect = document.getElementById("mascota");
                if(mascotaSelect) mascotaSelect.value = pub.mascota || "no";
                
                document.getElementById("contenido").value = pub.descripcion;
            }
        } catch (error) {
            console.error("Error al cargar la publicación", error);
        }
    }

    // 3. Controlar el envío (Crear o Actualizar)
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault(); 

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
        
        const mascota = formDataOriginal.get("mascota");
        if(mascota) formDataEnvio.append("mascota", mascota);
        formDataEnvio.append(
            "permitir_comentarios",
            document.getElementById("comentarios").checked ? "true" : "false"
        );

        const imagen = formDataOriginal.get("imagen");
        if (imagen instanceof File && imagen.size > 0) {
            formDataEnvio.append("imagen", imagen);
        }

        // Define si usas POST (crear) o PUT (actualizar)
        const url = idEdicion ? `/api/publicaciones/${idEdicion}` : "/api/publicaciones";
        const metodo = idEdicion ? "PUT" : "POST";

        try {
            const respuesta = await fetch(url, {
                method: metodo,
                body: formDataEnvio
            });

            if (respuesta.ok) {
                // Al guardar, te devuelve a la lista de publicaciones o al inicio
                window.location.href = idEdicion ? "/mis-publicaciones" : "/inicio";
            } else {
                const error = await respuesta.json();
                alert("Error al procesar: " + (error.detail || "Revisa los campos"));
            }
        } catch (error) {
            alert("Error de conexión con el servidor.");
        }
    });
});