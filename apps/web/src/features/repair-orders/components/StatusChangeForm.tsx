import { useState, type FormEvent } from "react";
import { LuArrowRightLeft, LuLoaderCircle } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { toApiError } from "@shared/api/errors";
import { Field } from "@shared/components/Field";
import { REPAIR_STATUS_LABELS, REPAIR_STATUSES, type RepairStatus } from "@shared/domain/repair-status";
import { useToast } from "@shared/feedback/useToast";

import { changeOrderStatus, type RepairOrderDetail } from "../api";

/**
 * Longest note kept with a status change.
 */
const NOTE_MAX = 500;

/**
 * Props of {@link StatusChangeForm}.
 */
interface StatusChangeFormProps {
  /** Order being moved. */
  order: RepairOrderDetail;
  /** Receives the order with its new stage and history. */
  onChanged: (order: RepairOrderDetail) => void;
}

/**
 * Moves an order to another stage, forward or back, with an optional note for the history.
 *
 * The suggested stage is the next one in the process; the current stage cannot be chosen,
 * because the API refuses a change that changes nothing.
 *
 * @param props - Order and change callback.
 * @returns The form.
 */
export function StatusChangeForm({ order, onChanged }: StatusChangeFormProps) {
  const { notify } = useToast();
  const currentIndex: number = REPAIR_STATUSES.indexOf(order.status);
  const suggested: RepairStatus | null = REPAIR_STATUSES[currentIndex + 1] ?? null;
  const [target, setTarget] = useState<RepairStatus | null>(suggested);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState<boolean>(false);

  /**
   * Sends the change and reports the result.
   *
   * @param event - Submit event of the form.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!target) {
      setError("Elige la etapa a la que pasa la orden.");
      return;
    }
    if (note.length > NOTE_MAX) {
      setError(`La nota puede tener hasta ${NOTE_MAX} caracteres.`);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      const updated: RepairOrderDetail = await changeOrderStatus(order.id, target, note.trim());
      onChanged(updated);
      setNote("");
      setTarget(REPAIR_STATUSES[REPAIR_STATUSES.indexOf(updated.status) + 1] ?? null);
      notify({ tone: "success", title: `Orden movida a ${REPAIR_STATUS_LABELS[updated.status]}` });
    } catch (caught: unknown) {
      notify({ tone: "error", title: "No se pudo cambiar la etapa", description: toApiError(caught).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4" data-tour="status-change">
      <Field label="Nueva etapa" error={error} required>
        {(controlProps) => (
          <Select value={target} onValueChange={(value) => setTarget(value as RepairStatus | null)}>
            <SelectTrigger className="w-full" {...controlProps}>
              <SelectValue placeholder="Elige una etapa">
                {(value: RepairStatus | null) => (value ? REPAIR_STATUS_LABELS[value] : "Elige una etapa")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REPAIR_STATUSES.filter((stage) => stage !== order.status).map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {REPAIR_STATUS_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label="Nota para el historial" hint="Opcional. Explica por qué cambia, sobre todo si vuelve a una etapa anterior.">
        <Textarea value={note} maxLength={NOTE_MAX} onChange={(event) => setNote(event.target.value)} rows={3} />
      </Field>
      <Button type="submit" disabled={saving} className="self-start">
        {saving ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuArrowRightLeft aria-hidden />}
        {saving ? "Guardando..." : "Cambiar etapa"}
      </Button>
    </form>
  );
}
