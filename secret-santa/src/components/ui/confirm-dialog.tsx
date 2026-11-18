"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { ActionForm } from "@/components/ui/action-form";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/fields";
import type { ActionState } from "@/lib/form";

/**
 * Diálogo modal accesible (elemento <dialog> nativo: atrapa el foco,
 * se cierra con Esc y devuelve el foco al botón que lo abrió).
 */
export function ConfirmDialog({
  triggerLabel,
  triggerVariant = "secondary",
  triggerSize = "md",
  triggerClassName,
  title,
  description,
  action,
  confirmLabel,
  confirmVariant = "primary",
  pendingLabel = "Procesando…",
  children,
}: {
  triggerLabel: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerSize?: "sm" | "md" | "lg";
  triggerClassName?: string;
  title: string;
  description?: ReactNode;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  pendingLabel?: string;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => {
          setSuccessMessage(null);
          dialogRef.current?.showModal();
        }}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-xl open:anim-fade"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="p-6">
          <h2 id={titleId} className="font-display text-xl font-semibold text-pine-900">
            {title}
          </h2>
          {description ? (
            <div id={descId} className="mt-2 space-y-2 text-sm text-muted">
              {description}
            </div>
          ) : null}
          <ActionForm action={action} className="mt-5" onSuccess={(state) => {
              dialogRef.current?.close();
              setSuccessMessage(state.message ?? null);
            }}
            showSuccess={false}
          >
            {children}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
                Cancelar
              </Button>
              <SubmitButton variant={confirmVariant} pendingLabel={pendingLabel}>
                {confirmLabel}
              </SubmitButton>
            </div>
          </ActionForm>
        </div>
      </dialog>
      {successMessage ? (
        <Alert tone="success" className="mt-3 basis-full">
          {successMessage}
        </Alert>
      ) : null}
    </>
  );
}
