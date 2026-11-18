import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Iniciar sesión" };

async function Content({ searchParams }: { searchParams: PageProps<"/iniciar-sesion">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getCurrentUser()) redirect(next);
  const confirmError = params.error === "confirmacion";
  return (
    <>
      {next.startsWith("/unirme/") ? (
        <Alert tone="info" className="mb-4">
          Inicia sesión para unirte al intercambio al que te invitaron.
        </Alert>
      ) : null}
      {confirmError ? (
        <Alert tone="error" className="mb-4">
          El enlace de confirmación no es válido o ya expiró. Intenta iniciar sesión o vuelve a registrarte.
        </Alert>
      ) : null}
      <SignInForm next={next} />
    </>
  );
}

export default function SignInPage(props: PageProps<"/iniciar-sesion">) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 font-display text-3xl font-semibold text-pine-900">Inicia sesión</h1>
      <p className="mb-6 text-muted">Entra para ver tus intercambios y descubrir a quién te tocó.</p>
      <Card>
        <Suspense fallback={<PageSkeleton />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
