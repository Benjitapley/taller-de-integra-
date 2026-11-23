import styles from "./auth.module.css";

export default function FormMessage({ children, error = false }: { children?: React.ReactNode; error?: boolean }) {
  return <div className={error ? styles.errorMessage : styles.formMessage} role={error ? "alert" : "status"} aria-atomic="true">{children}</div>;
}
