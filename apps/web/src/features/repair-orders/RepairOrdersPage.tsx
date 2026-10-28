import { useCallback, useMemo, useState } from "react";
import { LuLoaderCircle, LuPlus } from "react-icons/lu";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toApiError, type ApiError } from "@shared/api/errors";
import { ErrorState } from "@shared/components/ErrorState";
import { PageHeader } from "@shared/components/PageHeader";
import { REPAIR_STATUSES, type RepairStatus } from "@shared/domain/repair-status";
import { useToast } from "@shared/feedback/useToast";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Can } from "@shared/session/Can";

import { fetchOrders, type OrderFilters as Filters, type OrderPage, type RepairOrder, type RepairOrderDetail } from "./api";
import { CreateOrderModal } from "./components/CreateOrderModal";
import { OrderFilters } from "./components/OrderFilters";
import { OrdersList } from "./components/OrdersList";

/**
 * Reads the filters kept in the address, so a filtered list can be shared or reloaded.
 *
 * @param params - Query string of the page.
 * @returns The filters.
 */
function readFilters(params: URLSearchParams): Filters {
  const status: string | null = params.get("estado");
  return {
    search: params.get("q") || undefined,
    status: status && (REPAIR_STATUSES as readonly string[]).includes(status) ? (status as RepairStatus) : undefined,
    clientId: params.get("cliente") || undefined,
    engineId: params.get("motor") || undefined,
  };
}

/**
 * Writes the filters to a query string, leaving out the empty ones.
 *
 * @param filters - Filters to keep.
 * @returns The query string values.
 */
function writeFilters(filters: Filters): Record<string, string> {
  const entries: [string, string | undefined][] = [
    ["q", filters.search],
    ["estado", filters.status],
    ["cliente", filters.clientId],
    ["motor", filters.engineId],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
}

/**
 * Pages loaded after the first one, tied to the filters they belong to.
 */
interface ExtraPages {
  key: string;
  items: RepairOrder[];
  nextCursor: string | null;
}

/**
 * List of repair orders with search, filters by stage, client and engine, and "load more"
 * pagination over the keyset cursor of the API.
 *
 * @returns The page.
 */
export function RepairOrdersPage() {
  useDocumentTitle("Órdenes de reparación");
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const filters: Filters = useMemo(() => readFilters(params), [params]);
  const key: string = JSON.stringify(filters);
  const first = useAsync<OrderPage>(() => fetchOrders(filters), key);
  const [extra, setExtra] = useState<ExtraPages>({ key: "", items: [], nextCursor: null });
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [moreError, setMoreError] = useState<ApiError | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const extraForFilters: ExtraPages | null = extra.key === key ? extra : null;
  const orders: RepairOrder[] = [...(first.data?.items ?? []), ...(extraForFilters?.items ?? [])];
  const nextCursor: string | null = extraForFilters ? extraForFilters.nextCursor : (first.data?.next_cursor ?? null);

  const changeFilters = useCallback((next: Filters) => setParams(writeFilters(next), { replace: true }), [setParams]);

  /**
   * Loads the page after the last one shown.
   */
  const loadMore = async (): Promise<void> => {
    if (!nextCursor) {
      return;
    }
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page: OrderPage = await fetchOrders(filters, nextCursor);
      setExtra({ key, items: [...(extraForFilters?.items ?? []), ...page.items], nextCursor: page.next_cursor });
    } catch (caught: unknown) {
      setMoreError(toApiError(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Confirms a new order and opens its detail.
   *
   * @param order - Created order.
   */
  const handleCreated = (order: RepairOrderDetail): void => {
    notify({ tone: "success", title: `Orden ${order.order_number} abierta`, description: `${order.engine.manufacturer} ${order.engine.model} de ${order.client.name}.` });
    navigate(`/app/ordenes/${order.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Órdenes de reparación"
        description="Busca una orden por su número, la falla, la serie del motor o el cliente, o filtra por etapa."
        actions={
          <Can permission="repair_orders:write">
            <Button onClick={() => setCreating(true)} data-tour="new-order">
              <LuPlus aria-hidden />
              Nueva orden
            </Button>
          </Can>
        }
      />

      <OrderFilters filters={filters} onChange={changeFilters} />

      <section aria-labelledby="orders-results" aria-busy={first.loading} className="flex flex-col gap-4">
        <h2 id="orders-results" className="sr-only">
          Resultados
        </h2>
        {first.error ? (
          <ErrorState error={first.error} onRetry={first.reload} />
        ) : first.loading && !first.data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong p-8 text-center text-fg-muted">
            {Object.keys(writeFilters(filters)).length > 0
              ? "Ninguna orden coincide con la búsqueda. Prueba con otros filtros o límpialos."
              : "Todavía no hay órdenes. Abre la primera con Nueva orden."}
          </p>
        ) : (
          <>
            <p className="text-sm text-fg-subtle" role="status">
              {orders.length} {orders.length === 1 ? "orden mostrada" : "órdenes mostradas"}, de la más reciente a la más antigua.
            </p>
            <OrdersList orders={orders} />
          </>
        )}
        {moreError && <ErrorState error={moreError} onRetry={loadMore} />}
        {nextCursor && !first.error && (
          <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="self-center">
            {loadingMore && <LuLoaderCircle aria-hidden className="animate-spin" />}
            {loadingMore ? "Cargando..." : "Cargar más órdenes"}
          </Button>
        )}
      </section>

      <CreateOrderModal open={creating} onClose={() => setCreating(false)} onCreated={handleCreated} />
    </div>
  );
}
