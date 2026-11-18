import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { JoinCodeForm } from "./join-forms";

export const metadata: Metadata = { title: "Unirme a un intercambio" };

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 font-display text-3xl font-semibold text-pine-900">Unirme a un intercambio</h1>
      <p className="mb-6 text-muted">
        Abre el enlace que te compartió quien organiza. Si solo tienes el enlace o el código, pégalo aquí.
      </p>
      <Card>
        <JoinCodeForm />
      </Card>
    </div>
  );
}
