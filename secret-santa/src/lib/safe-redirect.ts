/** Solo permite rutas internas para evitar redirecciones abiertas. */
export function safeNextPath(next: string | null | undefined, fallback = "/intercambios"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/auth/")) return fallback;
  return next;
}
