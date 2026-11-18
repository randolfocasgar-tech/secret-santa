"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copiar enlace" }: { value: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const t = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <Button variant="primary" onClick={copy}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
        {status === "copied" ? "¡Copiado!" : label}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" ? "Enlace copiado al portapapeles" : status === "error" ? "No se pudo copiar" : ""}
      </span>
      {status === "error" ? (
        <span className="text-sm text-berry-700">No se pudo copiar. Selecciona el enlace y cópialo manualmente.</span>
      ) : null}
    </>
  );
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de una API del navegador
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  if (!canShare) return null;
  return (
    <Button
      variant="secondary"
      onClick={() =>
        navigator.share({ title, text: `Únete a «${title}» en Amigo Secreto`, url }).catch(() => {})
      }
    >
      Compartir
    </Button>
  );
}
