import { useEffect, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { fetchClient, searchClients, type ClientOption } from "@shared/api/catalog";
import { ACTIVE_FILTER_LABELS, type ActiveFilter } from "@shared/api/pagination";
import { AsyncPicker } from "@shared/components/AsyncPicker";
import { Field } from "@shared/components/Field";
import { formatIdentification } from "@shared/domain/identification";
import { useAsync } from "@shared/hooks/useAsync";
import { useSession } from "@shared/session/useSession";

import type { EngineFilters as Filters } from "../api";

/**
 * How long the search waits after the last keystroke, in milliseconds.
 */
const SEARCH_DELAY_MS = 350;

/**
 * Props of {@link EngineFilters}.
 */
interface EngineFiltersProps {
  /** Filters in effect. */
  filters: Filters;
  /** Receives the new filters. */
  onChange: (filters: Filters) => void;
}

/**
 * Search box and filters by owner and active state of the engine listing. The search waits
 * until the person stops typing, and the owner filter only shows when the role can read clients.
 *
 * @param props - Filters in effect and change callback.
 * @returns The filters.
 */
export function EngineFilters({ filters, onChange }: EngineFiltersProps) {
  const { can } = useSession();
  const [text, setText] = useState<string>(filters.search ?? "");
  const client = useAsync(() => (filters.clientId ? fetchClient(filters.clientId) : Promise.resolve(null)), filters.clientId ?? "");
  const changed: boolean = Boolean(filters.search || filters.clientId) || filters.active !== "active";

  useEffect(() => {
    const trimmed: string = text.trim();
    if (trimmed === (filters.search ?? "")) {
      return;
    }
    const timer: number = window.setTimeout(() => onChange({ ...filters, search: trimmed || undefined }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [text, filters, onChange]);

  return (
    <search
      aria-label="Buscar y filtrar motores"
      data-tour="engine-filters"
      className="grid gap-3 rounded-lg border border-line bg-panel p-4 md:grid-cols-2 xl:grid-cols-[2fr_1.5fr_1fr_auto] xl:items-end"
    >
      <Field label="Buscar">
        {(controlProps) => (
          <div className="relative">
            <LuSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Serie, fabricante o modelo"
              className="pl-9"
              {...controlProps}
            />
          </div>
        )}
      </Field>

      {can("clients:read") && (
        <Field label="Cliente">
          <AsyncPicker<ClientOption>
            value={filters.clientId ? client.data : null}
            onChange={(next) => onChange({ ...filters, clientId: next?.id })}
            search={searchClients}
            getKey={(item) => item.id}
            getLabel={(item) => item.name}
            getDescription={(item) => formatIdentification(item.identification_type, item.identification_number)}
            placeholder="Todos los clientes"
          />
        </Field>
      )}

      <Field label="Estado">
        {(controlProps) => (
          <Select value={filters.active} onValueChange={(value) => value && onChange({ ...filters, active: value as ActiveFilter })}>
            <SelectTrigger className="w-full" {...controlProps}>
              <SelectValue>{(value: string) => ACTIVE_FILTER_LABELS[value as ActiveFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ACTIVE_FILTER_LABELS) as ActiveFilter[]).map((option) => (
                <SelectItem key={option} value={option}>
                  {ACTIVE_FILTER_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Button
        variant="ghost"
        onClick={() => {
          setText("");
          onChange({ active: "active" });
        }}
        disabled={!changed}
        className="justify-self-start"
      >
        <LuX aria-hidden />
        Limpiar filtros
      </Button>
    </search>
  );
}
