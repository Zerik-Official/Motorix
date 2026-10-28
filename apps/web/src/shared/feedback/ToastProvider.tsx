import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuX } from "react-icons/lu";

import { cn } from "@/lib/utils";

import { ToastContext, type Toast, type ToastContextValue, type ToastTone } from "./toast-context";

/**
 * How long a notification stays on screen, in milliseconds; errors stay longer.
 */
const DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 5000, error: 8000 };

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-l-ok",
  error: "border-l-danger",
  info: "border-l-info",
};

const TONE_ICONS: Record<ToastTone, ReactNode> = {
  success: <LuCircleCheck aria-hidden className="size-5 text-ok" />,
  error: <LuCircleAlert aria-hidden className="size-5 text-danger" />,
  info: <LuInfo aria-hidden className="size-5 text-info" />,
};

/**
 * Props of {@link ToastProvider}.
 */
interface ToastProviderProps {
  /** The app. */
  children: ReactNode;
}

/**
 * Shows confirmations and errors in the corner of the screen.
 *
 * Successes and information are announced politely (`role="status"`) and errors at once
 * (`role="alert"`), so screen readers report them without the person moving focus.
 *
 * @param props - The app.
 * @returns The provider and its notification area.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef<number>(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id: number = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[toast.tone]);
    },
    [dismiss],
  );

  const value: ToastContextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        aria-label="Notificaciones"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-l-4 border-line bg-panel p-3.5 shadow-lg sm:w-96",
              TONE_STYLES[toast.tone],
            )}
          >
            {TONE_ICONS[toast.tone]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-sm text-fg-muted">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Cerrar notificación"
              className="cursor-pointer rounded-sm p-0.5 text-fg-subtle hover:bg-raised hover:text-fg"
            >
              <LuX aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  );
}
