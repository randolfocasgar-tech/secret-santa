import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de confirmación de correo. Admite los dos formatos:
 *  - ?code=…            (flujo PKCE, plantilla de correo por defecto)
 *  - ?token_hash=…&type= (plantilla personalizada, funciona en otro dispositivo)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next") ?? request.cookies.get("post_confirm_next")?.value);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (ok) {
    const response = NextResponse.redirect(new URL(next, origin));
    response.cookies.delete("post_confirm_next");
    return response;
  }
  return NextResponse.redirect(new URL(`/iniciar-sesion?error=confirmacion&next=${encodeURIComponent(next)}`, origin));
}
