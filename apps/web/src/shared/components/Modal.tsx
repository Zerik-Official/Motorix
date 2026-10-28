import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

import { cn } from "@/lib/utils";

/**
 * Open modals in the order they were opened; only the last one answers Escape.
 */
const openModals: symbol[] = [];

/**
 * Elements that can receive focus inside a modal.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Props of {@link Modal}.
 */
interface ModalProps {
  /** Whether the modal is shown. */
  open: boolean;
  /** Closes the modal (close button, Escape or a click outside). */
  onClose: () => void;
  /** Title of the header, also the accessible name of the dialog. */
  title: string;
  /** Optional sentence under the title, also its accessible description. */
  description?: string;
  /** Body of the modal. */
  children: ReactNode;
  /** Buttons of the footer, if any. */
  footer?: ReactNode;
  /** Tailwind max width class of the dialog. */
  width?: string;
  /** Whether the person may close it; disabled while an action runs. */
  closable?: boolean;
}

/**
 * Dialog over the whole window, rendered in `document.body` through a portal.
 *
 * It is announced as a modal dialog, moves focus inside when it opens, keeps Tab inside it,
 * and gives focus back to the element that opened it when it closes. With a modal opened over
 * another one, Escape only closes the one on top. Tall bodies scroll inside the dialog.
 *
 * @param props - Component props.
 * @returns The dialog, or nothing while closed.
 */
export function Modal({ open, onClose, title, description, children, footer, width = "max-w-lg", closable = true }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<symbol | null>(null);
  const titleId: string = useId();
  const descriptionId: string = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const token: symbol = Symbol("modal");
    tokenRef.current = token;
    openModals.push(token);
    const opener: Element | null = document.activeElement;
    const first: HTMLElement | null | undefined = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
    const previousOverflow: string = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      openModals.splice(openModals.indexOf(token), 1);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent): void => {
      if (openModals[openModals.length - 1] !== tokenRef.current) {
        return;
      }
      if (event.key === "Escape" && closable) {
        onClose();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const items: HTMLElement[] = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) {
          return;
        }
        const firstItem: HTMLElement = items[0] as HTMLElement;
        const lastItem: HTMLElement = items[items.length - 1] as HTMLElement;
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closable, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      onMouseDown={(event) => closable && event.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-lg border border-line bg-panel shadow-2xl outline-none sm:max-h-[88dvh] sm:rounded-lg",
          width,
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-wide text-base font-semibold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          {closable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-raised hover:text-fg"
            >
              <LuX aria-hidden className="size-4" />
            </button>
          )}
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
