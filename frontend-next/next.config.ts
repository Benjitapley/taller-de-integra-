import type { NextConfig } from "next";

function fastApiOrigin(): string {
  try {
    const url = new URL(process.env.FASTAPI_ORIGIN ?? "http://127.0.0.1:8000");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.port === "3000")
    ) throw new Error();
    return url.origin;
  } catch {
    throw new Error("FASTAPI_ORIGIN debe ser un origen HTTP(S) sin credenciales, ruta, query ni fragmento; no debe apuntar a Next.js en el puerto 3000.");
  }
}

const nextConfig: NextConfig = {
  // FastAPI utiliza /conexiones/ con barra final. Evita redirecciones opuestas.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Solo configuración del servidor; nunca usar env: ni NEXT_PUBLIC_ aquí.
    const origin = fastApiOrigin();
    const namespaces = ["api", "auth", "imagenes", "static_creacion", "static_principal", "PerfilU"];
    const legacyPages = ["inicio", "crear", "perfil", "mis-publicaciones", "editar-publicacion"];

    return {
      beforeFiles: [
        ...namespaces.map((namespace) => ({
          source: `/${namespace}/:path*`,
          destination: `${origin}/${namespace}/:path*`,
        })),
        { source: "/conexiones", destination: `${origin}/conexiones/` },
        { source: "/conexiones/:path+", destination: `${origin}/conexiones/:path+` },
      ],
      // Los WebP en public/Iconos conservan prioridad y funcionan sin FastAPI.
      afterFiles: [{ source: "/Iconos/:path*", destination: `${origin}/Iconos/:path*` }],
      // Lista explícita: no captura /, /navegacion, /_next ni rutas inexistentes.
      // Una futura página React tendrá prioridad sobre su equivalente HTML.
      fallback: [
        ...legacyPages.filter((page) => page !== "inicio").map((page) => ({ source: `/${page}`, destination: `${origin}/${page}` })),
        ...legacyPages.map((page) => ({ source: `/legacy/${page}`, destination: `${origin}/${page}` })),
        { source: "/legacy/acceso", destination: `${origin}/` },
        { source: "/acceso", destination: `${origin}/` },
      ],
    };
  },
};

export default nextConfig;
