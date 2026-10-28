import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Props of {@link DetailItem}.
 */
interface DetailItemProps {
  /** Name of the value. */
  term: string;
  /** Value, or nothing when it was not recorded. */
  children: ReactNode;
  /** Extra classes of the wrapper, such as a column span. */
  className?: string;
}

/**
 * One term and value of a description list; empty values read "Sin registrar".
 *
 * @param props - Term, value and extra classes.
 * @returns The pair.
 */
export function DetailItem({ term, children, className }: DetailItemProps) {
  const empty: boolean = children === null || children === undefined || children === "";
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt className="text-xs font-medium text-fg-subtle">{term}</dt>
      <dd className={empty ? "text-sm text-fg-faint" : "text-sm wrap-break-word whitespace-pre-line text-fg"}>{empty ? "Sin registrar" : children}</dd>
    </div>
  );
}
