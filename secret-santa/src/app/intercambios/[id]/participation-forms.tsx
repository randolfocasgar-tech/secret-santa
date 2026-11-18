"use client";

import { joinExchangeAction, leaveExchangeAction, updateMyParticipationAction } from "@/app/actions/exchanges";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton, TextAreaField, TextField } from "@/components/ui/fields";

export function MyParticipationForm({
  exchangeId,
  locked,
  defaults,
}: {
  exchangeId: string;
  locked: boolean;
  defaults: { display_name: string; wishlist: string; likes: string; avoid: string };
}) {
  return (
    <ActionForm action={updateMyParticipationAction} aria-label="Mis preferencias">
      <input type="hidden" name="exchange_id" value={exchangeId} />
      {locked ? <input type="hidden" name="display_name" value={defaults.display_name} /> : null}
      <TextField
        name={locked ? "display_name_locked" : "display_name"}
        label="Mi nombre en este intercambio"
        defaultValue={defaults.display_name}
        maxLength={60}
        disabled={locked}
        hint={locked ? "El nombre ya no se puede cambiar porque el sorteo se realizó." : undefined}
        required
      />
      <TextAreaField name="wishlist" label="Ideas de regalo" optional maxLength={2000} defaultValue={defaults.wishlist} />
      <TextAreaField name="likes" label="Gustos" optional maxLength={2000} defaultValue={defaults.likes} />
      <TextAreaField name="avoid" label="Prefiero evitar" optional maxLength={2000} defaultValue={defaults.avoid} />
      <SubmitButton pendingLabel="Guardando…">Guardar preferencias</SubmitButton>
    </ActionForm>
  );
}

export function LeaveExchangeButton({ exchangeId }: { exchangeId: string }) {
  return (
    <ConfirmDialog
      triggerLabel="Salir del intercambio"
      triggerVariant="danger"
      triggerSize="sm"
      title="¿Salir del intercambio?"
      description="Dejarás de participar en el sorteo. Podrás volver a unirte con el enlace mientras no se haya sorteado."
      action={leaveExchangeAction}
      confirmLabel="Sí, salir"
      confirmVariant="accent"
      pendingLabel="Saliendo…"
    >
      <input type="hidden" name="exchange_id" value={exchangeId} />
    </ConfirmDialog>
  );
}

export function JoinAsOrganizerButton({ code }: { code: string }) {
  return (
    <ConfirmDialog
      triggerLabel="Participar yo también"
      triggerSize="sm"
      title="Participar en el sorteo"
      description="Entrarás al sorteo como una persona más. Seguirás sin poder ver las asignaciones de los demás."
      action={joinExchangeAction}
      confirmLabel="Unirme"
      pendingLabel="Uniéndote…"
    >
      <input type="hidden" name="code" value={code} />
      <TextField name="display_name" label="Tu nombre en este intercambio" maxLength={60} required />
    </ConfirmDialog>
  );
}
