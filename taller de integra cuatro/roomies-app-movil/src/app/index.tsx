import { Redirect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { estaAutenticado } = useAuth();
  return <Redirect href={estaAutenticado ? "/(tabs)" : "/login"} />;
}
