import { cn } from "@/lib/utils";
import { REPAIR_STATUS_LABELS, stageColor, type RepairStatus } from "@shared/domain/repair-status";

/**
 * Props of {@link StageBadge}.
 */
interface StageBadgeProps {
  /** Stage to show. */
  status: RepairStatus;
  /** Extra classes. */
  className?: string;
}

/**
 * Name of a repair stage with its color; the text always carries the meaning, the color only helps.
 *
 * @param props - Stage and extra classes.
 * @returns The badge.
 */
export function StageBadge({ status, className }: StageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-0.5 text-xs font-medium whitespace-nowrap text-fg",
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: stageColor(status) }} />
      {REPAIR_STATUS_LABELS[status]}
    </span>
  );
}
