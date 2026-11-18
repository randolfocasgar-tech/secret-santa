import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { GiftIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";

function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg text-pine-900">
      <span className="flex size-9 items-center justify-center rounded-xl bg-pine-800 text-white">
        <GiftIcon className="size-5" />
      </span>
      <span className="whitespace-nowrap font-display text-base font-semibold tracking-tight sm:text-lg">
        Amigo <span className="text-berry-600">Secreto</span>
      </span>
    </Link>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          {children}
        </nav>
      </div>
    </header>
  );
}

export function SiteHeaderFallback() {
  return <Shell />;
}

export async function SiteHeader() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return (
      <Shell>
        <Link href="/iniciar-sesion" className={buttonClasses("ghost", "sm", "whitespace-nowrap")}>
          Entrar
        </Link>
        <Link href="/registro" className={buttonClasses("primary", "sm", "whitespace-nowrap")}>
          Crear cuenta
        </Link>
      </Shell>
    );
  }
  const profile = await getProfile(user.id).catch(() => null);
  const initial = (profile?.display_name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <Shell>
      <Link href="/intercambios" className={buttonClasses("ghost", "sm", "whitespace-nowrap")}>
        <span className="sm:hidden">Mis grupos</span>
        <span className="hidden sm:inline">Mis intercambios</span>
      </Link>
      <Link
        href="/perfil"
        className="flex size-9 items-center justify-center rounded-full border border-pine-200 bg-pine-50 text-sm font-semibold text-pine-800 hover:bg-pine-100"
        aria-label={`Perfil de ${profile?.display_name || user.email || "usuario"}`}
        title="Mi perfil"
      >
        {initial}
      </Link>
      <form action={signOutAction} className="hidden sm:block">
        <button type="submit" className={buttonClasses("ghost", "sm")}>
          Salir
        </button>
      </form>
    </Shell>
  );
}
