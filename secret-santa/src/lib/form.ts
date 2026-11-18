export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Cambia en cada envío para que la UI pueda reaccionar (p. ej. limpiar un formulario). */
  ts?: number;
};

export const initialActionState: ActionState = {};

export function str(formData: FormData, key: string, max = 2000): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function bool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Acepta "1500", "1,500.50", "1500,50". Devuelve null si no es un número válido ≥ 0. */
export function parseBudget(v: string): number | null {
  const cleaned = v.replace(/\s/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})$/.test(cleaned)) normalized = cleaned.replace(",", ".");
  else normalized = cleaned.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? n : null;
}

export type ExchangeInput = {
  name: string;
  giftDate: string;
  budget: number;
  currency: string;
  rules: string;
};

export function validateExchangeForm(
  formData: FormData,
  currencyCodes: Set<string>,
  todayIso: string | null,
): { data?: ExchangeInput; fieldErrors?: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const name = str(formData, "name", 80);
  const giftDate = str(formData, "gift_date", 10);
  const budgetRaw = str(formData, "budget", 20);
  const currency = str(formData, "currency", 3).toUpperCase();
  const rules = str(formData, "rules", 2000);

  if (!name) fieldErrors.name = "Escribe un nombre para el intercambio.";
  if (!isIsoDate(giftDate)) fieldErrors.gift_date = "Elige la fecha de entrega.";
  else if (todayIso && giftDate < todayIso) fieldErrors.gift_date = "La fecha de entrega no puede estar en el pasado.";
  const budget = parseBudget(budgetRaw);
  if (budget === null) fieldErrors.budget = "Escribe un presupuesto válido (por ejemplo, 500).";
  if (!currencyCodes.has(currency)) fieldErrors.currency = "Elige una moneda.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { data: { name, giftDate, budget: budget!, currency, rules } };
}
