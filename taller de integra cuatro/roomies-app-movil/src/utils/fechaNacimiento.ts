/**
 * M4-A01 · Utilidades del registro móvil.
 * En pantalla usamos DD/MM/AAAA y para los datos del usuario, AAAA-MM-DD.
 */
export function formatearFechaNacimiento(texto: string): string {
  const digitos = texto.replace(/\D/g, "").slice(0, 8);

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

type ResultadoFechaNacimiento =
  | { valido: true; fechaISO: string; edad: number }
  | { valido: false; error: string };

function esBisiesto(anio: number): boolean {
  return anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
}

/**
 * Valida una fecha real, que no sea futura y que corresponda a una persona
 * de 18 años cumplidos. `hoy` permite probar los límites sin depender del reloj.
 * La validación en la app NO sustituye la validación del servidor.
 */
export function validarFechaNacimiento(
  entrada: string,
  hoy: Date = new Date(),
): ResultadoFechaNacimiento {
  if (!entrada.trim()) {
    return { valido: false, error: "Ingresa tu fecha de nacimiento." };
  }

  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(entrada.trim());
  if (!partes) {
    return { valido: false, error: "Usa el formato DD/MM/AAAA." };
  }

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const anio = Number(partes[3]);
  const diasPorMes = [
    31,
    esBisiesto(anio) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];

  if (anio < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) {
    return { valido: false, error: "Ingresa una fecha de nacimiento válida." };
  }

  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();

  if (
    anio > anioActual ||
    (anio === anioActual && mes > mesActual) ||
    (anio === anioActual && mes === mesActual && dia > diaActual)
  ) {
    return { valido: false, error: "La fecha de nacimiento no puede ser futura." };
  }

  let edad = anioActual - anio;
  if (mesActual < mes || (mesActual === mes && diaActual < dia)) {
    edad -= 1;
  }

  if (edad < 18) {
    return { valido: false, error: "Debes tener al menos 18 años para registrarte." };
  }

  const fechaISO = `${partes[3]}-${partes[2]}-${partes[1]}`;
  return { valido: true, fechaISO, edad };
}
