import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  REPAIR_STATUS_HINTS,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUSES,
  stageColor,
} from "@shared/domain/repair-status";

import type { RepairOrderSummary } from "../api";

/**
 * Props of {@link StageBoard}.
 */
interface StageBoardProps {
  /** Orders per stage, or null while loading. */
  summary: RepairOrderSummary | null;
}

/**
 * The workshop floor as seven bays in process order, each with how many engines it holds.
 *
 * The stages are a real sequence, so each bay carries its step number. The bar under each
 * count shows the share of all open work that bay holds. On narrow screens the bays stack.
 *
 * @param props - Orders per stage.
 * @returns The board.
 */
export function StageBoard({ summary }: StageBoardProps) {
  const counts: Map<string, number> = new Map(summary?.by_status.map((item) => [item.status, item.count]));
  const total: number = summary?.total ?? 0;

  return (
    <ol
      aria-label="Órdenes por etapa del proceso"
      data-tour="stage-board"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 lg:grid-cols-7"
    >
      {REPAIR_STATUSES.map((status, index) => {
        const count: number = counts.get(status) ?? 0;
        const share: number = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li
            key={status}
            className={cn("relative flex flex-col gap-2 bg-panel p-3 sm:p-4 lg:min-h-48", index === REPAIR_STATUSES.length - 1 && "col-span-2 sm:col-span-1")}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: stageColor(status) }} />
            <div className="flex items-baseline justify-between gap-2 pt-1">
              <span className="text-xs font-semibold text-fg-subtle tabular">Paso {index + 1}</span>
              {summary !== null && <span className="text-xs text-fg-subtle tabular">{share}%</span>}
            </div>
            <h2 className="font-wide text-sm font-semibold text-fg">{REPAIR_STATUS_LABELS[status]}</h2>
            {summary === null ? (
              <Skeleton className="h-10 w-16" />
            ) : (
              <p className="font-wide text-3xl leading-none font-bold text-fg tabular sm:text-4xl">
                {count}
                <span className="sr-only"> {count === 1 ? "orden" : "órdenes"}</span>
              </p>
            )}
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${share}%`, backgroundColor: stageColor(status) }} />
            </div>
            <p className="hidden text-xs text-fg-muted sm:block lg:mt-auto">{REPAIR_STATUS_HINTS[status]}</p>
          </li>
        );
      })}
    </ol>
  );
}
