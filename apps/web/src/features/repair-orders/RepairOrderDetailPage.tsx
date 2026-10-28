import { useState, type ReactNode } from "react";
import { LuArrowLeft } from "react-icons/lu";
import { Link, useParams } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@shared/components/ErrorState";
import { StageBadge } from "@shared/components/StageBadge";
import { REPAIR_STATUS_HINTS } from "@shared/domain/repair-status";
import { formatDate, formatDateTime } from "@shared/format";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Can } from "@shared/session/Can";

import { fetchOrder, type RepairOrderDetail } from "./api";
import { HistoryTimeline } from "./components/HistoryTimeline";
import { StageTrack } from "./components/StageTrack";
import { StatusChangeForm } from "./components/StatusChangeForm";

/**
 * Props of {@link Detail}.
 */
interface DetailProps {
  /** Name of the value. */
  term: string;
  /** Value, or nothing when it was not recorded. */
  children: ReactNode;
}

/**
 * One term and value of the order details; empty values read "Sin registrar".
 *
 * @param props - Term and value.
 * @returns The pair.
 */
function Detail({ term, children }: DetailProps) {
  const empty: boolean = children === null || children === undefined || children === "";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-fg-subtle">{term}</dt>
      <dd className={empty ? "text-sm text-fg-faint" : "text-sm whitespace-pre-line text-fg"}>{empty ? "Sin registrar" : children}</dd>
    </div>
  );
}

/**
 * Everything about one repair order: its stage among the seven, the engine and client, what was
 * reported and done, the full history and, for roles that can, the form to move it to another stage.
 *
 * @returns The page.
 */
export function RepairOrderDetailPage() {
  const { orderId = "" } = useParams();
  const loaded = useAsync<RepairOrderDetail>(() => fetchOrder(orderId), orderId);
  const [updated, setUpdated] = useState<RepairOrderDetail | null>(null);
  const order: RepairOrderDetail | null = updated?.id === orderId ? updated : loaded.data;
  useDocumentTitle(order ? `Orden ${order.order_number}` : "Orden de reparación");

  const back = (
    <Link to="/app/ordenes" className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted no-underline hover:text-fg">
      <LuArrowLeft aria-hidden className="size-4" />
      Volver a las órdenes
    </Link>
  );

  if (loaded.error && !order) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState error={loaded.error} onRetry={loaded.error.code === "not_found" ? undefined : loaded.reload} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando la orden">
        {back}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {back}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-fg-subtle">Orden de reparación</p>
            <h1 className="font-wide text-3xl font-bold text-fg tabular">{order.order_number}</h1>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <StageBadge status={order.status} className="text-sm" />
            <p className="text-sm text-fg-muted">{REPAIR_STATUS_HINTS[order.status]}</p>
          </div>
        </header>
        <StageTrack status={order.status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <section aria-labelledby="engine-title" className="rounded-lg border border-line bg-panel p-5">
            <h2 id="engine-title" className="mb-4 font-wide text-lg font-semibold text-fg">
              Motor y cliente
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail term="Motor">
                {order.engine.manufacturer} {order.engine.model}
              </Detail>
              <Detail term="Número de serie">{order.engine.serial_number}</Detail>
              <Detail term="Cliente">{order.client.name}</Detail>
              <Detail term="Identificación del cliente">{order.client.identification_number}</Detail>
            </dl>
          </section>

          <section aria-labelledby="work-title" className="rounded-lg border border-line bg-panel p-5">
            <h2 id="work-title" className="mb-4 font-wide text-lg font-semibold text-fg">
              Trabajo
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Detail term="Falla reportada">{order.reported_issue}</Detail>
              </div>
              <div className="sm:col-span-2">
                <Detail term="Diagnóstico técnico">{order.diagnosis}</Detail>
              </div>
              <div className="sm:col-span-2">
                <Detail term="Trabajo realizado o reparación requerida">{order.work_performed}</Detail>
              </div>
              <Detail term="Técnico responsable">{order.technician_name}</Detail>
              <Detail term="Recibido">{formatDateTime(order.received_at)}</Detail>
              <Detail term="Entrega estimada">{order.estimated_delivery_date && formatDate(order.estimated_delivery_date)}</Detail>
              <Detail term="Entregado">{order.delivered_at && formatDateTime(order.delivered_at)}</Detail>
              <div className="sm:col-span-2">
                <Detail term="Observaciones">{order.observations}</Detail>
              </div>
              <Detail term="Creada">{formatDateTime(order.created_at)}</Detail>
              <Detail term="Última actualización">{formatDateTime(order.updated_at)}</Detail>
            </dl>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <Can permission="repair_orders:write">
            <section aria-labelledby="move-title" className="rounded-lg border border-line bg-panel p-5">
              <h2 id="move-title" className="mb-4 font-wide text-lg font-semibold text-fg">
                Mover a otra etapa
              </h2>
              <StatusChangeForm key={order.status} order={order} onChanged={setUpdated} />
            </section>
          </Can>

          <section aria-labelledby="history-title" className="rounded-lg border border-line bg-panel p-5">
            <h2 id="history-title" className="mb-4 font-wide text-lg font-semibold text-fg">
              Historial
            </h2>
            <HistoryTimeline entries={order.history} />
          </section>
        </div>
      </div>
    </div>
  );
}
