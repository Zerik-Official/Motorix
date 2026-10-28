import { Link } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { StageBadge } from "@shared/components/StageBadge";

import type { RecentRepairOrder } from "../api";

/**
 * Formats a date as the workshop reads it, such as "28 oct 2026".
 */
const DATE_FORMAT: Intl.DateTimeFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

/**
 * Props of {@link RecentOrders}.
 */
interface RecentOrdersProps {
  /** Orders to list, or null while loading. */
  orders: RecentRepairOrder[] | null;
}

/**
 * Latest repair orders: a table on wide screens and a list of cards on phones.
 *
 * @param props - Orders to list.
 * @returns The list.
 */
export function RecentOrders({ orders }: RecentOrdersProps) {
  if (orders === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando órdenes recientes">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line-strong p-6 text-center text-fg-muted">
        Todavía no hay órdenes de reparación. Cuando recepción registre la primera, aparecerá aquí.
      </p>
    );
  }

  return (
    <>
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">Órdenes de reparación más recientes</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-fg-subtle">
            <th scope="col" className="py-2 pr-3 font-medium">Orden</th>
            <th scope="col" className="py-2 pr-3 font-medium">Cliente</th>
            <th scope="col" className="py-2 pr-3 font-medium">Motor</th>
            <th scope="col" className="py-2 pr-3 font-medium">Recibido</th>
            <th scope="col" className="py-2 font-medium">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-line last:border-b-0">
              <td className="py-2.5 pr-3 font-semibold tabular">
                <Link to={`/app/ordenes/${order.id}`} className="text-fg underline-offset-4 hover:underline">
                  {order.order_number}
                </Link>
              </td>
              <td className="py-2.5 pr-3 text-fg">{order.client.name}</td>
              <td className="py-2.5 pr-3 text-fg-muted">
                {order.engine.manufacturer} {order.engine.model}
                <span className="block text-xs text-fg-subtle tabular">{order.engine.serial_number}</span>
              </td>
              <td className="py-2.5 pr-3 text-fg-muted tabular">{DATE_FORMAT.format(new Date(order.received_at))}</td>
              <td className="py-2.5">
                <StageBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Órdenes de reparación más recientes">
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
            <p className="text-xs text-fg-subtle tabular">Serie {order.engine.serial_number}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
