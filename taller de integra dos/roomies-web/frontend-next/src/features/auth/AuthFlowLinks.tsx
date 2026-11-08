import Link from "next/link";
import { authFlowLinks } from "@/config/navigation";
import styles from "./auth.module.css";

export default function AuthFlowLinks({ screen }: { screen: keyof typeof authFlowLinks }) {
  return <nav aria-label="Pasos de acceso" className={styles.flowLinks}>
    {authFlowLinks[screen].map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
  </nav>;
}
