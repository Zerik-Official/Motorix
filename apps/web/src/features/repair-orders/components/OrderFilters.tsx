import { useEffect, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { fetchClient, fetchEngine, searchClients, searchEngines, type ClientOption, type EngineOption } from "@shared/api/catalog";
import { AsyncPicker } from "@shared/components/AsyncPicker";
import { Field } from "@shared/components/Field";
import { REPAIR_STATUS_LABELS, REPAIR_STATUSES, type RepairStatus } from "@shared/domain/repair-status";
import { useAsync } from "@shared/hooks/useAsync";
import { useSession } from "@shared/session/useSession";

import type { OrderFilters as Filters } from "../api";

/**
 * How long the search waits after the last keystroke, in milliseconds.
 */
const SEARCH_DELAY_MS = 350;

/**
 * Value of the stage select that means "every stage".
 */
const ALL = "all";

/**
 * Props of {@link OrderFilters}.
 */
interface OrderFiltersProps {
  /** Filters in effect. */
  filters: Filters;
  /** Receives the new filters. */
  onChange: (filters: Filters) => void;
}

/**
 * Search box and filters by stage, client and engine of the order listing.
 *
 * The search waits until the person stops typing. Client and engine are picked from a server
 * search, and the engine list narrows to the chosen client. Each filter only shows when the
 * role can read what it filters by.
 *
 * @param props - Filters in effect and change callback.
 * @returns The filters.
 */
export function OrderFilters({ filters, onChange }: OrderFiltersProps) {
  const { can } = useSession();
  const [text, setText] = useState<string>(filters.search ?? "");
  const client = useAsync(() => (filters.clientId ? fetchClient(filters.clientId) : Promise.resolve(null)), filters.clientId ?? "");
  const engine = useAsync(() => (filters.engineId ? fetchEngine(filters.engineId) : Promise.resolve(null)), filters.engineId ?? "");
  const active: boolean = Boolean(filters.search || filters.status || filters.clientId || filters.engineId);

  useEffect(() => {
    const trimmed: string = text.trim();
    if (trimmed === (filters.search ?? "")) {
      return;
    }
    const timer: number = window.setTimeout(() => onChange({ ...filters, search: trimmed || undefined }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, filters, onChange]);

  return (
    <search aria-label="Buscar y filtrar órdenes" data-tour="order-filters" className="grid gap-3 rounded-lg border border-line bg-panel p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1.5fr_1.5fr_auto] xl:items-end">
      <Field label="Buscar">
        {(controlProps) => (
          <div className="relative">
            <LuSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Número, falla, serie o cliente"
              className="pl-9"
              {...controlProps}
            />
          </div>
        )}
      </Field>

      <Field label="Etapa">
        {(controlProps) => (
          <Select
            value={filters.status ?? ALL}
            onValueChange={(value) => onChange({ ...filters, status: value === ALL || !value ? undefined : (value as RepairStatus) })}
          >
            <SelectTrigger className="w-full" {...controlProps}>
              <SelectValue>{(value: string) => (value === ALL ? "Todas" : REPAIR_STATUS_LABELS[value as RepairStatus])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {REPAIR_STATUSES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {REPAIR_STATUS_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      {can("clients:read") && (
        <Field label="Cliente">
          <AsyncPicker<ClientOption>
            value={filters.clientId ? client.data : null}
            onChange={(next) => onChange({ ...filters, clientId: next?.id, engineId: next ? filters.engineId : undefined })}
            search={searchClients}
            getKey={(item) => item.id}
            getLabel={(item) => item.name}
            getDescription={(item) => `${item.identification_type.toUpperCase()} ${item.identification_number}`}
            placeholder="Todos los clientes"
          />
        </Field>
      )}

      {can("engines:read") && (
        <Field label="Motor">
          <AsyncPicker<EngineOption>
            value={filters.engineId ? engine.data : null}
            onChange={(next) => onChange({ ...filters, engineId: next?.id })}
            search={(query) => searchEngines(query, filters.clientId)}
            scopeKey={filters.clientId ?? ""}
            getKey={(item) => item.id}
            getLabel={(item) => `${item.manufacturer} ${item.model}`}
            getDescription={(item) => `Serie ${item.serial_number}`}
            placeholder={filters.clientId ? "Motores del cliente" : "Todos los motores"}
          />
        </Field>
      )}

      <Button
        variant="ghost"
        onClick={() => {
          setText("");
          onChange({});
        }}
        disabled={!active}
        className="justify-self-start"
      >
        <LuX aria-hidden />
        Limpiar filtros
      </Button>
    </search>
  );
}
