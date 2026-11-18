import type { Metadata } from "next";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, PageSkeleton } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

async function Profile() {
  const user = await requireUser("/perfil");
  const profile = await getProfile(user.id);
  return (
    <>
      <Card>
        <CardHeader
          title="Preferencias de regalos"
          description="Se usan como punto de partida cada vez que te unes a un intercambio. Para cambiar las de un intercambio existente, entra a ese intercambio."
        />
        <ProfileForm
          defaults={{
            display_name: profile?.display_name ?? "",
            wishlist: profile?.wishlist ?? "",
            likes: profile?.likes ?? "",
            avoid: profile?.avoid ?? "",
          }}
        />
      </Card>
      <Card>
        <CardHeader title="Cuenta" description={user.email ?? undefined} />
        <form action={signOutAction}>
          <button type="submit" className={buttonClasses("secondary")}>
            Cerrar sesión
          </button>
        </form>
      </Card>
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-pine-900">Mi perfil</h1>
      <Suspense fallback={<PageSkeleton label="Cargando perfil…" />}>
        <Profile />
      </Suspense>
    </div>
  );
}
