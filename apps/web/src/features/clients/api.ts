import type { ClientOption } from "@shared/api/catalog";
import { businessApi } from "@shared/api/http";
import { isActiveParam, type ActiveFilter, type OffsetPage } from "@shared/api/pagination";
import type { IdentificationType } from "@shared/domain/identification";

/**
 * Client with its record dates.
 */
export interface Client extends ClientOption {
  created_at: string;
  updated_at: string;
}

/**
 * Fields a client is registered or edited with; an edit replaces all of them.
 */
export interface ClientFields {
  name: string;
  identification_type: IdentificationType;
  identification_number: string;
  email: string;
}

/**
 * Filters of the client listing.
 */
export interface ClientFilters {
  search?: string;
  active: ActiveFilter;
}

/**
 * How many clients each page of the listing brings.
 */
export const CLIENT_PAGE_SIZE = 20;

/**
 * Fetches one page of clients, newest first.
 *
 * @param filters - Search and active filter.
 * @param page - Page to fetch, starting at 1.
 * @returns The page with the total of matching clients.
 */
export async function fetchClients(filters: ClientFilters, page: number): Promise<OffsetPage<Client>> {
  const response = await businessApi.get<OffsetPage<Client>>("/clients", {
    params: {
      search: filters.search || undefined,
      is_active: isActiveParam(filters.active),
      limit: CLIENT_PAGE_SIZE,
      offset: (page - 1) * CLIENT_PAGE_SIZE,
    },
  });
  return response.data;
}

/**
 * Fetches one client with its record dates.
 *
 * @param id - Identifier of the client.
 * @returns The client.
 */
export async function fetchClientDetail(id: string): Promise<Client> {
  return (await businessApi.get<Client>(`/clients/${id}`)).data;
}

/**
 * Registers a client.
 *
 * @param fields - Fields of the client.
 * @returns The registered client.
 */
export async function createClient(fields: ClientFields): Promise<Client> {
  return (await businessApi.post<Client>("/clients", fields)).data;
}

/**
 * Replaces the fields of a client.
 *
 * @param id - Identifier of the client.
 * @param fields - New values of every field.
 * @returns The updated client.
 */
export async function updateClient(id: string, fields: ClientFields): Promise<Client> {
  return (await businessApi.put<Client>(`/clients/${id}`, fields)).data;
}

/**
 * Reactivates a client, keeping the rest of its fields.
 *
 * @param client - Client to reactivate.
 * @returns The reactivated client.
 */
export async function reactivateClient(client: Client): Promise<Client> {
  const fields: ClientFields = {
    name: client.name,
    identification_type: client.identification_type as IdentificationType,
    identification_number: client.identification_number,
    email: client.email,
  };
  return (await businessApi.put<Client>(`/clients/${client.id}`, { ...fields, is_active: true })).data;
}

/**
 * Deactivates a client; its record and history are kept.
 *
 * @param id - Identifier of the client.
 * @returns The deactivated client.
 */
export async function deactivateClient(id: string): Promise<Client> {
  return (await businessApi.delete<Client>(`/clients/${id}`)).data;
}
