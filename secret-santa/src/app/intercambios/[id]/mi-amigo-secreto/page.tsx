import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageSkeleton } from "@/components/ui/card";
import { ArrowLeftIcon, GiftIcon } from "@/components/icons";
import { getMyAssignmentStatus } from "@/lib/data";
import { loadExchangeContext } from "@/lib/exchange-context";
import { formatGiftDate, formatMoney } from "@/lib/format";
import { GiftReveal } from "./gift-reveal";

export const metadata: Metadata = { title: "Descubre a quién te tocó" };

async function Reveal({ params }: { params: PageProps<"/intercambios/[id]/mi-amigo-secreto">["params"] }) {
  const { id } = await params;
  const { exchange, me } = await loadExchangeContext(id, `/intercambios/${id}/mi-amigo-secreto`);
  const back = (
    <Link href={`/intercambios/${exchange.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-pine-800">
      <ArrowLeftIcon className="size-4" /> {exchange.name}
    </Link>
  );

  if (!me) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          title="No participas en este sorteo"
          description="Solo las personas que participan tienen una asignación."
          action={<ButtonLink href={`/intercambios/${exchange.id}`} variant="secondary">Volver</ButtonLink>}
        />
      </div>
    );
  }

  // Solo se consulta si existe una asignación; el nombre se pide al pulsar el botón.
  const status = exchange.status === "drawn" ? await getMyAssignmentStatus(exchange.id) : null;

  if (!status?.has_assignment) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={<GiftIcon className="size-10" />}
          title="Aún no se realiza el sorteo"
          description="Cuando quien organiza haga el sorteo, aquí podrás descubrir a quién te tocó. Vuelve más tarde."
          action={<ButtonLink href={`/intercambios/${exchange.id}`} variant="secondary">Volver al intercambio</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-pine-900">Descubre a quién te tocó</h1>
        <p className="mt-2 text-muted">
          Asegúrate de que nadie esté mirando tu pantalla. Solo tú puedes ver este resultado.
        </p>
      </div>
      <GiftReveal
        exchangeId={exchange.id}
        exchangeName={exchange.name}
        budget={formatMoney(exchange.budget, exchange.currency)}
        giftDate={formatGiftDate(exchange.gift_date)}
        previouslyRevealed={Boolean(status.revealed_at)}
      />
    </div>
  );
}

export default function RevealPage(props: PageProps<"/intercambios/[id]/mi-amigo-secreto">) {
  return (
    <div className="mx-auto max-w-lg">
      <Suspense fallback={<PageSkeleton label="Cargando…" />}>
        <Reveal params={props.params} />
      </Suspense>
    </div>
  );
}
