"use client";

import { useState } from "react";
import { createExchangeAction } from "@/app/actions/exchanges";
import { ActionForm } from "@/components/ui/action-form";
import { CheckboxField, SubmitButton, TextField } from "@/components/ui/fields";
import { ExchangeFormFields } from "../exchange-form-fields";

export function CreateExchangeForm({ defaultName, minDate }: { defaultName: string; minDate: string }) {
  const [participates, setParticipates] = useState(true);
  return (
    <ActionForm action={createExchangeAction} aria-label="Crear intercambio">
      <ExchangeFormFields minDate={minDate} />

      <fieldset className="space-y-3 rounded-xl border border-line bg-paper/60 p-4">
        <legend className="px-1 text-sm font-semibold text-pine-900">Tu participación</legend>
        <CheckboxField
          name="participates"
          label="Yo también participo en el sorteo"
          checked={participates}
          onChange={(e) => setParticipates(e.currentTarget.checked)}
          hint="Aunque participes, no podrás ver las asignaciones de las demás personas."
        />
        {participates ? (
          <TextField name="display_name" label="Tu nombre en este intercambio" defaultValue={defaultName} maxLength={60} required />
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-dashed border-[#eadbb4] bg-gold-100/40 p-4">
        <legend className="px-1 text-sm font-semibold text-[#6b4f0f]">Modo demostración</legend>
        <CheckboxField
          name="is_demo"
          label="Agregar 4 participantes ficticios para probar"
          hint="Se marcan con «(demo)». Nadie puede iniciar sesión como ellos y sus resultados no son visibles. Úsalo solo para probar la app."
        />
      </fieldset>

      <SubmitButton className="w-full" size="lg" pendingLabel="Creando…">
        Crear intercambio
      </SubmitButton>
    </ActionForm>
  );
}
