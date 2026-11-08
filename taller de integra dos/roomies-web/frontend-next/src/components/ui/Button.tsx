import type { ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

export default function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return <button type={type} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />;
}
