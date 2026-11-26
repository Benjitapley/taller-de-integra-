import MemberPageGate from "@/features/recorrido/MemberPageGate";
import ConnectedTasksPage from "@/features/convivencia/tareas/TasksPage";

export default function TasksPage() {
  return <MemberPageGate><ConnectedTasksPage /></MemberPageGate>;
}
