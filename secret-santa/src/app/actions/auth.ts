"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { translateAuthError } from "@/lib/errors";
import { type ActionState, str } from "@/lib/form";
import { getOrigin } from "@/lib/origin";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email", 254).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(str(formData, "next", 500));

  const fieldErrors: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Escribe un correo válido.";
  if (!password) fieldErrors.password = "Escribe tu contraseña.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error) };
  redirect(next);
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const displayName = str(formData, "display_name", 60);
  const email = str(formData, "email", 254).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(str(formData, "next", 500));

  const fieldErrors: Record<string, string> = {};
  if (!displayName) fieldErrors.display_name = "Escribe tu nombre.";
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Escribe un correo válido.";
  if (password.length < 8) fieldErrors.password = "La contraseña debe tener al menos 8 caracteres.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: translateAuthError(error) };

  // Si el proyecto no exige confirmar el correo, ya hay sesión.
  if (data.session) redirect(next);

  // Recordar a dónde volver (p. ej. la invitación) si el correo de
  // confirmación no conserva el parámetro "next".
  (await cookies()).set("post_confirm_next", next, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return {
    ok: true,
    message: `Te enviamos un correo a ${email}. Abre el enlace para confirmar tu cuenta y continuar.`,
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
