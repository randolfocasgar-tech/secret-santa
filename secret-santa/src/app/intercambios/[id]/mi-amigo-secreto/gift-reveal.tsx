"use client";

import { useRef, useState, useTransition } from "react";
import { revealMyAssignmentAction } from "@/app/actions/exchanges";
import { Alert } from "@/components/ui/alert";
import { Button, Spinner } from "@/components/ui/button";
import type { MyAssignment } from "@/lib/types";

type Phase = "closed" | "opening" | "open";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GiftReveal({
  exchangeId,
  exchangeName,
  budget,
  giftDate,
  previouslyRevealed,
}: {
  exchangeId: string;
  exchangeName: string;
  budget: string;
  giftDate: string;
  previouslyRevealed: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [assignment, setAssignment] = useState<MyAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  function reveal() {
    if (pending || phase !== "closed") return;
    setError(null);
    startTransition(async () => {
      const result = await revealMyAssignmentAction(exchangeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAssignment(result.assignment);
      if (prefersReducedMotion()) {
        setPhase("open");
        requestAnimationFrame(() => headingRef.current?.focus());
        return;
      }
      setPhase("opening");
      setTimeout(() => {
        setPhase("open");
        requestAnimationFrame(() => headingRef.current?.focus());
      }, 1100);
    });
  }

  if (phase === "open" && assignment) {
    return (
      <div className="anim-reveal overflow-hidden rounded-3xl border border-line bg-card shadow-lg shadow-pine-900/5">
        <div className="relative bg-pine-800 px-6 pb-8 pt-9 text-center text-white">
          <div className="absolute inset-x-0 top-0 h-2 bg-berry-600" aria-hidden="true" />
          <div className="relative">
            <p className="text-sm text-pine-100">En «{exchangeName}» le regalas a</p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 break-words font-display text-4xl font-semibold focus:outline-none"
            >
              {assignment.receiver_name}
            </h2>
          </div>
        </div>
        <div className="space-y-5 p-6">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-paper p-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Presupuesto</dt>
              <dd className="mt-0.5 font-semibold text-pine-900">{budget}</dd>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Entrega</dt>
              <dd className="mt-0.5 font-semibold text-pine-900 first-letter:uppercase">{giftDate}</dd>
            </div>
          </dl>
          <PreferenceBlock title="Ideas de regalo" text={assignment.wishlist} />
          <PreferenceBlock title="Gustos" text={assignment.likes} />
          <PreferenceBlock title="Prefiere evitar" text={assignment.avoid} accent />
          <p className="border-t border-line pt-4 text-center text-xs text-muted">
            Este resultado no cambia al actualizar la página. Guarda el secreto 🤫
          </p>
        </div>
      </div>
    );
  }

  const opening = phase === "opening";

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className={`relative mt-8 w-full max-w-xs ${opening ? "anim-shake" : ""}`}
        aria-hidden="true"
      >
        {/* Tapa */}
        <div className={`relative z-10 mx-auto h-16 w-[108%] -translate-x-[3.7%] rounded-xl bg-pine-700 shadow-md ${opening ? "anim-lid" : ""}`}>
          <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-berry-600" />
          <div className="absolute -top-7 left-1/2 flex -translate-x-1/2 gap-1">
            <span className="block size-9 -rotate-12 rounded-full rounded-br-none border-[6px] border-berry-600" />
            <span className="block size-9 rotate-12 rounded-full rounded-bl-none border-[6px] border-berry-600" />
          </div>
        </div>
        {/* Caja */}
        <div className="relative -mt-1 h-48 rounded-b-2xl bg-pine-800 shadow-xl shadow-pine-900/20">
          <div className="absolute inset-y-0 left-1/2 w-7 -translate-x-1/2 bg-berry-600" />
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Button size="lg" variant="accent" onClick={reveal} disabled={pending || opening} className="w-full max-w-xs">
        {pending ? (
          <>
            <Spinner /> Abriendo…
          </>
        ) : opening ? (
          "Abriendo…"
        ) : (
          "Ver a quién me tocó"
        )}
      </Button>
      <p role="status" aria-live="polite" className="text-center text-sm text-muted">
        {opening ? "Abriendo tu regalo…" : previouslyRevealed ? "Ya lo habías visto antes: el resultado sigue siendo el mismo." : ""}
      </p>
    </div>
  );
}

function PreferenceBlock({ title, text, accent }: { title: string; text: string; accent?: boolean }) {
  return (
    <div>
      <h3 className={`text-sm font-semibold ${accent ? "text-berry-700" : "text-pine-900"}`}>{title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-ink">
        {text || <span className="text-muted">No escribió nada todavía.</span>}
      </p>
    </div>
  );
}
