import type { TextareaHTMLAttributes } from "react";

export default function PublicationRules({ rules = [], locked = false, ...props }: {
  rules?: string[];
  locked?: boolean;
} & Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">) {
  return <label>
    Reglas del arriendo (opcional)
    <textarea name="reglas_texto" defaultValue={rules.join("\n")} readOnly={locked} rows={props.rows ?? 3} />
    <small>{locked ? "Las reglas solo se pueden cambiar mientras el aviso esté Disponible." : "Una por línea, hasta 20 reglas de 300 caracteres."}</small>
  </label>;
}

export function setPublicationRules(form: FormData, previous: string[] = []) {
  const text = String(form.get("reglas_texto") ?? "").trim();
  form.delete("reglas_texto");
  if (text !== previous.join("\n").trim()) {
    form.set("reglas_arrendador", JSON.stringify(text.split("\n").map(rule => rule.trim()).filter(Boolean)));
  }
}
