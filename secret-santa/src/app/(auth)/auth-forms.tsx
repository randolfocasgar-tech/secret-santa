"use client";

import Link from "next/link";
import { useFormState, ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { SubmitButton, TextField } from "@/components/ui/fields";
import { signInAction, signUpAction } from "@/app/actions/auth";

export function SignInForm({ next }: { next: string }) {
  return (
    <ActionForm action={signInAction} aria-label="Iniciar sesión">
      <input type="hidden" name="next" value={next} />
      <TextField name="email" label="Correo electrónico" type="email" autoComplete="email" inputMode="email" required />
      <TextField name="password" label="Contraseña" type="password" autoComplete="current-password" required />
      <SubmitButton className="w-full" size="lg" pendingLabel="Entrando…">
        Iniciar sesión
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href={`/registro?next=${encodeURIComponent(next)}`} className="font-medium text-pine-700 underline">
          Regístrate
        </Link>
      </p>
    </ActionForm>
  );
}

function SignUpFields({ next }: { next: string }) {
  const { state } = useFormState();
  if (state.ok && state.message) {
    return (
      <Alert tone="success" title="Revisa tu correo">
        {state.message}
      </Alert>
    );
  }
  return (
    <>
      <input type="hidden" name="next" value={next} />
      <TextField
        name="display_name"
        label="Tu nombre"
        autoComplete="given-name"
        maxLength={60}
        hint="Así te verán en los intercambios."
        required
      />
      <TextField name="email" label="Correo electrónico" type="email" autoComplete="email" inputMode="email" required />
      <TextField
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="Mínimo 8 caracteres."
        required
      />
      <SubmitButton className="w-full" size="lg" pendingLabel="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/iniciar-sesion?next=${encodeURIComponent(next)}`} className="font-medium text-pine-700 underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}

export function SignUpForm({ next }: { next: string }) {
  return (
    <ActionForm action={signUpAction} aria-label="Crear cuenta" showSuccess={false}>
      <SignUpFields next={next} />
    </ActionForm>
  );
}
