import { createContext } from "react";

/**
 * Kind of a notification, which sets its color and how assistive technology announces it.
 */
export type ToastTone = "success" | "error" | "info";

/**
 * Notification shown in the corner of the screen.
 */
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

/**
 * Functions to show notifications.
 */
export interface ToastContextValue {
  /**
   * Shows a notification.
   *
   * @param toast - Kind, title and optional description.
   */
  notify: (toast: Omit<Toast, "id">) => void;
}

/**
 * Context of the notifications; read it through `useToast`.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);
