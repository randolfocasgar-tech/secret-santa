import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageSkeleton } from "@/components/ui/card";
import { GiftIcon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { listMyExchanges } from "@/lib/data";
import { daysUntil, describeDaysUntil, formatMoney, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Mis intercambios" };

async function ExchangeList({ searchParams }: { searchParams: PageProps<"/intercambios">["searchParams"] }) {
  await requireUser("/intercambios");
  const [params, exchanges] = await Promise.all([searchParams, listMyExchanges()]);
  const today = new Date();

  return (
    <div className="space-y-4">
      {params.eliminado ? <Alert tone="success">El intercambio se eliminó.</Alert> : null}
      {params.salida ? <Alert tone="success">Saliste del intercambio.</Alert> : null}

      {exchanges.length === 0 ? (
        <EmptyState
          icon={<GiftIcon className="size-10" />}
          title="Todavía no tienes intercambios"
          description="Crea uno para tu familia, amistades o trabajo, o únete con el enlace que te compartieron."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <ButtonLink href="/intercambios/nuevo">Crear intercambio</ButtonLink>
              <ButtonLink href="/unirme" variant="secondary">
                Unirme
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {exchanges.map((ex) => {
            const days = daysUntil(ex.gift_date, today);
            return (
              <li key={ex.id}>
                <Link
                  href={`/intercambios/${ex.id}`}
                  className="group block rounded-2xl border border-line bg-card p-4 transition-colors hover:border-pine-200 hover:bg-pine-50/40 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold text-pine-900 group-hover:underline">
                      {ex.name}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.is_demo ? <Badge tone="gold">Demo</Badge> : null}
                      {ex.status === "drawn" ? <Badge tone="red">Sorteado</Badge> : <Badge tone="green">Abierto</Badge>}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatShortDate(ex.gift_date)} · {describeDaysUntil(days)} · {formatMoney(ex.budget, ex.currency)}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {ex.is_organizer ? <Badge>Organizas</Badge> : null}
                    {ex.is_participant ? <Badge>Participas</Badge> : null}
                    <Badge>{ex.participant_count} {ex.participant_count === 1 ? "persona" : "personas"}</Badge>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function MyExchangesPage(props: PageProps<"/intercambios">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-pine-900">Mis intercambios</h1>
          <p className="mt-1 text-muted">Los que organizas y en los que participas.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/unirme" variant="secondary" size="sm">
            Unirme
          </ButtonLink>
          <ButtonLink href="/intercambios/nuevo" size="sm">
            Crear
          </ButtonLink>
        </div>
      </div>
      <Suspense fallback={<PageSkeleton label="Cargando tus intercambios…" />}>
        <ExchangeList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
