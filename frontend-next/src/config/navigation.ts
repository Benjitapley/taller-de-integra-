import type { IconName } from "@/components/ui/Icon";

export const routes = {
  access: "/",
  register: "/registro",
  verify: "/verificar",
  home: "/inicio",
  profile: "/perfil",
  publish: "/publicar",
  guide: "/navegacion",
  legacyAccess: "/acceso",
} as const;

// Enlaces explícitos; no implican registro o verificación satisfactorios.
export const authFlowLinks = {
  login: [{ href: routes.verify, label: "¿Tienes un código? Ir a verificación" }],
  register: [{ href: routes.verify, label: "¿Tienes un código? Ir a verificación" }],
  verify: [
    { href: routes.access, label: "Volver al inicio de sesión" },
    { href: routes.register, label: "Volver al registro" },
  ],
} as const;

type NavigationItem = { label: string; icon: IconName; href?: string; legacy?: boolean };

// Contrato compartido de navegación. Las funciones de negocio viven en features/.
export const navigationItems: readonly NavigationItem[] = [
  { label: "Inicio", icon: "home", href: routes.home },
  { label: "Chat", icon: "chat" },
  { label: "Publicar", icon: "plus", href: routes.publish },
  { label: "Mis publicaciones", icon: "file", href: "/mis-publicaciones" },
  { label: "Mis conexiones", icon: "user", href: "/mis-conexiones" },
  { label: "Mis postulaciones", icon: "file", href: "/mis-postulaciones" },
  { label: "Favoritos", icon: "heart" },
  { label: "Perfil", icon: "user", href: routes.profile },
  { label: "Ajustes", icon: "settings" },
];
