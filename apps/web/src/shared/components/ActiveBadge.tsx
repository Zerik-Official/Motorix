import { cn } from "@/lib/utils";

/**
 * Props of {@link ActiveBadge}.
 */
interface ActiveBadgeProps {
  /** Whether the record is active. */
  active: boolean;
  /** Extra classes. */
  className?: string;
}

/**
 * Whether a client or an engine is active; the text carries the meaning, the color only helps.
 *
 * @param props - Active state and extra classes.
 * @returns The badge.
 */
export function ActiveBadge({ active, className }: ActiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        active ? "border-ok/40 bg-ok-soft text-fg" : "border-line bg-raised text-fg-muted",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", active ? "bg-ok" : "bg-fg-faint")} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}
