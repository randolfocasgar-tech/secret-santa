"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { translateDbError } from "@/lib/errors";
import { type ActionState, bool, isUuid, str, validateExchangeForm } from "@/lib/form";
import { CURRENCY_CODES } from "@/lib/format";
import { extractInviteCode } from "@/lib/invite";
import { createClient } from "@/lib/supabase/server";
import type { MyAssignment } from "@/lib/types";

function yesterdayIso(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

const SESSION_EXPIRED: ActionState = { error: "Tu sesión expiró. Inicia sesión de nuevo." };

// ---------------------------------------------------------------------------
// Crear / editar / eliminar
// ---------------------------------------------------------------------------

export async function createExchangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;

  const { data, fieldErrors } = validateExchangeForm(formData, CURRENCY_CODES, yesterdayIso());
  const participates = bool(formData, "participates");
  const displayName = str(formData, "display_name", 60);
  const errors = { ...fieldErrors };
  if (participates && !displayName) errors.display_name = "Escribe tu nombre para participar.";
  if (Object.keys(errors).length || !data) return { fieldErrors: errors };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_exchange", {
    p_name: data.name,
    p_gift_date: data.giftDate,
    p_budget: data.budget,
    p_currency: data.currency,
    p_rules: data.rules,
    p_organizer_participates: participates,
    p_organizer_display_name: displayName || null,
    p_is_demo: bool(formData, "is_demo"),
  });
  if (error) return { error: translateDbError(error) };
  redirect(`/intercambios/${id as string}/organizar?creado=1`);
}

export async function updateExchangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  const { data, fieldErrors } = validateExchangeForm(formData, CURRENCY_CODES, null);
  if (fieldErrors || !data) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_exchange", {
    p_exchange_id: exchangeId,
    p_name: data.name,
    p_gift_date: data.giftDate,
    p_budget: data.budget,
    p_currency: data.currency,
    p_rules: data.rules,
  });
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Cambios guardados.", ts: Date.now() };
}

export async function deleteExchangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  if (!bool(formData, "confirm")) return { error: "Marca la casilla para confirmar." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_exchange", { p_exchange_id: exchangeId });
  if (error) return { error: translateDbError(error) };
  redirect("/intercambios?eliminado=1");
}

export async function regenerateInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_invite_code", { p_exchange_id: exchangeId });
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Generamos un enlace nuevo. El anterior ya no funciona.", ts: Date.now() };
}

// ---------------------------------------------------------------------------
// Unirse / participación
// ---------------------------------------------------------------------------

export async function goToInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = extractInviteCode(str(formData, "invite", 500));
  if (!code) {
    return { fieldErrors: { invite: "Pega el enlace completo que te compartieron o el código de invitación." } };
  }
  redirect(`/unirme/${code}`);
}

export async function joinExchangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const code = extractInviteCode(str(formData, "code", 100));
  const displayName = str(formData, "display_name", 60);
  if (!code) return { error: "El enlace de invitación no es válido." };
  if (!displayName) return { fieldErrors: { display_name: "Escribe tu nombre." } };

  const supabase = await createClient();
  const { data: exchangeId, error } = await supabase.rpc("join_exchange", {
    p_code: code,
    p_display_name: displayName,
    p_wishlist: str(formData, "wishlist"),
    p_likes: str(formData, "likes"),
    p_avoid: str(formData, "avoid"),
  });
  if (error) {
    if (error.message === "DUPLICATE_NAME") return { fieldErrors: { display_name: translateDbError(error) } };
    return { error: translateDbError(error) };
  }
  redirect(`/intercambios/${exchangeId as string}?bienvenida=1`);
}

export async function updateMyParticipationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  const displayName = str(formData, "display_name", 60);
  if (!displayName) return { fieldErrors: { display_name: "Escribe tu nombre." } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_participation", {
    p_exchange_id: exchangeId,
    p_display_name: displayName,
    p_wishlist: str(formData, "wishlist"),
    p_likes: str(formData, "likes"),
    p_avoid: str(formData, "avoid"),
  });
  if (error) {
    if (error.message === "DUPLICATE_NAME") return { fieldErrors: { display_name: translateDbError(error) } };
    return { error: translateDbError(error) };
  }
  refresh();
  return { ok: true, message: "Tus preferencias se guardaron.", ts: Date.now() };
}

export async function leaveExchangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_exchange", { p_exchange_id: exchangeId });
  if (error) return { error: translateDbError(error) };
  redirect("/intercambios?salida=1");
}

// ---------------------------------------------------------------------------
// Organizador: participantes y exclusiones
// ---------------------------------------------------------------------------

export async function removeParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const participantId = str(formData, "participant_id", 36);
  if (!isUuid(participantId)) return { error: "Participante no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_participant", { p_participant_id: participantId });
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Participante eliminado.", ts: Date.now() };
}

export async function addDemoParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  const name = str(formData, "display_name", 48);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  if (!name) return { fieldErrors: { display_name: "Escribe un nombre." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_demo_participant", { p_exchange_id: exchangeId, p_display_name: name });
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Participante ficticio agregado.", ts: Date.now() };
}

export async function addExclusionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  const giverId = str(formData, "giver_id", 36);
  const receiverId = str(formData, "receiver_id", 36);
  const direction = str(formData, "direction", 10);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  const fieldErrors: Record<string, string> = {};
  if (!isUuid(giverId)) fieldErrors.giver_id = "Elige una persona.";
  if (!isUuid(receiverId)) fieldErrors.receiver_id = "Elige una persona.";
  if (!fieldErrors.giver_id && giverId === receiverId) fieldErrors.receiver_id = "Elige a otra persona.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_exclusion", {
    p_exchange_id: exchangeId,
    p_giver_id: giverId,
    p_receiver_id: receiverId,
    p_bidirectional: direction !== "one",
  });
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Exclusión agregada.", ts: Date.now() };
}

export async function removeExclusionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exclusionId = str(formData, "exclusion_id", 36);
  if (!isUuid(exclusionId)) return { error: "Exclusión no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_exclusion", { p_exclusion_id: exclusionId });
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Exclusión eliminada.", ts: Date.now() };
}

// ---------------------------------------------------------------------------
// Sorteo
// ---------------------------------------------------------------------------

export async function drawAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  if (!isUuid(exchangeId)) return { error: "Intercambio no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("draw_exchange", { p_exchange_id: exchangeId });
  if (error) return { error: translateDbError(error) };
  refresh();
  const count = (data as { participants?: number } | null)?.participants ?? 0;
  return {
    ok: true,
    message: `¡Sorteo realizado! ${count} personas ya pueden descubrir a quién les tocó.`,
    ts: Date.now(),
  };
}

export async function redrawAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const exchangeId = str(formData, "exchange_id", 36);
  const expectedVersion = Number(str(formData, "expected_version", 10));
  const mode = str(formData, "mode", 10); // "redraw" | "reopen"
  if (!isUuid(exchangeId) || !Number.isInteger(expectedVersion)) return { error: "Solicitud no válida." };
  if (!bool(formData, "confirm")) {
    return { fieldErrors: { confirm: "Marca la casilla para confirmar que entiendes lo que pasará." } };
  }

  const supabase = await createClient();
  const args = { p_exchange_id: exchangeId, p_expected_version: expectedVersion, p_confirm: true };
  const { error } =
    mode === "reopen"
      ? await supabase.rpc("reopen_exchange", args)
      : await supabase.rpc("redraw_exchange", args);
  if (error) return { error: translateDbError(error) };
  refresh();
  return {
    ok: true,
    message:
      mode === "reopen"
        ? "Sorteo anulado. Ya puedes editar participantes y exclusiones."
        : "Sorteo repetido. Los resultados anteriores ya no son válidos; avisa a los participantes.",
    ts: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Descubrir mi asignación
// ---------------------------------------------------------------------------

export type RevealResult =
  | { ok: true; assignment: MyAssignment }
  | { ok: false; error: string };

export async function revealMyAssignmentAction(exchangeId: string): Promise<RevealResult> {
  if (!isUuid(exchangeId)) return { ok: false, error: "Intercambio no válido." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Inicia sesión de nuevo." };
  const supabase = await createClient();
  // La función solo devuelve la asignación de quien llama (auth.uid()).
  const { data, error } = await supabase.rpc("get_my_assignment", {
    p_exchange_id: exchangeId,
    p_mark_revealed: true,
  });
  if (error) return { ok: false, error: translateDbError(error) };
  const row = (data as MyAssignment[] | null)?.[0];
  if (!row) return { ok: false, error: "Todavía no tienes una asignación en este intercambio." };
  return { ok: true, assignment: row };
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const displayName = str(formData, "display_name", 60);
  if (!displayName) return { fieldErrors: { display_name: "Escribe tu nombre." } };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      wishlist: str(formData, "wishlist"),
      likes: str(formData, "likes"),
      avoid: str(formData, "avoid"),
    })
    .eq("id", user.id);
  if (error) return { error: translateDbError(error) };
  refresh();
  return { ok: true, message: "Perfil actualizado.", ts: Date.now() };
}
