import { LuLoaderCircle } from "react-icons/lu";

/**
 * Props of {@link FullScreenLoader}.
 */
interface FullScreenLoaderProps {
  /** What is being loaded, announced to screen readers. */
  label: string;
}

/**
 * Centered spinner shown while the whole screen waits, such as during session recovery.
 *
 * @param props - What is being loaded.
 * @returns The loader.
 */
export function FullScreenLoader({ label }: FullScreenLoaderProps) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh items-center justify-center gap-3 text-fg-muted">
      <LuLoaderCircle aria-hidden className="size-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
