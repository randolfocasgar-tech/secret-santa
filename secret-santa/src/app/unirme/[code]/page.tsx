import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageSkeleton } from "@/components/ui/card";
import { ExchangeFacts } from "@/components/exchange-facts";
import { getCurrentUser } from "@/lib/auth";
import { getInvitePreview, getProfile } from "@/lib/data";
import { extractInviteCode } from "@/lib/invite";
import { JoinExchangeForm } from "../join-forms";

export const metadata: Metadata = { title: "Invitación" };

async function Invite({ params }: { params: PageProps<"/unirme/[code]">["params"] }) {
  const { code: rawCode } = await params;
  const code = extractInviteCode(decodeURIComponent(rawCode));
  const preview = code ? await getInvitePreview(code) : null;

  if (!code || !preview) {
    return (
      <EmptyState
        title="Invitación no válida"
        description="El enlace no existe o quien organiza generó uno nuevo. Pide que te compartan el enlace actualizado."
        action={<ButtonLink href="/unirme" variant="secondary">Probar con otro enlace</ButtonLink>}
      />
    );
  }

  const user = await getCurrentUser();
  const next = `/unirme/${code}`;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-berry-600">{preview.organizer_name} te invitó a</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-pine-900">{preview.name}</h1>
      </div>

      <ExchangeFacts
        giftDate={preview.gift_date}
        budget={preview.budget}
        currency={preview.currency}
        participantCount={preview.participant_count}
      />
      {preview.rules ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-pine-900">Reglas y mensaje</h2>
          <p className="whitespace-pre-line text-sm text-ink">{preview.rules}</p>
        </Card>
      ) : null}

      {preview.is_participant ? (
        <Alert tone="success" title="Ya estás en este intercambio">
          <ButtonLink href={`/intercambios/${preview.exchange_id}`} size="sm" className="mt-2">
            Ir al intercambio
          </ButtonLink>
        </Alert>
      ) : preview.status === "drawn" ? (
        <Alert tone="warning" title="El sorteo ya se realizó">
          Ya no es posible unirse. Si deberías participar, pide a quien organiza que reabra el intercambio.
        </Alert>
      ) : !user ? (
        <Card>
          <h2 className="font-display text-lg font-semibold text-pine-900">Para unirte necesitas una cuenta</h2>
          <p className="mt-1 text-sm text-muted">
            Así podrás entrar después y descubrir, en privado, a quién te tocó regalarle.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href={`/registro?next=${encodeURIComponent(next)}`}>Crear cuenta</ButtonLink>
            <ButtonLink href={`/iniciar-sesion?next=${encodeURIComponent(next)}`} variant="secondary">
              Ya tengo cuenta
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <JoinCard code={code} userId={user.id} isOrganizer={preview.is_member} />
      )}
    </div>
  );
}

async function JoinCard({ code, userId, isOrganizer }: { code: string; userId: string; isOrganizer: boolean }) {
  const profile = await getProfile(userId);
  return (
    <Card>
      <h2 className="mb-1 font-display text-lg font-semibold text-pine-900">
        {isOrganizer ? "Participar en tu intercambio" : "Únete"}
      </h2>
      <p className="mb-4 text-sm text-muted">
        Cuéntale a tu amigo secreto qué te gustaría. Usamos las preferencias de tu perfil como punto de partida.
      </p>
      <JoinExchangeForm
        code={code}
        defaults={{
          display_name: profile?.display_name ?? "",
          wishlist: profile?.wishlist ?? "",
          likes: profile?.likes ?? "",
          avoid: profile?.avoid ?? "",
        }}
      />
    </Card>
  );
}

export default function InvitePage(props: PageProps<"/unirme/[code]">) {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<PageSkeleton label="Cargando invitación…" />}>
        <Invite params={props.params} />
      </Suspense>
    </div>
  );
}
