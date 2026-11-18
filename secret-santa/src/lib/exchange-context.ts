import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getExchange, getParticipants } from "@/lib/data";
import { isUuid } from "@/lib/form";

/** Carga el intercambio y la relación del usuario actual con él (RLS filtra el acceso). */
export async function loadExchangeContext(id: string, path: string) {
  const user = await requireUser(path);
  if (!isUuid(id)) notFound();
  const exchange = await getExchange(id);
  if (!exchange) notFound(); // no existe o no eres miembro: misma respuesta
  const participants = await getParticipants(id);
  const me = participants.find((p) => p.user_id === user.id) ?? null;
  return { user, exchange, participants, me, isOrganizer: exchange.organizer_id === user.id };
}
