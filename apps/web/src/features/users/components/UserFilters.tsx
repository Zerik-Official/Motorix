import { useEffect, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { ACTIVE_FILTER_LABELS, type ActiveFilter } from "@shared/api/pagination";
import { Field } from "@shared/components/Field";
import { ROLE_LABELS } from "@shared/session/roles";
import type { Role } from "@shared/session/types";

import type { UserFilters as Filters } from "../api";

/**
 * How long the search waits after the last keystroke, in milliseconds.
 */
const SEARCH_DELAY_MS = 350;

/**
 * Value of the role select that means "every role".
 */
const ALL = "all";

/**
 * Props of {@link UserFilters}.
 */
interface UserFiltersProps {
  /** Filters in effect. */
  filters: Filters;
  /** Receives the new filters. */
  onChange: (filters: Filters) => void;
}

/**
 * Search box and filters by role and active state of the account listing. The search waits
 * until the person stops typing.
 *
 * @param props - Filters in effect and change callback.
 * @returns The filters.
 */
export function UserFilters({ filters, onChange }: UserFiltersProps) {
  const [text, setText] = useState<string>(filters.search ?? "");
  const changed: boolean = Boolean(filters.search || filters.role) || filters.active !== "active";

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
      aria-label="Buscar y filtrar cuentas"
      data-tour="user-filters"
      className="grid gap-3 rounded-lg border border-line bg-panel p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto] xl:items-end"
    >
      <Field label="Buscar">
        {(controlProps) => (
          <div className="relative">
            <LuSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Nombre o correo"
              className="pl-9"
              {...controlProps}
            />
          </div>
        )}
      </Field>

      <Field label="Rol">
        {(controlProps) => (
          <Select value={filters.role ?? ALL} onValueChange={(value) => onChange({ ...filters, role: value === ALL || !value ? undefined : (value as Role) })}>
            <SelectTrigger className="w-full" {...controlProps}>
              <SelectValue>{(value: string) => (value === ALL ? "Todos" : ROLE_LABELS[value as Role])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

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
