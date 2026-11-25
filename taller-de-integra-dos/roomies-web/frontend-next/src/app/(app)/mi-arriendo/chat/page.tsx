import MemberPageGate from "@/features/recorrido/MemberPageGate";
import ChatPreviewPage from "@/features/recorrido/ChatPreviewPage";
import MemberAccessGate from "@/features/recorrido/MemberAccessGate";

export default function ChatPage() {
  return <MemberPageGate><MemberAccessGate><ChatPreviewPage /></MemberAccessGate></MemberPageGate>;
}
