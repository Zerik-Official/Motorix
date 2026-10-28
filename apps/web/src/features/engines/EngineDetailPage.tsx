import { useState } from "react";
import { LuArrowLeft, LuBan, LuClipboardList, LuPencil } from "react-icons/lu";
import { Link, useParams } from "react-router";

import { Button, buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { fetchClient, type ClientOption } from "@shared/api/catalog";
import { ActiveBadge } from "@shared/components/ActiveBadge";
import { ConfirmModal } from "@shared/components/ConfirmModal";
import { DetailItem } from "@shared/components/DetailItem";
import { ErrorState } from "@shared/components/ErrorState";
import { formatIdentification } from "@shared/domain/identification";
import { useToast } from "@shared/feedback/useToast";
import { formatDate, formatDateTime } from "@shared/format";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Can } from "@shared/session/Can";
import { useSession } from "@shared/session/useSession";

import { fetchOrders, type OrderPage } from "../repair-orders/api";
import { OrdersList } from "../repair-orders/components/OrdersList";
import { deactivateEngine, fetchEngineDetail, type Engine } from "./api";
import { EngineFormModal } from "./components/EngineFormModal";

/**
 * How many of the latest orders of the engine the detail shows.
 */
const ORDER_PREVIEW_SIZE = 5;

/**
 * Props of {@link EngineOrders}.
 */
interface EngineOrdersProps {
  /** Engine whose orders are shown. */
  engine: Engine;
}

/**
 * Latest repair orders of an engine, with a link to all of them.
 *
 * @param props - Engine of the orders.
 * @returns The section.
 */
function EngineOrders({ engine }: EngineOrdersProps) {
  const orders = useAsync<OrderPage>(() => fetchOrders({ engineId: engine.id }), engine.id);
  const items = orders.data?.items.slice(0, ORDER_PREVIEW_SIZE) ?? [];

  return (
    <section aria-labelledby="engine-orders-title" aria-busy={orders.loading} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="engine-orders-title" className="font-wide text-lg font-semibold text-fg">
          Últimas órdenes
        </h2>
        {items.length > 0 && (
          <Link to={`/app/ordenes?motor=${engine.id}`} className="text-sm font-medium text-link underline-offset-4 hover:underline">
            Ver todas las órdenes del motor
          </Link>
        )}
      </div>
      {orders.error ? (
        <ErrorState error={orders.error} onRetry={orders.reload} />
      ) : !orders.data ? (
        <Skeleton className="h-28 w-full" />
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-fg-muted">
          Este motor todavía no ha pasado por el taller. Ábrele una orden desde Órdenes.
        </p>
      ) : (
        <OrdersList orders={items} />
      )}
    </section>
  );
}

/**
 * Everything about one engine: its data, its owner and its latest orders, plus editing and
 * deactivation for roles that can.
 *
 * @returns The page.
 */
export function EngineDetailPage() {
  const { engineId = "" } = useParams();
  const { can } = useSession();
  const { notify } = useToast();
  const loaded = useAsync<Engine>(() => fetchEngineDetail(engineId), engineId);
  const [updated, setUpdated] = useState<Engine | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [deactivating, setDeactivating] = useState<boolean>(false);
  const engine: Engine | null = updated?.id === engineId ? updated : loaded.data;
  const ownerId: string = engine?.client_id ?? "";
  const owner = useAsync<ClientOption | null>(() => (ownerId && can("clients:read") ? fetchClient(ownerId) : Promise.resolve(null)), ownerId);
  useDocumentTitle(engine ? `Motor ${engine.serial_number}` : "Motor");

  const back = (
    <Link to="/app/motores" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-fg-muted no-underline hover:text-fg">
      <LuArrowLeft aria-hidden className="size-4" />
      Volver a los motores
    </Link>
  );

  if (loaded.error && !engine) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState error={loaded.error} onRetry={loaded.error.code === "not_found" ? undefined : loaded.reload} />
      </div>
    );
  }

  if (!engine) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando el motor">
        {back}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  /**
   * Keeps the edited engine and confirms the change.
   *
   * @param saved - Edited engine.
   */
  const handleEdited = (saved: Engine): void => {
    setUpdated(saved);
    setEditing(false);
    notify({ tone: "success", title: "Motor actualizado", description: `Los datos del motor ${saved.serial_number} quedaron guardados.` });
  };

  /**
   * Deactivates the engine and confirms it.
   */
  const handleDeactivate = async (): Promise<void> => {
    const saved: Engine = await deactivateEngine(engine.id);
    setUpdated(saved);
    notify({ tone: "success", title: "Motor desactivado", description: `El motor ${saved.serial_number} ya no aparece al abrir órdenes.` });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {back}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-fg-subtle tabular">Serie {engine.serial_number}</p>
            <h1 className="font-wide text-2xl font-bold wrap-break-word text-fg sm:text-3xl">
              {engine.manufacturer} {engine.model}
            </h1>
            <ActiveBadge active={engine.is_active} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Can permission="repair_orders:read">
              <Link to={`/app/ordenes?motor=${engine.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                <LuClipboardList aria-hidden />
                Ver sus órdenes
              </Link>
            </Can>
            <Can permission="engines:write">
              <Button variant="outline" onClick={() => setEditing(true)} disabled={!owner.data}>
                <LuPencil aria-hidden />
                Editar
              </Button>
              {engine.is_active && (
                <Button variant="destructive" onClick={() => setDeactivating(true)}>
                  <LuBan aria-hidden />
                  Desactivar
                </Button>
              )}
            </Can>
          </div>
        </header>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="engine-data-title" className="rounded-lg border border-line bg-panel p-5">
          <h2 id="engine-data-title" className="mb-4 font-wide text-lg font-semibold text-fg">
            Datos del motor
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem term="Número de serie o código interno">{engine.serial_number}</DetailItem>
            <DetailItem term="Fabricante">{engine.manufacturer}</DetailItem>
            <DetailItem term="Modelo">{engine.model}</DetailItem>
            <DetailItem term="Tipo de motor">{engine.engine_type}</DetailItem>
            <DetailItem term="Potencia o capacidad">{engine.power_rating}</DetailItem>
            <DetailItem term="Fecha de registro">{formatDate(engine.registered_at)}</DetailItem>
            <DetailItem term="Última actualización">{formatDateTime(engine.updated_at)}</DetailItem>
          </dl>
        </section>

        <Can permission="clients:read">
          <section aria-labelledby="engine-owner-title" aria-busy={owner.loading} className="rounded-lg border border-line bg-panel p-5">
            <h2 id="engine-owner-title" className="mb-4 font-wide text-lg font-semibold text-fg">
              Dueño
            </h2>
            {owner.error ? (
              <ErrorState error={owner.error} onRetry={owner.reload} />
            ) : !owner.data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <dl className="grid gap-4">
                <DetailItem term="Cliente">
                  <Link to={`/app/clientes/${owner.data.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">
                    {owner.data.name}
                  </Link>
                </DetailItem>
                <DetailItem term="Identificación">{formatIdentification(owner.data.identification_type, owner.data.identification_number)}</DetailItem>
                <DetailItem term="Correo de contacto">{owner.data.email}</DetailItem>
                {!owner.data.is_active && <ActiveBadge active={false} className="justify-self-start" />}
              </dl>
            )}
          </section>
        </Can>
      </div>

      <Can permission="repair_orders:read">
        <EngineOrders engine={engine} />
      </Can>

      {editing && owner.data && <EngineFormModal engine={engine} owner={owner.data} onClose={() => setEditing(false)} onSaved={handleEdited} />}
      <ConfirmModal
        open={deactivating}
        onClose={() => setDeactivating(false)}
        title={`¿Desactivar el motor ${engine.serial_number}?`}
        confirmLabel="Desactivar"
        pendingLabel="Desactivando..."
        onConfirm={handleDeactivate}
      >
        <p>Dejará de aparecer al abrir órdenes y en la lista de motores activos. Sus órdenes se conservan tal como están.</p>
        <p>La aplicación no permite reactivarlo después.</p>
      </ConfirmModal>
    </div>
  );
}
