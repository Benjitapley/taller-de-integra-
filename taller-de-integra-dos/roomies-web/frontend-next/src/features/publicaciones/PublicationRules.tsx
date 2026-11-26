"use client";

import { useState, type TextareaHTMLAttributes } from "react";
import Button from "@/components/ui/Button";

export default function PublicationRules({ rules = [], locked = false, onRulesChange, ...props }: {
  rules?: string[];
  locked?: boolean;
  onRulesChange?: () => void;
} & Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">) {
  const [entries, setEntries] = useState(() => rules.length ? rules : [""]);
  return <section aria-label="Reglas del arrendador">
    <h3>Reglas del arrendador (opcional)</h3>
    <input type="hidden" name="reglas_texto" value={entries.join("\n")} />
    {entries.map((text, index) => <div key={index}>
      <label>Regla {index + 1}
        <textarea aria-label={`Regla ${index + 1}`} value={text} readOnly={locked} maxLength={300} rows={props.rows ?? 2} onChange={event => {
          onRulesChange?.();
          setEntries(previous => previous.map((rule, position) => position === index ? event.target.value.replace(/\r?\n/g, " ") : rule));
        }} />
      </label>
      <small>{[...text].length}/300 caracteres</small>
      {!locked && <Button variant="secondary" type="button" onClick={() => { onRulesChange?.(); setEntries(previous => previous.filter((_, position) => position !== index)); }}>Quitar regla {index + 1}</Button>}
    </div>)}
    {!locked && <Button variant="secondary" type="button" disabled={entries.length >= 20} onClick={() => { onRulesChange?.(); setEntries(previous => [...previous, ""]); }}>Agregar regla</Button>}
    <p><small>{locked ? "Las reglas solo se pueden cambiar mientras el aviso esté Disponible." : `${entries.length}/20 reglas. Hasta 300 caracteres cada una.`}</small></p>
  </section>;
}

export function setPublicationRules(form: FormData, previous: string[] = []) {
  const text = String(form.get("reglas_texto") ?? "").trim();
  form.delete("reglas_texto");
  if (text !== previous.join("\n").trim()) {
    form.set("reglas_arrendador", JSON.stringify(text.split("\n").map(rule => rule.trim()).filter(Boolean)));
  }
}
