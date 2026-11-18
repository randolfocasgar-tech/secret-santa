/** Traduce errores de Supabase/PostgREST/Auth a mensajes claros en español. */

const DB_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Tu sesión expiró. Inicia sesión de nuevo.",
  NOT_FOUND_OR_FORBIDDEN: "No encontramos el intercambio o no tienes permiso para administrarlo.",
  NOT_ENOUGH_PARTICIPANTS: "Se necesitan al menos 3 participantes para sortear.",
  IMPOSSIBLE_CONSTRAINTS:
    "Con las exclusiones actuales el sorteo es imposible. Elimina alguna exclusión o agrega más participantes.",
  ALREADY_DRAWN: "El sorteo ya se realizó. Actualiza la página para ver el estado.",
  EXCHANGE_LOCKED: "El sorteo ya se realizó: los participantes y las exclusiones están bloqueados.",
  CONFIRMATION_REQUIRED: "Debes confirmar que quieres invalidar el sorteo anterior.",
  STALE_VERSION: "El sorteo cambió mientras confirmabas. Actualiza la página e inténtalo de nuevo.",
  NOT_DRAWN: "Este intercambio todavía no se ha sorteado.",
  INVALID_INVITE: "El enlace de invitación no es válido o fue reemplazado.",
  ALREADY_JOINED: "Ya formas parte de este intercambio.",
  DUPLICATE_NAME: "Ya hay alguien con ese nombre en el intercambio. Agrega una inicial o un apodo.",
  INVALID_DISPLAY_NAME: "Escribe tu nombre.",
  TOO_MANY_PARTICIPANTS: "Este intercambio alcanzó el máximo de 200 participantes.",
  NOT_A_PARTICIPANT: "No participas en este intercambio.",
  INVALID_EXCLUSION: "Elige dos personas distintas que participen en el intercambio.",
  DUPLICATE_EXCLUSION:
    "Ya existe una exclusión entre estas dos personas. Elimínala si quieres cambiar su dirección.",
  INVALID_NAME: "Escribe un nombre para el intercambio.",
  INVALID_DATE: "La fecha de entrega debe ser hoy o una fecha futura.",
  INVALID_BUDGET: "El presupuesto debe ser un número mayor o igual a 0.",
  INVALID_CURRENCY: "Elige una moneda válida.",
  NOT_DEMO: "Solo los intercambios de demostración admiten participantes ficticios.",
};

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.",
  user_already_exists: "Ya existe una cuenta con ese correo. Inicia sesión.",
  email_exists: "Ya existe una cuenta con ese correo. Inicia sesión.",
  weak_password: "La contraseña es demasiado débil. Usa al menos 8 caracteres.",
  over_email_send_rate_limit: "Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  email_address_invalid: "El correo no es válido.",
  signup_disabled: "El registro está deshabilitado en este momento.",
  otp_expired: "El enlace expiró o ya se usó. Solicita uno nuevo.",
};

export const GENERIC_ERROR = "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.";

type MaybeError = { message?: string; hint?: string | null; code?: string | null } | null | undefined;

export function dbErrorCode(error: MaybeError): string | null {
  if (!error?.message) return null;
  return /^[A-Z_]+$/.test(error.message) ? error.message : null;
}

export function translateDbError(error: MaybeError): string {
  if (!error) return GENERIC_ERROR;
  const code = dbErrorCode(error);
  // El "hint" del servidor trae detalles específicos (p. ej. quién queda sin opciones).
  if (code && error.hint) return error.hint;
  if (code && DB_MESSAGES[code]) return DB_MESSAGES[code];
  if (error.message && /fetch failed|network|ECONNREFUSED/i.test(error.message)) {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (error.code === "PGRST301" || error.code === "42501") {
    return "No tienes permiso para realizar esta acción.";
  }
  return GENERIC_ERROR;
}

export function translateAuthError(error: MaybeError): string {
  if (!error) return GENERIC_ERROR;
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  if (error.message && /invalid login credentials/i.test(error.message)) return AUTH_MESSAGES.invalid_credentials;
  if (error.message && /email not confirmed/i.test(error.message)) return AUTH_MESSAGES.email_not_confirmed;
  if (error.message && /already registered/i.test(error.message)) return AUTH_MESSAGES.user_already_exists;
  if (error.message && /fetch failed|network/i.test(error.message)) {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  return GENERIC_ERROR;
}
