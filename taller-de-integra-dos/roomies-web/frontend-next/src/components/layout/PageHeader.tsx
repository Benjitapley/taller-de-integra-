import styles from "./AppShell.module.css";

export default function PageHeader({ title, description }: { title: string; description: string }) {
  return <header className={styles.pageHeader}><h1>{title}</h1><p>{description}</p></header>;
}
