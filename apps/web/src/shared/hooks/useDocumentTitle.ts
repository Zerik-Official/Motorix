import { useEffect } from "react";

/**
 * Name of the app, appended to every page title.
 */
const APP_NAME = "Motorix";

/**
 * Sets the title of the browser tab, which screen readers announce after each navigation.
 *
 * @param title - Title of the page, or null for the home page.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : `${APP_NAME} | Taller de motores de minería pesada`;
  }, [title]);
}
