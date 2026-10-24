import type { HTMLAttributes } from "react";
import styles from "./ui.module.css";

export default function Card({ className = "", soft = false, ...props }: HTMLAttributes<HTMLDivElement> & { soft?: boolean }) {
  return <div className={`${styles.card} ${soft ? styles.soft : ""} ${className}`} {...props} />;
}
