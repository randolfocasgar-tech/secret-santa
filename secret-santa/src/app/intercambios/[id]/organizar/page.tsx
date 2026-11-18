import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, Card, CardHeader, PageSkeleton } from "@/components/ui/card";
import { CopyButton, ShareButton } from "@/components/ui/copy-button";
import { ArrowLeftIcon, LockIcon } from "@/components/icons";
import { getExclusions, getFeasibility, getRevealProgress } from "@/lib/data";
import { loadExchangeContext } from "@/lib/exchange-context";
import { formatDateTime } from "@/lib/format";
import { inviteUrl } from "@/lib/invite";
import { getOrigin } from "@/lib/origin";
import {
  AddDemoParticipantForm,
  AddExclusionForm,
  DeleteExchangeButton,
  DrawButton,
  EditExchangeForm,
  RedrawButtons,
  RegenerateInviteButton,
  RemoveExclusionButton,
  RemoveParticipantButton,
} from "./organizer-forms";

export const metadata: Metadata = { title: "Panel del organizador" };

async function OrganizerPanel({
  params,
  searchParams,
}: {
  params: PageProps<"/intercambios/[id]/organizar">["params"];
  searchParams: PageProps<"/intercambios/[id]/organizar">["searchParams"];
}) {
  const { id } = await params;
  const query = await searchParams;
  const { exchange, participants, me, isOrganizer } = await loadExchangeContext(id, `/intercambios/${id}/organizar`);
  if (!isOrganizer) notFound();

  const drawn = exchange.status === "drawn";
  const enough = participants.length >= 3;
  const [exclusions, feasibility, progress, origin] = await Promise.all([
    getExclusions(exchange.id),
    !drawn && enough ? getFeasibility(exchange.id) : Promise.resolve(null),
    drawn ? getRevealProgress(exchange.id) : Promise.resolve(null),
    getOrigin(),
  ]);
  const url = inviteUrl(origin, exchange.invite_code);
  const nameOf = new Map(participants.map((p) => [p.id, p.display_name]));
  const canDraw = !drawn && enough && feasibility?.feasible === true;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/intercambios/${exchange.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-pine-800">
          <ArrowLeftIcon className="size-4" /> Volver al intercambio
        </Link>
        <p className="mt-3 text-sm font-medium text-berry-600">Panel del organizador</p>
        <h1 className="font-display text-3xl font-semibold text-pine-900">{exchange.name}</h1>
        {exchange.is_demo ? (
          <Badge tone="gold" className="mt-2">
            Modo demostración: incluye participantes ficticios
          </Badge>
        ) : null}
      </div>

      {query.creado ? (
        <Alert tone="success" title="¡Intercambio creado!">
          Copia el enlace de invitación y compártelo con tu grupo.
        </Alert>
      ) : null}

      <Alert tone="info" title="Tu privacidad como organizador" live={false}>
        Puedes administrar el intercambio, pero la app no te muestra quién le regala a quién. Si participas, verás
        solo tu propia asignación, como cualquier otra persona.
      </Alert>

      {/* 1. Invitación */}
      <Card aria-labelledby="invitacion">
        <CardHeader
          id="invitacion"
          title="Invitación"
          description={
            drawn
              ? "El sorteo ya se realizó: el enlace ya no permite unirse."
              : "Cualquiera con este enlace puede unirse. Solo sirve para unirse: no muestra resultados."
          }
        />
        <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
          <label htmlFor="invite-url" className="sr-only">
            Enlace de invitación
          </label>
          <input
            id="invite-url"
            readOnly
            value={url}
            className="w-full truncate bg-transparent font-mono text-sm text-ink focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton value={url} />
          <ShareButton url={url} title={exchange.name} />
          <RegenerateInviteButton exchangeId={exchange.id} />
        </div>
      </Card>

      {/* 2. Participantes */}
      <Card aria-labelledby="participantes">
        <CardHeader
          id="participantes"
          title={`Participantes (${participants.length})`}
          description={
            drawn ? (
              <span className="inline-flex items-center gap-1">
                <LockIcon className="size-4" /> Bloqueados desde el sorteo.
              </span>
            ) : enough ? (
              "Revisa que estén todas las personas antes de sortear."
            ) : (
              `Faltan ${3 - participants.length} para el mínimo de 3.`
            )
          }
        />
        {participants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
            Todavía no se ha unido nadie. Comparte el enlace de invitación.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {p.display_name} {p.id === me?.id ? <span className="text-sm font-normal text-muted">(tú)</span> : null}
                  </p>
                  {p.is_demo ? <p className="text-xs text-[#7a5a12]">Participante ficticio</p> : null}
                </div>
                {!drawn ? <RemoveParticipantButton participantId={p.id} name={p.display_name} isMe={p.id === me?.id} /> : null}
              </li>
            ))}
          </ul>
        )}
        {exchange.is_demo && !drawn ? (
          <div className="mt-4 border-t border-line pt-4">
            <AddDemoParticipantForm exchangeId={exchange.id} />
          </div>
        ) : null}
      </Card>

      {/* 3. Exclusiones */}
      <Card aria-labelledby="exclusiones">
        <CardHeader
          id="exclusiones"
          title="Exclusiones"
          description="Evita que ciertas personas se toquen en el sorteo."
        />
        <div className="mb-4 space-y-1.5 rounded-xl bg-paper p-4 text-sm text-ink">
          <p>
            <strong className="text-pine-800">En ambas direcciones (⇄):</strong> ninguna de las dos personas puede
            regalarle a la otra. Ideal para parejas o personas que viven juntas.
          </p>
          <p>
            <strong className="text-pine-800">En una sola dirección (→):</strong> solo la primera persona no puede
            regalarle a la segunda; la segunda sí podría regalarle a la primera.
          </p>
        </div>
        {exclusions.length === 0 ? (
          <p className="text-sm text-muted">No hay exclusiones. Cualquiera puede tocarle a cualquiera (excepto a sí mismo).</p>
        ) : (
          <ul className="divide-y divide-line">
            {exclusions.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between gap-3 py-2.5">
                <p className="min-w-0 text-sm">
                  <span className="font-medium">{nameOf.get(ex.giver_id)}</span>{" "}
                  <span aria-hidden="true" className="px-1 text-berry-600">
                    {ex.bidirectional ? "⇄" : "→"}
                  </span>
                  <span className="sr-only">{ex.bidirectional ? " y " : " no le regala a "}</span>
                  <span className="font-medium">{nameOf.get(ex.receiver_id)}</span>
                  <span className="block text-xs text-muted">
                    {ex.bidirectional
                      ? "No se regalan entre sí"
                      : `${nameOf.get(ex.giver_id)} no le regala a ${nameOf.get(ex.receiver_id)}`}
                  </span>
                </p>
                {!drawn ? <RemoveExclusionButton exclusionId={ex.id} /> : null}
              </li>
            ))}
          </ul>
        )}
        {!drawn && participants.length >= 2 ? (
          <div className="mt-4 border-t border-line pt-4">
            <AddExclusionForm
              exchangeId={exchange.id}
              participants={participants.map((p) => ({ id: p.id, name: p.display_name }))}
            />
          </div>
        ) : null}
        {drawn ? (
          <p className="mt-3 inline-flex items-center gap-1 text-sm text-muted">
            <LockIcon className="size-4" /> Bloqueadas desde el sorteo.
          </p>
        ) : null}
      </Card>

      {/* 4. Sorteo */}
      <Card aria-labelledby="sorteo" className={drawn ? "" : "border-pine-200"}>
        <CardHeader id="sorteo" title="Sorteo" />
        {drawn ? (
          <div className="space-y-4">
            <Alert tone="success" title="Sorteo realizado" live={false}>
              {exchange.drawn_at ? `Se realizó el ${formatDateTime(exchange.drawn_at)}. ` : null}
              {progress ? `${progress.revealed} de ${progress.total} personas ya vieron a quién les tocó.` : null}
            </Alert>
            <RedrawButtons exchangeId={exchange.id} version={exchange.draw_version} />
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <StatusDot ok={enough} />
                {enough
                  ? `${participants.length} participantes (mínimo 3)`
                  : `Se necesitan al menos 3 participantes (hay ${participants.length})`}
              </li>
              {enough ? (
                <li className="flex items-start gap-2">
                  <StatusDot ok={feasibility?.feasible === true} />
                  <span>{feasibility?.feasible ? "Las exclusiones permiten un sorteo válido" : feasibility?.message}</span>
                </li>
              ) : null}
            </ul>
            {enough && feasibility && !feasibility.feasible ? (
              <Alert tone="error" title="El sorteo no es posible todavía">
                {feasibility.message} Corrige las exclusiones arriba.
              </Alert>
            ) : null}
            <DrawButton exchangeId={exchange.id} disabled={!canDraw} participantCount={participants.length} />
          </div>
        )}
      </Card>

      {/* 5. Datos */}
      <Card aria-labelledby="datos">
        <CardHeader id="datos" title="Datos del intercambio" description="Puedes editarlos incluso después del sorteo." />
        <EditExchangeForm
          exchangeId={exchange.id}
          defaults={{
            name: exchange.name,
            gift_date: exchange.gift_date,
            budget: exchange.budget,
            currency: exchange.currency,
            rules: exchange.rules,
          }}
        />
      </Card>

      <Card aria-labelledby="peligro" className="border-berry-100">
        <CardHeader
          id="peligro"
          title="Eliminar intercambio"
          description="Se borran el intercambio, sus participantes, exclusiones y resultados. No se puede deshacer."
        />
        <DeleteExchangeButton exchangeId={exchange.id} name={exchange.name} />
      </Card>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${ok ? "bg-pine-600" : "bg-berry-500"}`}
      aria-label={ok ? "Cumplido" : "Pendiente"}
      role="img"
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

export default function OrganizerPage(props: PageProps<"/intercambios/[id]/organizar">) {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando panel…" />}>
      <OrganizerPanel params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
