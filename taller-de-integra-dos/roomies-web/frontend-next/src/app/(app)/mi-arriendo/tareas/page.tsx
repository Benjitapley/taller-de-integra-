import MemberPageGate from "@/features/recorrido/MemberPageGate";
import TasksPageView from "@/features/recorrido/TasksPage";
import MemberAccessGate from "@/features/recorrido/MemberAccessGate";

export default function TasksPage() {
  return <MemberPageGate><MemberAccessGate><TasksPageView /></MemberAccessGate></MemberPageGate>;
}
