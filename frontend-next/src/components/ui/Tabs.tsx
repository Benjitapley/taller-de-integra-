"use client";

import { useId, type ReactNode } from "react";
import styles from "./ui.module.css";

export default function Tabs<T extends string>({ items, value, onChange, children, label }: { items: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; children: ReactNode; label: string }) {
  const id = useId();
  return <>
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item, index) => <button key={item.value} type="button" role="tab" id={`${id}-${item.value}`} aria-selected={value === item.value} aria-controls={`${id}-panel`} tabIndex={value === item.value ? 0 : -1} onClick={() => onChange(item.value)} onKeyDown={(event) => {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % items.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else return;
        event.preventDefault();
        onChange(items[next].value);
        document.getElementById(`${id}-${items[next].value}`)?.focus();
      }}>{item.label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`} tabIndex={0} className={styles.tabPanel}>{children}</div>
  </>;
}
