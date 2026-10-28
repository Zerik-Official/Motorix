import { Link } from "react-router";

import { ActiveBadge } from "@shared/components/ActiveBadge";
import { formatDate } from "@shared/format";

import type { Engine } from "../api";

/**
 * Props of {@link EnginesList}.
 */
interface EnginesListProps {
  /** Engines to list. */
  engines: Engine[];
  /** Accessible name of the list. */
  label?: string;
}

/**
 * Engines as a table on wide screens and as cards on phones. The manufacturer and model link to
 * the engine's detail in both layouts.
 *
 * @param props - Engines to list and the name of the list.
 * @returns The list.
 */
export function EnginesList({ engines, label = "Motores" }: EnginesListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-line bg-panel md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line bg-raised/50 text-left text-xs text-fg-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">Motor</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Serie</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Tipo</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Potencia</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Registrado</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {engines.map((engine) => (
              <tr key={engine.id} className="border-b border-line last:border-b-0 hover:bg-raised/40">
                <td className="px-4 py-3">
                  <Link to={`/app/motores/${engine.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">
                    {engine.manufacturer} {engine.model}
                  </Link>
                </td>
                <td className="px-4 py-3 text-fg-muted tabular">{engine.serial_number}</td>
                <td className="px-4 py-3 text-fg-muted">{engine.engine_type}</td>
                <td className="px-4 py-3 text-fg-muted">{engine.power_rating}</td>
                <td className="px-4 py-3 whitespace-nowrap text-fg-muted tabular">{formatDate(engine.registered_at)}</td>
                <td className="px-4 py-3">
                  <ActiveBadge active={engine.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label={label}>
        {engines.map((engine) => (
          <li key={engine.id} className="rounded-md border border-line bg-panel p-3">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/app/motores/${engine.id}`} className="min-w-0 font-semibold wrap-break-word text-fg underline-offset-4 hover:underline">
                {engine.manufacturer} {engine.model}
              </Link>
              <ActiveBadge active={engine.is_active} />
            </div>
            <p className="mt-1 text-sm text-fg-muted tabular">Serie {engine.serial_number}</p>
            <p className="text-sm text-fg-subtle">
              {engine.engine_type}, {engine.power_rating}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
