import { useCallback, useMemo, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { readActiveFilter, readPageNumber, type OffsetPage } from "@shared/api/pagination";
import { ErrorState } from "@shared/components/ErrorState";
import { ListPagination } from "@shared/components/ListPagination";
import { PageHeader } from "@shared/components/PageHeader";
import { useToast } from "@shared/feedback/useToast";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Can } from "@shared/session/Can";

import { CLIENT_PAGE_SIZE, fetchClients, type Client, type ClientFilters as Filters } from "./api";
import { ClientFilters } from "./components/ClientFilters";
import { ClientFormModal } from "./components/ClientFormModal";
import { ClientsList } from "./components/ClientsList";

/**
 * Writes the filters and the page to a query string, leaving out the defaults.
 *
 * @param filters - Filters to keep.
 * @param page - Page to keep.
 * @returns The query string values.
 */
function writeParams(filters: Filters, page: number = 1): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.search) {
    params.q = filters.search;
  }
  if (filters.active !== "active") {
    params.estado = filters.active;
  }
  if (page > 1) {
    params.pagina = String(page);
  }
  return params;
}

/**
 * List of clients with search, active filter and numbered pages, kept in the address so a
 * filtered list can be shared or reloaded.
 *
 * @returns The page.
 */
export function ClientsPage() {
  useDocumentTitle("Clientes");
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState<boolean>(false);
  const filters: Filters = useMemo(() => ({ search: params.get("q") || undefined, active: readActiveFilter(params.get("estado")) }), [params]);
  const page: number = readPageNumber(params.get("pagina"));
  const list = useAsync<OffsetPage<Client>>(() => fetchClients(filters, page), `${JSON.stringify(filters)}#${page}`);
  const filtered: boolean = Boolean(filters.search) || filters.active !== "active";

  const changeFilters = useCallback((next: Filters) => setParams(writeParams(next), { replace: true }), [setParams]);

  /**
   * Moves to another page and back to the top of the list.
   *
   * @param next - Page to show.
   */
  const changePage = (next: number): void => {
    setParams(writeParams(filters, next));
    window.scrollTo({ top: 0 });
  };

  /**
   * Confirms the new client and opens its detail.
   *
   * @param client - Registered client.
   */
  const handleCreated = (client: Client): void => {
    setCreating(false);
    notify({ tone: "success", title: "Cliente registrado", description: `${client.name} ya puede tener motores y órdenes.` });
    navigate(`/app/clientes/${client.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Empresas y personas dueñas de los motores que entran al taller."
        actions={
          <Can permission="clients:write">
            <Button onClick={() => setCreating(true)} data-tour="new-client">
              <LuPlus aria-hidden />
              Nuevo cliente
            </Button>
          </Can>
        }
      />

      <ClientFilters filters={filters} onChange={changeFilters} />

      <section aria-labelledby="clients-results" aria-busy={list.loading} className="flex flex-col gap-4" data-tour="clients-results">
        <h2 id="clients-results" className="sr-only">
          Resultados
        </h2>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong p-8 text-center text-fg-muted">
            {filtered || page > 1
              ? "Ningún cliente coincide con la búsqueda. Prueba con otros filtros o límpialos."
              : "Todavía no hay clientes. Registra el primero con Nuevo cliente."}
          </p>
        ) : (
          <>
            <p className="text-sm text-fg-subtle" role="status">
              {list.data.total} {list.data.total === 1 ? "cliente" : "clientes"}
              {list.data.total > CLIENT_PAGE_SIZE && `, página ${page} de ${Math.ceil(list.data.total / CLIENT_PAGE_SIZE)}`}.
            </p>
            <div className={list.loading ? "opacity-60 transition-opacity" : undefined}>
              <ClientsList clients={list.data.items} />
            </div>
            <ListPagination page={page} total={list.data.total} pageSize={CLIENT_PAGE_SIZE} onChange={changePage} />
          </>
        )}
      </section>

      {creating && <ClientFormModal onClose={() => setCreating(false)} onSaved={handleCreated} />}
    </div>
  );
}
