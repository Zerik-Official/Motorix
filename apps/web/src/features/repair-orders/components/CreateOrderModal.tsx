import { useState, type FormEvent } from "react";
import { LuLoaderCircle, LuPlus } from "react-icons/lu";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { fetchClient, searchEngines, type EngineOption } from "@shared/api/catalog";
import { toApiError } from "@shared/api/errors";
import { AsyncPicker } from "@shared/components/AsyncPicker";
import { Field } from "@shared/components/Field";
import { Modal } from "@shared/components/Modal";
import { useAsync } from "@shared/hooks/useAsync";

import { createOrder, type RepairOrderDetail } from "../api";

/**
 * Today as `YYYY-MM-DD`, the earliest estimated delivery date allowed.
 *
 * @returns The local date.
 */
function today(): string {
  const now: Date = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Rules of the new order form, with the messages shown under each field.
 */
const orderSchema = z.object({
  engine: z.custom<EngineOption>((value) => value !== null, "Elige el motor que entra al taller."),
  reported_issue: z.string().trim().min(5, "Describe la falla con al menos 5 caracteres.").max(2000, "Usa como máximo 2000 caracteres."),
  technician_name: z.string().trim().max(150, "Usa como máximo 150 caracteres."),
  estimated_delivery_date: z
    .string()
    .refine((value) => value === "" || value >= today(), "La entrega estimada no puede ser una fecha pasada."),
  diagnosis: z.string().trim().max(2000, "Usa como máximo 2000 caracteres."),
  observations: z.string().trim().max(2000, "Usa como máximo 2000 caracteres."),
});

/**
 * Field names of the form.
 */
type OrderField = keyof z.input<typeof orderSchema>;

/**
 * Props of {@link CreateOrderModal}.
 */
interface CreateOrderModalProps {
  /** Whether the modal is shown. */
  open: boolean;
  /** Closes the modal. */
  onClose: () => void;
  /** Receives the created order. */
  onCreated: (order: RepairOrderDetail) => void;
}

/**
 * Opens a repair order for an engine. The owner of the order is taken from the engine by the API,
 * so it is shown here but never chosen.
 *
 * @param props - Open state, close and creation callbacks.
 * @returns The modal.
 */
export function CreateOrderModal({ open, onClose, onCreated }: CreateOrderModalProps) {
  const [engine, setEngine] = useState<EngineOption | null>(null);
  const [reportedIssue, setReportedIssue] = useState<string>("");
  const [technician, setTechnician] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [observations, setObservations] = useState<string>("");
  const [errors, setErrors] = useState<Partial<Record<OrderField | "form", string>>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const owner = useAsync(() => (engine ? fetchClient(engine.client_id) : Promise.resolve(null)), engine?.client_id ?? "");
  const ownerHint: string = !engine
    ? "Busca por serie, fabricante o modelo."
    : owner.data
      ? `La orden queda a nombre de ${owner.data.name}.`
      : owner.error
        ? "La orden queda a nombre del dueño del motor."
        : "Buscando al dueño del motor...";

  /**
   * Clears the form and closes the modal.
   */
  const close = (): void => {
    setEngine(null);
    setReportedIssue("");
    setTechnician("");
    setDeliveryDate("");
    setDiagnosis("");
    setObservations("");
    setErrors({});
    onClose();
  };

  /**
   * Validates the form and opens the order.
   *
   * @param event - Submit event of the form.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = orderSchema.safeParse({
      engine,
      reported_issue: reportedIssue,
      technician_name: technician,
      estimated_delivery_date: deliveryDate,
      diagnosis,
      observations,
    });
    if (!parsed.success) {
      const next: Partial<Record<OrderField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as OrderField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const created: RepairOrderDetail = await createOrder({
        engine_id: parsed.data.engine.id,
        reported_issue: parsed.data.reported_issue,
        technician_name: parsed.data.technician_name || undefined,
        estimated_delivery_date: parsed.data.estimated_delivery_date || undefined,
        diagnosis: parsed.data.diagnosis || undefined,
        observations: parsed.data.observations || undefined,
      });
      close();
      onCreated(created);
    } catch (caught: unknown) {
      setErrors({ form: toApiError(caught, { not_found: "El motor elegido ya no existe. Elige otro." }).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      closable={!saving}
      title="Nueva orden de reparación"
      description="El cliente de la orden es el dueño del motor; no hace falta elegirlo."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="create-order-form" disabled={saving}>
            {saving ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuPlus aria-hidden />}
            {saving ? "Abriendo..." : "Abrir orden"}
          </Button>
        </>
      }
    >
      <form id="create-order-form" noValidate onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Motor" error={errors.engine} required hint={ownerHint} className="sm:col-span-2">
          <AsyncPicker<EngineOption>
            value={engine}
            onChange={setEngine}
            search={(text) => searchEngines(text)}
            getKey={(item) => item.id}
            getLabel={(item) => `${item.manufacturer} ${item.model}, serie ${item.serial_number}`}
            getDescription={(item) => `${item.engine_type}, ${item.power_rating}`}
            placeholder="Ej. QSK60 o CAT-0012"
            emptyText="Ningún motor activo coincide. Regístralo primero en Motores."
          />
        </Field>
        <Field label="Falla reportada" error={errors.reported_issue} required className="sm:col-span-2">
          <Textarea value={reportedIssue} onChange={(event) => setReportedIssue(event.target.value)} rows={3} placeholder="Qué notó el cliente y desde cuándo." />
        </Field>
        <Field label="Técnico responsable" error={errors.technician_name}>
          <Input value={technician} onChange={(event) => setTechnician(event.target.value)} autoComplete="off" />
        </Field>
        <Field label="Entrega estimada" error={errors.estimated_delivery_date}>
          <Input type="date" value={deliveryDate} min={today()} onChange={(event) => setDeliveryDate(event.target.value)} />
        </Field>
        <Field label="Diagnóstico inicial" error={errors.diagnosis} hint="Opcional. Puede completarse más adelante." className="sm:col-span-2">
          <Textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} rows={2} />
        </Field>
        <Field label="Observaciones" error={errors.observations} className="sm:col-span-2">
          <Textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={2} />
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
