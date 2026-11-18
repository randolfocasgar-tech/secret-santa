export const CURRENCIES: { code: string; label: string }[] = [
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "USD", label: "Dólar estadounidense (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "UYU", label: "Peso uruguayo (UYU)" },
  { code: "BOB", label: "Boliviano (BOB)" },
  { code: "PYG", label: "Guaraní (PYG)" },
  { code: "GTQ", label: "Quetzal (GTQ)" },
  { code: "HNL", label: "Lempira (HNL)" },
  { code: "NIO", label: "Córdoba (NIO)" },
  { code: "CRC", label: "Colón costarricense (CRC)" },
  { code: "PAB", label: "Balboa (PAB)" },
  { code: "DOP", label: "Peso dominicano (DOP)" },
  { code: "VES", label: "Bolívar (VES)" },
  { code: "BRL", label: "Real brasileño (BRL)" },
  { code: "CAD", label: "Dólar canadiense (CAD)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
];

export const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

export function formatMoney(amount: number | string, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Las fechas de entrega son fechas de calendario (YYYY-MM-DD), sin hora. */
export function formatGiftDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("es", { dateStyle: "full", timeZone: "UTC" }).format(d);
}

export function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Días desde "hoy" (en la fecha local dada) hasta la fecha de entrega. */
export function daysUntil(isoDate: string, today: Date): number {
  const target = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

export function describeDaysUntil(days: number): string {
  if (days < 0) return days === -1 ? "Fue ayer" : `Fue hace ${-days} días`;
  if (days === 0) return "¡Es hoy!";
  if (days === 1) return "Falta 1 día";
  return `Faltan ${days} días`;
}
