import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Exchange,
  Exclusion,
  InvitePreview,
  MyExchangeRow,
  Participant,
  Preferences,
  Profile,
} from "@/lib/types";

/**
 * Capa de acceso a datos. Todas las lecturas usan la sesión del usuario, así
 * que RLS decide qué filas puede ver. No existe ninguna función que lea las
 * asignaciones de otras personas.
 */

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, wishlist, likes, avoid")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
});

export const getExchange = cache(async (exchangeId: string): Promise<Exchange | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchanges")
    .select(
      "id, organizer_id, name, gift_date, budget, currency, rules, invite_code, status, draw_version, drawn_at, is_demo, created_at",
    )
    .eq("id", exchangeId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, budget: Number(data.budget) } : null;
});

export const getParticipants = cache(async (exchangeId: string): Promise<Participant[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, exchange_id, user_id, display_name, is_demo, joined_at")
    .eq("exchange_id", exchangeId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

export async function getMyPreferences(participantId: string): Promise<Preferences | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participant_preferences")
    .select("wishlist, likes, avoid")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getExclusions(exchangeId: string): Promise<Exclusion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exclusions")
    .select("id, exchange_id, giver_id, receiver_id, bidirectional")
    .eq("exchange_id", exchangeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMyExchanges(): Promise<MyExchangeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_exchanges");
  if (error) throw error;
  return ((data ?? []) as MyExchangeRow[]).map((r) => ({ ...r, budget: Number(r.budget) }));
}

export async function getInvitePreview(code: string): Promise<InvitePreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite_preview", { p_code: code });
  if (error) throw error;
  const row = (data as InvitePreview[] | null)?.[0];
  return row ? { ...row, budget: Number(row.budget) } : null;
}

export async function getFeasibility(
  exchangeId: string,
): Promise<{ feasible: boolean; code: string; message: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_draw_feasibility", { p_exchange_id: exchangeId });
  if (error) throw error;
  return (data as { feasible: boolean; code: string; message: string }[] | null)?.[0] ?? null;
}

export async function getRevealProgress(exchangeId: string): Promise<{ revealed: number; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_reveal_progress", { p_exchange_id: exchangeId });
  if (error) throw error;
  return (data as { revealed: number; total: number }[] | null)?.[0] ?? { revealed: 0, total: 0 };
}

export async function getMyAssignmentStatus(
  exchangeId: string,
): Promise<{ has_assignment: boolean; draw_version: number; revealed_at: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_assignment_status", { p_exchange_id: exchangeId });
  if (error) throw error;
  return (data as { has_assignment: boolean; draw_version: number; revealed_at: string | null }[] | null)?.[0] ?? null;
}
