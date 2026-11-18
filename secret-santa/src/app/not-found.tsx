import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";

export default function NotFound() {
  return (
    <EmptyState
      title="No encontramos esta página"
      description="Puede que el intercambio no exista, que se haya eliminado o que no tengas acceso a él."
      action={<ButtonLink href="/intercambios">Ir a mis intercambios</ButtonLink>}
    />
  );
}
