const formulario = document.querySelector("#crear-publicacion");
const mensaje = document.querySelector("#mensaje");
const publicar = formulario.querySelector('button[type="submit"]');
const limpiar = formulario.querySelector('button[type="reset"]');

formulario.addEventListener("reset", () => { mensaje.textContent = ""; });
formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (publicar.disabled) return;
  const datos = new FormData(formulario);
  for (const campo of ["titulo", "ubicacion", "descripcion"]) {
    const valor = String(datos.get(campo) || "").trim();
    if (!valor) {
      mensaje.textContent = "Completa el título, la ubicación y la descripción.";
      return;
    }
    datos.set(campo, valor);
  }
  datos.set("permitir_comentarios", formulario.elements.permitir_comentarios.checked ? "true" : "false");
  const archivo = formulario.elements.imagen.files[0];
  if (!archivo) datos.delete("imagen");
  if (archivo && archivo.size > 5 * 1024 * 1024) {
    mensaje.textContent = "La imagen debe pesar como máximo 5 MB.";
    return;
  }
  publicar.disabled = true;
  limpiar.disabled = true;
  mensaje.textContent = "Guardando…";
  try {
    // FormData envía los campos y la foto juntos.
    // El navegador configura Content-Type automáticamente.
    const respuesta = await fetch("/api/publicaciones", { method: "POST", body: datos });
    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(typeof resultado.detail === "string"
        ? resultado.detail : "Revisa los campos e intenta nuevamente.");
    }
    formulario.reset();
    mensaje.textContent = `¡Publicación creada correctamente! Número: ${resultado.id}.`;
  } catch (error) {
    mensaje.textContent = error instanceof TypeError
      ? "No se pudo conectar con FastAPI. Comprueba que esté funcionando."
      : error.message;
  } finally {
    publicar.disabled = false;
    limpiar.disabled = false;
  }
});
