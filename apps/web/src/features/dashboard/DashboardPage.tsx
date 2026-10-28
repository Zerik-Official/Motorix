import { Link } from "react-router";

import { ErrorState } from "@shared/components/ErrorState";
import { PageHeader } from "@shared/components/PageHeader";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { useSession } from "@shared/session/useSession";

import { fetchRecentOrders, fetchSummary } from "./api";
import { RecentOrders } from "./components/RecentOrders";
import { StageBoard } from "./components/StageBoard";

/**
 * How many recent orders the board lists.
 */
const RECENT_LIMIT = 8;

/**
 * Home of the app: how many engines each bay holds and the latest orders.
 *
 * @returns The dashboard.
 */
export function DashboardPage() {
  useDocumentTitle("Tablero");
  const { can, profile } = useSession();
  const allowed: boolean = can("repair_orders:read");
  const summary = useAsync(() => (allowed ? fetchSummary() : Promise.resolve(null)), String(allowed));
  const recent = useAsync(() => (allowed ? fetchRecentOrders(RECENT_LIMIT) : Promise.resolve(null)), String(allowed));
  const firstName: string = profile?.full_name.split(" ")[0] ?? "";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Tablero del taller"
        description={
          summary.data
            ? `Hola, ${firstName}. Hay ${summary.data.total} ${summary.data.total === 1 ? "orden registrada" : "órdenes registradas"} entre las siete etapas.`
            : `Hola, ${firstName}. Así está el taller en este momento.`
        }
      />

      {!allowed ? (
        <p role="note" className="rounded-md border border-line bg-panel p-4 text-fg-muted">
          Tu rol no tiene acceso a las órdenes de reparación. Pide a un administrador el permiso de consulta.
        </p>
      ) : (
        <>
          <section aria-labelledby="board-title" className="flex flex-col gap-3">
            <h2 id="board-title" className="sr-only">
              Etapas del proceso
            </h2>
            {summary.error ? <ErrorState error={summary.error} onRetry={summary.reload} /> : <StageBoard summary={summary.data} />}
          </section>

          <section aria-labelledby="recent-title" className="flex flex-col gap-3" data-tour="recent-orders">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="recent-title" className="font-wide text-lg font-semibold text-fg">
                Últimas órdenes
              </h2>
              <Link to="/app/ordenes" className="text-sm font-medium">
                Ver todas las órdenes
              </Link>
            </div>
            {recent.error ? <ErrorState error={recent.error} onRetry={recent.reload} /> : <RecentOrders orders={recent.data} />}
          </section>
        </>
      )}
    </div>
  );
}
