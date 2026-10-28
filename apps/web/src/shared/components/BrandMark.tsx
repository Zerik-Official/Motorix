import { cn } from "@/lib/utils";

/**
 * Props of {@link BrandMark}.
 */
interface BrandMarkProps {
  /** Extra classes of the wrapper. */
  className?: string;
  /** Hides the word, leaving only the badge. */
  compact?: boolean;
}

/**
 * Badge and name of Motorix.
 *
 * @param props - Extra classes and compact flag.
 * @returns The mark.
 */
export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-7 shrink-0">
        <rect width="32" height="32" rx="6" fill="var(--graphite)" />
        <path d="M7 23V9h3.2l5.8 8.2L21.8 9H25v14h-3.3v-8.6l-5.7 8-5.7-8V23z" fill="var(--safety)" />
      </svg>
      {!compact && <span className="font-wide text-lg font-bold tracking-tight text-fg">Motorix</span>}
    </span>
  );
}
