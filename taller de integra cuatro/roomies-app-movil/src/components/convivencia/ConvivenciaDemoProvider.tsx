import { createContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { crearAlmacenConvivenciaDemo, type AlmacenConvivenciaDemo } from "@/stores/convivenciaDemo";

type ContextoDemo = { identidadId: string | null; almacen: AlmacenConvivenciaDemo };
export const ConvivenciaDemoContext = createContext<ContextoDemo | null>(null);

export function ConvivenciaDemoProvider({ children }: { children: ReactNode }) {
  const { usuarioActual } = useAuth();
  const identidadId = usuarioActual?.identidad.id ?? null;
  // Cambiar de cuenta descarta la demo anterior, sin remontar el navegador ni
  // interferir con el callback de confirmación o la restauración de Supabase.
  const contexto = useMemo(() => ({ identidadId, almacen: crearAlmacenConvivenciaDemo() }), [identidadId]);
  return <ConvivenciaDemoContext.Provider value={contexto}>{children}</ConvivenciaDemoContext.Provider>;
}
