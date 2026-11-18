import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader, PageSkeleton } from "@/components/ui/card";
import { ExchangeFacts } from "@/components/exchange-facts";
import { ArrowLeftIcon, GiftIcon, LockIcon } from "@/components/icons";
import { getMyPreferences } from "@/lib/data";
import { loadExchangeContext } from "@/lib/exchange-context";
import { daysUntil, describeDaysUntil, formatDateTime } from "@/lib/format";
import { JoinAsOrganizerButton, LeaveExchangeButton, MyParticipationForm } from "./participation-forms";

export const metadata: Metadata = { title: "Intercambio" };

async function ExchangeDetail({
  params,
  searchParams,
}: {
  params: PageProps<"/intercambios/[id]">["params"];
  searchParams: PageProps<"/intercambios/[id]">["searchParams"];
}) {
  const { id } = await params;
  const query = await searchParams;
  const { exchange, participants, me, isOrganizer } = await loadExchangeContext(id, `/intercambios/${id}`);
  const prefs = me ? await getMyPreferences(me.id) : null;
  const drawn = exchange.status === "drawn";
  const days = daysUntil(exchange.gift_date, new Date());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/intercambios" className="inline-flex items-center gap-1 text-sm text-muted hover:text-pine-800">
          <ArrowLeftIcon className="size-4" /> Mis intercambios
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {exchange.is_demo ? <Badge tone="gold">Demostración</Badge> : null}
          {drawn ? <Badge tone="red">Sorteado</Badge> : <Badge tone="green">Abierto a participantes</Badge>}
          {isOrganizer ? <Badge>Organizas</Badge> : null}
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold text-pine-900 sm:text-4xl">{exchange.name}</h1>
      </div>

      {query.bienvenida ? (
        <Alert tone="success" title="¡Ya estás dentro!">
          Cuando quien organiza haga el sorteo, aquí podrás descubrir a quién te tocó.
        </Alert>
      ) : null}

      <ExchangeFacts
        giftDate={exchange.gift_date}
        budget={exchange.budget}
        currency={exchange.currency}
        participantCount={participants.length}
        countdown={describeDaysUntil(days)}
      />

      {me && drawn ? (
        <section className="relative overflow-hidden rounded-2xl bg-pine-800 p-6 text-white sm:p-8">
          <div className="absolute -right-6 -top-6 size-32 rounded-full bg-berry-600/30" aria-hidden="true" />
          <GiftIcon className="relative size-9 text-white" />
          <h2 className="relative mt-3 font-display text-2xl font-semibold">¡El sorteo ya se realizó!</h2>
          <p className="relative mt-1 text-pine-100">Descubre en privado a quién le vas a regalar.</p>
          <ButtonLink href={`/intercambios/${exchange.id}/mi-amigo-secreto`} variant="accent" size="lg" className="relative mt-5">
            Descubre a quién te tocó
          </ButtonLink>
        </section>
      ) : null}

      {!drawn ? (
        <Alert tone="info" title="Esperando el sorteo">
          {isOrganizer
            ? "Comparte el enlace de invitación y, cuando todas las personas estén registradas, realiza el sorteo desde el panel."
            : "Quien organiza hará el sorteo cuando todas las personas estén registradas. Vuelve después para ver a quién te tocó."}
        </Alert>
      ) : drawn && exchange.drawn_at ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <LockIcon className="size-4" /> Sorteo realizado el {formatDateTime(exchange.drawn_at)}. La lista de
          participantes está cerrada.
        </p>
      ) : null}

      {isOrganizer ? (
        <Card className="border-pine-200 bg-pine-50/50">
          <CardHeader
            title="Panel del organizador"
            description="Invitaciones, exclusiones, sorteo y datos del intercambio."
            action={<ButtonLink href={`/intercambios/${exchange.id}/organizar`}>Abrir panel</ButtonLink>}
          />
          {!me && !drawn ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-pine-100 pt-4">
              <p className="text-sm text-muted">No participas en el sorteo.</p>
              <JoinAsOrganizerButton code={exchange.invite_code} />
            </div>
          ) : null}
        </Card>
      ) : null}

      {exchange.rules ? (
        <Card>
          <CardHeader title="Reglas y mensaje" />
          <p className="whitespace-pre-line text-ink">{exchange.rules}</p>
        </Card>
      ) : null}

      <Card aria-labelledby="participantes">
        <CardHeader
          id="participantes"
          title="Participantes"
          description={`${participants.length} ${participants.length === 1 ? "persona" : "personas"}${participants.length < 3 ? " · se necesitan al menos 3 para sortear" : ""}`}
        />
        {participants.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay participantes.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-pine-100 text-xs font-semibold text-pine-800" aria-hidden="true">
                  {p.display_name.charAt(0).toUpperCase()}
                </span>
                {p.display_name}
                {p.id === me?.id ? <span className="text-xs text-muted">(tú)</span> : null}
                {p.user_id === exchange.organizer_id ? <span className="text-xs text-berry-600">organiza</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {me ? (
        <Card aria-labelledby="mis-preferencias">
          <CardHeader
            id="mis-preferencias"
            title="Mis preferencias"
            description="Solo las verá la persona a la que le toque regalarte."
          />
          <MyParticipationForm
            exchangeId={exchange.id}
            locked={drawn}
            defaults={{
              display_name: me.display_name,
              wishlist: prefs?.wishlist ?? "",
              likes: prefs?.likes ?? "",
              avoid: prefs?.avoid ?? "",
            }}
          />
          {!drawn ? (
            <div className="mt-6 border-t border-line pt-4">
              <LeaveExchangeButton exchangeId={exchange.id} />
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

export default function ExchangePage(props: PageProps<"/intercambios/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando intercambio…" />}>
      <ExchangeDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
