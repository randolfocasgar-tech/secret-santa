import { ButtonLink } from "@/components/ui/button";
import { GiftIcon, LinkIcon, ShuffleIcon, UsersIcon } from "@/components/icons";

const steps = [
  {
    icon: UsersIcon,
    title: "Crea el intercambio",
    text: "Pon nombre, fecha de entrega, presupuesto y, si quieres, algunas reglas.",
  },
  {
    icon: LinkIcon,
    title: "Comparte el enlace",
    text: "Cada persona se une con su cuenta y deja ideas de regalo y cosas que prefiere evitar.",
  },
  {
    icon: ShuffleIcon,
    title: "Sortea y descubre",
    text: "El sorteo ocurre en el servidor. Cada quien ve, en privado, solo a quién le toca regalar.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="pt-4 text-center sm:pt-10">
        <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-pine-800 text-white shadow-lg shadow-pine-900/10">
          <GiftIcon className="size-8" />
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-pine-900 sm:text-5xl">
          Tu intercambio de regalos,
          <br />
          <span className="text-berry-600">sin papelitos.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Invita a tu grupo, haz el sorteo con un clic y deja que cada persona descubra en secreto a quién le
          toca regalar.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <ButtonLink href="/intercambios/nuevo" size="lg">
            Crear intercambio
          </ButtonLink>
          <ButtonLink href="/unirme" size="lg" variant="secondary">
            Unirme
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="mb-5 text-center font-display text-2xl font-semibold text-pine-900">
          Cómo funciona
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-pine-50 text-pine-700">
                  <step.icon className="size-5" />
                </span>
                <span className="text-sm font-semibold text-berry-600">Paso {i + 1}</span>
              </div>
              <h3 className="font-semibold text-pine-900">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-pine-800 px-6 py-8 text-pine-50 sm:px-10">
        <h2 className="font-display text-2xl font-semibold text-white">Privado de verdad</h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed">
          <li>• Nadie se regala a sí mismo y cada persona recibe exactamente un regalo.</li>
          <li>• Quien organiza administra el grupo, pero no puede ver quién le regala a quién.</li>
          <li>• El resultado se guarda: actualizar la página no lo cambia.</li>
          <li>• Puedes evitar que ciertas personas se toquen entre sí (por ejemplo, parejas).</li>
        </ul>
      </section>
    </div>
  );
}
