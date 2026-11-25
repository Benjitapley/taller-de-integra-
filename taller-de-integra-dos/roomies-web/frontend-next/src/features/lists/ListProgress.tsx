"use client";
import Button from "@/components/ui/Button";

export default function ListProgress({ loading, loaded, error, count, cursor, retry, more, disabled = false }: {
  loading: boolean; loaded: boolean; error: string; count: number; cursor: string | null;
  retry: () => void; more: () => void; disabled?: boolean;
}) {
  return <div aria-busy={loading}>
    {loading && <p role="status">Cargando lista…</p>}
    {error && <div><p role="alert">{error}{count > 0 ? " Se conservan los elementos cargados." : ""}</p><Button disabled={loading || disabled} onClick={retry}>Reintentar carga</Button></div>}
    {!error && cursor && <Button disabled={loading || disabled} onClick={more}>Cargar más</Button>}
    {loaded && !loading && !error && !cursor && count > 0 && <p role="status">Llegaste al final de la lista.</p>}
  </div>;
}
