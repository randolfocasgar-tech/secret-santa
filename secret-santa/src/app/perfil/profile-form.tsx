"use client";

import { updateProfileAction } from "@/app/actions/exchanges";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton, TextAreaField, TextField } from "@/components/ui/fields";

export function ProfileForm({
  defaults,
}: {
  defaults: { display_name: string; wishlist: string; likes: string; avoid: string };
}) {
  return (
    <ActionForm action={updateProfileAction} aria-label="Perfil">
      <TextField name="display_name" label="Tu nombre" defaultValue={defaults.display_name} maxLength={60} required />
      <TextAreaField
        name="wishlist"
        label="Ideas de regalo"
        optional
        maxLength={2000}
        defaultValue={defaults.wishlist}
        placeholder="Libros, plantas, algo para la cocina…"
      />
      <TextAreaField name="likes" label="Gustos" optional maxLength={2000} defaultValue={defaults.likes} placeholder="Café, música, deportes…" />
      <TextAreaField name="avoid" label="Prefiero evitar" optional maxLength={2000} defaultValue={defaults.avoid} placeholder="Perfumes, dulces…" />
      <SubmitButton pendingLabel="Guardando…">Guardar perfil</SubmitButton>
    </ActionForm>
  );
}
