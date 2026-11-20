export function resolverUrlFoto(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;
  try {
    const url = texto.startsWith("/") && !texto.startsWith("//")
      ? new URL(texto, process.env.EXPO_PUBLIC_API_URL)
      : new URL(texto);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
