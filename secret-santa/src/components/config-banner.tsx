import { isSupabaseConfigured } from "@/lib/env";

/** Aviso visible si faltan las variables de entorno de Supabase. */
export function ConfigBanner() {
  if (isSupabaseConfigured()) return null;
  return (
    <div role="alert" className="bg-gold-100 px-4 py-2 text-center text-sm text-[#6b4f0f]">
      Falta configurar Supabase: copia <code className="font-mono">.env.example</code> a{" "}
      <code className="font-mono">.env.local</code> y completa las variables (ver README).
    </div>
  );
}
