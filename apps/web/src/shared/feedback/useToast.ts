import { useContext } from "react";

import { ToastContext, type ToastContextValue } from "./toast-context";

/**
 * Reads the notification functions of the app.
 *
 * @returns The functions.
 * @throws Error When used outside `ToastProvider`.
 */
export function useToast(): ToastContextValue {
  const value: ToastContextValue | null = useContext(ToastContext);
  if (value === null) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value;
}
