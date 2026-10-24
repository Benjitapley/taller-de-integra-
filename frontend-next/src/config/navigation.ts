import type { IconName } from "@/components/ui/Icon";

export const routes = {
  access: "/",
  home: "/inicio",
  publish: "/publicar",
  guide: "/navegacion",
  legacyAccess: "/acceso",
} as const;

type NavigationItem = { label: string; icon: IconName; href?: string; legacy?: boolean };

// Contrato compartido de navegación. Las funciones de negocio viven en features/.
export const navigationItems: readonly NavigationItem[] = [
  { label: "Inicio", icon: "home", href: routes.home },
  { label: "Chat", icon: "chat" },
  { label: "Publicar", icon: "plus", href: routes.publish },
  { label: "Mis publicaciones", icon: "file", href: "/mis-publicaciones", legacy: true },
  { label: "Favoritos", icon: "heart" },
  { label: "Perfil", icon: "user", href: "/perfil", legacy: true },
  { label: "Ajustes", icon: "settings" },
];
