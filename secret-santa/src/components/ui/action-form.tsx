"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { type ActionState, initialActionState } from "@/lib/form";

type Ctx = { state: ActionState; pending: boolean };
const FormStateContext = createContext<Ctx>({ state: initialActionState, pending: false });

export function useFormState(): Ctx {
  return use(FormStateContext);
}

export function useFieldError(name: string): string | undefined {
  return use(FormStateContext).state.fieldErrors?.[name];
}

/**
 * Formulario conectado a una Server Action con estados de carga, error y éxito.
 * - Funciona sin JavaScript (atributo action).
 * - Con JavaScript no se reinician los campos si hay errores.
 * - Mientras está enviando, el botón queda deshabilitado (evita doble envío).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  onSuccess,
  "aria-label": ariaLabel,
  id,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  "aria-label"?: string;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.(state);
    }
  }, [state, resetOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <FormStateContext value={{ state, pending }}>
      <form
        ref={formRef}
        id={id}
        action={formAction}
        onSubmit={handleSubmit}
        aria-label={ariaLabel}
        aria-busy={pending}
        className={cn("space-y-4", className)}
        noValidate
      >
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.ok && state.message && showSuccess ? <Alert tone="success">{state.message}</Alert> : null}
        {children}
      </form>
    </FormStateContext>
  );
}
