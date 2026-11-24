import MemberPageGate from "@/features/recorrido/MemberPageGate";
import TasksPreviewPage from "@/features/recorrido/TasksPreviewPage";

export default function TasksPage() {
  return <MemberPageGate><TasksPreviewPage /></MemberPageGate>;
}
