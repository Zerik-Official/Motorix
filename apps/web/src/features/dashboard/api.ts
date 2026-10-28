import { businessApi } from "@shared/api/http";
import type { RepairStatus } from "@shared/domain/repair-status";

/**
 * Number of repair orders in one stage.
 */
export interface StatusCount {
  status: RepairStatus;
  count: number;
}

/**
 * Number of repair orders per stage, in workshop order.
 */
export interface RepairOrderSummary {
  total: number;
  by_status: StatusCount[];
}

/**
 * Repair order as listed on the board.
 */
export interface RecentRepairOrder {
  id: string;
  order_number: string;
  status: RepairStatus;
  reported_issue: string;
  received_at: string;
  technician_name: string | null;
  engine: { id: string; serial_number: string; manufacturer: string; model: string };
  client: { id: string; name: string; identification_number: string };
}

/**
 * Fetches how many orders each stage holds.
 *
 * @returns The summary.
 */
export async function fetchSummary(): Promise<RepairOrderSummary> {
  const response = await businessApi.get<RepairOrderSummary>("/repair-orders/summary");
  return response.data;
}

/**
 * Fetches the most recent repair orders.
 *
 * @param limit - How many orders to fetch.
 * @returns The orders, newest first.
 */
export async function fetchRecentOrders(limit: number): Promise<RecentRepairOrder[]> {
  const response = await businessApi.get<{ items: RecentRepairOrder[] }>("/repair-orders", { params: { limit } });
  return response.data.items;
}
