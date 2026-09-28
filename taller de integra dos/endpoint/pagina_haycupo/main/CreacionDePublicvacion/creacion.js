console.log(
  "creacion.js nuevo cargado"
);


// =========================================================
// ELEMENTOS
// =========================================================

const formulario =
  document.querySelector("#crear-publicacion");


const mensaje =
  document.querySelector("#mensaje");


const publicar =
  document.querySelector("#boton-publicar");


const limpiar =
  document.querySelector("#boton-limpiar");


const botonCerrar =
  document.querySelector("#boton-cerrar");


const idPublicacion =
  document.querySelector("#id-publicacion");


const tituloPagina =
  document.querySelector("#titulo-pagina");


const subtituloPagina =
  document.querySelector("#subtitulo-pagina");


const modoEdicion =
  document.querySelector("#modo-edicion");


const numeroPublicacion =
  document.querySelector("#numero-publicacion");


const contenedorImagen =
  document.querySelector("#contenedor-imagen");


// =========================================================
// VOLVER A CREAR UNA PUBLICACIÓN
// =========================================================

formulario.addEventListener(
  "reset",
  () => {

    setTimeout(
      () => {

        idPublicacion.value =
          "";


        mensaje.textContent =
          "";


        tituloPagina.textContent =
          "Crear publicación";


        subtituloPagina.textContent =
          "Comparte tu arriendo o encuentra un lugar para vivir.";


        modoEdicion.hidden =
          true;


        numeroPublicacion.textContent =
          "";


        publicar.textContent =
          "Publicar";


        publicar.hidden =
          false;


        botonCerrar.hidden =
          true;


        limpiar.textContent =
          "Limpiar formulario";


        contenedorImagen.hidden =
          false;

      },

      0
    );

  }
);


// =========================================================
// CREAR O EDITAR
// =========================================================

formulario.addEventListener(
  "submit",
  async (evento) => {

    evento.preventDefault();


    if (publicar.disabled) {
      return;
    }


    // =====================================================
    // SABER SI ESTAMOS EDITANDO
    // =====================================================

    const editando =
      idPublicacion.value !== "";


    // =====================================================
    // DATOS DEL FORMULARIO
    // =====================================================

    const datos =
      new FormData(formulario);


    // =====================================================
    // LIMPIAR TEXTOS
    // =====================================================

    for (
      const campo
      of [
        "titulo",
        "ubicacion",
        "descripcion"
      ]
    ) {

      const valor =
        String(
          datos.get(campo) || ""
        ).trim();


      if (!valor) {

        mensaje.textContent =
          `Completa el campo: ${campo}.`;

        return;
      }


      datos.set(
        campo,
        valor
      );
    }


    // =====================================================
    // CHECKBOX
    // =====================================================

    datos.set(
      "permitir_comentarios",

      formulario
        .elements
        .permitir_comentarios
        .checked

        ? "true"
        : "false"
    );


    // =====================================================
    // IMAGEN
    // =====================================================

    const archivo =
      formulario
        .elements
        .imagen
        .files[0];


    // Al editar no cambiamos imagen todavía.
    if (editando) {

      datos.delete(
        "imagen"
      );

    } else {

      if (!archivo) {

        datos.delete(
          "imagen"
        );

      }

      else if (
        archivo.size >
        5 * 1024 * 1024
      ) {

        mensaje.textContent =
          "La imagen debe pesar como máximo 5 MB.";

        return;
      }

    }


    // =====================================================
    // DESACTIVAR BOTONES
    // =====================================================

    publicar.disabled =
      true;


    limpiar.disabled =
      true;


    botonCerrar.disabled =
      true;


    if (editando) {

      mensaje.textContent =
        "Guardando cambios…";

    } else {

      mensaje.textContent =
        "Creando publicación…";

    }


    try {


      // ===================================================
      // ENDPOINT
      // ===================================================

      let url;

      let metodo;


      if (editando) {

        url =
          `/api/publicaciones/${idPublicacion.value}`;

        metodo =
          "PATCH";

      } else {

        url =
          "/api/publicaciones";

        metodo =
          "POST";

      }


      // ===================================================
      // FETCH
      // ===================================================

      const respuesta =
        await fetch(
          url,
          {
            method: metodo,
            body: datos
          }
        );


      const resultado =
        await respuesta
          .json()
          .catch(
            () => ({})
          );


      // ===================================================
      // ERRORES
      // ===================================================

      if (!respuesta.ok) {

        let detalle =
          `Error HTTP ${respuesta.status}`;


        if (
          Array.isArray(
            resultado.detail
          )
        ) {

          detalle =
            resultado.detail
              .map(
                (error) => {

                  const campo =
                    (error.loc || [])
                      .filter(
                        (parte) =>
                          parte !== "body"
                      )
                      .join(".");


                  return (
                    `${campo || "Formulario"}: `
                    + error.msg
                  );

                }
              )
              .join(" | ");

        }

        else if (
          typeof resultado.detail
          === "string"
        ) {

          detalle =
            resultado.detail;

        }


        throw new Error(
          detalle
        );

      }


      // ===================================================
      // EDITADO
      // ===================================================

      if (editando) {

        mensaje.textContent =
          "¡Cambios guardados correctamente!";


        console.log(
          "Publicación editada:",
          resultado
        );

      }


      // ===================================================
      // CREADO
      // ===================================================

      else {

        idPublicacion.value =
          resultado.id;


        tituloPagina.textContent =
          "Editar publicación";


        subtituloPagina.textContent =
          "Modifica los datos de tu publicación o ciérrala cuando ya no esté disponible.";


        numeroPublicacion.textContent =
          resultado.id;


        modoEdicion.hidden =
          false;


        publicar.textContent =
          "Guardar cambios";


        limpiar.textContent =
          "Nueva publicación";


        // Mostrar botón cerrar
        botonCerrar.hidden =
          false;


        // La imagen no se edita todavía
        contenedorImagen.hidden =
          true;


        mensaje.textContent =
          `¡Publicación #${resultado.id} creada correctamente! Ahora puedes editarla o cerrarla.`;


        console.log(
          "Publicación creada:",
          resultado
        );

      }

    }


    catch (error) {

      if (
        error instanceof TypeError
      ) {

        mensaje.textContent =
          "No se pudo conectar con el servidor. Comprueba que FastAPI siga encendido.";

      }

      else {

        mensaje.textContent =
          error.message;

      }

    }


    finally {

      publicar.disabled =
        false;


      limpiar.disabled =
        false;


      botonCerrar.disabled =
        false;

    }

  }
);


// =========================================================
// CERRAR PUBLICACIÓN
// =========================================================

botonCerrar.addEventListener(
  "click",
  async () => {

    const id =
      idPublicacion.value;


    if (!id) {

      mensaje.textContent =
        "Primero debes crear una publicación.";

      return;

    }


    const confirmar =
      confirm(
        "¿Seguro que quieres cerrar esta publicación?"
      );


    if (!confirmar) {
      return;
    }


    // =====================================================
    // BLOQUEAR BOTONES
    // =====================================================

    botonCerrar.disabled =
      true;


    publicar.disabled =
      true;


    limpiar.disabled =
      true;


    mensaje.textContent =
      "Cerrando publicación…";


    try {


      // ===================================================
      // PETICIÓN
      // ===================================================

      const respuesta =
        await fetch(
          `/api/publicaciones/${id}/cerrar`,
          {
            method: "PATCH"
          }
        );


      const resultado =
        await respuesta
          .json()
          .catch(
            () => ({})
          );


      // ===================================================
      // ERROR
      // ===================================================

      if (!respuesta.ok) {

        throw new Error(
          resultado.detail
          ||
          `Error HTTP ${respuesta.status}`
        );

      }


      // ===================================================
      // PUBLICACIÓN CERRADA
      // ===================================================

      tituloPagina.textContent =
        "Publicación cerrada";


      subtituloPagina.textContent =
        "Esta publicación ya no se encuentra disponible.";


      mensaje.textContent =
        `¡Publicación #${id} cerrada correctamente!`;


      // Ya no se puede guardar
      publicar.hidden =
        true;


      // Ya está cerrada
      botonCerrar.hidden =
        true;


      // Permitir empezar otra
      limpiar.textContent =
        "Nueva publicación";


      console.log(
        "Publicación cerrada:",
        resultado
      );

    }


    catch (error) {

      mensaje.textContent =
        error.message;

    }


    finally {

      botonCerrar.disabled =
        false;


      publicar.disabled =
        false;


      limpiar.disabled =
        false;

    }

  }
);