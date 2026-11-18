/**
 * Variables de entorno públicas de Supabase. La clave "publishable" (o la
 * antigua "anon") es pública por diseño: la seguridad la dan RLS y las
 * funciones del servidor. Nunca se usa la clave service_role en esta app.
 */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env.local y complétalas.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}
