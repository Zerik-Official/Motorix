import { businessApi } from "@shared/api/http";
import type { RepairStatus } from "@shared/domain/repair-status";

/**
 * Engine embedded in a repair order.
 */
export interface OrderEngine {
  id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
}

/**
 * Client embedded in a repair order.
 */
export interface OrderClient {
  id: string;
  name: string;
  identification_number: string;
}

/**
 * Repair order as listed.
 */
export interface RepairOrder {
  id: string;
  order_number: string;
  engine: OrderEngine;
  client: OrderClient;
  received_at: string;
  reported_issue: string;
  diagnosis: string | null;
  work_performed: string | null;
  technician_name: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  status: RepairStatus;
  observations: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * One status change of a repair order.
 */
export interface StatusHistoryEntry {
  id: string;
  from_status: RepairStatus | null;
  to_status: RepairStatus;
  note: string | null;
  changed_by: string;
  changed_at: string;
}

/**
 * Repair order with its whole history, oldest first.
 */
export interface RepairOrderDetail extends RepairOrder {
  history: StatusHistoryEntry[];
}

/**
 * Filters of the order listing.
 */
export interface OrderFilters {
  search?: string;
  status?: RepairStatus;
  clientId?: string;
  engineId?: string;
}

/**
 * One page of orders and the cursor of the next one.
 */
export interface OrderPage {
  items: RepairOrder[];
  next_cursor: string | null;
}

/**
 * Fields of a new repair order; its client is taken from the engine by the API.
 */
export interface NewRepairOrder {
  engine_id: string;
  reported_issue: string;
  diagnosis?: string;
  technician_name?: string;
  estimated_delivery_date?: string;
  observations?: string;
}

/**
 * How many orders each page of the listing brings.
 */
export const ORDER_PAGE_SIZE = 20;

/**
 * Fetches one page of orders, newest first.
 *
 * @param filters - Search and filters.
 * @param cursor - Cursor returned by the previous page; omitted for the first one.
 * @returns The page.
 */
export async function fetchOrders(filters: OrderFilters, cursor?: string | null): Promise<OrderPage> {
  const response = await businessApi.get<OrderPage>("/repair-orders", {
    params: {
      limit: ORDER_PAGE_SIZE,
      cursor: cursor || undefined,
      search: filters.search || undefined,
      status: filters.status || undefined,
      client_id: filters.clientId || undefined,
      engine_id: filters.engineId || undefined,
    },
  });
  return response.data;
}

/**
 * Fetches one order with its history.
 *
 * @param id - Identifier of the order.
 * @returns The order.
 */
export async function fetchOrder(id: string): Promise<RepairOrderDetail> {
  return (await businessApi.get<RepairOrderDetail>(`/repair-orders/${id}`)).data;
}

/**
 * Opens a repair order.
 *
 * @param order - Fields of the order.
 * @returns The created order with its first history entry.
 */
export async function createOrder(order: NewRepairOrder): Promise<RepairOrderDetail> {
  return (await businessApi.post<RepairOrderDetail>("/repair-orders", order)).data;
}

/**
 * Moves an order to another stage.
 *
 * @param id - Identifier of the order.
 * @param status - New stage.
 * @param note - Optional note kept in the history.
 * @returns The order with its updated history.
 */
export async function changeOrderStatus(id: string, status: RepairStatus, note?: string): Promise<RepairOrderDetail> {
  return (await businessApi.patch<RepairOrderDetail>(`/repair-orders/${id}/status`, { status, note: note || undefined })).data;
}
