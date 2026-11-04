"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Publication = {
  id: number;
  titulo: string;
  categoria?: string;
  tipo_vivienda?: string;
  ubicacion?: string;
  precio?: number | string;
  cupos_totales?: number | string;
  mascota?: string;
  descripcion?: string;
  tipo?: "Arrendador" | "Compartida";
  permitir_comentarios?: boolean;
};

export default function EditPublicationPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return id && /^[1-9]\d{0,9}$/.test(id) ? <PublicationEditor key={id} id={id} /> : <main><PageHeader title="Editar publicación" description="Selecciona una publicación propia para continuar." /><Card><p role="alert">Selecciona una publicación válida.</p></Card></main>;
}

function PublicationEditor({ id }: { id: string }) {
  const router = useRouter();
  const [publication, setPublication] = useState<Publication | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/web-api/publicaciones/${id}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar la publicación para editar.");
        const data = await response.json();
        if (!controller.signal.aborted) setPublication(data);
      }).catch(() => {
        if (!controller.signal.aborted) setMessage("No se pudo cargar la publicación para editar.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || pending) return;

    const form = new FormData(event.currentTarget);
    if (!publication?.tipo) { setMessage("No se pudo determinar el tipo original. Recarga la publicación."); return; }
    form.set("tipo", publication.tipo);
    form.set("permitir_comentarios", form.has("permitir_comentarios") ? "true" : "false");

    setPending(true);
    setMessage("");

    try {
      const response = await fetch(`/web-api/publicaciones/${id}`, {
        method: "PUT",
        body: form,
        credentials: "same-origin",
        headers: { "X-Haycupo-CSRF": "1" },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.detail || "No se pudo guardar la publicación.");
        return;
      }

      router.push("/mis-publicaciones");
    } catch {
      setMessage("No se pudo actualizar la publicación.");
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
      {!loading && !publication ? <p role="alert">{message || "No se pudo cargar esta publicación."}</p> : null}
      {!loading && publication ? <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Título</span>
            <input name="titulo" required maxLength={200} defaultValue={publication.titulo} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Categoría</span>
            <select name="categoria" required defaultValue={publication.categoria || "ofrezco"} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}>
              <option value="ofrezco">Ofrezco</option>
              <option value="busco">Busco</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Tipo de vivienda</span>
            <select name="tipo_vivienda" required defaultValue={publication.tipo_vivienda || "departamento"} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}>
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
              <option value="habitacion">Habitación</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Ubicación</span>
            <input name="ubicacion" required maxLength={250} defaultValue={publication.ubicacion || ""} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Precio</span>
            <input name="precio" type="number" min="0" step="0.01" required defaultValue={publication.precio ?? 0} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Cupos</span>
            <input name="cupos_totales" type="number" min="1" max="2147483647" required defaultValue={publication.cupos_totales ?? 1} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Mascotas</span>
            <select name="mascota" defaultValue={publication.mascota || "no"} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Imagen (opcional)</span>
            <input type="file" name="imagen" accept="image/jpeg,image/png,image/webp" style={{ padding: 10 }} />
          </label>
        </div>

        <label style={{ display: "grid", gap: 8 }}>
          <span>Descripción</span>
          <textarea name="descripcion" rows={6} required maxLength={5000} defaultValue={publication.descripcion || ""} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }} />
        </label>

        <label><input type="checkbox" name="permitir_comentarios" defaultChecked={publication.permitir_comentarios} /> Permitir comentarios</label>
        {message ? <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{message}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={() => router.push("/mis-publicaciones")}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </form> : null}
    </Card>
  </main>;
}
