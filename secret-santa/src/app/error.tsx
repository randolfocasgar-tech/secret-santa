"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const notConfigured = error.message?.includes("NEXT_PUBLIC_SUPABASE_URL");
  return (
    <EmptyState
      title={notConfigured ? "Falta configurar Supabase" : "Algo salió mal"}
      description={
        notConfigured
          ? "Copia .env.example a .env.local, completa las variables de Supabase y reinicia el servidor."
          : "No pudimos cargar esta página. Revisa tu conexión e inténtalo de nuevo."
      }
      action={
        <div className="flex gap-2">
          <Button onClick={() => reset()}>Reintentar</Button>
          <ButtonLink href="/" variant="secondary">
            Ir al inicio
          </ButtonLink>
        </div>
      }
    />
  );
}
