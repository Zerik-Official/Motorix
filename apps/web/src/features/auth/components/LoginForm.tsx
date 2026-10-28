import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState, type FormEvent } from "react";
import { LuLoaderCircle, LuLogIn } from "react-icons/lu";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError, toApiError } from "@shared/api/errors";
import { Field } from "@shared/components/Field";
import { PasswordInput } from "@shared/components/PasswordInput";
import { env } from "@shared/config/env";
import { useSession } from "@shared/session/useSession";
import { useTheme } from "@shared/theme/useTheme";

/**
 * Rules of the login form, with the messages shown under each field.
 */
const loginSchema = z.object({
  email: z.string().trim().min(1, "Escribe tu correo.").pipe(z.email("Escribe un correo válido, como nombre@empresa.com.")),
  password: z.string().min(1, "Escribe tu contraseña."),
});

/**
 * Validation messages of the login form, per field.
 */
type LoginErrors = Partial<Record<"email" | "password" | "form", string>>;

/**
 * Props of {@link LoginForm}.
 */
interface LoginFormProps {
  /** Called once the session is open. */
  onSuccess: () => void;
}

/**
 * Email and password form with Cloudflare Turnstile.
 *
 * Fields are validated before sending; server errors appear above the button and are
 * announced. The Turnstile token is single use, so the widget resets after every attempt.
 *
 * @param props - Success callback.
 * @returns The form.
 */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useSession();
  const { theme } = useTheme();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const turnstileEnabled: boolean = env.turnstileSiteKey.length > 0;
  const waitingForTurnstile: boolean = turnstileEnabled && !turnstileToken;

  /**
   * Validates the fields and opens the session.
   *
   * @param event - Submit event of the form.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: LoginErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as "email" | "password";
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await login({ email: parsed.data.email, password: parsed.data.password, turnstileToken });
      onSuccess();
    } catch (caught: unknown) {
      const error: ApiError = toApiError(caught);
      setErrors({ form: error.message });
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5" aria-describedby={errors.form ? "login-error" : undefined}>
      <Field label="Correo" error={errors.email} required>
        <Input
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nombre@taller.com"
        />
      </Field>

      <Field label="Contraseña" error={errors.password} required>
        <PasswordInput autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>

      {turnstileEnabled && (
        <div className="min-h-16.25">
          <Turnstile
            ref={turnstileRef}
            siteKey={env.turnstileSiteKey}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            onError={() => setTurnstileToken("")}
            options={{ language: "es", theme, size: "flexible" }}
          />
        </div>
      )}

      {errors.form && (
        <p id="login-error" role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-fg">
          {errors.form}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting || waitingForTurnstile} aria-disabled={submitting || waitingForTurnstile}>
        {submitting ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuLogIn aria-hidden />}
        {submitting ? "Entrando..." : "Entrar al taller"}
      </Button>
      {waitingForTurnstile && !submitting && (
        <p className="-mt-3 text-xs text-fg-subtle">Espera a que termine la verificación de seguridad.</p>
      )}
    </form>
  );
}
