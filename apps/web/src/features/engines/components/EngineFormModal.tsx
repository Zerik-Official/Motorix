import { useState, type SubmitEvent } from "react";
import { LuLoaderCircle, LuSave } from "react-icons/lu";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { searchClients, type ClientOption } from "@shared/api/catalog";
import { toApiError, type ApiError } from "@shared/api/errors";
import { AsyncPicker } from "@shared/components/AsyncPicker";
import { Field } from "@shared/components/Field";
import { Modal } from "@shared/components/Modal";
import { formatIdentification } from "@shared/domain/identification";

import { createEngine, updateEngine, type Engine, type EngineFields } from "../api";

/**
 * Rule of a required free text field of the engine.
 *
 * @param empty - Message when it is empty.
 * @param max - Maximum length accepted by the API.
 * @returns The rule.
 */
function text(empty: string, max: number) {
  return z.string().trim().min(1, empty).max(max, `Usa como máximo ${max} caracteres.`);
}

/**
 * Rules of the engine form, with the messages shown under each field.
 */
const engineSchema = z.object({
  serial_number: text("Escribe el número de serie o el código interno.", 100),
  manufacturer: text("Escribe el fabricante.", 150),
  model: text("Escribe el modelo.", 150),
  engine_type: text("Escribe el tipo de motor.", 150),
  power_rating: text("Escribe la potencia o capacidad.", 100),
  owner: z.custom<ClientOption>((value) => value !== null, "Elige el cliente dueño del motor."),
});

/**
 * Field names of the form.
 */
type EngineField = keyof z.input<typeof engineSchema>;

/**
 * Messages of the form, by field, plus one for the whole form.
 */
type FormErrors = Partial<Record<EngineField | "form", string>>;

/**
 * Message shown under each field when the API rejects its value.
 */
const SERVER_FIELD_MESSAGES: Record<string, [EngineField, string]> = {
  serial_number: ["serial_number", "Revisa el número de serie."],
  manufacturer: ["manufacturer", "Revisa el fabricante."],
  model: ["model", "Revisa el modelo."],
  engine_type: ["engine_type", "Revisa el tipo de motor."],
  power_rating: ["power_rating", "Revisa la potencia o capacidad."],
  client_id: ["owner", "Elige un cliente de la lista."],
};

/**
 * Turns a rejected save into messages of the form: a duplicate serial points to the serial, a
 * missing owner points to the owner, invalid fields point to themselves, and anything else goes
 * to the whole form.
 *
 * @param error - Error of the request.
 * @param editing - Whether an existing engine was being edited.
 * @returns The messages.
 */
function serverErrors(error: ApiError, editing: boolean): FormErrors {
  if (error.code === "conflict") {
    return { serial_number: "Ya hay un motor registrado con ese número de serie." };
  }
  if (error.code === "not_found") {
    return editing
      ? { form: "El motor o el cliente elegido ya no existen. Cierra y vuelve a cargar la página." }
      : { owner: "El cliente elegido ya no existe. Elige otro." };
  }
  const fields: FormErrors = {};
  for (const item of error.fieldErrors) {
    const target: [EngineField, string] | undefined = SERVER_FIELD_MESSAGES[item.field];
    if (target) {
      fields[target[0]] = target[1];
    }
  }
  return Object.keys(fields).length > 0 ? fields : { form: error.message };
}

/**
 * Props of {@link EngineFormModal}.
 */
interface EngineFormModalProps {
  /** Engine to edit; omitted to register a new one. */
  engine?: Engine;
  /** Owner chosen when the modal opens: the current owner of the engine, or the client it is registered for. */
  owner?: ClientOption | null;
  /** Closes the modal. */
  onClose: () => void;
  /** Receives the saved engine. */
  onSaved: (engine: Engine) => void;
}

/**
 * Registers an engine for a client or edits one, with the same fields and rules. Mount it only
 * while it is shown, so every opening starts from the engine and owner given.
 *
 * @param props - Engine to edit, initial owner, close and save callbacks.
 * @returns The modal.
 */
export function EngineFormModal({ engine, owner: initialOwner = null, onClose, onSaved }: EngineFormModalProps) {
  const editing: boolean = Boolean(engine);
  const [serialNumber, setSerialNumber] = useState<string>(engine?.serial_number ?? "");
  const [manufacturer, setManufacturer] = useState<string>(engine?.manufacturer ?? "");
  const [model, setModel] = useState<string>(engine?.model ?? "");
  const [engineType, setEngineType] = useState<string>(engine?.engine_type ?? "");
  const [powerRating, setPowerRating] = useState<string>(engine?.power_rating ?? "");
  const [owner, setOwner] = useState<ClientOption | null>(initialOwner);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState<boolean>(false);
  const ownerChanged: boolean = Boolean(engine && owner && owner.id !== engine.client_id);

  /**
   * Validates the form and saves the engine.
   *
   * @param event - Submit event of the form.
   */
  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = engineSchema.safeParse({
      serial_number: serialNumber,
      manufacturer,
      model,
      engine_type: engineType,
      power_rating: powerRating,
      owner,
    });
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as EngineField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const { owner: chosenOwner, ...fields } = parsed.data;
    const body: EngineFields = { ...fields, client_id: chosenOwner.id };
    try {
      const saved: Engine = engine ? await updateEngine(engine.id, body) : await createEngine(body);
      onSaved(saved);
    } catch (caught: unknown) {
      setErrors(serverErrors(toApiError(caught), editing));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      closable={!saving}
      title={editing ? `Editar motor ${engine?.serial_number}` : "Nuevo motor"}
      description="El número de serie no puede repetirse entre motores."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="engine-form" disabled={saving}>
            {saving ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuSave aria-hidden />}
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Registrar motor"}
          </Button>
        </>
      }
    >
      <form id="engine-form" noValidate onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Cliente dueño"
          error={errors.owner}
          required
          hint={ownerChanged ? "Las órdenes ya abiertas siguen a nombre del dueño anterior." : "Busca por nombre o número de identificación."}
          className="sm:col-span-2"
        >
          <AsyncPicker<ClientOption>
            value={owner}
            onChange={setOwner}
            search={searchClients}
            getKey={(item) => item.id}
            getLabel={(item) => item.name}
            getDescription={(item) => formatIdentification(item.identification_type, item.identification_number)}
            placeholder="Ej. Minera El Roble"
            emptyText="Ningún cliente activo coincide. Regístralo primero en Clientes."
          />
        </Field>
        <Field label="Número de serie o código interno" error={errors.serial_number} required className="sm:col-span-2">
          <Input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} autoComplete="off" placeholder="Ej. CAT-3516-0012" />
        </Field>
        <Field label="Fabricante" error={errors.manufacturer} required>
          <Input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} autoComplete="off" placeholder="Ej. Caterpillar" />
        </Field>
        <Field label="Modelo" error={errors.model} required>
          <Input value={model} onChange={(event) => setModel(event.target.value)} autoComplete="off" placeholder="Ej. 3516B" />
        </Field>
        <Field label="Tipo de motor" error={errors.engine_type} required>
          <Input value={engineType} onChange={(event) => setEngineType(event.target.value)} autoComplete="off" placeholder="Ej. Diésel V16" />
        </Field>
        <Field label="Potencia o capacidad" error={errors.power_rating} required>
          <Input value={powerRating} onChange={(event) => setPowerRating(event.target.value)} autoComplete="off" placeholder="Ej. 2500 HP" />
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
