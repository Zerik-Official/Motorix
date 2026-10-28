import { Link } from "react-router";

import { StageBadge } from "@shared/components/StageBadge";
import { formatDate } from "@shared/format";

import type { RepairOrder } from "../api";

/**
 * Props of {@link OrdersList}.
 */
interface OrdersListProps {
  /** Orders to list. */
  orders: RepairOrder[];
}

/**
 * Repair orders as a table on wide screens and as cards on phones. The order number links to
 * its detail in both layouts.
 *
 * @param props - Orders to list.
 * @returns The list.
 */
export function OrdersList({ orders }: OrdersListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-line bg-panel md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Órdenes de reparación</caption>
          <thead>
            <tr className="border-b border-line bg-raised/50 text-left text-xs text-fg-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">Orden</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Motor</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Falla reportada</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Recibido</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Etapa</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-line last:border-b-0 hover:bg-raised/40">
                <td className="px-4 py-3">
                  <Link to={`/app/ordenes/${order.id}`} className="font-semibold text-fg tabular underline-offset-4 hover:underline">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-fg">{order.client.name}</td>
                <td className="px-4 py-3 text-fg-muted">
                  {order.engine.manufacturer} {order.engine.model}
                  <span className="block text-xs text-fg-subtle tabular">{order.engine.serial_number}</span>
                </td>
                <td className="max-w-64 px-4 py-3 text-fg-muted">
                  <span className="line-clamp-2">{order.reported_issue}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted tabular">{formatDate(order.received_at)}</td>
                <td className="px-4 py-3">
                  <StageBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Órdenes de reparación">
        {orders.map((order) => (
          <li key={order.id} className="rounded-md border border-line bg-panel p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/app/ordenes/${order.id}`} className="font-semibold text-fg tabular underline-offset-4 hover:underline">
                {order.order_number}
              </Link>
              <StageBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-fg">{order.client.name}</p>
            <p className="text-sm text-fg-muted">
              {order.engine.manufacturer} {order.engine.model}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-fg-subtle">{order.reported_issue}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
