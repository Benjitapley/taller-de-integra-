"use client";

type ReviewOption<T extends string> = { value: T; label: string };

export default function DevelopmentReviewControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReviewOption<T>[];
  onChange: (value: T) => void;
}) {
  if (process.env.NODE_ENV !== "development") return null;
  return <fieldset style={{ margin: "1rem 0", padding: "0.75rem", border: "1px dashed var(--border, #999)", borderRadius: "0.5rem" }}>
    <legend>Revisión E00 (solo desarrollo)</legend>
    <label htmlFor={`e00-${label}`}>{label}</label>{" "}
    <select id={`e00-${label}`} value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <p role="note" style={{ marginBottom: 0 }}>Los estados y datos de muestra son locales; no representan una respuesta del backend.</p>
  </fieldset>;
}
