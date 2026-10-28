import { AppLayout } from "./AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Frame of the app guarded by the session: anonymous visitors are sent to the login.
 *
 * @returns The protected layout.
 */
export function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
