import Button from "@/components/ui/Button";
import styles from "./auth.module.css";

// Pending follows the actual request; no artificial delay or simulated success.
export default function SubmitButton({ children, pending = false, name, value, variant = "primary", pendingLabel = "Procesando…" }: {
  children: React.ReactNode; pending?: boolean; name?: string; value?: string;
  variant?: "primary" | "secondary"; pendingLabel?: string;
}) {
  return <Button className={styles.submit} type="submit" name={name} value={value} variant={variant} disabled={pending} aria-busy={pending}>
    {pending ? <><span className={styles.spinner} aria-hidden="true" />{pendingLabel}</> : children}
  </Button>;
}
