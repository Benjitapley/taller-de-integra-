const ubicacion =
  document.querySelector("#ubicacion");

const sugerencias =
  document.querySelector("#sugerencias-ubicacion");

const estado =
  document.querySelector("#estado-ubicacion");


let temporizador;

let solicitudActual;

let version = 0;


// =========================================================
// CUANDO ESCRIBIMOS UNA UBICACIÓN
// =========================================================

ubicacion.addEventListener(
  "input",
  () => {

    clearTimeout(
      temporizador
    );


    solicitudActual?.abort();


    const miVersion =
      ++version;


    const texto =
      ubicacion.value.trim();


    sugerencias.replaceChildren();

    estado.textContent = "";


    // Esperar mínimo 3 caracteres
    if (
      texto.length < 3
    ) {

      return;

    }


    // Esperar medio segundo antes de consultar
    temporizador =
      setTimeout(
        async () => {

          const controlador =
            new AbortController();


          solicitudActual =
            controlador;


          estado.textContent =
            "Buscando ubicaciones…";


          try {

            const respuesta =
              await fetch(
                `/api/ubicaciones?texto=${encodeURIComponent(texto)}`,
                {
                  signal:
                    controlador.signal
                }
              );


            if (!respuesta.ok) {

              throw new Error(
                "No se pudieron consultar las ubicaciones."
              );

            }


            const direcciones =
              await respuesta.json();


            // Si ya escribimos otra cosa,
            // ignoramos esta respuesta vieja.

            if (
              miVersion !== version
            ) {

              return;

            }


            // Agregar sugerencias
            for (
              const direccion
              of direcciones
            ) {

              const opcion =
                document.createElement(
                  "option"
                );


              opcion.value =
                direccion;


              sugerencias.appendChild(
                opcion
              );

            }


            if (
              direcciones.length
            ) {

              estado.textContent =
                "Selecciona una sugerencia o completa tu dirección.";

            } else {

              estado.textContent =
                "Sin coincidencias. Puedes escribir tu dirección.";

            }

          }


          catch (error) {

            if (
              error.name === "AbortError"
              ||
              miVersion !== version
            ) {

              return;

            }


            estado.textContent =
              "No se pudieron cargar sugerencias. Puedes escribir la dirección.";

          }

        },

        500
      );

  }
);


// =========================================================
// CUANDO SE LIMPIA EL FORMULARIO
// =========================================================

ubicacion.form.addEventListener(
  "reset",
  () => {

    clearTimeout(
      temporizador
    );


    solicitudActual?.abort();


    version++;


    sugerencias.replaceChildren();


    estado.textContent =
      "";

  }
);