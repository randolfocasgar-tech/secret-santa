const CODE_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Acepta un enlace completo (https://…/unirme/CODIGO) o solo el código.
 * Devuelve el código o null si no parece válido.
 */
export function extractInviteCode(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const match = value.match(/\/unirme\/([A-Za-z0-9_-]+)/);
  const candidate = match ? match[1] : value;
  return CODE_RE.test(candidate) ? candidate : null;
}

export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/unirme/${code}`;
}
