import Icon, { type IconName } from "./Icon";
import Card from "./Card";
import styles from "./ui.module.css";

export default function EmptyState({ title, description, icon = "home" }: { title: string; description: string; icon?: IconName }) {
  return <Card className={styles.empty}><span className={styles.iconSquare}><Icon name={icon} size={30} /></span><h3>{title}</h3><p>{description}</p></Card>;
}
