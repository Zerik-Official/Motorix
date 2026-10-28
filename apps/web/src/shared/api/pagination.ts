/**
 * One page of an offset paginated listing, as both clients and engines return it.
 */
export interface OffsetPage<ItemT> {
  items: ItemT[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Which records of a listing to keep by their active flag.
 */
export type ActiveFilter = "active" | "inactive" | "all";

/**
 * Name of each active filter, as shown in the select.
 */
export const ACTIVE_FILTER_LABELS: Record<ActiveFilter, string> = {
  active: "Activos",
  inactive: "Inactivos",
  all: "Todos",
};

/**
 * Value of the `is_active` query parameter for an active filter.
 *
 * @param filter - Filter chosen in the page.
 * @returns True, false, or nothing to keep every record.
 */
export function isActiveParam(filter: ActiveFilter): boolean | undefined {
  return filter === "all" ? undefined : filter === "active";
}

/**
 * Reads the page number kept in the address.
 *
 * @param value - Value of the `pagina` query parameter.
 * @returns The page, starting at 1.
 */
export function readPageNumber(value: string | null): number {
  const page: number = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * Reads the active filter kept in the address; active records are the default.
 *
 * @param value - Value of the `estado` query parameter.
 * @returns The filter.
 */
export function readActiveFilter(value: string | null): ActiveFilter {
  return value === "inactive" || value === "all" ? value : "active";
}

/**
 * Entry of the page row: a page number or a gap between distant pages.
 */
export type PageEntry = number | "gap";

/**
 * Page numbers to show: the first, the last, and the ones around the current page, with gaps
 * where pages are skipped.
 *
 * @param current - Current page, starting at 1.
 * @param count - Number of pages.
 * @returns The entries in order.
 */
export function pageEntries(current: number, count: number): PageEntry[] {
  const pages: number[] = [...new Set([1, current - 1, current, current + 1, count])]
    .filter((page) => page >= 1 && page <= count)
    .sort((first, second) => first - second);
  const entries: PageEntry[] = [];
  for (const page of pages) {
    const previous: PageEntry | undefined = entries[entries.length - 1];
    if (typeof previous === "number" && page - previous === 2) {
      entries.push(previous + 1);
    } else if (typeof previous === "number" && page - previous > 2) {
      entries.push("gap");
    }
    entries.push(page);
  }
  return entries;
}
