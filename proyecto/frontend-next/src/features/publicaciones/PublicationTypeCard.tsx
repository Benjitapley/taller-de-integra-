import Card from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import styles from "./publication-type.module.css";

export default function PublicationTypeCard({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return <Card className={styles.publicationType}><span className={styles.largeIcon}><Icon name={icon} size={34} /></span><h2>{title}</h2><p>{description}</p><Button variant="secondary" disabled aria-label={`${title}: formulario pendiente`}>Continuar →</Button><small>Formulario pendiente de integración</small></Card>;
}
