import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, PageSkeleton } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Crear cuenta" };

async function Content({ searchParams }: { searchParams: PageProps<"/registro">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getCurrentUser()) redirect(next);
  return <SignUpForm next={next} />;
}

export default function SignUpPage(props: PageProps<"/registro">) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 font-display text-3xl font-semibold text-pine-900">Crea tu cuenta</h1>
      <p className="mb-6 text-muted">Necesitas una cuenta para unirte o crear intercambios.</p>
      <Card>
        <Suspense fallback={<PageSkeleton />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
