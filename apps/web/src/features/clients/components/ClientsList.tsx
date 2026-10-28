import { Link } from "react-router";

import { ActiveBadge } from "@shared/components/ActiveBadge";
import { formatIdentification } from "@shared/domain/identification";
import { formatDate } from "@shared/format";

import type { Client } from "../api";

/**
 * Props of {@link ClientsList}.
 */
interface ClientsListProps {
  /** Clients to list. */
  clients: Client[];
}

/**
 * Clients as a table on wide screens and as cards on phones. The name links to the client's
 * detail in both layouts.
 *
 * @param props - Clients to list.
 * @returns The list.
 */
export function ClientsList({ clients }: ClientsListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-line bg-panel md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Clientes</caption>
          <thead>
            <tr className="border-b border-line bg-raised/50 text-left text-xs text-fg-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Identificación</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Correo</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Registrado</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-line last:border-b-0 hover:bg-raised/40">
                <td className="px-4 py-3">
                  <Link to={`/app/clientes/${client.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted tabular">
                  {formatIdentification(client.identification_type, client.identification_number)}
                </td>
                <td className="max-w-64 truncate px-4 py-3 text-fg-muted">{client.email}</td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted tabular">{formatDate(client.created_at)}</td>
                <td className="px-4 py-3">
                  <ActiveBadge active={client.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Clientes">
        {clients.map((client) => (
          <li key={client.id} className="rounded-md border border-line bg-panel p-3">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/app/clientes/${client.id}`} className="min-w-0 font-semibold wrap-break-word text-fg underline-offset-4 hover:underline">
                {client.name}
              </Link>
              <ActiveBadge active={client.is_active} />
            </div>
            <p className="mt-1 text-sm text-fg-muted tabular">
              {formatIdentification(client.identification_type, client.identification_number)}
            </p>
            <p className="truncate text-sm text-fg-subtle">{client.email}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
