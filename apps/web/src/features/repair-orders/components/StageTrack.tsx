import { LuCheck } from "react-icons/lu";

import { cn } from "@/lib/utils";
import { REPAIR_STATUS_LABELS, REPAIR_STATUSES, stageColor, type RepairStatus } from "@shared/domain/repair-status";

/**
 * Props of {@link StageTrack}.
 */
interface StageTrackProps {
  /** Current stage of the order. */
  status: RepairStatus;
}

/**
 * The seven stages of the workshop with the current one highlighted: stages before it are done,
 * stages after it are pending. It is an ordered list, and the current stage carries
 * `aria-current="step"`.
 *
 * @param props - Current stage.
 * @returns The track.
 */
export function StageTrack({ status }: StageTrackProps) {
  const currentIndex: number = REPAIR_STATUSES.indexOf(status);
  return (
    <ol aria-label="Etapas de la orden" data-tour="stage-track" className="grid grid-cols-7 gap-1">
      {REPAIR_STATUSES.map((stage, index) => {
        const done: boolean = index < currentIndex;
        const current: boolean = index === currentIndex;
        return (
          <li key={stage} aria-current={current ? "step" : undefined} className="flex min-w-0 flex-col gap-2">
            <span
              aria-hidden
              className={cn("h-2 rounded-full", !done && !current && "bg-raised-2")}
              style={done || current ? { backgroundColor: stageColor(stage) } : undefined}
            />
            <span className={cn("hidden items-center gap-1 text-xs md:flex", current ? "font-semibold text-fg" : "text-fg-subtle")}>
              {done && <LuCheck aria-hidden className="size-3.5 shrink-0" />}
              <span className="truncate">{REPAIR_STATUS_LABELS[stage]}</span>
            </span>
            <span className="sr-only">
              {REPAIR_STATUS_LABELS[stage]}: {done ? "completada" : current ? "etapa actual" : "pendiente"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
