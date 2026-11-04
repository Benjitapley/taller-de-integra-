"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function ModalDemo() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>Probar diálogo accesible</Button><Modal title="Demostración de diálogo" open={open} onClose={() => setOpen(false)}><p>Ejemplo de presentación y navegación por teclado. No crea tareas, recordatorios ni documentos.</p><Button variant="secondary" onClick={() => setOpen(false)}>Cerrar ejemplo</Button></Modal></>;
}
