import { REPAIR_STATUS_HINTS, REPAIR_STATUS_LABELS, REPAIR_STATUSES, stageColor } from "@shared/domain/repair-status";

/**
 * Route of an engine through the seven bays of the workshop, drawn as a vertical rail with one
 * stop per stage. On load a marker travels the rail once, the only animation of the page; it
 * stays still when the system asks for reduced motion.
 *
 * @returns The illustration, described for screen readers as the list of stages.
 */
export function BayRoute() {
  return (
    <figure aria-labelledby="bay-route-caption">
      <figcaption id="bay-route-caption" className="sr-only">
        Las siete etapas por las que pasa un motor: {REPAIR_STATUSES.map((stage) => REPAIR_STATUS_LABELS[stage]).join(", ")}.
      </figcaption>
      <ol aria-hidden className="relative flex flex-col gap-3">
        <span className="absolute top-4 bottom-4 left-4.25 w-0.5 bg-line-strong" />
        <span className="bay-route-marker absolute left-0 z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-panel bg-accent shadow-md" />
        {REPAIR_STATUSES.map((stage, index) => (
          <li key={stage} className="relative grid grid-cols-[2.25rem_1fr] items-center gap-3">
            <span
              className="relative z-10 flex size-9 items-center justify-center rounded-md border-2 bg-panel font-wide text-sm font-bold text-fg tabular"
              style={{ borderColor: stageColor(stage) }}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-wide text-sm font-semibold text-fg">{REPAIR_STATUS_LABELS[stage]}</span>
              <span className="block truncate text-xs text-fg-subtle">{REPAIR_STATUS_HINTS[stage]}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
