import { REPAIR_STATUS_LABELS, stageColor } from "@shared/domain/repair-status";
import { formatDateTime } from "@shared/format";
import { useSession } from "@shared/session/useSession";

import type { StatusHistoryEntry } from "../api";

/**
 * Props of {@link HistoryTimeline}.
 */
interface HistoryTimelineProps {
  /** Status changes, oldest first. */
  entries: StatusHistoryEntry[];
}

/**
 * Status changes of an order, newest first, with who made each one and its note.
 *
 * business-api only knows the account identifier from the token, so changes by the signed in
 * account read "Tú" and the rest show the start of the identifier.
 *
 * @param props - Status changes.
 * @returns The timeline.
 */
export function HistoryTimeline({ entries }: HistoryTimelineProps) {
  const { profile } = useSession();
  const newestFirst: StatusHistoryEntry[] = [...entries].reverse();

  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-6" data-tour="history">
      {newestFirst.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            aria-hidden
            className="absolute top-1 -left-7.5 size-3.5 rounded-full border-2 border-panel"
            style={{ backgroundColor: stageColor(entry.to_status) }}
          />
          <p className="text-sm text-fg">
            {entry.from_status === null ? (
              <>
                Orden abierta en <strong>{REPAIR_STATUS_LABELS[entry.to_status]}</strong>
              </>
            ) : (
              <>
                De {REPAIR_STATUS_LABELS[entry.from_status]} a <strong>{REPAIR_STATUS_LABELS[entry.to_status]}</strong>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            <time dateTime={entry.changed_at}>{formatDateTime(entry.changed_at)}</time>
            {", por "}
            {entry.changed_by === profile?.id ? "ti" : `la cuenta ${entry.changed_by.slice(0, 8)}`}
          </p>
          {entry.note && <p className="mt-1.5 rounded-md bg-raised px-3 py-2 text-sm text-fg-muted">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}
