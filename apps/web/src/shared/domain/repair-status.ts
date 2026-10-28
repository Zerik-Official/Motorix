/**
 * Stage of a repair order, in the order the workshop moves through them.
 */
export type RepairStatus =
  | "received"
  | "in_diagnosis"
  | "awaiting_approval"
  | "in_repair"
  | "in_testing"
  | "finished"
  | "delivered";

/**
 * Every stage, in workshop order.
 */
export const REPAIR_STATUSES: readonly RepairStatus[] = [
  "received",
  "in_diagnosis",
  "awaiting_approval",
  "in_repair",
  "in_testing",
  "finished",
  "delivered",
];

/**
 * Name of each stage as the workshop says it.
 */
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  received: "Recibido",
  in_diagnosis: "En diagnóstico",
  awaiting_approval: "Esperando aprobación",
  in_repair: "En reparación",
  in_testing: "En pruebas",
  finished: "Finalizado",
  delivered: "Entregado",
};

/**
 * What each stage means for the person reading the board.
 */
export const REPAIR_STATUS_HINTS: Record<RepairStatus, string> = {
  received: "El motor llegó y espera turno.",
  in_diagnosis: "Un técnico está buscando la falla.",
  awaiting_approval: "El cliente debe aprobar el presupuesto.",
  in_repair: "La reparación está en curso.",
  in_testing: "El motor está en banco de pruebas.",
  finished: "Listo para entregar.",
  delivered: "El cliente ya lo retiró.",
};

/**
 * CSS color of a stage, from the design tokens.
 *
 * @param status - Stage.
 * @returns A `var(--stage-*)` reference.
 */
export function stageColor(status: RepairStatus): string {
  return `var(--stage-${status})`;
}
