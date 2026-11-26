"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

import styles from "./publicaciones.module.css";
import PublicationErrorNotice from "./PublicationErrorNotice";
import PublicationPreview, { emptySelection } from "./PublicationPreview";
import LocationFields from "./LocationFields";
import ImageFields, { type PublicationImage } from "./ImageFields";
import { validatePublicationForm, publicationError, type PublicationError } from "./validation";
import PublicationRules, { setPublicationRules } from "./PublicationRules";

type Publication = {
  id_publicacion: number;
  id_region?: number;
  id_comuna?: number;
  imagenes?: PublicationImage[];
  reglas?: string[];
  reglas_arrendador?: string[];
  region?: { id: number; nombre: string } | null;
  comuna?: { id: number; nombre: string } | null;
  estado?: string;
  titulo: string;
  tipo_vivienda?: string;
  precio?: number | string;
  cupos_totales?: number | string;
  mascota?: string;
  descripcion?: string;
  tipo?: "Arrendador";
};

export default function EditPublication() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return id && /^[1-9]\d{0,9}$/.test(id) ? <PublicationEditor key={id} id={id} /> : <main><PageHeader title="Editar publicación" description="Selecciona una publicación propia para continuar." /><Card><p role="alert">Selecciona una publicación válida.</p></Card></main>;
}

function PublicationEditor({ id }: { id: string }) {
  const router = useRouter();
  const operation = useRef<string | null>(null);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [error, setError] = useState<PublicationError | null>(null);
  const [preview, setPreview] = useState<FormData | null>(null);
  const [selection, setSelection] = useState(emptySelection);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/web-api/publicaciones/${id}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (!controller.signal.aborted) setError(publicationError(response.status, await response.json().catch(() => null)));
          return;
        }
        const data = await response.json();
        if (!controller.signal.aborted) {
          setPublication(data);
          setSelection({ retained: data.imagenes ?? [], files: [] });
          const form = new FormData();
          for (const name of ["titulo", "precio", "descripcion", "cupos_totales"]) form.set(name, String(data[name] ?? ""));
          form.set("nombre_comuna", data.comuna?.nombre ?? "");
          setPreview(form);
        }
      }).catch(() => {
        if (!controller.signal.aborted) setError(publicationError(503, null));
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  const rules = publication?.reglas_arrendador ?? publication?.reglas ?? [];
  const rulesLocked = publication?.estado !== "Disponible";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || pending) return;

    const form = new FormData(event.currentTarget);
    if (publication?.tipo !== "Arrendador") { setError(publicationError(422, { mensaje: "Solo se pueden editar publicaciones de Arrendador en este release." })); return; }
    form.set("tipo", publication.tipo);
    if (rulesLocked) form.delete("reglas_texto");
    else setPublicationRules(form, rules);

    const invalid = validatePublicationForm(form);
    if (invalid) { setError(publicationError(422, { mensaje: invalid })); return; }
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/web-api/publicaciones/${id}`, {
        method: "PUT",
        body: form,
        credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1", "Idempotency-Key": operation.current ??= crypto.randomUUID() },
        signal: AbortSignal.timeout(25_000),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(publicationError(response.status, payload));
        return;
      }
      if (payload?.id_publicacion !== Number(id)) {
        setError(publicationError(503, null));
        return;
      }
      setPublication(payload);
      router.push("/mis-publicaciones");
    } catch {
      setError(publicationError(503, null));
    } finally {
      setPending(false);
    }
  }

  if (!id) {
    return <main><PageHeader title="Editar publicación" description="Selecciona una publicación de tu listado para continuar." />
      <Card><p role="alert">No se indicó una publicación para editar.</p></Card>
    </main>;
  }

  return <main>
    <PageHeader title="Editar publicación" description="Actualiza los datos de tu publicación." />
    <Card>
      {loading ? <p>Cargando publicación…</p> : null}
      {!loading && !publication ? <PublicationErrorNotice error={error} /> : null}
      {!loading && publication ? <form onSubmit={onSubmit} onChange={event => {
        operation.current = null;
        const form = new FormData(event.currentTarget);
        const commune = event.currentTarget.querySelector<HTMLSelectElement>("select[data-publication-commune]");
        form.set("nombre_comuna", commune?.value ? commune.selectedOptions[0].text : publication.comuna?.nombre ?? "");
        setPreview(form);
      }} className={styles.editorForm} aria-busy={pending} style={{ display: "grid", gap: 16 }}>
        <fieldset disabled={pending} style={{ display: "grid", gap: 16, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Título</span>
            <input name="titulo" required maxLength={200} defaultValue={publication.titulo} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Tipo de vivienda</span>
            <select name="tipo_vivienda" required defaultValue={publication.tipo_vivienda ? publication.tipo_vivienda[0].toUpperCase() + publication.tipo_vivienda.slice(1).toLowerCase() : "Departamento"}>
              <option value="Departamento">Departamento</option>
              <option value="Casa">Casa</option>
              <option value="Habitacion">Habitación</option>
            </select>
          </label>
          <LocationFields initialRegion={publication.region?.id ?? publication.id_region} initialCommune={publication.comuna?.id ?? publication.id_comuna} />
          <label style={{ display: "grid", gap: 8 }}>
            <span>Precio del arriendo (CLP)</span>
            <input name="precio" type="number" min="0" max="999999999999" step="1" required defaultValue={publication.precio ?? 0} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Capacidad total</span>
            <input name="cupos_totales" type="number" min="1" max="2147483647" required defaultValue={publication.cupos_totales ?? 1} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Mascotas</span>
            <select name="mascota" defaultValue={publication.mascota || "no"}>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
          <ImageFields images={publication.imagenes} onRemoveFile={() => { operation.current = null; }} onSelectionChange={setSelection} />
        </div>

        <label style={{ display: "grid", gap: 8 }}>
          <span>Descripción</span>
          <textarea name="descripcion" rows={6} required maxLength={5000} defaultValue={publication.descripcion || ""} />
        </label>

        <PublicationRules key={id} rules={rules} locked={rulesLocked} onRulesChange={() => { operation.current = null; }} />

        <PublicationPreview form={preview} selection={selection} />
        <PublicationErrorNotice error={error} />
        {pending && <div role="status"><progress aria-label="Subiendo cambios y fotografías" /><p>Enviando los cambios y las fotografías…</p></div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={() => router.push("/mis-publicaciones")}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
        </fieldset>
      </form> : null}
    </Card>
  </main>;
}
