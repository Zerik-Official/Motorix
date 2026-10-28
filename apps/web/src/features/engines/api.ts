import type { EngineOption } from "@shared/api/catalog";
import { businessApi } from "@shared/api/http";
import { isActiveParam, type ActiveFilter, type OffsetPage } from "@shared/api/pagination";

/**
 * Engine with its record dates.
 */
export interface Engine extends EngineOption {
  registered_at: string;
  updated_at: string;
}

/**
 * Fields an engine is registered or edited with; an edit replaces all of them.
 */
export interface EngineFields {
  serial_number: string;
  manufacturer: string;
  model: string;
  engine_type: string;
  power_rating: string;
  client_id: string;
}

/**
 * Filters of the engine listing.
 */
export interface EngineFilters {
  search?: string;
  clientId?: string;
  active: ActiveFilter;
}

/**
 * How many engines each page of the listing brings.
 */
export const ENGINE_PAGE_SIZE = 20;

/**
 * Fetches one page of engines, the most recently registered first.
 *
 * @param filters - Search, owner and active filter.
 * @param page - Page to fetch, starting at 1.
 * @param pageSize - Engines per page.
 * @returns The page with the total of matching engines.
 */
export async function fetchEngines(filters: EngineFilters, page: number, pageSize: number = ENGINE_PAGE_SIZE): Promise<OffsetPage<Engine>> {
  const response = await businessApi.get<OffsetPage<Engine>>("/engines", {
    params: {
      search: filters.search || undefined,
      client_id: filters.clientId || undefined,
      is_active: isActiveParam(filters.active),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  });
  return response.data;
}

/**
 * Fetches one engine with its record dates.
 *
 * @param id - Identifier of the engine.
 * @returns The engine.
 */
export async function fetchEngineDetail(id: string): Promise<Engine> {
  return (await businessApi.get<Engine>(`/engines/${id}`)).data;
}

/**
 * Registers an engine for a client.
 *
 * @param fields - Fields of the engine.
 * @returns The registered engine.
 */
export async function createEngine(fields: EngineFields): Promise<Engine> {
  return (await businessApi.post<Engine>("/engines", fields)).data;
}

/**
 * Replaces the fields of an engine, its owner included.
 *
 * @param id - Identifier of the engine.
 * @param fields - New values of every field.
 * @returns The updated engine.
 */
export async function updateEngine(id: string, fields: EngineFields): Promise<Engine> {
  return (await businessApi.put<Engine>(`/engines/${id}`, fields)).data;
}

/**
 * Deactivates an engine; its record and its orders are kept.
 *
 * @param id - Identifier of the engine.
 * @returns The deactivated engine.
 */
export async function deactivateEngine(id: string): Promise<Engine> {
  return (await businessApi.delete<Engine>(`/engines/${id}`)).data;
}
