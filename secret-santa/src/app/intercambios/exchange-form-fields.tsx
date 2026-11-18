"use client";

import { SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { CURRENCIES } from "@/lib/format";

export type ExchangeDefaults = {
  name?: string;
  gift_date?: string;
  budget?: number | string;
  currency?: string;
  rules?: string;
};

export function ExchangeFormFields({ defaults = {}, minDate }: { defaults?: ExchangeDefaults; minDate?: string }) {
  return (
    <>
      <TextField
        name="name"
        label="Nombre del intercambio"
        placeholder="Navidad en familia 2026"
        maxLength={80}
        defaultValue={defaults.name}
        required
      />
      <TextField
        name="gift_date"
        label="Fecha de entrega de regalos"
        type="date"
        min={minDate}
        defaultValue={defaults.gift_date}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="budget"
          label="Presupuesto por regalo"
          inputMode="decimal"
          placeholder="500"
          defaultValue={defaults.budget !== undefined ? String(defaults.budget) : undefined}
          required
        />
        <SelectField name="currency" label="Moneda" defaultValue={defaults.currency ?? "MXN"} required>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>
      <TextAreaField
        name="rules"
        label="Mensaje o reglas"
        optional
        maxLength={2000}
        rows={4}
        defaultValue={defaults.rules}
        placeholder="Nos vemos en casa de la abuela a las 7 pm. Envuelve el regalo y no pongas tu nombre."
      />
    </>
  );
}
