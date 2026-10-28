import { useContext } from "react";

import { AppTourContext, type AppTourContextValue } from "./tour-context";

/**
 * Reads the controls of the guided tour.
 *
 * @returns The controls.
 * @throws Error When used outside `AppTourProvider`.
 */
export function useAppTour(): AppTourContextValue {
  const value: AppTourContextValue | null = useContext(AppTourContext);
  if (!value) {
    throw new Error("useAppTour must be used inside AppTourProvider");
  }
  return value;
}
