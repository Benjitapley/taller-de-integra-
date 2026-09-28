document.addEventListener('DOMContentLoaded', () => {
    // Seleccionamos el formulario y el contenedor donde mostraremos los resultados
    const formulario = document.querySelector('form');
    const contenedorResultados = document.querySelector('.espacio-futuro');

    formulario.addEventListener('submit', async (evento) => {
        // Evitamos que la página se recargue al presionar "Consultar"
        evento.preventDefault();

        // Limpiamos los resultados anteriores
        contenedorResultados.innerHTML = '<p>Buscando cupos...</p>';

        // Obtenemos los valores ingresados en el formulario
        const consulta = document.getElementById('consulta').value;
        const personas = document.getElementById('personas').value;
        const tipo = document.getElementById('tipo').value;
        const mascotas = document.getElementById('mascotas').value;

        // Armamos la URL para llamar al backend (usamos URLSearchParams para manejar los espacios y caracteres raros)
        const parametros = new URLSearchParams();
        if (consulta) parametros.append('consulta', consulta);
        if (personas) parametros.append('personas', personas);
        if (tipo) parametros.append('tipo', tipo);
        if (mascotas) parametros.append('mascotas', mascotas);

        // La ruta asume que el backend corre en el mismo servidor (localhost:8000)
        const urlBusqueda = `/conexiones/publicaciones/buscar?${parametros.toString()}`;

        try {
            // Hacemos la petición a FastAPI
            const respuesta = await fetch(urlBusqueda);
            
            if (!respuesta.ok) {
                throw new Error('Error al conectar con el servidor');
            }

            const publicaciones = await respuesta.json();

            // Dibujamos los resultados
            if (publicaciones.length === 0) {
                contenedorResultados.innerHTML = '<p>No se encontraron cupos con esos filtros.</p>';
                return;
            }

            // Creamos un HTML para las tarjetas
            let htmlResultados = '<h3>Resultados encontrados:</h3><div class="grilla-resultados">';
            
            publicaciones.forEach(pub => {
                htmlResultados += `
                    <div class="tarjeta-publicacion" style="border: 1px solid #ccc; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                        <h4>${pub.titulo}</h4>
                        <p><strong>Ubicación:</strong> ${pub.ubicacion}</p>
                        <p><strong>Precio:</strong> $${pub.precio}</p>
                        <p><strong>Tipo:</strong> ${pub.tipo_vivienda || pub.tipo}</p>
                        <button onclick="alert('Solicitar cupo (En desarrollo)')">Me interesa</button>
                    </div>
                `;
            });
            
            htmlResultados += '</div>';
            contenedorResultados.innerHTML = htmlResultados;

        } catch (error) {
            console.error('Error:', error);
            contenedorResultados.innerHTML = '<p>Hubo un problema al realizar la búsqueda. Intenta nuevamente.</p>';
        }
    });
});