import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageSkeleton } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { CreateExchangeForm } from "./create-form";

export const metadata: Metadata = { title: "Crear intercambio" };

async function Form() {
  const user = await requireUser("/intercambios/nuevo");
  const profile = await getProfile(user.id);
  const today = new Date().toISOString().slice(0, 10);
  return <CreateExchangeForm defaultName={profile?.display_name ?? ""} minDate={today} />;
}

export default function NewExchangePage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 font-display text-3xl font-semibold text-pine-900">Crear intercambio</h1>
      <p className="mb-6 text-muted">Después podrás invitar a las personas con un enlace.</p>
      <Card>
        <Suspense fallback={<PageSkeleton />}>
          <Form />
        </Suspense>
      </Card>
    </div>
  );
}
