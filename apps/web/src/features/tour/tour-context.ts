import { createContext } from "react";

/**
 * Controls of the guided tour shared with the rest of the app.
 */
export interface AppTourContextValue {
  /** Builds the tour for the signed in account and opens it at its first step. */
  start: () => Promise<void>;
  /** True while the tour is being prepared or shown. */
  active: boolean;
}

/**
 * Context of the guided tour; only available inside `AppTourProvider`.
 */
export const AppTourContext = createContext<AppTourContextValue | null>(null);
