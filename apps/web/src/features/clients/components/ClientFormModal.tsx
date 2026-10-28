import { useState, type SubmitEvent } from "react";
import { LuLoaderCircle, LuSave } from "react-icons/lu";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { toApiError, type ApiError } from "@shared/api/errors";
import { Field } from "@shared/components/Field";
import { Modal } from "@shared/components/Modal";
import { IDENTIFICATION_LABELS, IDENTIFICATION_TYPES, type IdentificationType } from "@shared/domain/identification";

import { createClient, updateClient, type Client, type ClientFields } from "../api";

/**
 * Rules of the client form, with the messages shown under each field.
 */
const clientSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre o la razón social.").max(200, "Usa como máximo 200 caracteres."),
  identification_type: z.enum(IDENTIFICATION_TYPES, "Elige el tipo de documento."),
  identification_number: z
    .string()
    .trim()
    .min(1, "Escribe el número de identificación.")
    .max(50, "Usa como máximo 50 caracteres.")
    .regex(/^[A-Za-z0-9-]+$/, "Usa solo letras, números y guiones, sin espacios ni puntos."),
  email: z.string().trim().min(1, "Escribe el correo de contacto.").pipe(z.email("Escribe un correo válido, como compras@minera.com.")),
});

/**
 * Field names of the form.
 */
type ClientField = keyof ClientFields;

/**
 * Messages of the form, by field, plus one for the whole form.
 */
type FormErrors = Partial<Record<ClientField | "form", string>>;

/**
 * Message shown under each field when the API rejects its value.
 */
const SERVER_FIELD_MESSAGES: Record<ClientField, string> = {
  name: "Revisa el nombre o la razón social.",
  identification_type: "Elige un tipo de documento de la lista.",
  identification_number: "Revisa el número de identificación.",
  email: "Escribe un correo válido, como compras@minera.com.",
};

/**
 * Turns a rejected save into messages of the form: a duplicate identification points to the
 * number, invalid fields point to themselves, and anything else goes to the whole form.
 *
 * @param error - Error of the request.
 * @returns The messages.
 */
function serverErrors(error: ApiError): FormErrors {
  if (error.code === "conflict") {
    return { identification_number: "Ya hay un cliente registrado con ese tipo y número de identificación." };
  }
  const fields: FormErrors = {};
  for (const item of error.fieldErrors) {
    if (item.field in SERVER_FIELD_MESSAGES) {
      fields[item.field as ClientField] = SERVER_FIELD_MESSAGES[item.field as ClientField];
    }
  }
  return Object.keys(fields).length > 0 ? fields : { form: error.message };
}

/**
 * Props of {@link ClientFormModal}.
 */
interface ClientFormModalProps {
  /** Client to edit; omitted to register a new one. */
  client?: Client;
  /** Closes the modal. */
  onClose: () => void;
  /** Receives the saved client. */
  onSaved: (client: Client) => void;
}

/**
 * Registers a client or edits one, with the same fields and rules. Mount it only while it is
 * shown, so every opening starts from the client given.
 *
 * @param props - Client to edit, close and save callbacks.
 * @returns The modal.
 */
export function ClientFormModal({ client, onClose, onSaved }: ClientFormModalProps) {
  const editing: boolean = Boolean(client);
  const [name, setName] = useState<string>(client?.name ?? "");
  const [identificationType, setIdentificationType] = useState<IdentificationType>(
    (client?.identification_type as IdentificationType | undefined) ?? "nit",
  );
  const [identificationNumber, setIdentificationNumber] = useState<string>(client?.identification_number ?? "");
  const [email, setEmail] = useState<string>(client?.email ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState<boolean>(false);

  /**
   * Validates the form and saves the client.
   *
   * @param event - Submit event of the form.
   */
  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = clientSchema.safeParse({
      name,
      identification_type: identificationType,
      identification_number: identificationNumber,
      email,
    });
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ClientField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved: Client = client ? await updateClient(client.id, parsed.data) : await createClient(parsed.data);
      onSaved(saved);
    } catch (caught: unknown) {
      setErrors(serverErrors(toApiError(caught, { not_found: "Este cliente ya no existe. Cierra y vuelve a cargar la lista." })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      closable={!saving}
      title={editing ? `Editar ${client?.name}` : "Nuevo cliente"}
      description="El tipo y el número de identificación no pueden repetirse entre clientes."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" disabled={saving}>
            {saving ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuSave aria-hidden />}
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Registrar cliente"}
          </Button>
        </>
      }
    >
      <form id="client-form" noValidate onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre o razón social" error={errors.name} required className="sm:col-span-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="organization" placeholder="Ej. Minera El Roble S.A.S." />
        </Field>
        <Field label="Tipo de documento" error={errors.identification_type} required>
          {(controlProps) => (
            <Select value={identificationType} onValueChange={(value) => value && setIdentificationType(value as IdentificationType)}>
              <SelectTrigger className="w-full" {...controlProps}>
                <SelectValue>{(value: string) => IDENTIFICATION_LABELS[value as IdentificationType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {IDENTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {IDENTIFICATION_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Número de identificación" error={errors.identification_number} required>
          <Input
            value={identificationNumber}
            onChange={(event) => setIdentificationNumber(event.target.value)}
            autoComplete="off"
            placeholder={identificationType === "nit" ? "Ej. 900222333-1" : "Ej. 1020304050"}
          />
        </Field>
        <Field label="Correo de contacto" error={errors.email} required className="sm:col-span-2">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="compras@minera.com" />
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-fg sm:col-span-2">
            {errors.form}
          </p>
        )}
      </form>
    </Modal>
  );
}
