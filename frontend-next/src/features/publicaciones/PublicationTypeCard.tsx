import Card from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import styles from "./publication-type.module.css";

export default function PublicationTypeCard({ title, description, icon, onSelect }: { title: string; description: string; icon: IconName; onSelect: () => void }) {
  return <Card className={styles.publicationType}><span className={styles.largeIcon}><Icon name={icon} size={34} /></span><h2>{title}</h2><p>{description}</p><Button variant="secondary" onClick={onSelect}>Continuar →</Button></Card>;
}
