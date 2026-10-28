import { useState } from "react";
import { LuArrowLeft, LuBan, LuClipboardList, LuPencil, LuPlus } from "react-icons/lu";
import { Link, useNavigate, useParams } from "react-router";

import { Button, buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { OffsetPage } from "@shared/api/pagination";
import { ActiveBadge } from "@shared/components/ActiveBadge";
import { ConfirmModal } from "@shared/components/ConfirmModal";
import { DetailItem } from "@shared/components/DetailItem";
import { ErrorState } from "@shared/components/ErrorState";
import { ReactivateButton } from "@shared/components/ReactivateButton";
import { formatIdentification, IDENTIFICATION_LABELS, type IdentificationType } from "@shared/domain/identification";
import { useToast } from "@shared/feedback/useToast";
import { formatDate, formatDateTime } from "@shared/format";
import { useAsync } from "@shared/hooks/useAsync";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Can } from "@shared/session/Can";

import { fetchEngines, type Engine } from "../engines/api";
import { EngineFormModal } from "../engines/components/EngineFormModal";
import { EnginesList } from "../engines/components/EnginesList";
import { deactivateClient, fetchClientDetail, reactivateClient, type Client } from "./api";
import { ClientFormModal } from "./components/ClientFormModal";

/**
 * How many engines of the client the detail shows before linking to the full list.
 */
const ENGINE_PREVIEW_SIZE = 10;

/**
 * Props of {@link ClientEngines}.
 */
interface ClientEnginesProps {
  /** Client whose engines are shown. */
  client: Client;
}

/**
 * Engines owned by a client, active or not, with a link to all of them when they do not fit and,
 * for roles that can, a button to register one more for an active client.
 *
 * @param props - Owner of the engines.
 * @returns The section.
 */
function ClientEngines({ client }: ClientEnginesProps) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [registering, setRegistering] = useState<boolean>(false);
  const engines = useAsync<OffsetPage<Engine>>(() => fetchEngines({ clientId: client.id, active: "all" }, 1, ENGINE_PREVIEW_SIZE), client.id);
  const total: number = engines.data?.total ?? 0;

  /**
   * Confirms the new engine and opens its detail.
   *
   * @param engine - Registered engine.
   */
  const handleRegistered = (engine: Engine): void => {
    setRegistering(false);
    notify({ tone: "success", title: "Motor registrado", description: `${engine.manufacturer} ${engine.model} quedó a nombre de ${client.name}.` });
    navigate(`/app/motores/${engine.id}`);
  };

  return (
    <section aria-labelledby="client-engines-title" aria-busy={engines.loading} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="client-engines-title" className="font-wide text-lg font-semibold text-fg">
            Motores
          </h2>
          {engines.data && (
            <p className="text-sm text-fg-subtle">
              {total === 0 ? "Sin motores registrados." : `${total} ${total === 1 ? "motor registrado" : "motores registrados"}.`}
            </p>
          )}
        </div>
        {client.is_active && (
          <Can permission="engines:write">
            <Button variant="outline" onClick={() => setRegistering(true)}>
              <LuPlus aria-hidden />
              Registrar motor
            </Button>
          </Can>
        )}
      </div>
      {engines.error ? (
        <ErrorState error={engines.error} onRetry={engines.reload} />
      ) : !engines.data ? (
        <Skeleton className="h-28 w-full" />
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-fg-muted">
          {client.is_active ? "Este cliente todavía no tiene motores. Registra el primero para poder abrirle órdenes." : "Este cliente no tiene motores."}
        </p>
      ) : (
        <>
          <EnginesList engines={engines.data.items} label={`Motores de ${client.name}`} showOwner={false} />
          {total > ENGINE_PREVIEW_SIZE && (
            <Link to={`/app/motores?cliente=${client.id}&estado=all`} className="self-start text-sm font-medium text-link underline-offset-4 hover:underline">
              Ver los {total} motores del cliente
            </Link>
          )}
        </>
      )}
      {registering && <EngineFormModal owner={client} onClose={() => setRegistering(false)} onSaved={handleRegistered} />}
    </section>
  );
}

/**
 * Everything about one client: identification, contact, record dates, its engines and a link to
 * its orders, plus editing and deactivation for roles that can.
 *
 * @returns The page.
 */
export function ClientDetailPage() {
  const { clientId = "" } = useParams();
  const { notify } = useToast();
  const loaded = useAsync<Client>(() => fetchClientDetail(clientId), clientId);
  const [updated, setUpdated] = useState<Client | null>(null);
  const [editing, setEditing] = useState<boolean>(false);
  const [deactivating, setDeactivating] = useState<boolean>(false);
  const client: Client | null = updated?.id === clientId ? updated : loaded.data;
  useDocumentTitle(client ? client.name : "Cliente");

  const back = (
    <Link to="/app/clientes" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-fg-muted no-underline hover:text-fg">
      <LuArrowLeft aria-hidden className="size-4" />
      Volver a los clientes
    </Link>
  );

  if (loaded.error && !client) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState error={loaded.error} onRetry={loaded.error.code === "not_found" ? undefined : loaded.reload} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando el cliente">
        {back}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  /**
   * Keeps the edited client and confirms the change.
   *
   * @param saved - Edited client.
   */
  const handleEdited = (saved: Client): void => {
    setUpdated(saved);
    setEditing(false);
    notify({ tone: "success", title: "Cliente actualizado", description: `Los datos de ${saved.name} quedaron guardados.` });
  };

  /**
   * Reactivates the client and confirms it.
   */
  const handleReactivate = async (): Promise<void> => {
    const saved: Client = await reactivateClient(client);
    setUpdated(saved);
    notify({ tone: "success", title: "Cliente reactivado", description: `${saved.name} vuelve a aparecer al registrar motores.` });
  };

  /**
   * Deactivates the client and confirms it.
   */
  const handleDeactivate = async (): Promise<void> => {
    const saved: Client = await deactivateClient(client.id);
    setUpdated(saved);
    notify({ tone: "success", title: "Cliente desactivado", description: `${saved.name} ya no aparece al registrar motores.` });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {back}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-fg-subtle tabular">{formatIdentification(client.identification_type, client.identification_number)}</p>
            <h1 className="font-wide text-2xl font-bold wrap-break-word text-fg sm:text-3xl">{client.name}</h1>
            <ActiveBadge active={client.is_active} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Can permission="repair_orders:read">
              <Link to={`/app/ordenes?cliente=${client.id}`} className={buttonVariants({ variant: "outline" })}>
                <LuClipboardList aria-hidden />
                Ver sus órdenes
              </Link>
            </Can>
            <Can permission="clients:write">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <LuPencil aria-hidden />
                Editar
              </Button>
              {client.is_active ? (
                <Button variant="destructive" onClick={() => setDeactivating(true)}>
                  <LuBan aria-hidden />
                  Desactivar
                </Button>
              ) : (
                <ReactivateButton onReactivate={handleReactivate} />
              )}
            </Can>
          </div>
        </header>
      </div>

      <section aria-labelledby="client-data-title" className="rounded-lg border border-line bg-panel p-5">
        <h2 id="client-data-title" className="mb-4 font-wide text-lg font-semibold text-fg">
          Datos del cliente
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem term="Nombre o razón social">{client.name}</DetailItem>
          <DetailItem term="Tipo de documento">{IDENTIFICATION_LABELS[client.identification_type as IdentificationType] ?? client.identification_type}</DetailItem>
          <DetailItem term="Número de identificación">{client.identification_number}</DetailItem>
          <DetailItem term="Correo de contacto">
            <a href={`mailto:${client.email}`} className="text-link underline-offset-4 hover:underline">
              {client.email}
            </a>
          </DetailItem>
          <DetailItem term="Registrado">{formatDate(client.created_at)}</DetailItem>
          <DetailItem term="Última actualización">{formatDateTime(client.updated_at)}</DetailItem>
        </dl>
      </section>

      <Can permission="engines:read">
        <ClientEngines client={client} />
      </Can>

      {editing && <ClientFormModal client={client} onClose={() => setEditing(false)} onSaved={handleEdited} />}
      <ConfirmModal
        open={deactivating}
        onClose={() => setDeactivating(false)}
        title={`¿Desactivar a ${client.name}?`}
        confirmLabel="Desactivar"
        pendingLabel="Desactivando..."
        onConfirm={handleDeactivate}
      >
        <p>Dejará de aparecer al registrar motores y en la lista de clientes activos. Sus motores y sus órdenes se conservan tal como están.</p>
        <p>Puedes reactivarlo después desde esta misma página.</p>
      </ConfirmModal>
    </div>
  );
}
