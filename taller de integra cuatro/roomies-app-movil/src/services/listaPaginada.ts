import type { ErrorHttp } from "@/types/Http";

export type Pagina<T> = { items: T[]; siguiente_cursor: string | null };
export type ResultadoPagina<T> = { exito: true; datos: Pagina<T>; estadoHttp: number } | ErrorHttp;
export type EstadoLista<T> = { items: T[]; cursor: string | null; cargando: boolean; iniciada: boolean; error: ErrorHttp | null };

/** Una sola petición por contexto; un fallo conserva filas y cursor para reintentar. */
export class ListaPaginada<T> {
  private generacion = 0;
  private oyentes = new Set<() => void>();
  private cursores = new Set<string>();
  private valor: EstadoLista<T> = this.vacia();

  constructor(private obtener: (cursor?: string) => Promise<ResultadoPagina<T>>, private clave: (item: T) => number) {}

  private vacia(): EstadoLista<T> { return { items: [], cursor: null, cargando: false, iniciada: false, error: null }; }
  estado = () => this.valor;
  suscribir = (oyente: () => void) => { this.oyentes.add(oyente); return () => { this.oyentes.delete(oyente); }; };
  private publicar(valor: EstadoLista<T>) { this.valor = valor; this.oyentes.forEach(oyente => oyente()); }
  reiniciar = () => { this.generacion++; this.cursores.clear(); this.publicar(this.vacia()); };

  cargar = async () => {
    if (this.valor.cargando || (this.valor.iniciada && this.valor.cursor === null)) return;
    const generacion = this.generacion;
    const cursor = this.valor.cursor ?? undefined;
    this.publicar({ ...this.valor, cargando: true, error: null });
    let resultado: ResultadoPagina<T>;
    try { resultado = await this.obtener(cursor); }
    catch { resultado = { exito: false, codigo: "red", error: "No se pudo cargar la lista. Reintenta." }; }
    if (generacion !== this.generacion) return;
    if (!resultado.exito) {
      const denegado = [401, 403, 404].includes(resultado.estadoHttp ?? 0);
      this.publicar({ ...(denegado ? this.vacia() : this.valor), cargando: false, error: resultado });
      return;
    }
    if (resultado.datos.siguiente_cursor !== null && this.cursores.has(resultado.datos.siguiente_cursor)) {
      this.publicar({ ...this.valor, cargando: false, error: { exito: false, codigo: "respuesta_invalida", error: "El servicio no avanzó de página. Reintenta." } });
      return;
    }
    if (resultado.datos.siguiente_cursor) this.cursores.add(resultado.datos.siguiente_cursor);
    const items = [...new Map([...this.valor.items, ...resultado.datos.items].map(item => [this.clave(item), item])).values()];
    this.publicar({ items, cursor: resultado.datos.siguiente_cursor, cargando: false, iniciada: true, error: null });
  };
}
