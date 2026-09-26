const formulario = document.querySelector("#crear-publicacion");
const mensaje = document.querySelector("#mensaje");
const publicar = formulario.querySelector('button[type="submit"]');
const limpiar = formulario.querySelector('button[type="reset"]');

formulario.addEventListener("reset", () => {
  mensaje.textContent = "";
});

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (publicar.disabled) return;

  // Recoge todos los campos del formulario, incluida la imagen.
  const datos = new FormData(formulario);

  for (const campo of ["titulo", "ubicacion", "descripcion"]) {
    const valor = String(datos.get(campo) || "").trim();

    if (!valor) {
      mensaje.textContent = `Completa el campo: ${campo}.`;
      return;
    }

    datos.set(campo, valor);
  }

  // Un checkbox desmarcado no se incluye automáticamente en FormData.
  datos.set(
    "permitir_comentarios",
    formulario.elements.permitir_comentarios.checked ? "true" : "false"
  );

  const archivo = formulario.elements.imagen.files[0];

  if (!archivo) {
    datos.delete("imagen");
  } else if (archivo.size > 5 * 1024 * 1024) {
    mensaje.textContent = "La imagen debe pesar como máximo 5 MB.";
    return;
  }

  publicar.disabled = true;
  limpiar.disabled = true;
  mensaje.textContent = "Guardando…";

  try {
    const respuesta = await fetch("/api/publicaciones", {
      method: "POST",
      body: datos
    });

    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      let detalle = `Error HTTP ${respuesta.status}`;

      // FastAPI devuelve una lista cuando falla la validación.
      if (Array.isArray(resultado.detail)) {
        detalle = resultado.detail.map((error) => {
          const campo = (error.loc || [])
            .filter((parte) => parte !== "body")
            .join(".");

          return `${campo || "Formulario"}: ${error.msg}`;
        }).join(" | ");
      } else if (typeof resultado.detail === "string") {
        detalle = resultado.detail;
      }

      throw new Error(detalle);
    }

    formulario.reset();

    mensaje.textContent =
      `¡Publicación creada correctamente! Número: ${resultado.id}.`;
  } catch (error) {
    mensaje.textContent = error instanceof TypeError
      ? "No se pudo conectar con el servidor. Comprueba que FastAPI siga encendido."
      : error.message;
  } finally {
    publicar.disabled = false;
    limpiar.disabled = false;
  }
});