"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { Spinner, buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useFieldError, useFormState } from "@/components/ui/action-form";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border bg-white px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-muted/70 " +
  "shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-colors focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-200 " +
  "disabled:bg-paper disabled:text-muted";

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  optional,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-pine-900">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted">(opcional)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-berry-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type BaseProps = { name: string; label: ReactNode; hint?: ReactNode; optional?: boolean };

export function TextField({
  name,
  label,
  hint,
  optional,
  className,
  ...props
}: BaseProps & Omit<ComponentProps<"input">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, error ? "border-berry-500" : "border-line", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  optional,
  className,
  ...props
}: BaseProps & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, "resize-y", error ? "border-berry-500" : "border-line", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  optional,
  className,
  children,
  ...props
}: BaseProps & Omit<ComponentProps<"select">, "name">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, "appearance-auto pr-8", error ? "border-berry-500" : "border-line", className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  ...props
}: { name: string; label: ReactNode; hint?: ReactNode } & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className="mt-0.5 size-5 shrink-0 rounded border-line accent-pine-700"
          {...props}
        />
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="pl-8 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="pl-8 text-sm font-medium text-berry-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  variant = "primary",
  size = "md",
  className,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormState();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      className={buttonClasses(variant, size, className)}
    >
      {pending ? (
        <>
          <Spinner />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
