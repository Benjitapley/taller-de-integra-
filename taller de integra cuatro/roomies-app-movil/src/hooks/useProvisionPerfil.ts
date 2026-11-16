import { useCallback, useEffect, useState } from "react";
import { asegurarPerfilPropio, type ResultadoProvisionPerfil } from "@/services/provisionPerfilService";
import type { IdentidadSupabase } from "@/types/Auth";

export function useProvisionPerfil(identidad: IdentidadSupabase | null) {
  const identidadId = identidad?.id;
  const correoConfirmado = Boolean(identidad?.email_confirmed_at);
  const metadata = identidad?.user_metadata;
  const nombre = typeof metadata?.nombre === "string" ? metadata.nombre : null;
  const fechaNacimiento = typeof metadata?.fecha_nacimiento === "string" ? metadata.fecha_nacimiento : null;
  const [intento, setIntento] = useState(0);
  const [provision, setProvision] = useState<{
    identidadId: string;
    intento: number;
    resultado: ResultadoProvisionPerfil;
  } | null>(null);

  useEffect(() => {
    if (!identidadId) return;
    let vigente = true;

    async function preparar(id: string) {
      let resultado: ResultadoProvisionPerfil;
      try {
        resultado = await asegurarPerfilPropio({ identidadId: id, correoConfirmado, nombre, fechaNacimiento });
      } catch {
        resultado = { exito: false, codigo: "red", error: "No pudimos preparar tu perfil. Inténtalo otra vez." };
      }
      if (vigente) setProvision({ identidadId: id, intento, resultado });
    }

    // Fuera de onAuthStateChange: el transporte usa getSession del SDK.
    void preparar(identidadId);
    return () => { vigente = false; };
  }, [identidadId, correoConfirmado, nombre, fechaNacimiento, intento]);

  // Descartar el estado de la sesión anterior al salir o cambiar de cuenta.
  if (provision && provision.identidadId !== identidadId) setProvision(null);

  const resultado = provision && provision.identidadId === identidadId && provision.intento === intento
    ? provision.resultado
    : null;
  const reintentar = useCallback(() => setIntento((valor) => valor + 1), []);
  return { resultado, reintentar };
}
