import { useState } from "react";
import { LuLoaderCircle, LuRotateCcw } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { toApiError } from "@shared/api/errors";
import { useToast } from "@shared/feedback/useToast";

/**
 * Props of {@link ReactivateButton}.
 */
interface ReactivateButtonProps {
  /** Reactivates the record; a failure is announced in a toast. */
  onReactivate: () => Promise<void>;
}

/**
 * Button that reactivates a deactivated client or engine. It needs no confirmation, since
 * reactivating only makes the record available again.
 *
 * @param props - Reactivation action.
 * @returns The button.
 */
export function ReactivateButton({ onReactivate }: ReactivateButtonProps) {
  const { notify } = useToast();
  const [running, setRunning] = useState<boolean>(false);

  /**
   * Runs the reactivation and announces why it failed, if it does.
   */
  const reactivate = async (): Promise<void> => {
    setRunning(true);
    try {
      await onReactivate();
    } catch (caught: unknown) {
      notify({ tone: "error", title: "No se pudo reactivar", description: toApiError(caught).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button variant="outline" onClick={reactivate} disabled={running}>
      {running ? <LuLoaderCircle aria-hidden className="animate-spin" /> : <LuRotateCcw aria-hidden />}
      {running ? "Reactivando..." : "Reactivar"}
    </Button>
  );
}
