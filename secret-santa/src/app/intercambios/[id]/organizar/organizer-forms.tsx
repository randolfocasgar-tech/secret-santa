"use client";

import {
  addDemoParticipantAction,
  addExclusionAction,
  deleteExchangeAction,
  drawAction,
  redrawAction,
  regenerateInviteAction,
  removeExclusionAction,
  removeParticipantAction,
  updateExchangeAction,
} from "@/app/actions/exchanges";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckboxField, SelectField, SubmitButton, TextField } from "@/components/ui/fields";
import { ExchangeFormFields, type ExchangeDefaults } from "../../exchange-form-fields";

export function RegenerateInviteButton({ exchangeId }: { exchangeId: string }) {
  return (
    <ConfirmDialog
      triggerLabel="Generar enlace nuevo"
      triggerVariant="ghost"
      title="¿Generar un enlace nuevo?"
      description="El enlace actual dejará de funcionar. Las personas que ya se unieron no se ven afectadas."
      action={regenerateInviteAction}
      confirmLabel="Generar enlace nuevo"
      pendingLabel="Generando…"
    >
      <input type="hidden" name="exchange_id" value={exchangeId} />
    </ConfirmDialog>
  );
}

export function RemoveParticipantButton({ participantId, name, isMe }: { participantId: string; name: string; isMe: boolean }) {
  return (
    <ConfirmDialog
      triggerLabel={<span>Quitar<span className="sr-only"> a {name}</span></span>}
      triggerVariant="ghost"
      triggerSize="sm"
      title={isMe ? "¿Dejar de participar?" : `¿Quitar a ${name}?`}
      description={
        isMe
          ? "Seguirás organizando el intercambio, pero no entrarás en el sorteo."
          : "Se eliminarán también sus exclusiones. Podrá volver a unirse con el enlace mientras no se haya sorteado."
      }
      action={removeParticipantAction}
      confirmLabel="Quitar"
      confirmVariant="accent"
      pendingLabel="Quitando…"
    >
      <input type="hidden" name="participant_id" value={participantId} />
    </ConfirmDialog>
  );
}

export function AddDemoParticipantForm({ exchangeId }: { exchangeId: string }) {
  return (
    <ActionForm action={addDemoParticipantAction} resetOnSuccess aria-label="Agregar participante ficticio">
      <input type="hidden" name="exchange_id" value={exchangeId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField name="display_name" label="Agregar participante ficticio" placeholder="Elena" maxLength={48} />
        </div>
        <SubmitButton variant="secondary" pendingLabel="Agregando…">
          Agregar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AddExclusionForm({
  exchangeId,
  participants,
}: {
  exchangeId: string;
  participants: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={addExclusionAction} resetOnSuccess aria-label="Agregar exclusión">
      <input type="hidden" name="exchange_id" value={exchangeId} />
      <p className="text-sm font-semibold text-pine-900">Agregar exclusión</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField name="giver_id" label="Persona" defaultValue="">
          <option value="" disabled>
            Elige…
          </option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField name="receiver_id" label="No debe tocarle con" defaultValue="">
          <option value="" disabled>
            Elige…
          </option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-pine-900">Dirección</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="radio" name="direction" value="both" defaultChecked className="mt-0.5 size-4 accent-pine-700" />
          <span>
            <strong>En ambas direcciones</strong> — ninguna le regala a la otra
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="radio" name="direction" value="one" className="mt-0.5 size-4 accent-pine-700" />
          <span>
            <strong>Solo en una dirección</strong> — la primera no le regala a la segunda
          </span>
        </label>
      </fieldset>
      <SubmitButton variant="secondary" pendingLabel="Agregando…">
        Agregar exclusión
      </SubmitButton>
    </ActionForm>
  );
}

export function RemoveExclusionButton({ exclusionId }: { exclusionId: string }) {
  return (
    <ActionForm action={removeExclusionAction} className="space-y-0" showSuccess={false}>
      <input type="hidden" name="exclusion_id" value={exclusionId} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Quitando…">
        Quitar<span className="sr-only"> exclusión</span>
      </SubmitButton>
    </ActionForm>
  );
}

export function DrawButton({
  exchangeId,
  disabled,
  participantCount,
}: {
  exchangeId: string;
  disabled: boolean;
  participantCount: number;
}) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-pine-800 px-6 font-medium text-white opacity-50 sm:w-auto"
      >
        Realizar sorteo
      </button>
    );
  }
  return (
    <ConfirmDialog
      triggerLabel="Realizar sorteo"
      triggerVariant="primary"
      triggerSize="lg"
      triggerClassName="w-full sm:w-auto"
      title="¿Realizar el sorteo?"
      description={
        <>
          <p>
            Se asignará en secreto a quién le regala cada una de las {participantCount} personas, respetando las
            exclusiones.
          </p>
          <p>Después del sorteo, la lista de participantes y las exclusiones quedarán bloqueadas.</p>
        </>
      }
      action={drawAction}
      confirmLabel="Sortear ahora"
      pendingLabel="Sorteando…"
    >
      <input type="hidden" name="exchange_id" value={exchangeId} />
    </ConfirmDialog>
  );
}

function RedrawConfirmFields({ exchangeId, version, mode }: { exchangeId: string; version: number; mode: "redraw" | "reopen" }) {
  return (
    <>
      <input type="hidden" name="exchange_id" value={exchangeId} />
      <input type="hidden" name="expected_version" value={version} />
      <input type="hidden" name="mode" value={mode} />
      <Alert tone="warning" live={false}>
        Los resultados actuales dejarán de ser válidos. Quien ya vio a quién le tocó deberá volver a entrar
        {mode === "redraw" ? " para ver su nueva asignación." : " cuando hagas el nuevo sorteo."}
      </Alert>
      <CheckboxField name="confirm" label="Entiendo que se invalidarán los resultados anteriores." />
    </>
  );
}

export function RedrawButtons({ exchangeId, version }: { exchangeId: string; version: number }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <ConfirmDialog
        triggerLabel="Repetir sorteo"
        triggerVariant="secondary"
        title="¿Repetir el sorteo?"
        description="Se hará un sorteo nuevo con los mismos participantes y exclusiones."
        action={redrawAction}
        confirmLabel="Sí, repetir sorteo"
        confirmVariant="accent"
        pendingLabel="Sorteando…"
      >
        <RedrawConfirmFields exchangeId={exchangeId} version={version} mode="redraw" />
      </ConfirmDialog>
      <ConfirmDialog
        triggerLabel="Anular y reabrir"
        triggerVariant="ghost"
        title="¿Anular el sorteo y reabrir?"
        description="Podrás agregar o quitar participantes y exclusiones, y luego sortear de nuevo."
        action={redrawAction}
        confirmLabel="Sí, anular sorteo"
        confirmVariant="accent"
        pendingLabel="Anulando…"
      >
        <RedrawConfirmFields exchangeId={exchangeId} version={version} mode="reopen" />
      </ConfirmDialog>
    </div>
  );
}

export function EditExchangeForm({ exchangeId, defaults }: { exchangeId: string; defaults: ExchangeDefaults }) {
  return (
    <ActionForm action={updateExchangeAction} aria-label="Editar datos del intercambio">
      <input type="hidden" name="exchange_id" value={exchangeId} />
      <ExchangeFormFields defaults={defaults} />
      <SubmitButton variant="secondary" pendingLabel="Guardando…">
        Guardar cambios
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteExchangeButton({ exchangeId, name }: { exchangeId: string; name: string }) {
  return (
    <ConfirmDialog
      triggerLabel="Eliminar intercambio"
      triggerVariant="danger"
      title={`¿Eliminar «${name}»?`}
      description="Esta acción no se puede deshacer. Todas las personas perderán acceso al intercambio y a sus resultados."
      action={deleteExchangeAction}
      confirmLabel="Eliminar definitivamente"
      confirmVariant="accent"
      pendingLabel="Eliminando…"
    >
      <input type="hidden" name="exchange_id" value={exchangeId} />
      <CheckboxField name="confirm" label="Sí, quiero eliminar este intercambio." />
    </ConfirmDialog>
  );
}
