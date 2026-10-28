import { useState, type SubmitEvent } from "react";
import { LuLoaderCircle, LuSave } from "react-icons/lu";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { toApiError, type ApiError } from "@shared/api/errors";
import { Field } from "@shared/components/Field";
import { Modal } from "@shared/components/Modal";
import { PasswordInput } from "@shared/components/PasswordInput";
import { ROLE_LABELS } from "@shared/session/roles";

import { createUser, updateUser, type AssignableRole, type User } from "../api";

/**
 * Rule of the email, with the message shown under it.
 */
const emailRule = z
  .string()
  .trim()
  .min(1, "Escribe el correo de la cuenta.")
  .max(255, "Usa como máximo 255 caracteres.")
  .pipe(z.email("Escribe un correo válido, como nombre@taller.com."));

/**
 * Rule of the full name, with the message shown under it.
 */
const nameRule = z.string().trim().min(1, "Escribe el nombre de la persona.").max(150, "Usa como máximo 150 caracteres.");

/**
 * Rule of a password the API accepts.
 */
const passwordRule = z.string().min(8, "Usa al menos 8 caracteres.").max(128, "Usa como máximo 128 caracteres.");

/**
 * Field names of the form.
 */
type UserField = "full_name" | "email" | "role" | "password";

/**
 * Messages of the form, by field, plus one for the whole form.
 */
type FormErrors = Partial<Record<UserField | "form", string>>;

/**
 * Turns a rejected save into messages of the form: a taken email points to the email, a role the
 * account may not give points to the role, and anything else goes to the whole form.
 *
 * @param error - Error of the request.
 * @returns The messages.
 */
function serverErrors(error: ApiError): FormErrors {
  if (error.code === "conflict") {
    return { email: "Ya hay una cuenta con ese correo." };
  }
  if (error.code === "forbidden") {
    return { role: "Tu rol no puede administrar cuentas con ese rol." };
  }
  if (error.fieldErrors.some((item) => item.field === "email")) {
    return { email: "Escribe un correo válido, como nombre@taller.com." };
  }
  return { form: error.message };
}

/**
 * Props of {@link UserFormModal}.
 */
interface UserFormModalProps {
  /** Account to edit; omitted to create a new one. */
  user?: User;
  /** Roles the signed in account may give, from the most to the least privileged. */
  roles: AssignableRole[];
  /** Closes the modal. */
  onClose: () => void;
  /** Receives the saved account. */
  onSaved: (user: User) => void;
}

/**
 * Creates an account or edits one. A new account needs a password; an edit only resets it when
 * one is typed, and that ends every open session of the account. Mount it only while it is shown,
 * so every opening starts from the account given.
 *
 * @param props - Account to edit, roles that can be given, close and save callbacks.
 * @returns The modal.
 */
export function UserFormModal({ user, roles, onClose, onSaved }: UserFormModalProps) {
  const editing: boolean = Boolean(user);
  const [fullName, setFullName] = useState<string>(user?.full_name ?? "");
  const [email, setEmail] = useState<string>(user?.email ?? "");
  const [role, setRole] = useState<AssignableRole>((user?.role as AssignableRole | undefined) ?? roles[roles.length - 1] ?? "user");
  const [password, setPassword] = useState<string>("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState<boolean>(false);

  /**
   * Validates the form and saves the account.
   *
   * @param event - Submit event of the form.
   */
  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const schema = z.object({
      full_name: nameRule,
      email: emailRule,
      password: editing ? z.union([z.literal(""), passwordRule]) : passwordRule,
    });
    const parsed = schema.safeParse({ full_name: fullName, email, password });
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as UserField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved: User = user
        ? await updateUser(user.id, {
            full_name: parsed.data.full_name,
            email: parsed.data.email,
            role,
            is_active: user.is_active,
            password: parsed.data.password || undefined,
          })
        : await createUser({ full_name: parsed.data.full_name, email: parsed.data.email, role, password: parsed.data.password });
      onSaved(saved);
    } catch (caught: unknown) {
      setErrors(serverErrors(toApiError(caught, { not_found: "Esta cuenta ya no existe. Cierra y vuelve a cargar la lista." })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      closable={!saving}
      title={editing ? `Editar a ${user?.full_name}` : "Nueva cuenta"}
      description="Cada cuenta entra con su correo y su contraseña; su rol decide qué puede hacer."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" disabled={saving}>
            {saving ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuSave aria-hidden />}
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </>
      }
    >
      <form id="user-form" noValidate onSubmit={handleSubmit} className="grid gap-4">
        <Field label="Nombre completo" error={errors.full_name} required>
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="off" placeholder="Ej. Ana Torres" />
        </Field>
        <Field label="Correo" error={errors.email} required>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" placeholder="nombre@taller.com" />
        </Field>
        <Field label="Rol" error={errors.role} required hint={role === "admin" ? "Puede administrar a los operativos." : "Trabaja con clientes, motores y órdenes."}>
          {(controlProps) => (
            <Select value={role} onValueChange={(value) => value && setRole(value as AssignableRole)}>
              <SelectTrigger className="w-full" {...controlProps}>
                <SelectValue>{(value: string) => ROLE_LABELS[value as AssignableRole]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field
          label={editing ? "Nueva contraseña" : "Contraseña"}
          error={errors.password}
          required={!editing}
          hint={editing ? "Déjala vacía para no cambiarla. Si la cambias, la cuenta tendrá que volver a iniciar sesión." : "Al menos 8 caracteres."}
        >
          <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-fg">
            {errors.form}
          </p>
        )}
      </form>
    </Modal>
  );
}
