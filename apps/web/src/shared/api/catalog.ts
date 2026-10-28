import { businessApi } from "./http";

/**
 * Client as listed by business-api.
 */
export interface ClientOption {
  id: string;
  name: string;
  identification_type: string;
  identification_number: string;
  email: string;
  is_active: boolean;
}

/**
 * Engine as listed by business-api.
 */
export interface EngineOption {
  id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  engine_type: string;
  power_rating: string;
  client_id: string;
  is_active: boolean;
}

/**
 * How many options a picker shows per search.
 */
const PICKER_LIMIT = 20;

/**
 * Searches active clients by name or identification number.
 *
 * @param search - Text typed by the user; empty lists the first clients.
 * @returns Up to twenty clients.
 */
export async function searchClients(search: string): Promise<ClientOption[]> {
  const response = await businessApi.get<{ items: ClientOption[] }>("/clients", {
    params: { search: search.trim() || undefined, is_active: true, limit: PICKER_LIMIT },
  });
  return response.data.items;
}

/**
 * Fetches one client.
 *
 * @param id - Identifier of the client.
 * @returns The client.
 */
export async function fetchClient(id: string): Promise<ClientOption> {
  return (await businessApi.get<ClientOption>(`/clients/${id}`)).data;
}

/**
 * Searches active engines by serial number, manufacturer or model, optionally of one client.
 *
 * @param search - Text typed by the user; empty lists the first engines.
 * @param clientId - Owner to restrict the search to, if any.
 * @returns Up to twenty engines.
 */
export async function searchEngines(search: string, clientId?: string | null): Promise<EngineOption[]> {
  const response = await businessApi.get<{ items: EngineOption[] }>("/engines", {
    params: { search: search.trim() || undefined, client_id: clientId || undefined, is_active: true, limit: PICKER_LIMIT },
  });
  return response.data.items;
}

/**
 * Fetches one engine.
 *
 * @param id - Identifier of the engine.
 * @returns The engine.
 */
export async function fetchEngine(id: string): Promise<EngineOption> {
  return (await businessApi.get<EngineOption>(`/engines/${id}`)).data;
}
