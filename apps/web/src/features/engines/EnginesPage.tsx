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

import { ENGINE_PAGE_SIZE, fetchEngines, type Engine, type EngineFilters as Filters } from "./api";
import { EngineFilters } from "./components/EngineFilters";
import { EngineFormModal } from "./components/EngineFormModal";
import { EnginesList } from "./components/EnginesList";

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
  if (filters.clientId) {
    params.cliente = filters.clientId;
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
 * List of engines with search, filters by owner and active state, and numbered pages, kept in
 * the address so a filtered list can be shared or reloaded.
 *
 * @returns The page.
 */
export function EnginesPage() {
  useDocumentTitle("Motores");
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState<boolean>(false);
  const filters: Filters = useMemo(
    () => ({ search: params.get("q") || undefined, clientId: params.get("cliente") || undefined, active: readActiveFilter(params.get("estado")) }),
    [params],
  );
  const page: number = readPageNumber(params.get("pagina"));
  const list = useAsync<OffsetPage<Engine>>(() => fetchEngines(filters, page), `${JSON.stringify(filters)}#${page}`);
  const filtered: boolean = Boolean(filters.search || filters.clientId) || filters.active !== "active";

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
   * Confirms the new engine and opens its detail.
   *
   * @param engine - Registered engine.
   */
  const handleCreated = (engine: Engine): void => {
    setCreating(false);
    notify({ tone: "success", title: "Motor registrado", description: `${engine.manufacturer} ${engine.model}, serie ${engine.serial_number}, ya puede recibir órdenes.` });
    navigate(`/app/motores/${engine.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Motores"
        description="Cada motor que el taller atiende, con su serie y su dueño."
        actions={
          <Can permission="engines:write">
            <Button onClick={() => setCreating(true)} data-tour="new-engine">
              <LuPlus aria-hidden />
              Nuevo motor
            </Button>
          </Can>
        }
      />

      <EngineFilters filters={filters} onChange={changeFilters} />

      <section aria-labelledby="engines-results" aria-busy={list.loading} className="flex flex-col gap-4">
        <h2 id="engines-results" className="sr-only">
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
              ? "Ningún motor coincide con la búsqueda. Prueba con otros filtros o límpialos."
              : "Todavía no hay motores. Registra el primero con Nuevo motor."}
          </p>
        ) : (
          <>
            <p className="text-sm text-fg-subtle" role="status">
              {list.data.total} {list.data.total === 1 ? "motor" : "motores"}
              {list.data.total > ENGINE_PAGE_SIZE && `, página ${page} de ${Math.ceil(list.data.total / ENGINE_PAGE_SIZE)}`}.
            </p>
            <div className={list.loading ? "opacity-60 transition-opacity" : undefined}>
              <EnginesList engines={list.data.items} />
            </div>
            <ListPagination page={page} total={list.data.total} pageSize={ENGINE_PAGE_SIZE} onChange={changePage} />
          </>
        )}
      </section>

      {creating && <EngineFormModal onClose={() => setCreating(false)} onSaved={handleCreated} />}
    </div>
  );
}
