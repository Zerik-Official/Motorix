import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import type { ApiError } from "@shared/api/errors";

/**
 * Props of {@link ErrorState}.
 */
interface ErrorStateProps {
  /** Error to explain. */
  error: ApiError;
  /** Retries the failed load, if it makes sense. */
  onRetry?: () => void;
}

/**
 * Explains why a section could not load and offers to try again; announced as an alert.
 *
 * @param props - Error and retry action.
 * @returns The message.
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-danger/40 bg-danger-soft p-4 sm:flex-row sm:items-center">
      <LuTriangleAlert aria-hidden className="size-5 shrink-0 text-danger" />
      <p className="flex-1 text-sm text-fg">{error.message}</p>
      {onRetry && error.code !== "forbidden" && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <LuRefreshCw aria-hidden />
          Reintentar
        </Button>
      )}
    </div>
  );
}
