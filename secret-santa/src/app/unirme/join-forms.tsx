"use client";

import { goToInviteAction, joinExchangeAction } from "@/app/actions/exchanges";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton, TextAreaField, TextField } from "@/components/ui/fields";

export function JoinCodeForm() {
  return (
    <ActionForm action={goToInviteAction} aria-label="Ingresar invitación">
      <TextField
        name="invite"
        label="Enlace o código de invitación"
        placeholder="https://…/unirme/AbC123…"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        required
      />
      <SubmitButton className="w-full" size="lg" pendingLabel="Buscando…">
        Continuar
      </SubmitButton>
    </ActionForm>
  );
}

export function JoinExchangeForm({
  code,
  defaults,
}: {
  code: string;
  defaults: { display_name: string; wishlist: string; likes: string; avoid: string };
}) {
  return (
    <ActionForm action={joinExchangeAction} aria-label="Unirme al intercambio">
      <input type="hidden" name="code" value={code} />
      <TextField
        name="display_name"
        label="Tu nombre en este intercambio"
        defaultValue={defaults.display_name}
        maxLength={60}
        autoComplete="name"
        hint="Debe ser distinto al de las demás personas del grupo."
        required
      />
      <TextAreaField
        name="wishlist"
        label="Ideas de regalo"
        optional
        maxLength={2000}
        defaultValue={defaults.wishlist}
        placeholder="Un libro de cocina, una planta, calcetines divertidos…"
      />
      <TextAreaField
        name="likes"
        label="Gustos"
        optional
        maxLength={2000}
        defaultValue={defaults.likes}
        placeholder="Café, senderismo, música de los 80…"
      />
      <TextAreaField
        name="avoid"
        label="Prefiero evitar"
        optional
        maxLength={2000}
        defaultValue={defaults.avoid}
        placeholder="Perfumes, dulces, ropa de talla…"
      />
      <p className="text-xs text-muted">
        Tus preferencias solo las verá la persona a la que le toque regalarte. Puedes cambiarlas después.
      </p>
      <SubmitButton className="w-full" size="lg" pendingLabel="Uniéndote…">
        Unirme al intercambio
      </SubmitButton>
    </ActionForm>
  );
}
