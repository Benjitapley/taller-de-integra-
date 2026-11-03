import AuthScreen from "./AuthScreen";

export default function AccessPlaceholder() {
  // Compatibilidad con imports de SCRUM-66; el formulario usa el adaptador web seguro.
  return <AuthScreen mode="login" />;
}
