import { useState, type ReactNode } from "react";
import { LuLoaderCircle } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { toApiError } from "@shared/api/errors";

import { Modal } from "./Modal";

/**
 * Props of {@link ConfirmModal}.
 */
interface ConfirmModalProps {
  /** Whether the modal is shown. */
  open: boolean;
  /** Closes the modal without doing anything. */
  onClose: () => void;
  /** Title of the modal; asks what is about to happen. */
  title: string;
  /** What happens if the person confirms. */
  children: ReactNode;
  /** Text of the confirm button, the same verb as the action. */
  confirmLabel: string;
  /** Text of the confirm button while the action runs. */
  pendingLabel: string;
  /** Runs the action; the modal closes when it resolves and shows the error when it fails. */
  onConfirm: () => Promise<void>;
  /** Messages that replace the default error messages for some codes. */
  errorMessages?: Partial<Record<string, string>>;
}

/**
 * Asks before an action that changes how a record can be used, such as deactivating it.
 *
 * @param props - Open state, texts, action and error messages.
 * @returns The modal.
 */
export function ConfirmModal({ open, onClose, title, children, confirmLabel, pendingLabel, onConfirm, errorMessages }: ConfirmModalProps) {
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clears the error and closes the modal.
   */
  const close = (): void => {
    setError(null);
    onClose();
  };

  /**
   * Runs the action and closes the modal, or shows why it failed.
   */
  const confirm = async (): Promise<void> => {
    setRunning(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (caught: unknown) {
      setError(toApiError(caught, errorMessages).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      closable={!running}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={running}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={running}>
            {running && <LuLoaderCircle aria-hidden className="animate-spin" />}
            {running ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-fg-muted">
        {children}
        {error && (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-fg">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
