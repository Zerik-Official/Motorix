import { useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import { Link, useParams } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { DetailItem } from "@shared/components/DetailItem";
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
              <DetailItem term="Motor">
                {order.engine.manufacturer} {order.engine.model}
              </DetailItem>
              <DetailItem term="Número de serie">{order.engine.serial_number}</DetailItem>
              <DetailItem term="Cliente">{order.client.name}</DetailItem>
              <DetailItem term="Identificación del cliente">{order.client.identification_number}</DetailItem>
            </dl>
          </section>

          <section aria-labelledby="work-title" className="rounded-lg border border-line bg-panel p-5">
            <h2 id="work-title" className="mb-4 font-wide text-lg font-semibold text-fg">
              Trabajo
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem term="Falla reportada" className="sm:col-span-2">{order.reported_issue}</DetailItem>
              <DetailItem term="Diagnóstico técnico" className="sm:col-span-2">{order.diagnosis}</DetailItem>
              <DetailItem term="Trabajo realizado o reparación requerida" className="sm:col-span-2">{order.work_performed}</DetailItem>
              <DetailItem term="Técnico responsable">{order.technician_name}</DetailItem>
              <DetailItem term="Recibido">{formatDateTime(order.received_at)}</DetailItem>
              <DetailItem term="Entrega estimada">{order.estimated_delivery_date && formatDate(order.estimated_delivery_date)}</DetailItem>
              <DetailItem term="Entregado">{order.delivered_at && formatDateTime(order.delivered_at)}</DetailItem>
              <DetailItem term="Observaciones" className="sm:col-span-2">{order.observations}</DetailItem>
              <DetailItem term="Creada">{formatDateTime(order.created_at)}</DetailItem>
              <DetailItem term="Última actualización">{formatDateTime(order.updated_at)}</DetailItem>
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
