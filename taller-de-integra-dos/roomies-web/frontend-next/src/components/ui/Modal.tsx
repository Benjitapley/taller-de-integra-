"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Icon from "./Icon";
import styles from "./ui.module.css";

export default function Modal({ open, onClose, title, children, drawer = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previous = document.body.style.overflow;
    dialog?.showModal();
    closeButton.current?.focus();
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, [open]);

  return <dialog ref={ref} className={`${styles.modal} ${drawer ? styles.drawer : ""}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={(event) => {
    // Strict Mode can queue a close event during effect cleanup, then reopen.
    if (open && !event.currentTarget.open) onClose();
  }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter((item) => item.tabIndex >= 0 && item.getClientRects().length > 0);
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <button type="button" className={styles.scrim} tabIndex={-1} aria-label="Cerrar desde el fondo" onClick={onClose} />
    <div className={styles.modalSurface}>
      <div className={styles.modalHeader}><h2 id={titleId}>{title}</h2><button ref={closeButton} type="button" className={styles.close} aria-label="Cerrar diálogo" onClick={onClose}><Icon name="close" /></button></div>
      {children}
    </div>
  </dialog>;
}
