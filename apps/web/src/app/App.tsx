import { RouterProvider } from "react-router";

import { TooltipProvider } from "@/components/ui/Tooltip";
import { ToastProvider } from "@shared/feedback/ToastProvider";
import { SessionProvider } from "@shared/session/SessionProvider";

import { router } from "./router";

/**
 * Root of the web app: session, notifications and tooltips around the router.
 *
 * @returns The app.
 */
export function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
