"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function CreatePublicationPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    form.set("tipo", "Compartida");
    form.set("permitir_comentarios", "false");

    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/web-api/publicaciones", {
        method: "POST",
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
      setMessage("No se pudo completar la operación. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  }

  return <main>
    <PageHeader title="Crear publicación" description="Publica un espacio disponible o una búsqueda para compartir vivienda." />
    <Card>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Título</span>
            <input name="titulo" required maxLength={200} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Categoría</span>
            <select name="categoria" required defaultValue="ofrezco" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}>
              <option value="ofrezco">Ofrezco</option>
              <option value="busco">Busco</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Tipo de vivienda</span>
            <select name="tipo_vivienda" required defaultValue="departamento" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}>
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
              <option value="habitacion">Habitación</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Ubicación</span>
            <input name="ubicacion" required maxLength={250} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Precio</span>
            <input name="precio" type="number" min="0" step="1000" required style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Cupos</span>
            <input name="cupos_totales" type="number" min="1" max="100" required style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span>Mascotas</span>
            <select name="mascota" defaultValue="no" style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}>
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
          <textarea name="descripcion" rows={6} required maxLength={5000} style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }} />
        </label>

        {message ? <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{message}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <Button type="button" variant="secondary" onClick={() => router.push("/mis-publicaciones")}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar publicación"}</Button>
        </div>
      </form>
    </Card>
  </main>;
}
